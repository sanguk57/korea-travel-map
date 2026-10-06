# 길찾기 API 키 발급 가이드 (TMAP · ODsay)

장소를 선택하면 **내 위치 → 장소**까지 자동차·대중교통·도보 소요 시간과 경로를 보여주고,
목록을 **도착 시간순**으로 정렬하는 기능에 필요한 키입니다.

| 이동 수단 | 사용 API | 환경변수 (로컬) | GitHub Secret (배포) |
|---|---|---|---|
| 🚗 자동차, 🚶 도보 | TMAP (SK open API) | `VITE_TMAP_APP_KEY` | `TMAP_APP_KEY` |
| 🚌 대중교통 | ODsay LAB | `VITE_ODSAY_API_KEY` | `ODSAY_API_KEY` |

- 두 키는 **선택 사항**입니다. 없으면 길찾기 카드에 해당 수단만 `—`로 표시되고 나머지 기능은 그대로 동작합니다.
- 두 키 모두 **브라우저에서 직접 호출**하므로 배포된 페이지의 JS 파일에 키가 들어갑니다. 아래 [보안 주의](#보안-주의)를 꼭 읽어주세요.

> 카카오는 자동차 길찾기 API(카카오모빌리티)가 REST 키를 요구해 정적 사이트에서 안전하게 쓸 수 없고,
> 대중교통 길찾기 API는 공개하지 않아 TMAP과 ODsay를 사용합니다.

---

## 1. TMAP 앱 키 (자동차 · 도보)

1. [SK open API](https://openapi.sk.com)에 회원가입 후 로그인
2. 상단 **마이페이지 > 앱 관리**(또는 *My Project*)에서 **앱 생성**
   - 앱 이름 예: `korea-travel-map`
3. 생성한 앱에서 **TMAP** 상품을 찾아 **사용 신청**
   - 요금제는 **무료(Free)** 를 선택합니다. 무료 요금제의 일일 호출 한도는 상품 상세 화면에서 확인할 수 있습니다.
   - 이 앱은 *경로안내(자동차)* 와 *보행자 경로안내* 두 가지를 사용합니다.
4. 앱 상세 화면의 **App Key**를 복사

### 사용하는 API

| 기능 | 엔드포인트 |
|---|---|
| 자동차 경로 | `POST https://apis.openapi.sk.com/tmap/routes?version=1` |
| 보행자 경로 | `POST https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1` |

키는 요청 헤더 `appKey`로 보냅니다 ([src/routing.js](../src/routing.js)).
직선 거리 25km를 넘는 곳은 도보 경로를 요청하지 않습니다.

---

## 2. ODsay LAB 키 (대중교통)

1. [ODsay LAB](https://lab.odsay.com)에 회원가입 후 로그인
2. **애플리케이션 관리**(또는 마이페이지)에서 **애플리케이션 등록**
3. 플랫폼은 반드시 **Web**을 선택하고, URI에 사이트 주소를 등록합니다.

   ```
   http://localhost:5173
   https://sanguk57.github.io
   ```
   - 프로토콜(`http://`, `https://`)을 포함하고, 경로(`/korea-travel-map/`)는 빼고 적습니다.
   - 여기 등록되지 않은 주소에서 호출하면 `ApiKeyAuthFailed` 오류가 납니다.
4. 발급된 **API Key**를 복사
   - 키에 `/`, `+`, `=` 같은 특수문자가 들어 있어도 **그대로** 붙여 넣으세요. 인코딩은 코드에서 처리합니다.

### 사용하는 API

| 기능 | 엔드포인트 |
|---|---|
| 대중교통 경로 검색 | `GET https://api.odsay.com/v1/api/searchPubTransPathT` |
| 노선 모양(지도에 그릴 선) | `GET https://api.odsay.com/v1/api/loadLane` |

장소 하나를 선택할 때 ODsay를 **2회**(경로 + 노선 모양) 호출합니다.
출발지와 도착지가 700m 이내이면 ODsay가 경로를 주지 않으므로 "가까워서 걸어가는 게 빨라요"로 안내합니다.

---

## 3. 키 넣기

### 로컬 개발 — `.env.local`

```bash
VITE_TMAP_APP_KEY=발급받은_TMAP_App_Key
VITE_ODSAY_API_KEY=발급받은_ODsay_API_Key
```

- `=` 뒤에 공백이나 따옴표 없이 적습니다.
- `.env.local`을 바꾼 뒤에는 `npm run dev`를 **다시 시작**해야 반영됩니다.

### 배포 — GitHub Secrets

저장소 **Settings > Secrets and variables > Actions > New repository secret**에서 등록합니다.
이름에 `VITE_`를 **붙이지 않습니다** (워크플로가 빌드할 때 붙여줍니다).

| Name | Value |
|---|---|
| `TMAP_APP_KEY` | TMAP App Key |
| `ODSAY_API_KEY` | ODsay API Key |

CLI로 등록하려면:

```bash
gh secret set TMAP_APP_KEY  -R sanguk57/korea-travel-map
gh secret set ODSAY_API_KEY -R sanguk57/korea-travel-map
```

등록 후 **Actions > Build & Deploy > Run workflow**로 다시 배포해야 사이트에 반영됩니다.

---

## 4. 동작 확인

터미널에서 키가 살아 있는지 먼저 확인할 수 있습니다 (서울시청 → 광화문).

```bash
# TMAP 자동차: "totalTime"(초)이 보이면 정상
curl -s -X POST 'https://apis.openapi.sk.com/tmap/routes?version=1&format=json' \
  -H "appKey: $VITE_TMAP_APP_KEY" -H 'Content-Type: application/json' \
  -d '{"startX":126.978,"startY":37.5665,"endX":126.977,"endY":37.5759}' | grep -o '"totalTime":[0-9]*'

# ODsay: Web 키는 등록한 URI를 Referer로 보내야 통과합니다. "totalTime"(분)이 보이면 정상
curl -s -G 'https://api.odsay.com/v1/api/searchPubTransPathT' \
  -H 'Referer: http://localhost:5173/' \
  --data-urlencode "apiKey=$VITE_ODSAY_API_KEY" \
  -d SX=126.978 -d SY=37.5665 -d EX=127.0276 -d EY=37.4979 | grep -o '"totalTime":[0-9]*' | head -1
```

브라우저에서는:

1. 지역을 고르고 장소를 클릭 → 지도 왼쪽 아래 길찾기 카드 표시
2. **📍 내 위치에서 걸리는 시간 보기** → 브라우저 위치 권한 **허용**
3. 자동차 / 대중교통 / 도보 시간이 채워지고, 선택한 수단의 경로가 지도에 그려지면 성공

---

## 5. 문제 해결

| 증상 | 원인과 해결 |
|---|---|
| 카드에 `—`, 아래에 "TMAP/ODsay 키가 설정되지 않았습니다" | 환경변수 이름 확인(`VITE_` 접두사), `npm run dev` 재시작. 배포라면 Secret 등록 후 재배포 |
| ODsay `ApiKeyAuthFailed` | Web 플랫폼 URI에 현재 주소가 없음. `localhost`와 `127.0.0.1`은 서로 다른 주소로 취급됩니다 |
| TMAP 403 / 인증 오류 | 앱에 TMAP 상품 사용 신청이 안 됐거나 키 오타 |
| TMAP 429 / 한도 초과 | 무료 일일 한도 소진. 다음 날 초기화 |
| "위치 권한이 없어…" | 브라우저 주소창 왼쪽 자물쇠 → 위치 → 허용. `http://`는 `localhost`에서만 위치를 쓸 수 있습니다 |
| "대중교통 경로가 없습니다" | 섬 지역, 심야, 또는 너무 먼 거리(시외 구간) 등 ODsay가 경로를 찾지 못한 경우 |

---

## 보안 주의

정적 사이트(GitHub Pages)는 서버가 없어서 키를 숨길 수 없습니다. 배포된 JS에서 누구나 키를 볼 수 있습니다.

- **ODsay**: Web 키는 등록한 URI에서만 동작하므로 다른 사이트에서 가져다 쓰기 어렵습니다.
- **TMAP**: App Key에 ODsay 같은 도메인 제한을 걸 수 없다면, 노출된 키로 남이 내 한도를 쓸 수 있습니다.
  앱 관리 화면에 허용 도메인/IP 설정이 있으면 `sanguk57.github.io`, `localhost`로 제한해 두세요.
  **결제 수단을 등록하지 않은 무료 요금제로만 사용**하세요. 한도를 넘으면 호출이 막힐 뿐 요금이 청구되지 않습니다.
- 한도가 이상하게 빨리 줄면 콘솔에서 키를 **재발급**하고 Secret만 바꾼 뒤 재배포하면 됩니다.
- TourAPI 키와 카카오 **REST** 키는 이와 달리 절대 `VITE_` 변수로 만들지 마세요(브라우저로 나갑니다).

### 호출량 참고

| 동작 | 호출 수 |
|---|---|
| 장소 1곳 선택 | TMAP 2회(자동차·도보) + ODsay 2회 |
| 도착 시간순 정렬 1회 | 선택한 수단으로 최대 15회 (가까운 15곳) |

같은 출발지·도착지 결과는 페이지를 새로고침하기 전까지 캐시되어 다시 호출하지 않습니다.
