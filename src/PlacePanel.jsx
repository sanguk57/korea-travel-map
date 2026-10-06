import { useEffect, useRef, useState } from 'react';
import PlaceDetail from './PlaceDetail.jsx';
import { naverPlace } from './mapLinks.js';
import RegionCourses from './RegionCourses.jsx';
import Weather from './Weather.jsx';
import { MODES, formatMinutes, modeAvailable } from './routing.js';
import { SORTS, TIME_CANDIDATES, distanceKm, isOngoing } from './sort.js';

export const TABS = [
  { key: 'attractions', label: '관광지', icon: '🏞️' },
  { key: 'restaurants', label: '맛집', icon: '🍜' },
  { key: 'stays', label: '숙소', icon: '🛏️' },
  { key: 'festivals', label: '축제', icon: '🎉' },
  { key: 'courses', label: '코스', icon: '🧭' },
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
const shortDate = (yyyymmdd) => `${Number(yyyymmdd.slice(4, 6))}.${Number(yyyymmdd.slice(6, 8))}`;
const formatKm = (km) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(km < 10 ? 1 : 0)}km`);
const formatCount = (n) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : n.toLocaleString('ko-KR'));

function daysUntil(yyyymmdd) {
  const at = (s) => Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00+09:00`);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '');
  return Math.round((at(yyyymmdd) - at(today)) / 86400e3);
}

function FestivalBadge({ place }) {
  if (isOngoing(place)) return <span className="badge live">진행 중</span>;
  return <span className="badge soon">D-{daysUntil(place.start)}</span>;
}

