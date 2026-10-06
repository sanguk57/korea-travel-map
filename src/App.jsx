import { useCallback, useEffect, useMemo, useState } from 'react';
import KakaoMap from './KakaoMap.jsx';
import PlacePanel from './PlacePanel.jsx';
import RegionSearch from './RegionSearch.jsx';

const DATA = `${import.meta.env.BASE_URL}data/`;

async function getJson(path) {
  const res = await fetch(DATA + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export default function App() {
  const [regions, setRegions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [tab, setTab] = useState('attractions');
  const [focusedId, setFocusedId] = useState(null);

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

  // 현재 탭에서 지도에 찍을 장소들
  const places = useMemo(() => {
    if (!data || status !== 'ready') return [];
    if (tab === 'restaurants') return [...data.restaurants, ...data.tourRestaurants];
    return data[tab];
  }, [data, status, tab]);

  const changeTab = useCallback((t) => {
    setTab(t);
    setFocusedId(null);
  }, []);

  return (
    <div className="app">
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
          data={data}
          status={status}
          meta={meta}
          tab={tab}
          onTabChange={changeTab}
          onSelectRegion={setSelectedCode}
          focusedId={focusedId}
          onFocusPlace={setFocusedId}
        />
      </aside>
      <main className="map-area">
        <KakaoMap
          regions={regions}
          selectedCode={selectedCode}
          onSelectRegion={setSelectedCode}
          places={places}
          tab={tab}
          focusedId={focusedId}
          onFocusPlace={setFocusedId}
        />
        {!region && <div className="map-hint">지도에서 시·군·구를 눌러 보세요</div>}
      </main>
    </div>
  );
}
