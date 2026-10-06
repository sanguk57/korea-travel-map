import { useCallback, useEffect, useMemo, useState } from 'react';
import KakaoMap from './KakaoMap.jsx';
import PlacePanel from './PlacePanel.jsx';
import RegionSearch from './RegionSearch.jsx';
import RouteCard from './RouteCard.jsx';
import { MODES, getRoute, modeAvailable } from './routing.js';
import { TIME_CANDIDATES, nearest, sortPlaces } from './sort.js';

const DATA = `${import.meta.env.BASE_URL}data/`;
const ETA_CONCURRENCY = 3;

async function getJson(path) {
  const res = await fetch(DATA + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const etaKey = (mode, id) => `${mode}|${id}`;

const SIDEBAR_MIN = 340;
const SIDEBAR_MAX = 760;
const SIDEBAR_DEFAULT = 440;
const clampWidth = (w) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.min(w, window.innerWidth - 320)));

function savedSidebarWidth() {
  try {
    const w = Number(localStorage.getItem('sidebarWidth'));
    return w ? clampWidth(w) : SIDEBAR_DEFAULT;
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

export default function App() {
  const [regions, setRegions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [tab, setTab] = useState('attractions');
  const [focusedId, setFocusedId] = useState(null);
  const [sort, setSort] = useState('recommended');
  const [origin, setOrigin] = useState(null); // 내 위치 {lat, lng}
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | pending | ok | denied
  const [travelMode, setTravelMode] = useState('car');
  const [etas, setEtas] = useState({}); // "mode|placeId" -> { minutes } | { error }
  const [routes, setRoutes] = useState({}); // 선택한 장소의 mode -> { status, route?, error? }
  const [sidebarWidth, setSidebarWidth] = useState(savedSidebarWidth);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('sidebarWidth', String(sidebarWidth));
    } catch {
      // 저장 실패는 무시 (시크릿 모드 등)
    }
  }, [sidebarWidth]);

  const startResize = useCallback((e) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setResizing(true);
    const move = (ev) => setSidebarWidth(clampWidth(ev.clientX));
    const up = () => {
      setResizing(false);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }, []);

  const resizeByKey = useCallback((e) => {
    const step = e.shiftKey ? 80 : 20;
    if (e.key === 'ArrowLeft') setSidebarWidth((w) => clampWidth(w - step));
    else if (e.key === 'ArrowRight') setSidebarWidth((w) => clampWidth(w + step));
  }, []);

  useEffect(() => {
    getJson('regions.json').then(setRegions).catch(console.error);
    getJson('places/_meta.json').then(setMeta).catch(() => setMeta(null));
  }, []);

  useEffect(() => {
    setFocusedId(null);
    if (!selectedCode) {
      setData(null);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    getJson(`places/${selectedCode}.json`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode]);

  const region = useMemo(() => regions.find((r) => r.code === selectedCode), [regions, selectedCode]);

  const requestLocation = useCallback(() => {
    if (origin || geoStatus === 'pending') return;
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ok');
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, [origin, geoStatus]);

  // 현재 탭의 장소들(정렬 전)
  const tabItems = useMemo(() => {
    if (!data || status !== 'ready') return [];
    if (tab === 'restaurants') return [...data.restaurants, ...data.tourRestaurants];
    return data[tab];
  }, [data, status, tab]);

  // 도착 시간순: 직선 거리로 가까운 후보만 실제 경로 시간을 조회한다 (API 한도 절약)
  useEffect(() => {
    if (sort !== 'time' || !origin || !modeAvailable(travelMode)) return;
    const todo = nearest(tabItems, origin, TIME_CANDIDATES).filter((p) => !(etaKey(travelMode, p.id) in etas));
    if (todo.length === 0) return;
    let cancelled = false;
    const queue = [...todo];
    const worker = async () => {
      while (queue.length && !cancelled) {
        const p = queue.shift();
        let eta;
        try {
          eta = { minutes: (await getRoute(travelMode, origin, p)).minutes };
        } catch (e) {
          eta = { error: e.message };
        }
        if (!cancelled) setEtas((prev) => ({ ...prev, [etaKey(travelMode, p.id)]: eta }));
      }
    };
    Array.from({ length: ETA_CONCURRENCY }, worker);
    return () => {
      cancelled = true;
    };
    // etas는 의도적으로 제외: 결과가 들어올 때마다 다시 돌 필요가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, origin, travelMode, tabItems]);

  const etaOf = useCallback((p) => etas[etaKey(travelMode, p.id)]?.minutes, [etas, travelMode]);

  const sorted = useMemo(() => {
    if (!data) return null;
    const by = (items) => sortPlaces(items, sort, origin, etaOf);
    return {
      ...data,
      attractions: by(data.attractions),
      stays: by(data.stays),
      restaurants: by(data.restaurants),
      tourRestaurants: by(data.tourRestaurants),
    };
  }, [data, sort, origin, etaOf]);

  // 현재 탭에서 지도에 찍을 장소들
  const places = useMemo(() => {
    if (!sorted || status !== 'ready') return [];
    if (tab === 'restaurants') return [...sorted.restaurants, ...sorted.tourRestaurants];
    return sorted[tab];
  }, [sorted, status, tab]);

  const focusedPlace = useMemo(() => tabItems.find((p) => p.id === focusedId), [tabItems, focusedId]);

  // 선택한 장소까지 자동차·대중교통·도보 경로를 모두 조회
  useEffect(() => {
    setRoutes({});
    if (!focusedPlace || !origin) return;
    let cancelled = false;
    for (const { key } of MODES) {
      if (!modeAvailable(key)) {
        setRoutes((r) => ({ ...r, [key]: { status: 'error', error: '키 미설정' } }));
        continue;
      }
      setRoutes((r) => ({ ...r, [key]: { status: 'loading' } }));
      getRoute(key, origin, focusedPlace)
        .then((route) => {
          if (cancelled) return;
          setRoutes((r) => ({ ...r, [key]: { status: 'ready', route } }));
          setEtas((e) => ({ ...e, [etaKey(key, focusedPlace.id)]: { minutes: route.minutes } }));
        })
        .catch((e) => !cancelled && setRoutes((r) => ({ ...r, [key]: { status: 'error', error: e.message } })));
    }
    return () => {
      cancelled = true;
    };
  }, [focusedPlace, origin]);

  const changeTab = useCallback((t) => {
    setTab(t);
    setFocusedId(null);
  }, []);

  const changeSort = useCallback(
    (key) => {
      setSort(key);
      if (key === 'distance' || key === 'time') requestLocation();
    },
    [requestLocation],
  );

  const shownRoute = routes[travelMode]?.status === 'ready' ? routes[travelMode].route : null;

  return (
    <div className={`app ${resizing ? 'resizing' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` }}>
      <aside className="sidebar">
        <header className="brand">
          <button className="brand-home" onClick={() => setSelectedCode(null)} title="처음으로">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  d="M12 22s7-6.6 7-12.2A7 7 0 0 0 5 9.8C5 15.4 12 22 12 22z"
                  fill="currentColor"
                />
                <circle cx="12" cy="9.8" r="2.6" fill="#fff" />
              </svg>
            </span>
            <span>
              <strong>한국 여행 지도</strong>
              <small>관광지 · 맛집 · 숙소</small>
            </span>
          </button>
        </header>
        <RegionSearch regions={regions} onSelect={setSelectedCode} />
        <PlacePanel
          regions={regions}
          region={region}
          data={sorted}
          status={status}
          meta={meta}
          tab={tab}
          onTabChange={changeTab}
          sort={sort}
          onSortChange={changeSort}
          origin={origin}
          geoStatus={geoStatus}
          travelMode={travelMode}
          onTravelModeChange={setTravelMode}
          etas={etas}
          onSelectRegion={setSelectedCode}
          focusedId={focusedId}
          onFocusPlace={setFocusedId}
        />
      </aside>
      <div
        className={`resizer ${resizing ? 'dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="사이드바 폭 조절"
        aria-valuenow={sidebarWidth}
        aria-valuemin={SIDEBAR_MIN}
        aria-valuemax={SIDEBAR_MAX}
        tabIndex={0}
        title="드래그해서 폭 조절 (더블클릭: 기본 폭)"
        onPointerDown={startResize}
        onKeyDown={resizeByKey}
        onDoubleClick={() => setSidebarWidth(clampWidth(SIDEBAR_DEFAULT))}
      />
      <main className="map-area">
        <KakaoMap
          regions={regions}
          selectedCode={selectedCode}
          onSelectRegion={setSelectedCode}
          places={places}
          tab={tab}
          focusedId={focusedId}
          onFocusPlace={setFocusedId}
          origin={origin}
          route={shownRoute}
        />
        {!region && <div className="map-hint">지도에서 시·군·구를 눌러 보세요</div>}
        {focusedPlace && (
          <RouteCard
            place={focusedPlace}
            origin={origin}
            geoStatus={geoStatus}
            onRequestLocation={requestLocation}
            routes={routes}
            mode={travelMode}
            onModeChange={setTravelMode}
            onClose={() => setFocusedId(null)}
          />
        )}
      </main>
    </div>
  );
}
