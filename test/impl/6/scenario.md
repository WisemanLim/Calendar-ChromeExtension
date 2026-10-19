# impl/6 시나리오 — 설정·온보딩·고객지원·사이드패널

> 작성일 2026-10-19 · 수용 기준: .docs/PRD.md §3·§5

- TC-01 온보딩 4단계 → 완료 저장 → 재실행 미노출
- TC-02 입력 방식 변경 영속
- TC-03 화면 테마 순환·다크 배경
- TC-04 알림 토글 영속
- TC-05 고객지원 5개 하위 화면·버전
- TC-06 사이드패널 페이지 렌더

## 실행

- E2E: `PLAYWRIGHT=... node test/e2e/run.mjs` — 압축해제 확장을 Chromium 에 로드, Open-Meteo 목, 위치=서울, TZ=Asia/Seoul
