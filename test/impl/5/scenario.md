# impl/5 시나리오 — 수정·복사·반복복사·삭제·검색

> 작성일 2026-10-19 · 수용 기준: .docs/PRD.md §3·§5

- TC-01 편집: 시작 변경 시 원본 간격 유지
- TC-02 우클릭 메뉴 복사(내용제외)
- TC-03 롱프레스 메뉴 반복복사 3일
- TC-04 반복 발생 단건 삭제(내년 유지)
- TC-05 검색 결과 이동 / 결과 없음

## 실행

- E2E: `PLAYWRIGHT=... node test/e2e/run.mjs` — 압축해제 확장을 Chromium 에 로드, Open-Meteo 목, 위치=서울, TZ=Asia/Seoul
