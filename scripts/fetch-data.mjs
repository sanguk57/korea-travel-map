// TourAPI(관광지·숙소·음식점)와 카카오 로컬 API(맛집)를 호출해
// 시·군·구별 JSON(public/data/places/{code}.json)을 만든다.
// API 키는 환경변수로만 받으며, 브라우저로 나가는 결과물에는 포함되지 않는다.
//
//   TOUR_API_KEY    공공데이터포털 TourAPI 서비스키(디코딩 키)
//   KAKAO_REST_KEY  카카오 REST API 키
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';

const ROOT = new URL('../public/data/', import.meta.url);
const OUT_DIR = new URL('places/', ROOT);

const TOUR_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const TOUR_TYPES = { attractions: 12, stays: 32, tourRestaurants: 39 };
const TOUR_PAGE_SIZE = 1000;

const KAKAO_URL = 'https://dapi.kakao.com/v2/local/search/category.json';
const KAKAO_GRID = 2;          // 지역 bbox를 2x2로 나눠 검색 (쿼리당 최대 45건 제한 보완)
const KAKAO_MAX_PER_REGION = 60;
const KAKAO_CONCURRENCY = 5;

// 공공데이터포털은 인코딩/디코딩 키를 함께 주므로 어느 쪽을 넣어도 동작하게 한다.
const rawTourKey = process.env.TOUR_API_KEY?.trim();
const TOUR_KEY = rawTourKey?.includes('%') ? decodeURIComponent(rawTourKey) : rawTourKey;
const KAKAO_KEY = process.env.KAKAO_REST_KEY?.trim();

const regions = JSON.parse(await readFile(new URL('regions.json', ROOT), 'utf8'));

// ---------- 지역 판정 ----------

function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRegion(lng, lat, region) {
  const [minLng, minLat, maxLng, maxLat] = region.bbox;
  if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
  return region.polygons.some(([outer, ...holes]) => inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h)));
}

const findRegion = (lng, lat) => regions.find((r) => inRegion(lng, lat, r));

// ---------- TourAPI ----------

