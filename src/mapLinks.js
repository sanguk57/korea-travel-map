// 외부 지도 앱(카카오맵·네이버지도) 길찾기 링크. from이 없으면 도착지만 넘긴다.
// from/to: { lat, lng, title? }, mode: car | transit | walk

const KAKAO_MODE = { car: 'car', transit: 'traffic', walk: 'walk' };
const NAVER_MODE = { car: 'car', transit: 'transit', walk: 'walk' };

const nameOf = (p, fallback) => encodeURIComponent((p.title || fallback).replace(/[,/]/g, ' '));

export function kakaoDirections(mode, from, to) {
  const dest = `${nameOf(to, '도착지')},${to.lat},${to.lng}`;
  if (!from) return `https://map.kakao.com/link/to/${dest}`;
  return `https://map.kakao.com/link/by/${KAKAO_MODE[mode] ?? 'car'}/${nameOf(from, '내 위치')},${from.lat},${from.lng}/${dest}`;
}

// 네이버지도 길찾기 주소는 웹 메르카토르(EPSG:3857) 좌표를 쓴다
function toMercator({ lat, lng }) {
  const R = 6378137;
  const x = (lng * Math.PI * R) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

export function naverDirections(mode, from, to) {
  const point = (p, fallback) => `${toMercator(p)},${nameOf(p, fallback)},,`;
  const start = from ? point(from, '내 위치') : '-';
  return `https://map.naver.com/p/directions/${start}/${point(to, '도착지')}/-/${NAVER_MODE[mode] ?? 'car'}`;
}

// 네이버 지도에서 "지역 이름 + 장소 이름"으로 검색하면 결과가 하나일 때 그 장소의 지도홈(리뷰·메뉴·영업시간)이 바로 열린다
const shortRegion = (name = '') => (/[시군]$/.test(name) && name.length > 2 ? name.slice(0, -1) : name);

export function naverPlace(regionName, title) {
  return `https://map.naver.com/p/search/${encodeURIComponent(`${shortRegion(regionName)} ${title}`.trim())}`;
}
