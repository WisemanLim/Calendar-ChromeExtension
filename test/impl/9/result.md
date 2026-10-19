# impl/9 결과 — Google Calendar 연동: 브라우저 로그인 계정으로 권한 요청

> 실행일 2026-10-19 · 재시도 1회 (첫 E2E 실행은 출력 필터로 결과 미수집 → 재실행)

## 판정: PASS (실계정 OAuth 동의 완료는 미검증 — 클라이언트 ID 필요)

| 구분 | 케이스 | 결과 |
|------|--------|------|
| unit | authUrl: implicit token + 범위 + login_hint + prompt | PASS |
| unit | parseAuthRedirect: 토큰/만료, 오류 | PASS |
| unit | 토큰: client ID 없음 → NO_CLIENT | PASS |
| unit | 토큰: manifest client_id → getAuthToken(로그인 계정 id) | PASS |
| unit | 토큰: 설정 client ID → launchWebAuthFlow(login_hint), 캐시, 폐기 후 재요청 | PASS |
| unit | 전체 회귀 | 54/54 PASS |
| e2e | 온보딩 4단계 (선행) | PASS |
| e2e | Google 연동 화면 · client ID 입력 → 권한 요청 버튼 · 로컬 유지 | PASS |
| e2e | 사이드패널 렌더 (회귀) | PASS |

## 변경 파일

| 파일 | 내용 |
|------|------|
| `js/platform/googleCalendar.js` | `profileAccount`, `createTokenProvider`(manifest → getAuthToken / 설정 ID → launchWebAuthFlow / NO_CLIENT), `authUrl`, `parseAuthRedirect`, `dropToken` 웹 토큰 캐시 폐기 |
| `js/ui/settingsView.js` | Google 선택 시 연동 화면(`openGoogleConnect`): 로그인 계정·요청 권한·권한 요청 버튼·클라이언트 ID 입력·확장 ID/리디렉션 URI 복사·오류 메시지 한글화, 연동 후 연결 계정 표시 |
| `js/main.js` | 토큰 제공자 주입, `connectGoogle`/`useLocal` 갱신 |
| `js/platform/settings.js` | `settings.googleClientId` |
| `js/ui/supportView.js` | 동기화 안내서 단계 갱신 |
| `manifest.json` | `identity.email` 권한 |
| `test/unit/services.test.mjs`, `test/e2e/run.mjs` | 인증 시험 5건, Google E2E 갱신, `E2E_ONLY` 선택 실행 |
| `.docs/PRD.md`, `README.md`, `README.en.md` | 연동 절차·권한·저장 키·변경 이력 |

## 회차 2 (2026-10-19) — 사용자 보고: "설정했는데 연계 안 됨"

- 원인: 연동 화면 OAuth 클라이언트 ID 칸 비어 있음 → 권한 요청 버튼 숨김 → 저장소 로컬 유지. 입력값이 `change`(blur) 시에만 저장되어 붙여넣고 바로 '뒤로' 시 유실 가능.
- 수정: 입력 즉시 저장(`input`), 권한 요청 버튼 항상 표시(ID 없으면 "클라이언트 ID 입력 후 권한 요청" + 클릭 시 안내·포커스), 형식 검사(`…apps.googleusercontent.com`), 버튼을 클라이언트 ID 섹션 아래로 이동.
- 시험: E2E 2/2 PASS (빈 ID 안내 → 붙여넣기 즉시 저장 → blur 없이 뒤로 → 재진입 값 유지). 로그 `logs/e2e-rerun.log`.
