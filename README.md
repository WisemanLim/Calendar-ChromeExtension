# Wise Calendar — Chrome Extension

[English](README.en.md) · PRD: [.docs/PRD.md](.docs/PRD.md)

iOS·Android 의 **Wise Calendar** 를 데스크톱 Chrome 에서 쓰도록 옮긴 Manifest V3 확장 프로그램입니다.
큰 날짜 히어로 화면과, 플래너 모드별 **템플릿 입력(복용·약속·고정/반복) + 반복 주기(매일·매주·매년)** 를 그대로 제공합니다.
iOS 소스(`Calendar-iOS/Calendar/*.swift`)를 기준으로 포팅했습니다.

## 주요 기능

| 영역 | 내용 |
|------|------|
| 메인 | `⚙ ⇥ / [Today] ‹ 년 › / ⌕ ＋` · `‹ MONTH YEAR ›` · 주간 스트립(날씨/이모지) · 큰 날짜 히어로(이벤트 수 무지개색) · 음력·최고기온 · 일정 목록 · 미니 달력 2개 |
| 제스처 | 히어로 좌우 드래그=전일/익일 · 더블클릭=추가 · 롱프레스 0.6s=1회 입력방식 선택 · 주간 스트립 드래그=±7일 · 미니 달력 드래그=월 이동 · 아래로 당기기=새로고침 |
| 플래너 모드 | 일기(전체화면·경과시간·시작/종료 자동) · 업무 이벤트(할 일 체크리스트+Due Date, 회의·세미나·회식) · 개인 이벤트(복용·약속·고정/반복) |
| 템플릿 | iOS `templates.v3` 15종 · 날짜 패턴 `yyyy-mm-dd` `yyyy/mm/dd` `yy-mm-dd` `yyyy.mm.dd` `dd-mm-yyyy` `d###` 치환 |
| 반복 | 매일 / 매주(요일) / 매년 + 반복 시작·종료일 · **개별 등록**(기본 ON: 날짜별 개별 이벤트) · 패턴 없는 복용/고정은 자동 매년 반복 |
| 이벤트 관리 | 클릭=편집(시작 변경 시 원본 간격 유지) · 우클릭/롱프레스=복사·반복복사(내용포함/제외)·삭제 · 검색(-1년~+2년) |
| 저장소 | 기본 **로컬**(`chrome.storage.local`) · 설정에서 **Google Calendar** 연동 |
| 기타 | 알림(당일 09:00, `chrome.alarms`) · 날씨(Open-Meteo + 위치) · 복용 사진 첨부 · 다크/라이트 · 온보딩 4단계 · 고객지원 · 사이드패널 |

## 설치 (개발자 모드)

1. `chrome://extensions` → 우측 상단 **개발자 모드** ON
2. **압축해제된 확장 프로그램을 로드** → 이 폴더(`Calendar-ChromeExtension`) 선택
3. 툴바 퍼즐 아이콘에서 Wise Calendar 고정 → 클릭하면 팝업, 팝업의 **⇥** 버튼으로 사이드패널

배포용 zip: `make package` → `dist/wise-calendar-<version>.zip` (Chrome 웹 스토어 업로드용)

## Google Calendar 연동 (선택)

설정(⚙) → 캘린더 연동 → **Google Calendar** 를 누르면 연동 화면이 열립니다.

- **브라우저 로그인 계정** — Chrome 프로필에 로그인된 계정을 보여 주고, `[<계정> 계정으로 권한 요청]` 버튼으로 그 계정의 Google 동의 화면을 엽니다.
- **요청 권한** — 캘린더 일정 보기·추가·수정·삭제(`calendar.events`), 캘린더 목록 보기(`calendar.readonly`).
- 동의 후 표시할 캘린더를 고르면 끝. 새 이벤트는 기본 캘린더에 저장되고, 로컬 데이터는 옮겨지지 않습니다.

Google 은 앱마다 OAuth 클라이언트가 있어야 권한을 줍니다(최초 1회 등록). 두 방법 중 하나:

