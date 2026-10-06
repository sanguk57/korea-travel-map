# 🗺️ 한국 여행 지도

지도에서 시·군·구를 클릭하면 그 지역의 **관광지 · 맛집 · 숙소 · 축제**를 보여주는 웹앱입니다.
GitHub Pages로 호스팅하며 서버 비용 없이 동작합니다.

**주요 기능**
- 시·군·구 선택, 지역 검색, 3일 날씨 예보
- 추천·신규 등록·최근 업데이트·도착 시간·내 주변·이름·블로그 언급순 정렬
- 장소 상세(운영시간·쉬는 날·주차·사진), 진행 중·예정 축제
- 내 위치에서 자동차·대중교통·도보 소요 시간과 경로
- 지역별 추천 코스 (관광공사 공식 여행코스 + 자동 추천 하루 코스)
- ♥ 찜한 장소로 하루 코스 만들기 (방문 순서 최적화, 구간별 이동 시간)
- 화면 상태가 담긴 공유 링크, 마커 클러스터링

## 구조

```
┌──────────── GitHub Actions (매일 03:00 KST) ────────────┐
│  scripts/fetch-data.mjs                                 │
│   ├─ TourAPI  → 관광지(12) · 숙박(32) · 음식점(39) 전국 │
│   ├─ 카카오 로컬 → 지역별 음식점(FD6)                   │
│   └─ 좌표로 시·군·구 판정 → public/data/places/*.json   │
│  vite build → GitHub Pages 배포                         │
└─────────────────────────────────────────────────────────┘
          ▲ TOUR_API_KEY, KAKAO_REST_KEY는 Secrets에만 존재
브라우저: React + 카카오맵 JS SDK가 정적 JSON만 읽음
```

- GitHub Pages는 서버를 돌릴 수 없으므로, **Actions가 백엔드 역할**을 합니다.
  API 키는 빌드 중에만 쓰이고, 결과물(JSON)에는 들어가지 않습니다.
- 지역 판정은 TourAPI 지역코드 대신 **좌표가 어느 경계 안에 있는지**로 합니다.
  (2025년 법정동 코드 전환으로 지역코드가 비어 있는 데이터가 있기 때문)
- 같은 날 여러 번 push해도 수집 결과를 캐시해서 TourAPI 일일 한도를 아낍니다.

## 1. API 키 발급

### TourAPI (무료)
1. [공공데이터포털](https://www.data.go.kr)에서 **한국관광공사_국문 관광정보 서비스_GW** 활용신청
2. 마이페이지에서 **일반 인증키(Decoding)** 복사 → `TOUR_API_KEY`

### 카카오 (무료 쿼터: 계정의 첫 번째 앱에만 제공)
1. [Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 → 앱 생성
2. **앱 설정 > 카카오맵**에서 카카오맵 API 활성화
3. **앱 키**에서
   - JavaScript 키 → `KAKAO_JS_KEY` (지도 표시용)
   - REST API 키 → `KAKAO_REST_KEY` (맛집 수집용)
4. **플랫폼 > Web > 사이트 도메인**에 등록
   - `http://localhost:5173` (로컬 개발)
   - `https://<GitHub아이디>.github.io` (배포)

> JavaScript 키는 브라우저에 노출되는 게 정상입니다. 등록된 도메인에서만 동작하므로 안전합니다.
> REST 키와 TourAPI 키는 절대 프론트엔드 코드에 넣지 마세요.

## 2. GitHub에 배포

1. GitHub에 새 저장소를 만들고 push
2. **Settings > Secrets and variables > Actions > New repository secret**에 3개 등록curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
node -v   # v22.x 확인

   - `TOUR_API_KEY`, `KAKAO_REST_KEY`, `KAKAO_JS_KEY`
3. **Settings > Pages > Source**를 **GitHub Actions**로 선택
4. **Actions** 탭에서 `Build & Deploy`를 실행(Run workflow)하거나 main에 push
5. `https://<GitHub아이디>.github.io/<저장소명>/` 에서 확인

## 3. 로컬 개발

Node.js 22 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local   # 키 3개 입력
npm run data:fetch           # 장소·축제·날씨 수집 (수 분 소요)
npm run data:enrich          # 장소 상세·블로그 언급 수 (하루 한도 안에서 누적)
npm run dev                  # http://localhost:5173
```

## 파일 구성

| 경로 | 설명 |
|---|---|
| `src/App.jsx` | 상태 관리, 지역 선택 시 JSON 로드 |
| `src/KakaoMap.jsx` | 지도, 시·군·구 경계 폴리곤, 마커 |
| `src/PlacePanel.jsx` | 관광지/맛집/숙소 탭과 목록 |
| `src/CoursePanel.jsx`, `src/course.js` | 찜한 장소로 하루 코스, 방문 순서 최적화 |
| `src/routing.js` | TMAP·ODsay 경로 조회 |
| `scripts/fetch-data.mjs` | API 수집 및 지역별 JSON 생성 (백엔드 역할) |
| `scripts/enrich.mjs` | 장소 상세·블로그 언급 수를 매일 조금씩 누적 |
| `scripts/build-regions.mjs` | 경계 TopoJSON → `public/data/regions.json` 변환 (최초 1회) |
| `.github/workflows/deploy.yml` | 매일 수집 + 빌드 + Pages 배포 |

## 데이터 출처

- 한국관광공사 TourAPI (공공누리)
- 카카오 로컬 API
- 시·군·구 경계: 통계청 SGIS 2018 ([southkorea-maps](https://github.com/southkorea/southkorea-maps), 공공누리 제1유형)
