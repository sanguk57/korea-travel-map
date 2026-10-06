import { useEffect, useRef } from 'react';

export const TABS = [
  { key: 'attractions', label: '관광지', icon: '🏞️' },
  { key: 'restaurants', label: '맛집', icon: '🍜' },
  { key: 'stays', label: '숙소', icon: '🛏️' },
];

const FEATURED = [
  { code: '39020', emoji: '🌊', tag: '바다와 오름' },
  { code: '39010', emoji: '🍊', tag: '공항과 해변' },
  { code: '21090', emoji: '🏖️', tag: '해운대 바다' },
  { code: '32030', emoji: '☕', tag: '커피와 해변' },
  { code: '37020', emoji: '🏯', tag: '천년 고도' },
  { code: '36020', emoji: '🌉', tag: '밤바다 낭만' },
  { code: '32060', emoji: '⛰️', tag: '설악과 항구' },
  { code: '38050', emoji: '⛵', tag: '남해 섬 여행' },
];

const formatDate = (yyyymmdd) =>
  yyyymmdd ? `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}` : null;

function PlaceItem({ place, focused, onFocus }) {
  const ref = useRef(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focused]);

  return (
    <li ref={ref} className={`place ${focused ? 'focused' : ''}`} onClick={() => onFocus(place.id)}>
      {place.image ? (
        <img className="thumb" src={place.image} alt="" loading="lazy" />
      ) : (
        <div className="thumb empty" aria-hidden="true">
          {place.source === 'kakao' ? '🍽️' : '📍'}
        </div>
      )}
      <div className="place-body">
        <div className="place-title">{place.title}</div>
        {place.category && <div className="place-cat">{place.category.split(' > ').pop()}</div>}
        <div className="place-addr">{place.addr}</div>
        <div className="place-actions">
          <a className="chip-link" href={place.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            지도 보기 ↗
          </a>
          {place.tel && (
            <a className="chip-link" href={`tel:${place.tel}`} onClick={(e) => e.stopPropagation()}>
              ☎ {place.tel}
            </a>
          )}
          {place.modified && <span className="muted small">수정 {formatDate(place.modified)}</span>}
        </div>
      </div>
    </li>
  );
}

function PlaceList({ items, focusedId, onFocusPlace, empty }) {
  if (items.length === 0) return <p className="empty-msg">{empty}</p>;
  return (
    <ul className="places">
      {items.map((p) => (
        <PlaceItem key={p.id} place={p} focused={p.id === focusedId} onFocus={onFocusPlace} />
      ))}
    </ul>
  );
}

function Skeleton() {
  return (
    <ul className="places" aria-label="불러오는 중">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="place skeleton">
          <div className="thumb" />
          <div className="place-body">
            <div className="bar w60" />
            <div className="bar w30" />
            <div className="bar w90" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Welcome({ regions, meta, onSelectRegion }) {
  const byCode = new Map(regions.map((r) => [r.code, r]));
  const featured = FEATURED.filter((f) => byCode.has(f.code));

  return (
    <div className="welcome">
      <div className="hero">
        <p className="eyebrow">전국 {regions.length || 250}개 시·군·구</p>
        <h2>어디로 떠나볼까요?</h2>
        <p>지역을 고르면 그곳의 관광지, 맛집, 숙소를 한눈에 보여드려요.</p>
      </div>

      {featured.length > 0 && (
        <>
          <h3 className="section">추천 여행지</h3>
          <div className="featured">
            {featured.map((f) => {
              const r = byCode.get(f.code);
              return (
                <button key={f.code} className="featured-card" onClick={() => onSelectRegion(f.code)}>
                  <span className="featured-emoji" aria-hidden="true">{f.emoji}</span>
                  <strong>{r.name}</strong>
                  <small>{f.tag}</small>
                </button>
              );
            })}
          </div>
        </>
      )}

      {meta?.updatedAt && (
        <p className="source muted">데이터 갱신 {new Date(meta.updatedAt).toLocaleString('ko-KR')}</p>
      )}
      {!meta && (
        <p className="notice">
          아직 장소 데이터가 없습니다. <code>npm run data:fetch</code>를 실행하거나 GitHub Actions 배포를 확인하세요.
        </p>
      )}
    </div>
  );
}

export default function PlacePanel({
  regions,
  region,
  data,
  status,
  meta,
  tab,
  onTabChange,
  onSelectRegion,
  focusedId,
  onFocusPlace,
}) {
  if (!region) {
    return (
      <div className="panel">
        <div className="panel-body">
          <Welcome regions={regions} meta={meta} onSelectRegion={onSelectRegion} />
        </div>
      </div>
    );
  }

  const counts = data
    ? {
        attractions: data.attractions.length,
        restaurants: data.restaurants.length + data.tourRestaurants.length,
        stays: data.stays.length,
      }
    : {};

  return (
    <div className="panel">
      <div className="panel-head">
        <button className="back" onClick={() => onSelectRegion(null)}>
          ← 전체 지도
        </button>
        <p className="eyebrow">{region.sido}</p>
        <h2>{region.name}</h2>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab-${t.key} ${tab === t.key ? 'active' : ''}`}
              onClick={() => onTabChange(t.key)}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
              {data && <span className="count">{counts[t.key]}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="panel-body">
        {status === 'loading' && <Skeleton />}
        {status === 'error' && <p className="notice">이 지역의 데이터 파일을 찾을 수 없습니다.</p>}
        {status === 'ready' && data && (
          <>
            {tab === 'attractions' && (
              <PlaceList items={data.attractions} focusedId={focusedId} onFocusPlace={onFocusPlace} empty="등록된 관광지가 없습니다." />
            )}
            {tab === 'stays' && (
              <PlaceList items={data.stays} focusedId={focusedId} onFocusPlace={onFocusPlace} empty="등록된 숙소가 없습니다." />
            )}
            {tab === 'restaurants' && (
              <>
                {data.restaurants.length > 0 && (
                  <>
                    <h3 className="section">카카오맵 음식점</h3>
                    <PlaceList items={data.restaurants} focusedId={focusedId} onFocusPlace={onFocusPlace} />
                  </>
                )}
                <h3 className="section">한국관광공사 추천 음식점</h3>
                <PlaceList items={data.tourRestaurants} focusedId={focusedId} onFocusPlace={onFocusPlace} empty="등록된 음식점이 없습니다." />
              </>
            )}
            <p className="source muted">
              출처: 한국관광공사 TourAPI, 카카오 로컬 · 갱신 {new Date(data.updatedAt).toLocaleDateString('ko-KR')}
              <br />
              영업 여부·시간은 카카오맵에서 최신 정보를 확인하세요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
