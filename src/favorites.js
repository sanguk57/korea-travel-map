import { useCallback, useEffect, useState } from 'react';

// 찜한 장소는 이 브라우저에만 저장한다 (로그인 없음)
const STORAGE_KEY = 'favorites:v1';

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// 코스·목록 표시에 필요한 필드만 저장한다
const snapshot = (p, regionCode) => ({
  id: p.id,
  source: p.source,
  title: p.title,
  addr: p.addr,
  lat: p.lat,
  lng: p.lng,
  image: p.image,
  url: p.url,
  category: p.category,
  start: p.start,
  end: p.end,
  regionCode,
});

export function useFavorites() {
  const [favorites, setFavorites] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // 저장 실패는 무시 (시크릿 모드 등)
    }
  }, [favorites]);

  // 다른 탭에서 바꾼 내용도 반영
  useEffect(() => {
    const onStorage = (e) => e.key === STORAGE_KEY && setFavorites(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isFavorite = useCallback((id) => favorites.some((f) => f.id === id), [favorites]);

  const toggleFavorite = useCallback((place, regionCode) => {
    setFavorites((list) =>
      list.some((f) => f.id === place.id) ? list.filter((f) => f.id !== place.id) : [...list, snapshot(place, regionCode)],
    );
  }, []);

  // 이미 담긴 곳은 건너뛰고 순서대로 추가
  const addFavorites = useCallback((places, regionCode) => {
    setFavorites((list) => {
      const have = new Set(list.map((f) => f.id));
      return [...list, ...places.filter((p) => !have.has(p.id)).map((p) => snapshot(p, regionCode))];
    });
  }, []);

  return { favorites, setFavorites, isFavorite, toggleFavorite, addFavorites };
}
