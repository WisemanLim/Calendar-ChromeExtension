# PRD — Wise Calendar (Chrome Extension)

> One-Page PRD · 작성일 2026-10-19 · 원본: `Calendar-iOS/.docs/PRD.md`, `Calendar-iOS/.docs/WiseCal-iOS.md`, iOS 소스(`Calendar-iOS/Calendar/*.swift`)
> iOS 문서에 없던 실제 구현 사항은 iOS 소스 기준으로 반영(§3.4).

## 1. Why — 목표

iOS·Android 앱을 쓰지 않는 사용자(데스크톱 Chrome 사용자)에게 Wise Calendar 의 핵심 경험 —
**큰 날짜 히어로 + 플래너 모드별 템플릿 입력(복용·약속·고정/반복) + 반복 주기 등록** — 을 Chrome 확장으로 제공한다.

## 2. Who

- 개인 일정을 관리하는 데스크톱 Chrome 사용자 (iOS/Android 미사용자).
- 가정: Chrome 116+ (sidePanel API). 한국어 UI.

## 3. What

### 3.1 형태 · 저장소 (확정 2026-10-19)

| 항목 | 결정 |
|------|------|
| UI | 툴바 **팝업**(380×600, iPhone 비율) + 동일 화면 **사이드패널**(`app.html?view=panel`, 팝업 ⇥ 버튼) |
| 이벤트 저장소 | 기본 **로컬**(`chrome.storage.local`) · 설정에서 **Google Calendar** 연동(`chrome.identity` + Calendar API v3) 선택 |
| 반복(로컬) | master 1건 + rule(`daily/weekly/yearly`, `byDay`, `until`) 저장, 조회 시 발생일 전개. 발생 단건 수정/삭제 = iOS `.thisEvent` |
| 반복(Google) | `recurrence: [RRULE]` 로 저장, `singleEvents=true` 로 발생 단위 조회·수정·삭제 |
| 날씨 | `navigator.geolocation` + Open-Meteo(무료·무키). WeatherKit 제외 |
| 알림 | `chrome.alarms` → 서비스 워커 `chrome.notifications`. 이벤트 당일 09:00. 브라우저·OS 알림 허용 시에만 표시 |
| 사진 | 복용 이벤트 — 파일 선택/드래그&드롭 → 최대 1024px JPEG(0.8) dataURL 을 `eventImage.<id>` 로 저장(`unlimitedStorage`). 파일 접근 허용 시에만 |

### 3.2 화면 (iOS 대응)

- **메인**: Row1 `⚙ ⇥ | [Today] ‹ 년 › | ⌕ ＋` · Row2 `‹ MONTH YEAR ›` · Row3 주간 스트립(SUN~SAT, 날씨 아이콘/이모지) ·
  히어로(큰 날짜 + 영문 요일, 이벤트 수 무지개색 opacity 0.28) + 정보 바(좌 음력 · 우 날씨+최고기온) + 일정 목록 · 미니 달력 2개(현재·다음 월).
- **제스처(마우스/포인터)**: 히어로 좌우 드래그(폭 1/4) = 전일/익일 · 히어로 더블클릭 = 에디터 · 히어로/＋ 롱프레스 0.6s = 1회 입력방식 선택 ·
  주간 스트립 드래그(50px, 러버밴드 0.25×) = ±7일 · 미니 달력 드래그 = 월 이동 · 히어로 아래로 당기기(60px) = 새로고침.
- **일정 목록**: `HH:mm 제목` · 기한 초과 할 일 적색 · `[비밀]` opacity 0.25 · 클릭 = 편집 · 우클릭/롱프레스 = 복사(내용포함/제외)·반복복사(내용포함/제외)·삭제.
- **에디터**: 일기(전체화면, 제목 `[yyyy.MM.dd]😀수고했어요.`, 경과 mm:ss, 시작=오픈/종료=저장) · 업무 이벤트(할 일 체크리스트+Due Date 23:59 기본, 회의·세미나·회식 시작/종료+장소) ·
  개인 이벤트(분류 복용/약속/고정·반복 → 템플릿 → 프리필).
