# impl/1 결과 — 순수 로직 포팅 (CalendarLogic·PlannerLogic·템플릿·반복·포맷)

> 실행일 2026-10-19 · 재시도(수정 후 재시험) 0회

## 판정: PASS



| 구분 | 케이스 | 결과 |
|------|--------|------|
| unit | dateKey 형식/0 패딩 | PASS |
| unit | 그리드 항상 42칸 | PASS |
| unit | 일요일 시작 월은 선행 빈칸 없음 | PASS |
| unit | 토요일 시작 월은 선행 6칸 | PASS |
| unit | 2026-02 당월 28일 | PASS |
| unit | today / selected / eventCount 주입 | PASS |
| unit | addMonths 말일 클램프 | PASS |
| unit | weekDates 일~토 | PASS |
| unit | combine 날짜+시각 | PASS |
| unit | dayOfYear | PASS |
| unit | fixedTitle / parse | PASS |
| unit | todo 인코딩/디코딩 | PASS |
| unit | isTodo / isOverdue | PASS |
| unit | 타이틀 날짜 패턴 치환 | PASS |
| unit | 시드 템플릿 v3 15개 / 카테고리 분포 | PASS |
| unit | 템플릿 하위호환(isTodo 누락) / fixedDisplayTitle | PASS |
| unit | 반복 없음: 범위 내 1회 | PASS |
| unit | yearly 무기한: 매년 같은 날, 시작 이전 제외 | PASS |
| unit | daily until 포함 + exdates 제외 | PASS |
| unit | weekly byDay(월,수) / byDay 비면 시작 요일 | PASS |
| unit | toRRULE | PASS |
| unit | 이모지 / 무지개 색 / 히어로 색 | PASS |
| unit | displayTitle HH:mm 제목 | PASS |
| unit | 음력 (Intl chinese) — iOS 캡처 2026-06-12 = 음력 4월 27일, 윤달 | PASS |
| unit | WMO 코드 매핑 | PASS |
| unit | templates.v3 시드 → 수정 영속 | PASS |
| unit | 고정: 날짜 패턴 + 반복 off → 반복 없음, 치환 | PASS |

로그: `logs/`
