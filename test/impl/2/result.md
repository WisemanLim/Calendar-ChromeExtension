# impl/2 결과 — 저장소 계층 (settings·templates.v3·로컬 캘린더·EventStore·이미지) + 에디터 저장 계획

> 실행일 2026-10-19 · 재시도(수정 후 재시험) 0회

## 판정: PASS



| 구분 | 케이스 | 결과 |
|------|--------|------|
| unit | settings 기본값 (iOS AppSettings 준용) + 영속 | PASS |
| unit | 온보딩 재노출: 버전 변경 | PASS |
| unit | templates.v3 시드 → 수정 영속 | PASS |
| unit | 로컬: 추가/조회/수정/삭제 | PASS |
| unit | 로컬: 반복 발생 단건 삭제/수정 = thisEvent | PASS |
| unit | EventStore: 월 로드·일별 정렬·수 캐시·todo/overdue/비밀·검색 | PASS |
| unit | EventStore: 삭제 시 첨부 사진도 삭제 | PASS |
| unit | diary: 시작=에디터 오픈, 종료=저장 시각 | PASS |
| unit | 업무 할 일: 체크리스트 인코딩, Due Date 시작=종료 | PASS |
| unit | 업무 회의: 시작/종료 + 장소, 종료<=시작이면 +1h | PASS |
| unit | 약속: 비밀 약속 제목 그대로, 장소 저장 | PASS |
| unit | 복용: 패턴 없음 + 반복 off → 자동 yearly | PASS |
| unit | 고정: 날짜 패턴 + 반복 off → 반복 없음, 치환 | PASS |
| unit | 고정: 반복 + 개별 등록 ON → 날짜별 개별 이벤트 | PASS |
| unit | 복용: 반복 + 개별 OFF → 주간 RRULE (요일, until) | PASS |
| unit | 개인 이벤트: 템플릿 없음/제목 없음 → 저장 불가 | PASS |

로그: `logs/`
