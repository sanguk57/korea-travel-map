import { FavButton } from './PlacePanel.jsx';
import { MODES, formatMinutes } from './routing.js';

const formatMeters = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}km` : `${Math.round(m)}m`);

function kakaoDirections(origin, place) {
  const to = `${encodeURIComponent(place.title)},${place.lat},${place.lng}`;
  return origin
    ? `https://map.kakao.com/link/from/${encodeURIComponent('내 위치')},${origin.lat},${origin.lng}/to/${to}`
    : `https://map.kakao.com/link/to/${to}`;
}

export default function RouteCard({
  place,
  origin,
  geoStatus,
  onRequestLocation,
  routes,
  mode,
  onModeChange,
  onClose,
  favorite,
  onToggleFavorite,
  onShare,
}) {
  const current = routes[mode];

  return (
    <section className="route-card" aria-label="길찾기">
      <header className="route-head">
        <div>
          <p className="eyebrow">내 위치에서</p>
          <h3>{place.title}</h3>
        </div>
        <div className="route-head-actions">
          <FavButton active={favorite} onClick={onToggleFavorite} />
          <button className="route-close" onClick={onShare} aria-label="링크 공유" title="이 장소 링크 복사">
            🔗
          </button>
          <button className="route-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
      </header>

      {!origin ? (
        <div className="route-locate">
          {geoStatus === 'denied' ? (
            <p>위치 권한이 없어 이동 시간을 계산할 수 없습니다. 브라우저에서 위치 접근을 허용해 주세요.</p>
          ) : (
            <button className="primary" onClick={onRequestLocation} disabled={geoStatus === 'pending'}>
              {geoStatus === 'pending' ? '위치 확인 중…' : '📍 내 위치에서 걸리는 시간 보기'}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="route-modes" role="radiogroup" aria-label="이동 수단">
            {MODES.map((m) => {
              const r = routes[m.key];
              return (
                <button
                  key={m.key}
                  role="radio"
                  aria-checked={mode === m.key}
                  className={mode === m.key ? 'active' : ''}
                  style={{ '--mode': m.color }}
                  onClick={() => onModeChange(m.key)}
                >
                  <span className="route-mode-label">
                    {m.icon} {m.label}
                  </span>
                  <strong>
                    {!r || r.status === 'loading' ? (
                      <span className="dots">···</span>
                    ) : r.status === 'ready' ? (
                      formatMinutes(r.route.minutes)
                    ) : (
                      '—'
                    )}
                  </strong>
                </button>
              );
            })}
          </div>
          <p className="route-detail">
            {current?.status === 'ready' && (
              <>
                {current.route.meters ? `${formatMeters(current.route.meters)}` : ''}
                {current.route.summary ? ` · ${current.route.summary}` : ''}
              </>
            )}
            {current?.status === 'error' && current.error}
            {current?.status === 'loading' && '경로를 찾는 중…'}
          </p>
        </>
      )}

      <a className="route-link" href={kakaoDirections(origin, place)} target="_blank" rel="noreferrer">
        카카오맵에서 길찾기 ↗
      </a>
    </section>
  );
}
