import { useEffect, useRef, useState } from 'react';
import { loadKakaoMaps } from './kakaoLoader.js';

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

const STYLE = {
  idle: { strokeColor: '#4f46e5', strokeWeight: 1, strokeOpacity: 0.35, fillColor: '#6366f1', fillOpacity: 0.04 },
  hover: { strokeColor: '#4f46e5', strokeWeight: 2, strokeOpacity: 0.9, fillColor: '#6366f1', fillOpacity: 0.18 },
  selected: { strokeColor: '#4338ca', strokeWeight: 3, strokeOpacity: 1, fillColor: '#6366f1', fillOpacity: 0.1 },
};

const PIN_COLOR = { attractions: '#0d9488', restaurants: '#ea580c', stays: '#db2777' };
const INITIAL_VIEW = { lat: 36.0, lng: 127.8, level: 13 };

// 탭 색상의 SVG 핀. 선택된 장소는 크게 그린다.
function pinImage(kakao, color, big) {
  const [w, h] = big ? [38, 50] : [26, 34];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 26 34">
<path d="M13 33s11.5-10.8 11.5-19.7A11.5 11.5 0 0 0 1.5 13.3C1.5 22.2 13 33 13 33z" fill="${color}" stroke="#fff" stroke-width="2"/>
<circle cx="13" cy="13.3" r="4.3" fill="#fff"/></svg>`;
  return new kakao.maps.MarkerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, new kakao.maps.Size(w, h), {
    offset: new kakao.maps.Point(w / 2, h - 1),
  });
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default function KakaoMap({ regions, selectedCode, onSelectRegion, places, tab, focusedId, onFocusPlace, origin, route }) {
  const containerRef = useRef(null);
  const kakaoRef = useRef(null);
  const mapRef = useRef(null);
  const polygonsRef = useRef(new Map()); // code -> kakao.maps.Polygon[]
  const markersRef = useRef(new Map()); // place id -> kakao.maps.Marker
  const pinsRef = useRef(null);
  const focusedRef = useRef(null);
  const labelRef = useRef(null);
  const infoRef = useRef(null);
  const meRef = useRef(null);
  const selectedRef = useRef(selectedCode);
  const callbacksRef = useRef({ onSelectRegion, onFocusPlace });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  callbacksRef.current = { onSelectRegion, onFocusPlace };

  // 지도 생성
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps(KAKAO_JS_KEY)
      .then((kakao) => {
        if (cancelled || mapRef.current) return;
        kakaoRef.current = kakao;
        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(INITIAL_VIEW.lat, INITIAL_VIEW.lng),
          level: INITIAL_VIEW.level,
        });
        mapRef.current.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        labelRef.current = new kakao.maps.CustomOverlay({ yAnchor: 1.6, zIndex: 3 });
        infoRef.current = new kakao.maps.CustomOverlay({ yAnchor: 2.6, zIndex: 4 });
        meRef.current = new kakao.maps.CustomOverlay({ content: '<div class="me-dot"></div>', zIndex: 5 });
        setReady(true);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // 사이드바 폭이 바뀌면 지도 크기를 다시 계산한다
  useEffect(() => {
    if (!ready) return;
    const ro = new ResizeObserver(() => mapRef.current.relayout());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // 시·군·구 경계 그리기
  useEffect(() => {
    if (!ready || regions.length === 0) return;
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    const label = labelRef.current;

    const styleFor = (code, hovered) =>
      code === selectedRef.current ? STYLE.selected : hovered ? STYLE.hover : STYLE.idle;

    for (const region of regions) {
      const parts = region.polygons.map(
        (rings) =>
          new kakao.maps.Polygon({
            map,
            path: rings.map((ring) => ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng))),
            ...STYLE.idle,
          }),
      );
      const setStyle = (hovered) => parts.forEach((p) => p.setOptions(styleFor(region.code, hovered)));

      for (const p of parts) {
        kakao.maps.event.addListener(p, 'mouseover', (e) => {
          setStyle(true);
          label.setContent(`<div class="map-label">${escapeHtml(region.fullName)}</div>`);
          label.setPosition(e.latLng);
          label.setMap(map);
        });
        kakao.maps.event.addListener(p, 'mousemove', (e) => label.setPosition(e.latLng));
        kakao.maps.event.addListener(p, 'mouseout', () => {
          setStyle(false);
          label.setMap(null);
        });
        kakao.maps.event.addListener(p, 'click', () => callbacksRef.current.onSelectRegion(region.code));
      }
      polygonsRef.current.set(region.code, parts);
    }

    return () => {
      polygonsRef.current.forEach((parts) => parts.forEach((p) => p.setMap(null)));
      polygonsRef.current.clear();
    };
  }, [ready, regions]);

  // 선택 지역 강조 + 화면 맞춤
  useEffect(() => {
    if (!ready) return;
    const prev = selectedRef.current;
    selectedRef.current = selectedCode;
    polygonsRef.current.get(prev)?.forEach((p) => p.setOptions(STYLE.idle));
    polygonsRef.current.get(selectedCode)?.forEach((p) => p.setOptions(STYLE.selected));

    const kakao = kakaoRef.current;
    const region = regions.find((r) => r.code === selectedCode);
    if (region) {
      const [minLng, minLat, maxLng, maxLat] = region.bbox;
      mapRef.current.setBounds(
        new kakao.maps.LatLngBounds(new kakao.maps.LatLng(minLat, minLng), new kakao.maps.LatLng(maxLat, maxLng)),
        40, 40, 40, 40,
      );
    } else if (prev) {
      mapRef.current.setLevel(INITIAL_VIEW.level);
      mapRef.current.setCenter(new kakao.maps.LatLng(INITIAL_VIEW.lat, INITIAL_VIEW.lng));
    }
  }, [ready, selectedCode, regions]);

  // 장소 마커
  useEffect(() => {
    if (!ready) return;
    const kakao = kakaoRef.current;
    const color = PIN_COLOR[tab] ?? PIN_COLOR.attractions;
    const pins = { normal: pinImage(kakao, color, false), big: pinImage(kakao, color, true) };
    pinsRef.current = pins;
    focusedRef.current = null;
    for (const place of places) {
      const marker = new kakao.maps.Marker({
        map: mapRef.current,
        position: new kakao.maps.LatLng(place.lat, place.lng),
        title: place.title,
        image: pins.normal,
        clickable: true,
      });
      kakao.maps.event.addListener(marker, 'click', () => callbacksRef.current.onFocusPlace(place.id));
      markersRef.current.set(place.id, marker);
    }
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();
      infoRef.current?.setMap(null);
    };
  }, [ready, places, tab]);

  // 선택한 장소 강조 + 말풍선
  useEffect(() => {
    if (!ready) return;
    const info = infoRef.current;
    const pins = pinsRef.current;
    const prev = markersRef.current.get(focusedRef.current);
    if (prev) {
      prev.setImage(pins.normal);
      prev.setZIndex(0);
    }
    focusedRef.current = focusedId;

    const place = places.find((p) => p.id === focusedId);
    if (!place) {
      info.setMap(null);
      return;
    }
    const marker = markersRef.current.get(place.id);
    marker?.setImage(pins.big);
    marker?.setZIndex(10);

    const pos = new kakaoRef.current.maps.LatLng(place.lat, place.lng);
    info.setContent(`<div class="map-info">${escapeHtml(place.title)}</div>`);
    info.setPosition(pos);
    info.setMap(mapRef.current);
    mapRef.current.panTo(pos);
  }, [ready, places, focusedId]);

  // 내 위치 표시
  useEffect(() => {
    if (!ready) return;
    if (!origin) {
      meRef.current.setMap(null);
      return;
    }
    meRef.current.setPosition(new kakaoRef.current.maps.LatLng(origin.lat, origin.lng));
    meRef.current.setMap(mapRef.current);
  }, [ready, origin]);

  // 선택한 이동 수단의 경로
  useEffect(() => {
    if (!ready || !route) return;
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    const bounds = new kakao.maps.LatLngBounds();
    const lines = route.paths.flatMap(({ coords, color, dashed }) => {
      const path = coords.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng));
      path.forEach((ll) => bounds.extend(ll));
      return [
        // 흰 테두리를 먼저 깔아 지도 위에서 잘 보이게 한다
        new kakao.maps.Polyline({ map, path, strokeWeight: 9, strokeColor: '#ffffff', strokeOpacity: 0.9, zIndex: 1 }),
        new kakao.maps.Polyline({
          map,
          path,
          strokeWeight: 5,
          strokeColor: color,
          strokeOpacity: 0.95,
          strokeStyle: dashed ? 'shortdash' : 'solid',
          zIndex: 2,
        }),
      ];
    });
    if (origin) bounds.extend(new kakao.maps.LatLng(origin.lat, origin.lng));
    if (!bounds.isEmpty()) map.setBounds(bounds, 60, 60, 220, 60);
    return () => lines.forEach((l) => l.setMap(null));
  }, [ready, route, origin]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map" />
      {error && (
        <div className="map-error">
          <strong>지도를 표시할 수 없습니다</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
