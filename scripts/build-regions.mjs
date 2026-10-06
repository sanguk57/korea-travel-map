// 통계청 시·군·구 경계(TopoJSON)를 앱에서 쓰기 쉬운 regions.json으로 변환한다.
// 경계가 바뀌지 않는 한 한 번만 실행하면 되고, 결과물은 저장소에 커밋한다.
import { readFile, writeFile } from 'node:fs/promises';
import { feature } from 'topojson-client';

const SRC = new URL('./raw/skorea-municipalities-2018-topo-simple.json', import.meta.url);
const OUT = new URL('../public/data/regions.json', import.meta.url);

// 통계청 시·도 코드(앞 2자리)
const SIDO = {
  11: '서울특별시', 21: '부산광역시', 22: '대구광역시', 23: '인천광역시',
  24: '광주광역시', 25: '대전광역시', 26: '울산광역시', 29: '세종특별자치시',
  31: '경기도', 32: '강원특별자치도', 33: '충청북도', 34: '충청남도',
  35: '전북특별자치도', 36: '전라남도', 37: '경상북도', 38: '경상남도',
  39: '제주특별자치도',
};

const round = (n) => Math.round(n * 1e5) / 1e5;

const topo = JSON.parse(await readFile(SRC, 'utf8'));
const geo = feature(topo, Object.values(topo.objects)[0]);

const regions = geo.features.map((f) => {
  const { code, name } = f.properties;
  const polygons = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
    .map((rings) => rings.map((ring) => ring.map(([lng, lat]) => [round(lng), round(lat)])));

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const rings of polygons) {
    for (const [lng, lat] of rings[0]) {
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
  }

  const sido = SIDO[code.slice(0, 2)] ?? '';
  return {
    code,
    name,
    sido,
    fullName: sido === '세종특별자치시' ? sido : `${sido} ${name}`,
    bbox: [minLng, minLat, maxLng, maxLat],
    polygons,
  };
});

await writeFile(OUT, JSON.stringify(regions));
console.log(`regions.json: ${regions.length}개 지역`);
