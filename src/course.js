// 찜한 장소로 하루 코스 만들기: 방문 순서 최적화와 구간별 경로.
import { RouteError, getRoute, modeAvailable } from './routing.js';
import { distanceKm } from './sort.js';

/**
 * 직선 거리 기준으로 총 이동 거리가 짧은 방문 순서를 찾는다.
 * 가까운 곳부터 고르는 탐욕법으로 시작해 2-opt로 교차 구간을 풀어준다 (장소 수십 곳까지 즉시 계산).
 * start가 있으면 그 지점에서 출발하는 것으로 계산한다 (돌아오지 않는 편도 코스).
 */
export function optimizeOrder(stops, start) {
  if (stops.length < 3 && !start) return [...stops];

  const remaining = [...stops];
  const order = [];
  let cur = start ?? remaining.shift();
  if (!start) order.push(cur);
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (distanceKm(cur, remaining[i]) < distanceKm(cur, remaining[best])) best = i;
    }
    cur = remaining.splice(best, 1)[0];
    order.push(cur);
  }

  // 2-opt: 구간 [i..j]를 뒤집어 짧아지면 채택
  const pts = start ? [start, ...order] : order;
  const fixed = start ? 1 : 0;
  const d = (a, b) => distanceKm(pts[a], pts[b]);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = Math.max(1, fixed); i < pts.length - 1; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const before = d(i - 1, i) + (j + 1 < pts.length ? d(j, j + 1) : 0);
        const after = d(i - 1, j) + (j + 1 < pts.length ? d(i, j + 1) : 0);
        if (after < before - 1e-9) {
          pts.splice(i, j - i + 1, ...pts.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return start ? pts.slice(1) : pts;
}

/**
 * 구간 하나의 경로. 대중교통이 너무 가깝거나 경로가 없으면 도보로 대신한다.
 * @returns {Promise<{ mode: string, route?: object, error?: string }>}
 */
export async function legRoute(mode, from, to) {
  try {
    return { mode, route: await getRoute(mode, from, to) };
  } catch (e) {
    if (mode === 'transit' && e instanceof RouteError && modeAvailable('walk')) {
      try {
        return { mode: 'walk', route: await getRoute('walk', from, to), note: e.message };
      } catch {
        // 아래에서 원래 오류를 돌려준다
      }
    }
    return { mode, error: e.message };
  }
}
