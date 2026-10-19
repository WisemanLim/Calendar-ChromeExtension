// Epic 1 — 순수 로직 단위 시험 (iOS CalendarLogicTests / PlannerLogicTests 포팅 + 확장 전용 케이스).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, monthGrid, addMonths, weekDates, combine } from '../../js/core/calendarLogic.js';
import {
  dayOfYear, dateFromDayOfYear, fixedTitle, parseFixedTitle, encodeTodos, decodeTodos,
  substituteTitlePatterns, hasTitleDatePattern, isOverdue, isTodoNotes,
} from '../../js/core/plannerLogic.js';
import { seedTemplates, normalizeTemplate, fixedDisplayTitle, makeTemplate } from '../../js/core/templates.js';
import { occurrences, toRRULE } from '../../js/core/recurrence.js';
import { eventDayEmoji, eventCountColor, heroColor, displayTitle, lunarDateString, weatherFromWmo } from '../../js/core/eventFormat.js';

const D = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);

// MARK: CalendarLogic
test('dateKey 형식/0 패딩', () => {
  assert.equal(dateKey(D(2025, 6, 9)), '2025-06-09');
  assert.equal(dateKey(D(2025, 1, 5)), '2025-01-05');
});
test('그리드 항상 42칸', () => {
  for (const y of [2024, 2025, 2026]) for (let m = 1; m <= 12; m++) assert.equal(monthGrid(D(y, m, 1)).length, 42);
});
test('일요일 시작 월은 선행 빈칸 없음 (2025-06)', () => {
  const g = monthGrid(D(2025, 6, 1));
  assert.ok(g[0].isCurrentMonth);
  assert.equal(g[0].day, 1);
});
test('토요일 시작 월은 선행 6칸 (2025-11)', () => {
  const g = monthGrid(D(2025, 11, 1));
  for (let i = 0; i < 6; i++) assert.equal(g[i].isCurrentMonth, false);
  assert.equal(g[6].day, 1);
});
test('2026-02 당월 28일', () => {
  assert.equal(monthGrid(D(2026, 2, 1)).filter((c) => c.isCurrentMonth).length, 28);
});
test('today / selected / eventCount 주입', () => {
  const g = monthGrid(D(2025, 6, 1), {
    today: D(2025, 6, 9), selectedDate: D(2025, 6, 15),
    eventCount: (d) => (dateKey(d) === '2025-06-10' ? 2 : 0),
  });
  assert.equal(g.filter((c) => c.isToday).length, 1);
  assert.equal(g.find((c) => c.isToday).day, 9);
  assert.equal(g.find((c) => c.isSelected).day, 15);
  assert.equal(g.filter((c) => c.hasEvent).length, 1);
  assert.equal(g.find((c) => c.hasEvent).eventCount, 2);
});
test('addMonths 말일 클램프', () => {
  assert.equal(dateKey(addMonths(D(2026, 1, 31), 1)), '2026-02-28');
  assert.equal(dateKey(addMonths(D(2024, 2, 29), 12)), '2025-02-28');
  assert.equal(dateKey(addMonths(D(2026, 3, 15), -3)), '2025-12-15');
});
test('weekDates 일~토', () => {
  const w = weekDates(D(2026, 6, 12)); // 금
  assert.equal(w.length, 7);
  assert.equal(dateKey(w[0]), '2026-06-07');
  assert.equal(dateKey(w[6]), '2026-06-13');
});
test('combine 날짜+시각', () => {
  assert.equal(combine(D(2026, 3, 8), D(2000, 1, 1, 14, 30)).getTime(), D(2026, 3, 8, 14, 30).getTime());
});

