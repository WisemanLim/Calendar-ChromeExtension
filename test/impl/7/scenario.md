# impl/7 시나리오 — 알림(chrome.alarms)·날씨(Open-Meteo)

> 작성일 2026-10-19 · 수용 기준: .docs/PRD.md §3·§5

- TC-01 Open-Meteo 파싱·일별 갱신·위치 거부 시 이모지 대체
- TC-02 당일 09:00 예약·지난 시각 미예약
- TC-03 UI 저장 → alarms 예약, SW 알람 발화 → notifications 생성

## 실행

- 단위: `make test` (node --test)
- E2E: `PLAYWRIGHT=... node test/e2e/run.mjs` — 압축해제 확장을 Chromium 에 로드, Open-Meteo 목, 위치=서울, TZ=Asia/Seoul
