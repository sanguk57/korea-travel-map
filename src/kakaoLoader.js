// 카카오맵 JS SDK를 한 번만 로드한다.
// JavaScript 키는 브라우저에 노출되는 것이 정상이며, 카카오 개발자 콘솔의
// "플랫폼 > Web 사이트 도메인"에 등록된 도메인에서만 동작한다.
let promise;

export function loadKakaoMaps(appKey) {
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    if (!appKey) {
      reject(new Error('VITE_KAKAO_JS_KEY가 설정되지 않았습니다.'));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = () =>
      reject(new Error('카카오맵 SDK를 불러오지 못했습니다. JavaScript 키와 등록된 도메인을 확인하세요.'));
    document.head.appendChild(script);
  });
  return promise;
}
