import { useEffect, useState } from 'react';

const DETAILS = `${import.meta.env.BASE_URL}data/details/`;
const cache = new Map(); // contentId -> Promise<detail | null>

function loadDetail(contentId) {
  if (!cache.has(contentId)) {
    cache.set(
      contentId,
      fetch(`${DETAILS}${contentId}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    );
  }
  return cache.get(contentId);
}

/** 선택한 장소 카드 아래에 펼쳐지는 상세 정보 (관광공사 데이터 중 수집된 곳만) */
export default function PlaceDetail({ place }) {
  const contentId = place.id.replace(/^tour-/, '');
  const [detail, setDetail] = useState(undefined); // undefined: 로딩, null: 없음
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetail(undefined);
    setExpanded(false);
    if (!place.detail) {
      setDetail(null);
      return;
    }
    loadDetail(contentId).then((d) => alive && setDetail(d));
    return () => {
      alive = false;
    };
  }, [contentId, place.detail]);

  if (place.source !== 'tour') return null;
  if (detail === undefined) return <div className="detail muted small">상세 정보 불러오는 중…</div>;
  if (detail === null) {
    return <div className="detail muted small">상세 정보는 아직 준비 중이에요. 인기 장소부터 매일 조금씩 채워집니다.</div>;
  }

  const long = (detail.overview?.length ?? 0) > 160;
  return (
    <div className="detail" onClick={(e) => e.stopPropagation()}>
      {detail.images?.length > 0 && (
        <div className="gallery">
          {detail.images.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {detail.overview && (
        <p className={`overview ${expanded || !long ? 'open' : ''}`}>
          {detail.overview}
          {long && (
            <button className="more" onClick={() => setExpanded((v) => !v)}>
              {expanded ? '접기' : '더 보기'}
            </button>
          )}
        </p>
      )}
      {detail.info?.length > 0 && (
        <dl className="info">
          {detail.info.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {detail.homepage && (
        <a className="chip-link" href={detail.homepage} target="_blank" rel="noreferrer">
          홈페이지 ↗
        </a>
      )}
    </div>
  );
}
