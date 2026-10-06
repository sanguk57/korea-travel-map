// 공식 코스가 없어도 볼 수 있게 지역 데이터로 하루 코스를 자동으로 만든다.
// 인기 관광지 3곳(가장 인기 있는 곳 주변으로 묶음) + 근처 맛집 1곳 + 진행 중인 축제가 가까우면 1곳.
import { optimizeOrder } from './course.js';
import { distanceKm, isOngoing, sortPlaces } from './sort.js';

const NEAR_KM = 20; // 하루에 돌기 적당한 반경

const toStop = (p) => ({ id: p.id, title: p.title, lat: p.lat, lng: p.lng, image: p.image });

function pickNear(items, center, n, maxKm = NEAR_KM) {
  const near = items.filter((p) => distanceKm(center, p) <= maxKm);
  const pool = near.length >= n ? near : items;
  return pool.slice(0, n);
}

export function autoCourse(region, data) {
  if (!region || !data) return null;
  const attractions = sortPlaces(data.attractions.filter((p) => p.image), 'recommended').slice(0, 15);
  if (attractions.length < 2) return null;

  const anchor = attractions[0];
  // 인기순을 유지하되 기준 관광지에서 가까운 곳만 고른다
  const picked = [anchor, ...pickNear(attractions.slice(1), anchor, 2)];
  const center = {
    lat: picked.reduce((s, p) => s + p.lat, 0) / picked.length,
    lng: picked.reduce((s, p) => s + p.lng, 0) / picked.length,
  };

  // 맛집: 카카오 검색 상위 → 관광공사 음식점 순으로, 코스 중심에서 가까운 곳
  const eateries = [
    ...sortPlaces(data.restaurants, 'recommended').slice(0, 20),
    ...sortPlaces(data.tourRestaurants.filter((p) => p.image), 'recommended').slice(0, 20),
  ];
  const meal = eateries.sort((a, b) => distanceKm(center, a) - distanceKm(center, b))[0];

  const festival = (data.festivals ?? []).filter((f) => isOngoing(f) && distanceKm(center, f) <= NEAR_KM)[0];

  const stops = optimizeOrder([...picked, meal, festival].filter(Boolean).map(toStop));
  let km = 0;
  for (let i = 1; i < stops.length; i++) km += distanceKm(stops[i - 1], stops[i]);

  return {
    id: `auto-${region.code}`,
    source: 'auto',
    title: `${region.name} 하루 추천 코스`,
    subtitle: [
      `인기 관광지 ${picked.length}곳`,
      meal && '근처 맛집',
      festival && '진행 중 축제',
    ]
      .filter(Boolean)
      .join(' + '),
    image: anchor.image,
    stops,
    total: stops.length,
    km: Math.round(km * 10) / 10,
  };
}
