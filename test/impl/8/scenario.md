# impl/8 시나리오 — Google Calendar 연동 (chrome.identity + Calendar API v3)

> 작성일 2026-10-19 · 수용 기준: .docs/PRD.md §3·§5

- TC-01 401 → 토큰 폐기 재시도·캘린더 목록/primary
- TC-02 singleEvents 조회·취소 제외·종일·표시 캘린더 필터
- TC-03 추가(RRULE)·수정(PATCH)·삭제
- TC-04 EventStore 와 결합 시 todo/overdue 동일
- TC-05 client_id 미설정 시 안내 + 로컬 유지(E2E)
- TC-06 실계정 OAuth 연동은 client_id 필요 — 미검증

## 실행

- 단위: `make test` (node --test)
- E2E: `PLAYWRIGHT=... node test/e2e/run.mjs` — 압축해제 확장을 Chromium 에 로드, Open-Meteo 목, 위치=서울, TZ=Asia/Seoul
