# impl/2 시나리오 — 저장소 계층 (settings·templates.v3·로컬 캘린더·EventStore·이미지) + 에디터 저장 계획

> 작성일 2026-10-19 · 수용 기준: .docs/PRD.md §3·§5

- TC-01 설정 기본값(iOS AppSettings)·영속·온보딩 노출 조건
- TC-02 템플릿 시드/수정 영속
- TC-03 로컬 CRUD, 반복 발생 단건 수정/삭제(thisEvent)
- TC-04 월 로드·정렬·수 캐시·todo/overdue/비밀·검색, 삭제 시 사진 삭제
- TC-05 iOS save() 분기 전부: diary·할 일·회의·약속·복용 자동 yearly·고정 패턴·반복+개별·반복 RRULE·저장 불가 조건

## 실행

- 단위: `make test` (node --test)
