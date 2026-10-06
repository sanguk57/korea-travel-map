// fetch-data.mjs가 만든 장소 데이터에 부가 정보를 조금씩 쌓아 붙인다.
//   1) 장소 상세 (TourAPI detailCommon2·detailIntro2·detailImage2) → public/data/details/{contentid}.json
//   2) 네이버 블로그 언급 수 (네이버 검색 API)                     → 장소의 blog 필드
//
// 두 API 모두 일일 호출 한도가 있어 한 번에 전부 받을 수 없다. 추천순 상위 장소부터
// 하루 한도 안에서 받아 .cache/enrich/state.json에 기록하고, 다음 실행 때 이어서 받는다.
// (GitHub Actions에서는 actions/cache로 .cache/enrich와 public/data/details를 보존한다)
//
//   TOUR_API_KEY         공공데이터포털 TourAPI 서비스키
//   NAVER_CLIENT_ID      (선택) 네이버 개발자센터 애플리케이션 Client ID
//   NAVER_CLIENT_SECRET  (선택) 〃 Client Secret
//   DETAIL_DAILY_PLACES  (선택) 하루에 상세를 받을 장소 수, 기본 300 (장소당 TourAPI 3회)
//   NAVER_DAILY_CALLS    (선택) 하루 네이버 검색 호출 수, 기본 20000 (한도 25,000)
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { sortPlaces } from '../src/sort.js';

const ROOT = new URL('../', import.meta.url);
const PLACES_DIR = new URL('public/data/places/', ROOT);
const DETAILS_DIR = new URL('public/data/details/', ROOT);
const STATE_DIR = new URL('.cache/enrich/', ROOT);
const STATE_FILE = new URL('state.json', STATE_DIR);

const rawTourKey = process.env.TOUR_API_KEY?.trim();
const TOUR_KEY = rawTourKey?.includes('%') ? decodeURIComponent(rawTourKey) : rawTourKey;
const NAVER_ID = process.env.NAVER_CLIENT_ID?.trim();
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET?.trim();
const DETAIL_DAILY_PLACES = Number(process.env.DETAIL_DAILY_PLACES) || 300;
const NAVER_DAILY_CALLS = Number(process.env.NAVER_DAILY_CALLS) || 20000;

const DETAIL_MAX_AGE_DAYS = 60;
const FESTIVAL_DETAIL_MAX_AGE_DAYS = 7;
const BLOG_MAX_AGE_DAYS = 14;
const NAVER_CONCURRENCY = 5;
const TOUR_CONCURRENCY = 3;

const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const ageDays = (iso) => (iso ? (Date.now() - Date.parse(iso)) / 86400e3 : Infinity);

// 목록 이름 → TourAPI 콘텐츠 타입
const TOUR_LISTS = { festivals: '15', attractions: '12', tourRestaurants: '39', stays: '32' };

// ---------- 상태 ----------

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

const state = await loadState();
state.blog ??= {}; // placeId -> { n, at }
state.details ??= {}; // contentId -> at
if (state.quota?.date !== TODAY) state.quota = { date: TODAY, detailPlaces: 0, naver: 0 };

const files = (await readdir(PLACES_DIR)).filter((f) => /^\d+\.json$/.test(f));
const regions = JSON.parse(await readFile(new URL('public/data/regions.json', ROOT), 'utf8'));
const regionName = new Map(regions.map((r) => [r.code, r.name]));
const regionData = new Map();
for (const f of files) regionData.set(f.slice(0, -5), JSON.parse(await readFile(new URL(f, PLACES_DIR), 'utf8')));

// 우선순위 큐: "모든 지역의 1위 → 모든 지역의 2위 → …" 순서로 뽑아 하루치가 전국에 고루 퍼지게 한다.
// 같은 순위 안에서는 lists 순서(앞이 우선)를 따른다.
function priorityQueue(lists, pick) {
  const columns = []; // 목록 순서대로, 그 안에서 지역 순서대로
  for (const list of lists) {
    for (const [code, data] of regionData) {
      if (data[list]?.length) columns.push(sortPlaces(data[list], 'recommended').map((p) => [p, list, code]));
    }
  }
  const out = [];
  for (let i = 0; columns.some((c) => i < c.length); i++) {
    for (const c of columns) {
      if (i >= c.length) continue;
      const item = pick(...c[i]);
      if (item) out.push(item);
    }
  }
  return out;
}