const https = (url) => (url ? url.replace(/^http:\/\//, 'https://') : undefined);
const kakaoMapLink = (title, lat, lng) => `https://map.kakao.com/link/map/${encodeURIComponent(title)},${lat},${lng}`;

async function tourPage(contentTypeId, pageNo) {
  const params = new URLSearchParams({
    serviceKey: TOUR_KEY,
    MobileOS: 'ETC',
    MobileApp: 'KoreaTravelMap',
    _type: 'json',
    arrange: 'Q', // 수정일순(이미지 있는 항목 우선)
    contentTypeId: String(contentTypeId),
    numOfRows: String(TOUR_PAGE_SIZE),
    pageNo: String(pageNo),
  });
  const res = await fetch(`${TOUR_BASE}/areaBasedList2?${params}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // 키 오류 등은 _type=json이어도 XML로 온다
    throw new Error(`TourAPI 응답 오류 (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const gwError = json.OpenAPI_ServiceResponse?.cmmMsgHeader; // 공공데이터포털 게이트웨이 오류(키 미등록 등)
  if (gwError) throw new Error(`TourAPI 인증 오류: ${gwError.returnAuthMsg} (${gwError.errMsg})`);
  const header = json.response?.header;
  if (header?.resultCode !== '0000') throw new Error(`TourAPI 오류: ${header?.resultCode} ${header?.resultMsg}`);
  const body = json.response.body;
  const item = body.items?.item ?? [];
  return { items: Array.isArray(item) ? item : [item], totalCount: body.totalCount };
}

async function fetchTourType(contentTypeId) {
  const all = [];
  for (let page = 1; ; page++) {
    const { items, totalCount } = await tourPage(contentTypeId, page);
    all.push(...items);
    if (items.length === 0 || all.length >= totalCount) break;
  }
  return all;
}

function normalizeTour(it) {
  const lng = Number(it.mapx);
  const lat = Number(it.mapy);
  if (!lng || !lat) return null;
  return {
    id: `tour-${it.contentid}`,
    source: 'tour',
    title: it.title,
    addr: [it.addr1, it.addr2].filter(Boolean).join(' '),
    tel: it.tel || undefined,
    lat,
    lng,
    image: https(it.firstimage2 || it.firstimage),
    modified: it.modifiedtime?.slice(0, 8),
    url: kakaoMapLink(it.title, lat, lng),
  };
}

// ---------- 카카오 로컬 ----------

async function kakaoCategory(rect, page) {
  const params = new URLSearchParams({
    category_group_code: 'FD6', // 음식점
    rect: rect.join(','),
    page: String(page),
    size: '15',
    sort: 'accuracy',
  });
  const res = await fetch(`${KAKAO_URL}?${params}`, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } });
  if (!res.ok) throw new Error(`카카오 로컬 API 오류 (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function fetchKakaoRestaurants(region) {
  const [minLng, minLat, maxLng, maxLat] = region.bbox;
  const dLng = (maxLng - minLng) / KAKAO_GRID;
  const dLat = (maxLat - minLat) / KAKAO_GRID;
  const found = new Map();

  for (let i = 0; i < KAKAO_GRID; i++) {
    for (let j = 0; j < KAKAO_GRID; j++) {
      const rect = [minLng + i * dLng, minLat + j * dLat, minLng + (i + 1) * dLng, minLat + (j + 1) * dLat];
      for (let page = 1; page <= 3; page++) {
        const { documents, meta } = await kakaoCategory(rect, page);
        for (const d of documents) {
          const lng = Number(d.x);
          const lat = Number(d.y);
          if (found.has(d.id) || !inRegion(lng, lat, region)) continue;
          found.set(d.id, {
            id: `kakao-${d.id}`,
            source: 'kakao',
            title: d.place_name,
            category: d.category_name?.split(' > ').slice(1).join(' > ') || undefined,
            addr: d.road_address_name || d.address_name,
            tel: d.phone || undefined,
            lat,
            lng,
            url: d.place_url,
          });
        }
        if (meta.is_end) break;
      }
    }
  }
  return [...found.values()].slice(0, KAKAO_MAX_PER_REGION);
}

async function mapLimit(list, limit, fn) {
  const results = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      results[i] = await fn(list[i], i);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// ---------- 실행 ----------

const byRegion = new Map(
  regions.map((r) => [r.code, { attractions: [], stays: [], restaurants: [], tourRestaurants: [] }]),
);
const sources = { tour: false, kakao: false };
let failed = false;

if (TOUR_KEY) {
  for (const [field, typeId] of Object.entries(TOUR_TYPES)) {
    try {
      const raw = await fetchTourType(typeId);
      let placed = 0;
      for (const it of raw) {
        const place = normalizeTour(it);
        const region = place && findRegion(place.lng, place.lat);
        if (!region) continue;
        byRegion.get(region.code)[field].push(place);
        placed++;
      }
      console.log(`TourAPI ${field}: ${raw.length}건 수신, ${placed}건 지역 배정`);
      sources.tour = true;
    } catch (e) {
      console.error(e.message);
      failed = true;
    }
  }
} else {
  console.warn('TOUR_API_KEY가 없어 TourAPI 데이터를 건너뜁니다.');
}

if (KAKAO_KEY) {
  let errors = 0;
  let total = 0;
  await mapLimit(regions, KAKAO_CONCURRENCY, async (region) => {
    try {
      const list = await fetchKakaoRestaurants(region);
      byRegion.get(region.code).restaurants = list;
      total += list.length;
    } catch (e) {
      if (errors++ === 0) console.error(e.message);
    }
  });
  console.log(`카카오 맛집: ${total}건 (실패 지역 ${errors}곳)`);
  sources.kakao = errors < regions.length;
  if (!sources.kakao) failed = true;
} else {
  console.warn('KAKAO_REST_KEY가 없어 카카오 맛집 데이터를 건너뜁니다.');
}

const updatedAt = new Date().toISOString();
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });
for (const region of regions) {
  const data = byRegion.get(region.code);
  await writeFile(new URL(`${region.code}.json`, OUT_DIR), JSON.stringify({ code: region.code, updatedAt, ...data }));
}
await writeFile(new URL('_meta.json', OUT_DIR), JSON.stringify({ updatedAt, sources }));
console.log(`완료: ${regions.length}개 지역 파일 작성`);

if (failed) process.exit(1);