// MARK: PlannerLogic
test('dayOfYear', () => {
  assert.equal(dayOfYear(D(2025, 1, 1)), 1);
  assert.equal(dayOfYear(D(2025, 6, 11)), 162);
  assert.equal(dayOfYear(D(2026, 3, 8)), 67);
  assert.equal(dateKey(dateFromDayOfYear(162, 2025)), '2025-06-11');
  assert.ok(dateFromDayOfYear(366, 2024));
  assert.equal(dateFromDayOfYear(366, 2025), null);
  assert.equal(dateFromDayOfYear(0, 2025), null);
});
test('fixedTitle / parse', () => {
  assert.equal(fixedTitle(162, '알레르기 약 복용(-/-)'), '[#162] 알레르기 약 복용(-/-)');
  assert.deepEqual(parseFixedTitle('[#162] 알레르기 약 복용(-/-)'), { dayOfYear: 162, title: '알레르기 약 복용(-/-)' });
  assert.equal(parseFixedTitle('일반 제목'), null);
  assert.equal(parseFixedTitle('[#abc] x'), null);
  assert.deepEqual(parseFixedTitle(fixedTitle(200, '운동')), { dayOfYear: 200, title: '운동' });
});
test('todo 인코딩/디코딩', () => {
  assert.equal(encodeTodos([{ text: '우유 사기', done: false }, { text: '운동', done: true }]), '- [ ] 우유 사기\n- [x] 운동');
  const items = decodeTodos('- [ ] 우유 사기\n- [x] 운동');
  assert.deepEqual(items, [{ text: '우유 사기', done: false }, { text: '운동', done: true }]);
  assert.deepEqual(decodeTodos('메모\n- [ ] 할일\n그냥 줄'), [{ text: '할일', done: false }]);
});
test('isTodo / isOverdue', () => {
  const now = D(2026, 6, 12, 12);
  assert.ok(isTodoNotes('- [x] a'));
  assert.equal(isTodoNotes('plain'), false);
  assert.ok(isOverdue('- [ ] a', D(2026, 6, 11), now));
  assert.equal(isOverdue('- [x] a', D(2026, 6, 11), now), false);
  assert.equal(isOverdue('- [ ] a', D(2026, 6, 13), now), false);
});
test('타이틀 날짜 패턴 치환', () => {
  const d = D(2026, 3, 8);
  assert.equal(substituteTitlePatterns('작업 yyyy-mm-dd', d), '작업 2026-03-08');
  assert.equal(substituteTitlePatterns('d###', d), '067');
  assert.equal(substituteTitlePatterns('[정기작업] (d###) yyyy-mm-dd', d), '[정기작업] (067) 2026-03-08');
  const j = D(2026, 1, 5);
  assert.equal(substituteTitlePatterns('yyyy/mm/dd', j), '2026/01/05');
  assert.equal(substituteTitlePatterns('yyyy.mm.dd', j), '2026.01.05');
  assert.equal(substituteTitlePatterns('dd-mm-yyyy', j), '05-01-2026');
  assert.equal(substituteTitlePatterns('yy-mm-dd', j), '26-01-05');
  assert.equal(substituteTitlePatterns('(d###) [ALG -/-] yyyy-mm-dd', D(2026, 7, 1)), '(182) [ALG -/-] 2026-07-01');
  assert.ok(hasTitleDatePattern('작업 yyyy-mm-dd'));
  assert.ok(hasTitleDatePattern('d### 기록'));
  assert.equal(hasTitleDatePattern('아침 약 복용'), false);
});

// MARK: Templates
test('시드 템플릿 v3 15개 / 카테고리 분포', () => {
  const s = seedTemplates();
  assert.equal(s.length, 15);
  const by = (c) => s.filter((t) => t.category === c).length;
  assert.deepEqual([by('workEvent'), by('medication'), by('appointment'), by('fixed')], [4, 4, 4, 3]);
  assert.equal(s.filter((t) => t.isTodo).map((t) => t.name).join(), '할 일');
  assert.equal(s.find((t) => t.name === '비밀 약속').titleFormat, '[비밀] 약속');
});
test('템플릿 하위호환(isTodo 누락) / fixedDisplayTitle', () => {
  const t = normalizeTemplate({ id: 'x', name: 'n', category: 'fixed', titleFormat: '알레르기 약 복용(-/-)', dayOfYear: 162, defaultStartHour: 9, defaultDurationMinutes: 0 });
  assert.equal(t.isTodo, false);
  assert.equal(fixedDisplayTitle(t), '[#162] 알레르기 약 복용(-/-)');
  assert.equal(fixedDisplayTitle(makeTemplate({ name: 'a', category: 'appointment', titleFormat: 'a' })), null);
});