**B) 설정 화면에 클라이언트 ID 입력 (manifest 수정 불필요, 권장)**
1. [Google Cloud Console](https://console.cloud.google.com/) → **Google Calendar API** 사용 설정
2. OAuth 동의 화면 구성 → 범위 `calendar.events`, `calendar.readonly` · 게시 상태가 '테스트'면 **테스트 사용자**에 사용할 계정 추가
3. 사용자 인증 정보 → OAuth 클라이언트 ID → 유형 **웹 애플리케이션** → **승인된 리디렉션 URI** 에 연동 화면에 표시된 `https://<확장ID>.chromiumapp.org/` 등록
4. 발급된 클라이언트 ID 를 연동 화면 입력칸에 붙여넣기 → 권한 요청 (계정 선택에 로그인 계정이 미리 지정됨)

**A) manifest 에 Chrome 확장 유형 클라이언트 지정**
1. `manifest.json` 에 `"key"` 를 추가해 확장 ID 고정(웹 스토어 등록 시 자동)
2. OAuth 클라이언트 ID 유형 **Chrome 확장 프로그램**, 항목 ID = 확장 ID
3. `oauth2.client_id` 의 `YOUR_OAUTH_CLIENT_ID...` 교체 → 확장 새로고침. 이후 Chrome 로그인 계정으로 바로 권한 요청(`getAuthToken`)

클라이언트 ID 가 없으면 오류 대신 위 등록 절차와 확장 ID·리디렉션 URI(복사 버튼)를 보여 줍니다.

## 권한

| 권한 | 용도 |
|------|------|
| `storage`, `unlimitedStorage` | 설정·템플릿·로컬 이벤트·사진 저장 |
| `alarms`, `notifications` | 이벤트 당일 09:00 알림 |
| `sidePanel` | 사이드패널 표시 |
| `identity`, `identity.email` | Google 권한 요청, 브라우저 로그인 계정 표시(연동 시) |
| `geolocation` | 날씨 조회용 위치 |
| host: `api.open-meteo.com`, `www.googleapis.com` | 날씨, Google Calendar API |

## 구조

```
Calendar-ChromeExtension/
├── manifest.json        # MV3 — popup + side_panel + service worker
├── app.html             # 팝업/사이드패널 공용(?view=panel)
├── background.js        # 알람 → chrome.notifications
├── css/app.css          # iOS 테마 토큰, 다크모드
├── icons/               # iOS AppIcon 리사이즈
├── js/
│   ├── main.js          # RootView: 로드 → 온보딩 분기 → 메인
│   ├── core/            # 순수 로직 (iOS CalendarLogic/PlannerLogic/EventTemplate 포팅)
│   │   ├── calendarLogic.js  plannerLogic.js  plannerMode.js  templates.js
│   │   ├── recurrence.js     # 반복 전개 + RRULE
│   │   ├── editorPlan.js     # 에디터 save() → 저장할 이벤트 목록
│   │   └── eventFormat.js    # 무지개색·이모지·음력·날씨 코드
│   ├── platform/        # 저장소·외부 연동
│   │   ├── storage.js  settings.js  templateStore.js  imageStore.js
│   │   ├── eventStore.js     # EventStoreManager: 월 캐시·이벤트 수 캐시
│   │   ├── localCalendar.js  googleCalendar.js
│   │   └── weather.js  notifications.js
│   └── ui/              # 화면 (iOS View 대응)
│       ├── calendarView.js  editor.js  eventSheets.js
│       └── settingsView.js  supportView.js  onboarding.js  dom.js
├── test/unit/           # node --test (49)
├── test/e2e/run.mjs     # Playwright 로 확장 실제 로드 (35)
└── test/impl/<N>/       # Epic 별 시험 시나리오·결과·로그
```

## 저장 키 (iOS UserDefaults 키 준용)

| 키 | 내용 |
|----|------|
| `settings.plannerMode` | `diary` / `todo` / `personalEvent` (기본 `todo`) |
| `settings.notificationsEnabled` · `settings.onboardingCompleted` · `settings.lastSeenVersion` | 알림·온보딩 |
| `settings.appColorScheme` | `system` / `dark` / `light` |
| `settings.storageMode` · `settings.enabledCalendarIDs` | `local` / `google`, 표시 캘린더(빈 배열=전체) |
| `settings.googleClientId` · `google.webToken` | 설정에 입력한 OAuth 클라이언트 ID, 웹 인증 토큰 캐시(만료 포함) |
| `templates.v3` | 템플릿 |
| `events.local.v1` | 로컬 이벤트(반복은 master+rule+exdates) |
| `eventImage.<id>` | 사진 JPEG dataURL |
| `wc.eventCountCache` · `wc.dailyWeather` · `wc.dailyTemperature` · `wc.lastFetchDate` | 캐시 |
| `wc-remind:<uuid>` | 예약 알림 본문 |

