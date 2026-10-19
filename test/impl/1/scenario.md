# impl/1 시나리오 — 순수 로직 포팅 (CalendarLogic·PlannerLogic·템플릿·반복·포맷)

> 작성일 2026-10-19 · 수용 기준: .docs/PRD.md §3·§5

- TC-01 iOS CalendarLogicTests 9 + PlannerLogicTests 15 케이스 포팅
- TC-02 addMonths 말일 클램프·주간 날짜·날짜+시각 결합
- TC-03 반복 전개(yearly 무기한·daily until·weekly byDay·exdates)·RRULE 변환
- TC-04 무지개 7단계·이모지·히어로 색·음력(윤달)·WMO 매핑
- TC-05 KST·EST 두 시간대에서 실행

## 실행

- 단위: `make test` (node --test)