// MARK: Recurrence
test('반복 없음: 범위 내 1회', () => {
  const e = { start: D(2026, 6, 12, 9).getTime(), end: D(2026, 6, 12, 10).getTime(), rule: null };
  assert.equal(occurrences(e, D(2026, 6, 1), D(2026, 7, 1)).length, 1);
  assert.equal(occurrences(e, D(2026, 7, 1), D(2026, 8, 1)).length, 0);
});
test('yearly 무기한: 매년 같은 날, 시작 이전 제외', () => {
  const e = { start: D(2026, 3, 8, 9).getTime(), end: D(2026, 3, 8, 9).getTime(), rule: { freq: 'yearly', until: null } };
  const occ = occurrences(e, D(2025, 1, 1), D(2029, 1, 1)).map((o) => o.key);
  assert.deepEqual(occ, ['2026-03-08', '2027-03-08', '2028-03-08']);
});
test('daily until 포함 + exdates 제외', () => {
  const e = { start: D(2026, 7, 1, 7).getTime(), end: D(2026, 7, 1, 7).getTime(), rule: { freq: 'daily', until: D(2026, 7, 3).getTime() }, exdates: ['2026-07-02'] };
  assert.deepEqual(occurrences(e, D(2026, 6, 1), D(2026, 8, 1)).map((o) => o.key), ['2026-07-01', '2026-07-03']);
});
test('weekly byDay(월,수) / byDay 비면 시작 요일', () => {
  const e = { start: D(2026, 6, 1, 9).getTime(), end: D(2026, 6, 1, 10).getTime(), rule: { freq: 'weekly', byDay: [2, 4], until: D(2026, 6, 14).getTime() } };
  assert.deepEqual(occurrences(e, D(2026, 6, 1), D(2026, 7, 1)).map((o) => o.key), ['2026-06-01', '2026-06-03', '2026-06-08', '2026-06-10']);
  const e2 = { ...e, rule: { freq: 'weekly', byDay: [], until: D(2026, 6, 15).getTime() } };
  assert.deepEqual(occurrences(e2, D(2026, 6, 1), D(2026, 7, 1)).map((o) => o.key), ['2026-06-01', '2026-06-08', '2026-06-15']);
});
test('toRRULE', () => {
  assert.equal(toRRULE({ freq: 'yearly', until: null }, D(2026, 1, 1)), 'RRULE:FREQ=YEARLY');
  assert.match(toRRULE({ freq: 'weekly', byDay: [4, 2], until: D(2026, 6, 14).getTime() }, D(2026, 6, 1)), /^RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=\d{8}T\d{6}Z$/);
});

// MARK: Format
test('이모지 / 무지개 색 / 히어로 색', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(eventDayEmoji), ['😀', '😀', '😊', '😊', '🤯', '🤯']);
  assert.equal(eventCountColor(0), null);
  assert.equal(new Set([1, 2, 3, 4, 5, 6].map(eventCountColor)).size, 6);
  assert.equal(eventCountColor(6), eventCountColor(10));
  assert.equal(heroColor(1), 'rgba(242, 217, 0, 0.28)');
});
test('displayTitle HH:mm 제목', () => {
  assert.equal(displayTitle('회의', D(2026, 1, 1, 9, 5)), '09:05 회의');
});
test('음력 (Intl chinese) — iOS 캡처 2026-06-12 = 음력 4월 27일, 윤달', () => {
  assert.equal(lunarDateString(D(2026, 6, 12, 12)), '음력 4월 27일');
  assert.equal(lunarDateString(D(2025, 7, 26, 12)), '음력 윤6월 2일');
});
test('WMO 코드 매핑', () => {
  assert.deepEqual([0, 2, 3, 45, 51, 61, 65, 71, 95].map(weatherFromWmo),
    ['clear', 'partlyCloudy', 'overcast', 'fog', 'drizzle', 'rain', 'heavyRain', 'snow', 'thunderstorm']);
});
