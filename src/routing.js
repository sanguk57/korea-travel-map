// 내 위치 → 장소 이동 시간과 경로.
//   자동차·도보: TMAP (SK open API)   VITE_TMAP_APP_KEY
//   대중교통:     ODsay LAB           VITE_ODSAY_API_KEY
// 두 키 모두 브라우저에 노출된다. ODsay는 Web 키 URI 제한, TMAP은 무료 요금제로 피해를 막는다.
// 발급·보안 안내: docs/route-api-keys.md
import { distanceKm } from './sort.js';

const TMAP_KEY = import.meta.env.VITE_TMAP_APP_KEY;
const ODSAY_KEY = import.meta.env.VITE_ODSAY_API_KEY;

export const MODES = [
  { key: 'car', label: '자동차', icon: '🚗', color: '#2563eb' },
  { key: 'transit', label: '대중교통', icon: '🚌', color: '#16a34a' },
  { key: 'walk', label: '도보', icon: '🚶', color: '#7c3aed' },
];

export const modeAvailable = (mode) => Boolean(mode === 'transit' ? ODSAY_KEY : TMAP_KEY);

const WALK_MAX_KM = 25; // 이보다 먼 곳은 도보 경로를 요청하지 않는다

export class RouteError extends Error {}

const cache = new Map(); // key -> Promise<Route>

const keyOf = (mode, from, to) => `${mode}:${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;

/**
 * @returns {Promise<{ minutes: number, meters?: number, summary?: string, paths: Array<{ coords: [number, number][], color: string, dashed?: boolean }> }>}
 *   coords는 [lat, lng] 배열. 실패하면 RouteError를 던진다.
 */
export function getRoute(mode, from, to) {
  const key = keyOf(mode, from, to);
  if (!cache.has(key)) {
    const p = (mode === 'transit' ? transitRoute : tmapRoute)(mode, from, to);
    cache.set(key, p);
    p.catch(() => cache.delete(key)); // 실패는 캐시하지 않는다
  }
  return cache.get(key);
}

// ---------- TMAP (자동차·도보) ----------

async function tmapRoute(mode, from, to) {
  if (!TMAP_KEY) throw new RouteError('TMAP 키가 설정되지 않았습니다');
  if (mode === 'walk' && distanceKm(from, to) > WALK_MAX_KM) throw new RouteError('도보로 가기엔 너무 멀어요');

  const url =
    mode === 'walk'
      ? 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json'
      : 'https://apis.openapi.sk.com/tmap/routes?version=1&format=json';
  const body = {
    startX: from.lng,
    startY: from.lat,
    endX: to.lng,
    endY: to.lat,
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    ...(mode === 'walk' ? { startName: encodeURIComponent('내 위치'), endName: encodeURIComponent('도착지') } : { searchOption: '0' }),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { appKey: TMAP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.features?.length) {
    throw new RouteError(json?.error?.message || `경로를 찾지 못했습니다 (${res.status})`);
  }

  const props = json.features[0].properties;
  const coords = [];
  for (const f of json.features) {
    if (f.geometry.type !== 'LineString') continue;
    for (const [lng, lat] of f.geometry.coordinates) coords.push([lat, lng]);
  }
  const color = MODES.find((m) => m.key === mode).color;
  return {
    minutes: Math.max(1, Math.round(props.totalTime / 60)),
    meters: props.totalDistance,
    paths: [{ coords, color, dashed: mode === 'walk' }],
  };
}

// ---------- ODsay (대중교통) ----------

const ODSAY_BASE = 'https://api.odsay.com/v1/api';

async function odsay(path, params) {
  const qs = new URLSearchParams({ ...params, apiKey: ODSAY_KEY });
  const res = await fetch(`${ODSAY_BASE}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) {
    const e = Array.isArray(json.error) ? json.error[0] : json.error;
    const code = String(e.code);
    if (code === '-98') throw new RouteError('가까워서 걸어가는 게 빨라요');
    if (code === '-99') throw new RouteError('대중교통 경로가 없습니다');
    throw new RouteError(e.message || e.msg || '대중교통 경로를 찾지 못했습니다');
  }
  return json.result;
}

const SUBWAY_COLOR = '#0ea5e9';
const BUS_COLOR = '#16a34a';

async function transitRoute(_mode, from, to) {
  if (!ODSAY_KEY) throw new RouteError('ODsay 키가 설정되지 않았습니다');
  const result = await odsay('searchPubTransPathT', { SX: from.lng, SY: from.lat, EX: to.lng, EY: to.lat });
  const best = result?.path?.[0];
  if (!best) throw new RouteError('대중교통 경로가 없습니다');

  const legs = (best.subPath ?? []).filter((s) => s.trafficType !== 3);
  const summary = legs
    .map((s) => {
      const lane = s.lane?.[0];
      if (s.trafficType === 1) return lane?.name ?? '지하철';
      if (s.trafficType === 2) return `${lane?.busNo ?? ''}번 버스`.trim();
      return lane?.name ?? s.startName ?? '';
    })
    .filter(Boolean)
    .join(' → ');

  return {
    minutes: best.info.totalTime,
    meters: best.info.totalDistance,
    summary: summary || undefined,
    paths: await transitPaths(best, from, to),
  };
}

// 노선 모양은 loadLane으로 받는다. 실패하면 정류장끼리 직선으로 잇는다.
async function transitPaths(path, from, to) {
  const paths = [];
  try {
    const lane = await odsay('loadLane', { mapObject: `0:0@${path.info.mapObj}` });
    for (const l of lane?.lane ?? []) {
      const color = l.class === 2 ? SUBWAY_COLOR : BUS_COLOR;
      for (const sec of l.section ?? []) {
        paths.push({ coords: sec.graphPos.map((g) => [g.y, g.x]), color });
      }
    }
  } catch {
    // 아래 직선 대체
  }
  if (paths.length === 0) {
    const coords = [[from.lat, from.lng]];
    for (const s of path.subPath ?? []) {
      if (s.startY) coords.push([Number(s.startY), Number(s.startX)]);
      if (s.endY) coords.push([Number(s.endY), Number(s.endX)]);
    }
    coords.push([to.lat, to.lng]);
    paths.push({ coords, color: BUS_COLOR });
  }

  // 출발지·도착지와 첫/마지막 정류장 사이 도보 구간
  const legs = (path.subPath ?? []).filter((s) => s.trafficType !== 3 && s.startY);
  if (legs.length) {
    const first = legs[0];
    const last = legs[legs.length - 1];
    paths.push({ coords: [[from.lat, from.lng], [Number(first.startY), Number(first.startX)]], color: '#64748b', dashed: true });
    paths.push({ coords: [[Number(last.endY), Number(last.endX)], [to.lat, to.lng]], color: '#64748b', dashed: true });
  }
  return paths;
}

export const formatMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60 ? `${m % 60}분` : ''}`.trim() : `${m}분`);