export function FavButton({ active, onClick, className = '' }) {
  return (
    <button
      className={`fav ${active ? 'on' : ''} ${className}`}
      aria-pressed={active}
      aria-label={active ? '찜 해제' : '찜하기'}
      title={active ? '찜 해제' : '찜해서 코스에 담기'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {active ? '♥' : '♡'}
    </button>
  );
}

function PlaceItem({ place, focused, onFocus, sort, origin, eta, travelMode, favorite, onToggleFavorite, regionName }) {
  const ref = useRef(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focused]);

  return (
    <li ref={ref} className={`place ${focused ? 'focused' : ''}`} onClick={() => onFocus(place.id)}>
      <div className="place-row">
        {place.image ? (
          <img className="thumb" src={place.image} alt="" loading="lazy" />
        ) : (
          <div className="thumb empty" aria-hidden="true">
            {place.source === 'kakao' ? '🍽️' : place.start ? '🎉' : '📍'}
          </div>
        )}
        <div className="place-body">
          <div className="place-title">
            <span>{place.title}</span>
            {sort === 'distance' && origin && <span className="distance">{formatKm(distanceKm(origin, place))}</span>}
            {sort === 'time' && eta?.minutes != null && (
              <span className="distance">
                {MODES.find((m) => m.key === travelMode).icon} {formatMinutes(eta.minutes)}
              </span>
            )}
          </div>
          {place.start && (
            <div className="place-dates">
              <FestivalBadge place={place} /> {shortDate(place.start)} ~ {shortDate(place.end)}
            </div>
          )}
          {place.category && <div className="place-cat">{place.category.split(' > ').pop()}</div>}
          <div className="place-addr">{place.addr}</div>
          <div className="place-actions">
            <a
              className="chip-link"
              href={place.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              카카오맵 ↗
            </a>
            <a
              className="chip-link naver"
              href={naverPlace(regionName, place.title)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="네이버 지도홈 (리뷰·메뉴·영업시간)"
            >
              네이버 ↗
            </a>
            {place.tel && (
              <a className="chip-link" href={`tel:${place.tel}`} onClick={(e) => e.stopPropagation()}>
                ☎ {place.tel}
              </a>
            )}
            {place.blog != null && <span className="blog-count">✍️ 블로그 {formatCount(place.blog)}</span>}
            {sort === 'newest' && place.created ? (
              <span className="muted small">등록 {formatDate(place.created)}</span>
            ) : sort === 'updated' && place.modified ? (
              <span className="muted small">수정 {formatDate(place.modified)}</span>
            ) : null}
          </div>
        </div>
        <FavButton active={favorite} onClick={() => onToggleFavorite(place)} />
      </div>
      {focused && <PlaceDetail place={place} regionName={regionName} />}
    </li>
  );
}

function PlaceList({
  items,
  focusedId,
  onFocusPlace,
  empty,
  sort,
  origin,
  etas,
  travelMode,
  isFavorite,
  onToggleFavorite,
  regionName,
}) {
  if (items.length === 0) return <p className="empty-msg">{empty}</p>;
  return (
    <ul className="places">
      {items.map((p) => (
        <PlaceItem
          key={p.id}
          place={p}
          focused={p.id === focusedId}
          onFocus={onFocusPlace}
          sort={sort}
          origin={origin}
          eta={etas[`${travelMode}|${p.id}`]}
          travelMode={travelMode}
          favorite={isFavorite(p.id)}
          onToggleFavorite={onToggleFavorite}
          regionName={regionName}
        />
      ))}
    </ul>
  );
}

function Skeleton() {
  return (
    <ul className="places" aria-label="불러오는 중">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="place skeleton">
          <div className="place-row">
            <div className="thumb" />
            <div className="place-body">
              <div className="bar w60" />
              <div className="bar w30" />
              <div className="bar w90" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const FESTIVALS_SHOWN = 6;

const SIDO_SHORT = {
  경상북도: '경북',
  경상남도: '경남',
  충청북도: '충북',
  충청남도: '충남',
  전라남도: '전남',
  전라북도: '전북',
  전북특별자치도: '전북',
  강원특별자치도: '강원',
  제주특별자치도: '제주',
  세종특별자치시: '세종',
  경기도: '경기',
};
const sidoShort = (sido) => SIDO_SHORT[sido] ?? sido.replace(/(특별|광역)시$/, '');

// 시작 화면: 전국에서 오늘 진행 중인 축제
function OngoingFestivals({ festivals, byCode, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const ongoing = festivals
    .filter((f) => isOngoing(f))
    // 블로그 언급이 많은 순 → 곧 끝나는 순
    .sort((a, b) => (b.blog ?? -1) - (a.blog ?? -1) || a.end.localeCompare(b.end));
  if (!ongoing.length) return null;
  const shown = expanded ? ongoing : ongoing.slice(0, FESTIVALS_SHOWN);

  return (
    <>
      <h3 className="section">
        🎉 지금 열리는 축제 <span className="section-count">{ongoing.length}</span>
      </h3>
      <ul className="ongoing">
        {shown.map((f) => {
          const left = daysUntil(f.end);
          const region = byCode.get(f.regionCode);
          return (
            <li key={f.id}>
              <button className="ongoing-card" onClick={() => onOpen(f)}>
                {f.image ? <img src={f.image} alt="" loading="lazy" /> : <div className="ongoing-noimg">🎉</div>}
                <span className="ongoing-body">
                  <strong>{f.title}</strong>
                  <span className="muted small">{region ? `${sidoShort(region.sido)} ${region.name}` : ''}</span>
                  <span className="ongoing-dates">
                    <span className="badge live">{left === 0 ? '오늘 종료' : `${left}일 남음`}</span>
                    {shortDate(f.start)} ~ {shortDate(f.end)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {ongoing.length > FESTIVALS_SHOWN && (
        <button className="more-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '접기' : `${ongoing.length - FESTIVALS_SHOWN}개 더 보기`}
        </button>
      )}
    </>
  );
}

function Welcome({ regions, meta, onSelectRegion, favoriteCount, onOpenCourse, festivals, onOpenFestival }) {
  const byCode = new Map(regions.map((r) => [r.code, r]));
  const featured = FEATURED.filter((f) => byCode.has(f.code));

  return (
    <div className="welcome">
      <div className="hero">
        <p className="eyebrow">전국 {regions.length || 250}개 시·군·구</p>
        <h2>어디로 떠나볼까요?</h2>
        <p>지역을 고르면 그곳의 관광지, 맛집, 숙소, 축제를 한눈에 보여드려요.</p>
      </div>

      {favoriteCount > 0 && (
        <button className="course-cta" onClick={onOpenCourse}>
          <span>♥ 찜한 {favoriteCount}곳으로 하루 코스 짜기</span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      {featured.length > 0 && (
        <>
          <h3 className="section">추천 여행지</h3>
          <div className="featured">
            {featured.map((f) => {
              const r = byCode.get(f.code);
              return (
                <button key={f.code} className="featured-card" onClick={() => onSelectRegion(f.code)}>
                  <span className="featured-emoji" aria-hidden="true">
                    {f.emoji}
                  </span>
                  <strong>{r.name}</strong>
                  <small>{f.tag}</small>
                </button>
              );
            })}
          </div>
        </>
      )}

      <OngoingFestivals festivals={festivals} byCode={byCode} onOpen={onOpenFestival} />

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
  sort,
  onSortChange,
  origin,
  geoStatus,
  travelMode,
  onTravelModeChange,
  etas,
  onSelectRegion,
  focusedId,
  onFocusPlace,
  isFavorite,
  onToggleFavorite,
  favoriteCount,
  onOpenCourse,
  festivals,
  onOpenFestival,
  onShare,
  courses,
  selectedCourseId,
  onSelectCourse,
  onSaveCourse,
}) {
  if (!region) {
    return (
      <div className="panel">
        <div className="panel-body">
          <Welcome
            regions={regions}
            meta={meta}
            onSelectRegion={onSelectRegion}
            favoriteCount={favoriteCount}
            onOpenCourse={onOpenCourse}
            festivals={festivals}
            onOpenFestival={onOpenFestival}
          />
        </div>
      </div>
    );
  }

  const sorts = SORTS.filter((s) => !s.needs || meta?.sources?.[s.needs]);
  const needsLocation = sort === 'distance' || sort === 'time';
  const toggle = (p) => onToggleFavorite(p, region.code);
  const listProps = {
    focusedId,
    onFocusPlace,
    sort,
    origin,
    etas,
    travelMode,
    isFavorite,
    onToggleFavorite: toggle,
    regionName: region.name,
  };
  const counts = data
    ? {
        attractions: data.attractions.length,
        restaurants: data.restaurants.length + data.tourRestaurants.length,
        stays: data.stays.length,
        festivals: data.festivals?.length ?? 0,
        courses: courses.length,
      }
    : {};

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-nav">
          <button className="back" onClick={() => onSelectRegion(null)}>
            ← 전체 지도
          </button>
          <button className="back" onClick={onShare} title="이 화면 링크 복사">
            🔗 공유
          </button>
        </div>
        <p className="eyebrow">{region.sido}</p>
        <h2>{region.name}</h2>
        <Weather weather={data?.weather} />
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
        {tab !== 'courses' && (
          <div className="sorts" role="radiogroup" aria-label="정렬">
            {sorts.map((s) => (
              <button
                key={s.key}
                role="radio"
                aria-checked={sort === s.key}
                className={sort === s.key ? 'active' : ''}
                title={s.hint}
                onClick={() => onSortChange(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {sort === 'time' && tab !== 'courses' && (
          <div className="modes" role="radiogroup" aria-label="이동 수단">
            {MODES.map((m) => (
              <button
                key={m.key}
                role="radio"
                aria-checked={travelMode === m.key}
                className={travelMode === m.key ? 'active' : ''}
                style={{ '--mode': m.color }}
                onClick={() => onTravelModeChange(m.key)}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel-body">
        {tab === 'courses' ? (
          <p className="sort-note">코스를 누르면 지도에 동선이 표시됩니다. 담으면 실제 이동 시간을 계산해 드려요.</p>
        ) : (
          <>
            {needsLocation && geoStatus === 'pending' && <p className="sort-note">현재 위치를 확인하는 중…</p>}
            {needsLocation && geoStatus === 'denied' && (
              <p className="notice">
                위치 권한이 없어 이 순서로 정렬할 수 없습니다. 브라우저에서 위치 접근을 허용해 주세요.
              </p>
            )}
            {sort === 'time' && origin && !modeAvailable(travelMode) && (
              <p className="notice">
                {travelMode === 'transit' ? 'ODsay' : 'TMAP'} API 키가 설정되지 않아 이동 시간을 계산할 수 없습니다.
              </p>
            )}
            {sort === 'time' && origin && modeAvailable(travelMode) && (
              <p className="sort-note">
                가까운 {TIME_CANDIDATES}곳의 실제 경로 시간을 비교합니다. 나머지는 직선 거리순입니다.
              </p>
            )}
            {!needsLocation && <p className="sort-note">{SORTS.find((s) => s.key === sort)?.hint}</p>}
          </>
        )}
        {status === 'loading' && <Skeleton />}
        {status === 'error' && <p className="notice">이 지역의 데이터 파일을 찾을 수 없습니다.</p>}
        {status === 'ready' && data && (
          <>
            {tab === 'attractions' && (
              <PlaceList items={data.attractions} {...listProps} empty="등록된 관광지가 없습니다." />
            )}
            {tab === 'stays' && <PlaceList items={data.stays} {...listProps} empty="등록된 숙소가 없습니다." />}
            {tab === 'festivals' && (
              <PlaceList
                items={data.festivals ?? []}
                {...listProps}
                empty="앞으로 4개월 안에 열리는 축제·행사가 없습니다."
              />
            )}
            {tab === 'courses' && (
              <RegionCourses
                courses={courses}
                selectedId={selectedCourseId}
                onSelect={onSelectCourse}
                focusedId={focusedId}
                onFocusStop={onFocusPlace}
                onSaveAll={onSaveCourse}
                isFavorite={isFavorite}
              />
            )}
            {tab === 'restaurants' && (
              <>
                {data.restaurants.length > 0 && (
                  <>
                    <h3 className="section">카카오맵 음식점</h3>
                    <PlaceList items={data.restaurants} {...listProps} />
                  </>
                )}
                <h3 className="section">한국관광공사 추천 음식점</h3>
                <PlaceList items={data.tourRestaurants} {...listProps} empty="등록된 음식점이 없습니다." />
              </>
            )}
            <p className="source muted">
              출처: 한국관광공사 TourAPI, 카카오 로컬
              {meta?.sources?.weather ? ', 기상청' : ''}
              {meta?.sources?.naver ? ', 네이버 검색' : ''} · 갱신{' '}
              {new Date(data.updatedAt).toLocaleDateString('ko-KR')}
              <br />
              영업 여부·시간과 행사 일정은 방문 전 공식 정보를 확인하세요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
