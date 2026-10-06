// 화면 상태를 주소(?r=지역&t=탭&p=장소&s=정렬&v=course)에 담아 링크로 공유할 수 있게 한다.
const KEYS = { region: 'r', tab: 't', place: 'p', sort: 's', view: 'v' };
const DEFAULTS = { tab: 'attractions', sort: 'recommended', view: 'explore' };

export function readUrlState() {
  const q = new URLSearchParams(window.location.search);
  const out = {};
  for (const [name, key] of Object.entries(KEYS)) out[name] = q.get(key) || DEFAULTS[name] || null;
  return out;
}

export function writeUrlState(state) {
  const q = new URLSearchParams();
  for (const [name, key] of Object.entries(KEYS)) {
    const v = state[name];
    if (v && v !== DEFAULTS[name]) q.set(key, v);
  }
  const search = q.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ''}`;
  if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url);
}

/** 현재 주소를 공유한다. 모바일은 공유 시트, 데스크톱은 클립보드 복사. 결과 메시지를 돌려준다. */
export async function shareCurrentUrl(title) {
  const url = window.location.href;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title, url });
      return null;
    }
    await navigator.clipboard.writeText(url);
    return '링크를 복사했어요';
  } catch (e) {
    if (e?.name === 'AbortError') return null;
    window.prompt('아래 링크를 복사하세요', url);
    return null;
  }
}
