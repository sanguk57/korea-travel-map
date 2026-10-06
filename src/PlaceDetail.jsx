import { useEffect, useState } from 'react';
import { naverPlace } from './mapLinks.js';

const DETAILS = `${import.meta.env.BASE_URL}data/details/`;
const cache = new Map(); // contentId -> Promise<detail | null>

function loadDetail(contentId) {
  if (!cache.has(contentId)) {
    cache.set(
      contentId,
      fetch(`${DETAILS}${contentId}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return cache.get(contentId);
}

// 원본 블로그 이미지는 수 MB인 경우가 많아 카카오 썸네일만 보여주고, 누르면 출처 글로 이동한다
function WebPhoto({ photo }) {
  return (
    <a href={photo.src} target="_blank" rel="noreferrer" title="사진 출처 글 보기">
      <img src={photo.t} alt="" loading="lazy" />
    </a>
  );
}

function WebPhotos({ photos }) {
  if (!photos?.length) return null;
  return (
    <>
      <div className="gallery">
        {photos.map((p) => (
          <WebPhoto key={p.t} photo={p} />
        ))}
      </div>
      <p className="photo-credit muted">사진: 블로그 검색 결과 (누르면 출처 글로 이동) · 실제와 다를 수 있어요</p>
    </>
  );
}

// 리뷰·메뉴·영업시간은 네이버 지도홈 / 카카오맵 상세에서 본다
function ExternalHomes({ place, regionName }) {
  return (
    <div className="homes">
      <a className="home-btn naver" href={naverPlace(regionName, place.title)} target="_blank" rel="noreferrer">
        <b>N</b>
        <span>
          네이버 지도홈
          <small>리뷰 · 메뉴 · 영업시간</small>
        </span>
      </a>
      <a className="home-btn kakao" href={place.url} target="_blank" rel="noreferrer">
        <b>K</b>
        <span>
          카카오맵 상세
          <small>후기 · 사진 · 길찾기</small>
        </span>
      </a>
    </div>
  );
}

/** 선택한 장소 카드 아래에 펼쳐지는 상세 정보 */
export default function PlaceDetail({ place, regionName }) {
  const contentId = place.id.replace(/^tour-/, '');
  const [detail, setDetail] = useState(undefined); // undefined: 로딩, null: 없음
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetail(undefined);
    setExpanded(false);
    if (place.source !== 'tour' || !place.detail) {
      setDetail(null);
      return;
    }
    loadDetail(contentId).then((d) => alive && setDetail(d));
    return () => {
      alive = false;
    };
  }, [contentId, place.source, place.detail]);

  const stop = (e) => e.stopPropagation();

  // 카카오 맛집: 관광공사 상세가 없으므로 사진 + 분류 + 외부 지도 홈으로 안내
  if (place.source === 'kakao') {
    return (
      <div className="detail" onClick={stop}>
        <WebPhotos photos={place.photos} />
        {place.category && (
          <dl className="info">
            <div>
              <dt>분류</dt>
              <dd>{place.category.replaceAll(' > ', ' · ')}</dd>
            </div>
            {place.tel && (
              <div>
                <dt>전화</dt>
                <dd>{place.tel}</dd>
              </div>
            )}
          </dl>
        )}
        <ExternalHomes place={place} regionName={regionName} />
      </div>
    );
  }

  if (detail === undefined) return <div className="detail muted small">상세 정보 불러오는 중…</div>;
  if (detail === null) {
    const search = `https://korean.visitkorea.or.kr/search/search_list.do?keyword=${encodeURIComponent(place.title)}`;
    return (
      <div className="detail" onClick={stop}>
        <WebPhotos photos={place.photos} />
        <div className="detail-pending small">
          <span className="muted">관광공사 상세 정보는 아직 준비 중이에요. 인기 장소부터 매일 채워집니다.</span>
          <a className="chip-link" href={search} target="_blank" rel="noreferrer">
            대한민국 구석구석에서 보기 ↗
          </a>
        </div>
        <ExternalHomes place={place} regionName={regionName} />
      </div>
    );
  }

  const long = (detail.overview?.length ?? 0) > 160;
  return (
    <div className="detail" onClick={stop}>
      {detail.images?.length > 0 ? (
        <div className="gallery">
          {detail.images.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      ) : (
        <WebPhotos photos={place.photos} />
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
      <ExternalHomes place={place} regionName={regionName} />
    </div>
  );
}
