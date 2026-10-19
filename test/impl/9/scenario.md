# impl/9 시나리오 — Google Calendar 연동: 브라우저 로그인 계정으로 권한 요청

> 작성일 2026-10-19 · 요구: "설정-캘린더 연동-Google Calendar 시 오류 발생, 브라우저 로그인 계정으로 권한 요청 프로세스 추가"
> 원인: manifest `oauth2.client_id` 가 placeholder → `getAuthToken` 불가. Google API 는 OAuth 클라이언트 없이 권한 부여 불가.

- TC-01 Google 선택 → 오류 대신 연동 화면(브라우저 로그인 계정·요청 권한) 표시
- TC-02 클라이언트 ID 없으면 확장 ID·리디렉션 URI(복사)·등록 절차 안내, 권한 요청 버튼 미노출
- TC-03 클라이언트 ID 입력 → 저장(`settings.googleClientId`) → `[<계정> 계정으로 권한 요청]` 버튼 노출
- TC-04 manifest client_id 있음 → `getAuthToken({ interactive, account: {id: 로그인 계정} })`
- TC-05 설정 client ID → `launchWebAuthFlow` (response_type=token, login_hint=로그인 계정, prompt=consent), 토큰·만료 캐시, 폐기 후 prompt=none 재요청
- TC-06 client ID 없음 → `NO_CLIENT` 코드 오류
- TC-07 연결 전 저장소는 로컬 유지, 회귀: 온보딩·사이드패널