async function mapLimit(list, limit, fn) {
  let next = 0;
  let stop = false;
  const worker = async () => {
    while (!stop && next < list.length) {
      const item = list[next++];
      if ((await fn(item)) === false) stop = true;
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
}

// ---------- 1) 장소 상세 ----------

const TOUR_BASE = 'https://apis.data.go.kr/B551011/KorService2';

class QuotaError extends Error {}

async function tour(op, params) {
  const qs = new URLSearchParams({ serviceKey: TOUR_KEY, MobileOS: 'ETC', MobileApp: 'KoreaTravelMap', _type: 'json', ...params });
  const res = await fetch(`${TOUR_BASE}/${op}?${qs}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/.test(text)) throw new QuotaError(`TourAPI 일일 한도 초과 (${op})`);
    throw new Error(`TourAPI ${op} 응답 오류: ${text.slice(0, 200)}`);
  }
  const gw = json.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (gw) {
    if (gw.returnReasonCode === '22') throw new QuotaError(`TourAPI 일일 한도 초과 (${op})`);
    throw new Error(`TourAPI ${op} 인증 오류: ${gw.returnAuthMsg}`);
  }
  const item = json.response?.body?.items?.item;
  return Array.isArray(item) ? item : item ? [item] : [];
}

// TourAPI 텍스트에는 <br>, <a> 같은 HTML이 섞여 있다
function clean(html) {
  if (!html) return undefined;
  const text = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || undefined;
}

function firstUrl(html) {
  if (!html) return undefined;
  const href = /href=["']([^"']+)["']/i.exec(html)?.[1] ?? /(https?:\/\/[^\s"'<>]+)/i.exec(html)?.[1];
  if (href) return href.replace(/^http:\/\//, 'https://');
  const bare = /\bwww\.[^\s"'<>]+/i.exec(html)?.[0];
  return bare ? `https://${bare}` : undefined;
}

const INTRO_FIELDS = {
  12: [['usetime', '이용 시간'], ['restdate', '쉬는 날'], ['useseason', '이용 시기'], ['parking', '주차'], ['infocenter', '문의'], ['expguide', '체험 안내'], ['chkbabycarriage', '유모차'], ['chkpet', '반려동물']],
  32: [['checkintime', '체크인'], ['checkouttime', '체크아웃'], ['roomcount', '객실 수'], ['subfacility', '부대시설'], ['parkinglodging', '주차'], ['reservationlodging', '예약'], ['infocenterlodging', '문의']],
  39: [['firstmenu', '대표 메뉴'], ['treatmenu', '취급 메뉴'], ['opentimefood', '영업 시간'], ['restdatefood', '쉬는 날'], ['packing', '포장'], ['parkingfood', '주차'], ['infocenterfood', '문의']],
  15: [['eventplace', '장소'], ['playtime', '공연 시간'], ['usetimefestival', '이용 요금'], ['agelimit', '관람 연령'], ['program', '프로그램'], ['sponsor1', '주최'], ['sponsor1tel', '주최 연락처']],
};

async function fetchDetail(contentId, typeId) {
  const [common] = await tour('detailCommon2', { contentId });
  const [intro] = await tour('detailIntro2', { contentId, contentTypeId: typeId });
  const images = await tour('detailImage2', { contentId, imageYN: 'Y', numOfRows: '10', pageNo: '1' });
  const info = (INTRO_FIELDS[typeId] ?? []).map(([k, label]) => [label, clean(intro?.[k])]).filter(([, v]) => v && v !== '0');
  return {
    overview: clean(common?.overview),
    homepage: firstUrl(common?.homepage) ?? firstUrl(intro?.eventhomepage),
    info,
    images: images.map((i) => i.originimgurl?.replace(/^http:\/\//, 'https://')).filter(Boolean),
    at: new Date().toISOString(),
  };
}

async function enrichDetails() {
  if (!TOUR_KEY) return console.warn('TOUR_API_KEY가 없어 장소 상세 수집을 건너뜁니다.');
  const budget = DETAIL_DAILY_PLACES - state.quota.detailPlaces;
  if (budget <= 0) return console.log(`장소 상세: 오늘 한도(${DETAIL_DAILY_PLACES}곳) 소진`);

  const seen = new Set();
  const queue = priorityQueue(Object.keys(TOUR_LISTS), (p, list) => {
    const id = p.id.replace(/^tour-/, '');
    if (p.source !== 'tour' || seen.has(id)) return null;
    seen.add(id);
    const maxAge = list === 'festivals' ? FESTIVAL_DETAIL_MAX_AGE_DAYS : DETAIL_MAX_AGE_DAYS;
    return ageDays(state.details[id]) > maxAge ? { id, type: TOUR_LISTS[list] } : null;
  }).slice(0, budget);

  await mkdir(DETAILS_DIR, { recursive: true });
  let done = 0;
  let error;
  await mapLimit(queue, TOUR_CONCURRENCY, async ({ id, type }) => {
    try {
      const detail = await fetchDetail(id, type);
      await writeFile(new URL(`${id}.json`, DETAILS_DIR), JSON.stringify(detail));
      state.details[id] = detail.at;
      state.quota.detailPlaces++;
      done++;
    } catch (e) {
      error ??= e.message;
      if (e instanceof QuotaError) return false;
    }
  });
  const total = Object.keys(state.details).length;
  console.log(`장소 상세: 이번 실행 ${done}곳, 누적 ${total}곳${error ? ` (오류: ${error})` : ''}`);
}

// ---------- 2) 네이버 블로그 언급 수 ----------

// "서귀포시" → "서귀포", "해운대구"는 그대로 (구 이름만으로는 흔한 경우가 많아 붙여 둔다)
const shortRegion = (name) => (/[시군]$/.test(name) && name.length > 2 ? name.slice(0, -1) : name);

async function naverBlogTotal(query) {
  const res = await fetch(`https://openapi.naver.com/v1/search/blog.json?${new URLSearchParams({ query, display: '1' })}`, {
    headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET },
  });
  if (res.status === 401 || res.status === 403) throw new QuotaError(`네이버 인증 오류 (HTTP ${res.status}) — Client ID/Secret과 검색 API 사용 설정을 확인하세요`);
  if (res.status === 429) throw new QuotaError('네이버 호출 한도 초과');
  if (!res.ok) throw new Error(`네이버 검색 오류 (HTTP ${res.status})`);
  return (await res.json()).total;
}

async function enrichBlog() {
  if (!NAVER_ID || !NAVER_SECRET) return console.warn('NAVER_CLIENT_ID/SECRET이 없어 블로그 언급 수 수집을 건너뜁니다.');
  const budget = NAVER_DAILY_CALLS - state.quota.naver;
  if (budget <= 0) return console.log(`블로그 언급: 오늘 한도(${NAVER_DAILY_CALLS}회) 소진`);

  const lists = ['festivals', 'attractions', 'restaurants', 'tourRestaurants', 'stays'];
  const queue = priorityQueue(lists, (p, _list, code) =>
    ageDays(state.blog[p.id]?.at) > BLOG_MAX_AGE_DAYS ? { id: p.id, query: `${shortRegion(regionName.get(code) ?? '')} ${p.title}`.trim() } : null,
  ).slice(0, budget);

  let done = 0;
  let error;
  await mapLimit(queue, NAVER_CONCURRENCY, async ({ id, query }) => {
    try {
      const n = await naverBlogTotal(query);
      state.blog[id] = { n, at: new Date().toISOString() };
      state.quota.naver++;
      done++;
      await new Promise((r) => setTimeout(r, 120)); // 초당 호출 제한 여유
    } catch (e) {
      error ??= e.message;
      if (e instanceof QuotaError) return false;
    }
  });
  console.log(`블로그 언급: 이번 실행 ${done}곳, 누적 ${Object.keys(state.blog).length}곳${error ? ` (오류: ${error})` : ''}`);
}

// ---------- 실행 ----------

await enrichDetails();
await enrichBlog();

await mkdir(STATE_DIR, { recursive: true });
await writeFile(STATE_FILE, JSON.stringify(state));

// 장소 데이터에 결과를 붙인다 (매번 다시 붙여도 결과가 같다)
for (const [code, data] of regionData) {
  for (const list of ['attractions', 'stays', 'restaurants', 'tourRestaurants', 'festivals']) {
    for (const p of data[list] ?? []) {
      const blog = state.blog[p.id]?.n;
      if (blog != null) p.blog = blog;
      if (p.source === 'tour' && state.details[p.id.replace(/^tour-/, '')]) p.detail = true;
    }
  }
  await writeFile(new URL(`${code}.json`, PLACES_DIR), JSON.stringify(data));
}

const metaFile = new URL('_meta.json', PLACES_DIR);
const meta = JSON.parse(await readFile(metaFile, 'utf8').catch(() => '{}'));
meta.sources = {
  ...meta.sources,
  naver: Object.keys(state.blog).length > 0,
  details: Object.keys(state.details).length,
};
await writeFile(metaFile, JSON.stringify(meta));
console.log('부가 정보 반영 완료');