- **복용**: 아침/점심/저녁/직접 프리셋, 기본 시간으로 저장, 반복(매일/매주(요일)/매년) + 개별 등록(기본 ON), 사진.
- **약속**: 시작/종료 + 장소. **고정/반복**: 시작/종료(종료<시작이면 보정) + 반복 + 개별 등록.
- **타이틀 날짜 패턴**: `yyyy-mm-dd`, `yyyy/mm/dd`, `yy-mm-dd`, `yyyy.mm.dd`, `dd-mm-yyyy`, `d###` 치환. 패턴 없는 복용/고정 + 반복 OFF → 자동 yearly.
- **편집**: 제목·시작·종료·장소·메모. 시작 변경 시 종료 = 시작 + 원본 간격. 첨부 사진 표시.
- **복사/반복복사**: 목표 날짜(범위) + 제목·시간·(내용). **검색**: 제목·메모, -1년~+2년.
- **설정**: 화면 테마(system→dark→light) · 입력 방식 · 알림 · 캘린더 연동(로컬/Google, 표시 캘린더 선택, 연동 해제) · 고객지원.
- **고객지원**: 도움말 센터 · FAQ · 현재 버전/업데이트 확인 · 일반적인 문제 · 동기화 안내서 · 이메일 · 디버그 로그(복사/이메일).
- **온보딩 4단계**: 소개+모드선택 → 일기·업무 → 개인 이벤트 → 연동·알림. 노출 = 미완료 또는 `lastSeenVersion ≠ manifest.version`.

### 3.3 템플릿 v3 (`templates.v3`, iOS 동일 15종)

workEvent(할 일·회의·세미나/컨퍼런스·회식) · medication(아침·점심·저녁·임시/긴급) · appointment(연인·친구·동호회/이벤트·비밀 약속) · fixed(알레르기 약 복용 (d###) · 약 복용 yyyy-mm-dd · [정기작업] (d###) yyyy-mm-dd).

### 3.4 iOS 문서 누락 → 소스 기준 반영

- 반복 주기는 문서상 yearly 만 있으나 소스는 **매일/매주(요일 선택)/매년** + 반복 시작/종료일(주기별 기본 종료 +1일/+1주/+1년).
- 컨텍스트 메뉴에 **반복복사(내용포함/제외)** 존재(날짜 범위 1일 단위 복사).
- 히어로 **아래로 당기기 새로고침**, 검색 범위 실제 **-1년~+2년**(문서 ±2년).
- 기본 플래너 모드: 소스 `AppSettings` 기본값 **업무 이벤트(todo)** (문서 스크린샷의 개인 이벤트는 사용자 선택값).
- 개별 등록은 주기와 무관하게 **1일 단위** 순회(iOS 동작 그대로).

## 4. How

- Manifest V3, Vanilla JS ES Modules, 빌드/런타임 의존성 없음. 순수 로직(`js/core`)과 플랫폼(`js/platform`), UI(`js/ui`) 분리.
- 저장 키는 iOS UserDefaults 키 준용: `settings.*`, `templates.v3`, `wc.eventCountCache`, `wc.dailyWeather`, `wc.dailyTemperature`, `wc.lastFetchDate`.
- 시험: `node --test`(단위 49) + Playwright 로 확장 실제 로드 E2E(35).

## 5. Success

| 기준 | 측정 |
|------|------|
| 로직 동등성 | iOS CalendarLogic/PlannerLogic 시험 케이스 포팅 PASS |
| 플래너 모드 UX | 모드별 에디터·템플릿·반복·개별등록 E2E PASS |
| 저장소 | 로컬 CRUD·반복 단건 수정/삭제, Google 어댑터(목) PASS |
| 알림·날씨 | 09:00 알람 예약·발화, Open-Meteo 일별 갱신 PASS |
| 설치 | `make package` zip → chrome://extensions 로드 |

## 6. 리스크 / 제약

- Google 연동은 Google Cloud OAuth 클라이언트(유형: Chrome 확장) 발급 + `manifest.json` `oauth2.client_id` 설정 + 확장 ID 고정(`key`)이 필요. 미설정 시 설정 화면에 안내.
- Chrome 알림은 브라우저 실행 중 + OS 알림 허용 시에만 표시.
- 로컬 저장 데이터는 브라우저 프로필 단위, 확장 삭제 시 함께 삭제(동기화 없음).
- 사진은 `chrome.storage` 용량을 사용(`unlimitedStorage`). 카메라 직접 촬영은 데스크톱 특성상 미지원(파일 선택으로 대체).

## 변경 이력

- 2026-10-19 — 최초 작성. 확인: 저장소=로컬+Google 연동, UI=팝업+사이드패널, 범위=날씨·알림·사진·고객지원 포함(알림/사진은 브라우저 권한 허용 시).
