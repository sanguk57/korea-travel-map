// 장소 정렬. TourAPI·카카오 로컬은 리뷰·평점·조회수를 주지 않으므로
// 받을 수 있는 정보(사진, 연락처, 등록일, 수정일, 카카오 검색 순위, 좌표)로만 정렬한다.

export const SORTS = [
  { key: 'recommended', label: '추천순', hint: '사진·연락처가 있고 오래 소개된 대표 장소, 카카오 검색 상위 순' },
  { key: 'newest', label: '신규 등록순', hint: '관광공사에 최근 등록된 순' },
  { key: 'updated', label: '최근 업데이트순', hint: '정보가 최근에 수정된 순' },
  { key: 'time', label: '도착 시간순', hint: '현재 위치에서 실제 경로로 빨리 도착하는 순' },
  { key: 'distance', label: '내 주변순', hint: '현재 위치에서 가까운 순(직선 거리)' },
  { key: 'name', label: '이름순', hint: '가나다 순' },
  { key: 'blog', label: '블로그 언급순', hint: '네이버 블로그에 많이 언급된 순 (수집된 곳만)', needs: 'naver' },
];

const TODAY = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '');
export const isOngoing = (p, today = TODAY()) => p.start <= today && today <= p.end;

function recommendScore(p) {
  if (p.source === 'kakao') return 100 - (p.rank ?? 99); // 카카오 정확도 순위
  if (p.start) {
    // 축제: 진행 중 → 곧 시작하는 순
    const today = TODAY();
    return isOngoing(p, today) ? 1e9 - Number(p.end) : -Number(p.start);
  }
  let score = 0;
  if (p.image) score += 3;
  if (p.tel) score += 1;
  // 관광공사에 일찍 등록된 곳일수록 지역 대표 관광지인 경우가 많다
  if (p.created) score += Math.max(0, 2026 - Number(p.created.slice(0, 4))) / 10;
  return score;
}

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// 날짜가 없는 항목(카카오 등)은 뒤로 보낸다
const byDateDesc = (field) => (a, b) => (b[field] ?? '').localeCompare(a[field] ?? '');

// 도착 시간순 정렬 때 실제 경로를 조회할 후보 수 (직선 거리 기준 가까운 곳부터)
export const TIME_CANDIDATES = 15;

export const nearest = (items, origin, n) =>
  [...items].sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b)).slice(0, n);

/** etaOf(place) -> 분 | undefined. 시간을 아는 곳을 먼저, 나머지는 직선 거리순 */
export function sortPlaces(items, sort, origin, etaOf) {
  const list = [...items];
  switch (sort) {
    case 'time': {
      if (!origin) return list;
      const eta = (p) => etaOf?.(p) ?? Infinity;
      return list.sort((a, b) => eta(a) - eta(b) || distanceKm(origin, a) - distanceKm(origin, b));
    }
    case 'newest':
      return list.sort(byDateDesc('created'));
    case 'updated':
      return list.sort(byDateDesc('modified'));
    case 'distance':
      return origin ? list.sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b)) : list;
    case 'blog':
      return list.sort((a, b) => (b.blog ?? -1) - (a.blog ?? -1));
    case 'name':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    default:
      return list.sort((a, b) => recommendScore(b) - recommendScore(a));
  }
}
