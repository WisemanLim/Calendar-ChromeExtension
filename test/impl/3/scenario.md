# impl/3 시나리오 — 메인 캘린더 UI

> 작성일 2026-10-19 · 수용 기준: .docs/PRD.md §3·§5

- TC-01 헤더(연도·MONTH YEAR·Today)·주간 스트립·날씨·음력
- TC-02 월/연 이동, Today 복귀, 미니 달력 선택
- TC-03 히어로/주간/미니 달력 스와이프
- TC-04 이벤트 수 무지개색·히어로 opacity·아래로 당기기 새로고침
- TC-05 페이지 오류 0

## 실행

- E2E: `PLAYWRIGHT=... node test/e2e/run.mjs` — 압축해제 확장을 Chromium 에 로드, Open-Meteo 목, 위치=서울, TZ=Asia/Seoul