## 개발 · 시험

```bash
make test      # 단위 시험 (Node 20+, 의존성 없음)
make lint      # manifest JSON + JS 구문 검사
make package   # dist/*.zip
```

E2E(선택) — Playwright 는 프로젝트 의존성이 아니므로 별도 위치에 설치해 경로를 넘깁니다.

```bash
mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright && npx playwright install chromium
cd <이 폴더>
PLAYWRIGHT=/tmp/pw/node_modules/playwright node test/e2e/run.mjs test/e2e/out
# 이미 받은 Chromium 을 쓰려면 CHROMIUM_PATH=<실행파일 경로> 추가
```

### 시험 결과 (2026-10-19)

| 차수 | Epic | 시험 | 판정 |
|------|------|------|------|
| impl/1 | 순수 로직 포팅 | unit 25 (KST·EST) | PASS |
| impl/2 | 저장소 계층·에디터 저장 계획 | unit 16 | PASS |
| impl/3 | 메인 캘린더 UI | E2E 12 | PASS* |
| impl/4 | 이벤트 에디터 | E2E 8 | PASS* |
| impl/5 | 수정·복사·삭제·검색 | E2E 5 | PASS* |
| impl/6 | 설정·온보딩·고객지원·사이드패널 | E2E 7 | PASS* |
| impl/7 | 알림·날씨 | unit 3 + E2E 2 | PASS* |
| impl/8 | Google Calendar 연동 | unit 5 + E2E 1 | PASS* (실 계정 연동은 client_id 필요 — 미검증) |

\* E2E 전체 35/35 PASS 는 마지막 수정(EventStore 무효화 세대·테마 즉시 적용·테스트 동기화 보강) **이전** 실행 결과입니다.
수정 후 단위 시험 49/49 는 PASS, E2E 재실행은 시스템 부하로 지연되어 11/35(실행분 전부 PASS) 진행 중 중단했습니다. `make e2e` 로 재검증이 필요합니다.

## 트러블슈팅 (구현 중 실제 겪은 문제)

- **재렌더 시 시트·온보딩이 사라짐** — 메인 뷰가 `#app` 전체를 다시 그려 그 위의 오버레이까지 지웠음 → 메인 전용 호스트(`.main-host`)로 분리.
- **반복 이벤트의 사진이 편집 화면에 안 보임** — 발생 id(`master@날짜`)로 조회 → master id 로 폴백(iOS 반복 이벤트 공통 identifier 동작).
- **Google 연동 시 오류/무한 대기** — placeholder client_id 로 `getAuthToken` 호출 → 클라이언트 ID 확인 후, 로그인 계정 표시 + 권한 요청 화면, 설정 내 클라이언트 ID 입력(`launchWebAuthFlow`) 경로 추가.
- **월 로드 경합** — 새로고침(무효화) 중 진행되던 이전 로드가 오래된 데이터를 기록할 수 있음 → 무효화 세대(gen) 비교로 폐기.
- **E2E 브라우저 종료** — 외부 `timeout` 의 SIGTERM 을 Playwright 가 받아 브라우저를 닫은 것(크래시 아님) → 래퍼 제거, Playwright 와 같은 빌드의 Chromium 사용.

## iOS 대비 차이 / 제한

- WeatherKit → Open-Meteo 만 사용. 날씨는 하루 1회 자동, 아래로 당기면 즉시 재조회.
- 카메라 직접 촬영 대신 파일 선택·드래그&드롭.
- 알림은 Chrome 이 실행 중이고 OS 알림이 허용된 경우에만 표시.
- 로컬 데이터는 브라우저 프로필 단위(기기 간 동기화 없음). 동기화가 필요하면 Google 연동 사용.
