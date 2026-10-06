import { MODES, formatMinutes } from './routing.js';

const formatMeters = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}km` : `${Math.round(m)}m`);
const modeOf = (key) => MODES.find((m) => m.key === key);

function Leg({ leg }) {
  if (!leg || leg.status === 'loading') return <div className="leg muted">경로 계산 중…</div>;
  if (leg.error) return <div className="leg leg-error">{leg.error}</div>;
  const m = modeOf(leg.mode);
  return (
    <div className="leg" style={{ '--mode': m.color }}>
      <span className="leg-mode">
        {m.icon} {formatMinutes(leg.route.minutes)}
      </span>
      {leg.route.meters ? <span className="muted">{formatMeters(leg.route.meters)}</span> : null}
      {leg.route.summary && <span className="muted leg-summary">{leg.route.summary}</span>}
      {leg.note && <span className="muted">· {leg.note}</span>}
    </div>
  );
}

export default function CoursePanel({
  favorites,
  regionName,
  onReorder,
  onRemove,
  onClear,
  onOptimize,
  legs,
  mode,
  onModeChange,
  fromMyLocation,
  onFromMyLocationChange,
  origin,
  geoStatus,
  focusedId,
  onFocus,
  onBack,
}) {
  const ready = legs.filter((l) => l?.route);
  const totalMin = ready.reduce((s, l) => s + l.route.minutes, 0);
  const totalM = ready.reduce((s, l) => s + (l.route.meters ?? 0), 0);
  const pending = legs.some((l) => !l || l.status === 'loading');
  const startsAtMe = fromMyLocation && origin;
  // legs[i]는 i번째 장소에 도착하는 구간 (내 위치에서 출발하지 않으면 legs[0]은 비어 있다)
  const legTo = (i) => legs[i];

  return (
    <div className="panel">
      <div className="panel-head">
        <button className="back" onClick={onBack}>
          ← 장소 둘러보기
        </button>
        <p className="eyebrow">찜 {favorites.length}곳</p>
        <h2>내 하루 코스</h2>

        {favorites.length > 0 && (
          <>
            <div className="modes" role="radiogroup" aria-label="이동 수단">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  role="radio"
                  aria-checked={mode === m.key}
                  className={mode === m.key ? 'active' : ''}
                  style={{ '--mode': m.color }}
                  onClick={() => onModeChange(m.key)}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <div className="course-tools">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={fromMyLocation}
                  onChange={(e) => onFromMyLocationChange(e.target.checked)}
                />
                내 위치에서 출발
              </label>
              <button className="chip-btn" onClick={onOptimize} disabled={favorites.length < 2}>
                ✨ 최적 순서로
              </button>
              <button className="chip-btn danger" onClick={onClear}>
                비우기
              </button>
            </div>
          </>
        )}
      </div>

      <div className="panel-body">
        {favorites.length === 0 ? (
          <div className="empty-course">
            <div className="empty-icon" aria-hidden="true">♡</div>
            <p>
              장소 카드의 <strong>♡</strong>를 눌러 가고 싶은 곳을 담아 보세요.
              <br />
              담은 곳들을 효율적인 순서로 묶고 구간별 이동 시간을 계산해 드려요.
            </p>
          </div>
        ) : (
          <>
            <div className="course-summary">
              <div>
                <span className="muted">총 이동</span>
                <strong>{ready.length ? formatMinutes(totalMin) : '—'}</strong>
              </div>
              <div>
                <span className="muted">총 거리</span>
                <strong>{totalM ? formatMeters(totalM) : '—'}</strong>
              </div>
              <div>
                <span className="muted">장소</span>
                <strong>{favorites.length}곳</strong>
              </div>
              {pending && <span className="muted small">계산 중…</span>}
            </div>
            {fromMyLocation && !origin && (
              <p className="notice">
                {geoStatus === 'denied'
                  ? '위치 권한이 없어 첫 장소에서 출발하는 것으로 계산했어요.'
                  : '현재 위치를 확인하는 중…'}
              </p>
            )}

            <ol className="course">
              {startsAtMe && (
                <li className="stop start">
                  <span className="stop-num">●</span>
                  <div className="stop-body">
                    <strong>내 위치</strong>
                  </div>
                </li>
              )}
              {favorites.map((p, i) => (
                <li key={p.id} className="course-item">
                  {(i > 0 || startsAtMe) && <Leg leg={legTo(i)} />}
                  <div className={`stop ${focusedId === p.id ? 'focused' : ''}`} onClick={() => onFocus(p.id)}>
                    <span className="stop-num">{i + 1}</span>
                    {p.image ? <img className="stop-thumb" src={p.image} alt="" loading="lazy" /> : null}
                    <div className="stop-body">
                      <strong>{p.title}</strong>
                      <span className="muted small">{regionName(p.regionCode)}</span>
                    </div>
                    <div className="stop-actions" onClick={(e) => e.stopPropagation()}>
                      <button aria-label="위로" disabled={i === 0} onClick={() => onReorder(i, i - 1)}>
                        ↑
                      </button>
                      <button aria-label="아래로" disabled={i === favorites.length - 1} onClick={() => onReorder(i, i + 1)}>
                        ↓
                      </button>
                      <button aria-label="코스에서 빼기" onClick={() => onRemove(p)}>
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="source muted">
              ✨ 최적 순서는 직선 거리 기준으로 가장 짧게 도는 순서를 계산합니다. 대중교통으로 갈 수 없는 짧은 구간은 도보로
              안내합니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
