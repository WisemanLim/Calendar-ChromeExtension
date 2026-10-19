// Epic 2 — 저장소 계층 + 에디터 저장 계획 시험 (메모리 storage 백엔드).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../../js/platform/storage.js';
import { AppSettings } from '../../js/platform/settings.js';
import { TemplateStore } from '../../js/platform/templateStore.js';
import { LocalCalendar } from '../../js/platform/localCalendar.js';
import { EventStore } from '../../js/platform/eventStore.js';
import { saveImage, loadImage } from '../../js/platform/imageStore.js';
import { canSave, planEvents } from '../../js/core/editorPlan.js';
import { seedTemplates } from '../../js/core/templates.js';
import { dateKey } from '../../js/core/calendarLogic.js';

const D = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);
beforeEach(() => storage._resetMemory());

// MARK: Settings
test('settings 기본값 (iOS AppSettings 준용) + 영속', async () => {
  const s = await new AppSettings().load();
  assert.equal(s.plannerMode, 'todo');
  assert.equal(s.appColorScheme, 'system');
  assert.equal(s.storageMode, 'local');
  assert.ok(s.shouldShowOnboarding);
  await s.set('plannerMode', 'personalEvent');
  await s.set('onboardingCompleted', true);
  await s.set('lastSeenVersion', '1.0.0');
  const s2 = await new AppSettings().load();
  assert.equal(s2.plannerMode, 'personalEvent');
  assert.equal(s2.shouldShowOnboarding, false);
  assert.equal(await storage.get('settings.plannerMode'), 'personalEvent');
});
test('온보딩 재노출: 버전 변경', async () => {
  const s = await new AppSettings().load();
  await s.set('onboardingCompleted', true);
  await s.set('lastSeenVersion', '0.9.0');
  assert.ok(s.shouldShowOnboarding);
});

// MARK: Templates
test('templates.v3 시드 → 수정 영속', async () => {
  const ts = await new TemplateStore().load();
  assert.equal(ts.templates.length, 15);
  assert.equal(ts.inCategory('medication').length, 4);
  const t = { ...ts.inCategory('medication')[0], defaultStartHour: 8 };
  await ts.update(t);
  const ts2 = await new TemplateStore().load();
  assert.equal(ts2.templates.find((x) => x.id === t.id).defaultStartHour, 8);
});

// MARK: LocalCalendar
test('로컬: 추가/조회/수정/삭제', async () => {
  const cal = new LocalCalendar();
  const id = await cal.add({ title: '회의', notes: null, start: D(2026, 6, 12, 10), end: D(2026, 6, 12, 11), location: '본사' });
  let list = await cal.list(D(2026, 6, 1), D(2026, 7, 1));
  assert.equal(list.length, 1);
  assert.equal(list[0].location, '본사');
  await cal.update(id, { title: '회의2', notes: 'n', start: D(2026, 6, 13, 10), end: D(2026, 6, 13, 12), location: null });
  const got = await cal.get(id);
  assert.equal(got.title, '회의2');
  assert.equal(dateKey(got.start), '2026-06-13');
  await cal.remove(id);
  list = await cal.list(D(2026, 6, 1), D(2026, 7, 1));
  assert.equal(list.length, 0);
});
test('로컬: 반복 발생 단건 삭제/수정 = thisEvent', async () => {
  const cal = new LocalCalendar();
  await cal.add({ title: '약', start: D(2026, 7, 1, 7), end: D(2026, 7, 1, 7), rule: { freq: 'daily', until: +D(2026, 7, 5) } });
  let list = await cal.list(D(2026, 7, 1), D(2026, 8, 1));
  assert.equal(list.length, 5);
  const second = list.find((e) => dateKey(e.start) === '2026-07-02');
  assert.match(second.id, /@2026-07-02$/);
  await cal.remove(second.id);
  const third = list.find((e) => dateKey(e.start) === '2026-07-03');
  await cal.update(third.id, { title: '약(변경)', notes: null, start: D(2026, 7, 3, 9), end: D(2026, 7, 3, 9), location: null });
  list = await cal.list(D(2026, 7, 1), D(2026, 8, 1));
  assert.deepEqual(list.map((e) => `${dateKey(e.start)} ${e.title}`).sort(),
    ['2026-07-01 약', '2026-07-03 약(변경)', '2026-07-04 약', '2026-07-05 약']);
});

// MARK: EventStore
test('EventStore: 월 로드·일별 정렬·수 캐시·todo/overdue/비밀·검색', async () => {
  const es = await new EventStore(new LocalCalendar()).init();
  await es.add({ title: '[비밀] 약속', start: D(2026, 6, 12, 19), end: D(2026, 6, 12, 21) });
  await es.add({ title: '할 일', notes: '- [ ] 보고서', start: D(2020, 1, 1, 23, 59), end: D(2020, 1, 1, 23, 59) });
  await es.add({ title: '아침 약 복용', start: D(2026, 6, 12, 7), end: D(2026, 6, 12, 7) });
  await es.ensure([D(2026, 6, 12), D(2020, 1, 1)]);
  const day = es.eventsFor(D(2026, 6, 12));
  assert.deepEqual(day.map((e) => e.displayTitle), ['07:00 아침 약 복용', '19:00 [비밀] 약속']);
  assert.ok(day[1].isSecret);
  assert.equal(es.countFor(D(2026, 6, 12)), 2);
  assert.equal((await storage.get('wc.eventCountCache'))['2026-06-12'], 2);
  const todo = es.eventsFor(D(2020, 1, 1))[0];
  assert.ok(todo.isTodo && todo.isOverdue);
  const found = await es.search('보고서', D(2019, 1, 1), D(2027, 1, 1));
  assert.equal(found.length, 1);
  assert.equal((await es.search('  ', D(2019, 1, 1), D(2027, 1, 1))).length, 0);
});
test('EventStore: 삭제 시 첨부 사진도 삭제', async () => {
  const es = await new EventStore(new LocalCalendar()).init();
  const id = await es.add({ title: 'x', start: D(2026, 1, 1, 9), end: D(2026, 1, 1, 9) });
  await saveImage(id, 'data:image/jpeg;base64,AAA');
  assert.ok(await loadImage(id));
  await es.remove(id);
  assert.equal(await loadImage(id), null);
});

// MARK: editorPlan (iOS save())
const tmpl = (name) => seedTemplates().find((t) => t.name === name);
const baseForm = (over) => ({
  date: D(2026, 3, 8), title: '', todos: [{ text: '', done: false }], dueDate: D(2026, 3, 8, 23, 59),
  eventStart: D(2026, 3, 8, 9), eventEnd: D(2026, 3, 8, 10), location: '',
  repeatEnabled: false, individual: true, repeatFrequency: 'yearly', selectedWeekdays: new Set(),
  repeatStart: D(2026, 3, 8), repeatEnd: D(2027, 3, 8), ...over,
});

test('diary: 시작=에디터 오픈, 종료=저장 시각', () => {
  const f = baseForm({ mode: 'diary', title: '[2026.03.08]😀수고했어요.', diaryBody: '본문', editorOpenTime: D(2026, 3, 8, 21), now: D(2026, 3, 8, 21, 5) });
  assert.ok(canSave(f));
  const [e] = planEvents(f);
  assert.equal(e.start, +D(2026, 3, 8, 21));
  assert.equal(e.end, +D(2026, 3, 8, 21, 5));
  assert.equal(e.notes, '본문');
  assert.equal(canSave({ ...f, title: '', diaryBody: '' }), false);
});
test('업무 할 일: 체크리스트 인코딩, Due Date 시작=종료', () => {
  const f = baseForm({ mode: 'todo', template: tmpl('할 일'), todos: [{ text: '보고서', done: false }, { text: '', done: false }] });
  assert.ok(canSave(f));
  const [e] = planEvents(f);
  assert.equal(e.title, '할 일');
  assert.equal(e.notes, '- [ ] 보고서');
  assert.equal(e.start, +D(2026, 3, 8, 23, 59));
  assert.equal(canSave({ ...f, todos: [{ text: '', done: false }] }), false);
});
test('업무 회의: 시작/종료 + 장소, 종료<=시작이면 +1h', () => {
  const f = baseForm({ mode: 'todo', template: tmpl('회의'), title: '회의', location: ' 본사 3층 ', eventEnd: D(2026, 3, 8, 8) });
  const [e] = planEvents(f);
  assert.equal(e.location, '본사 3층');
  assert.equal(e.end - e.start, 3600000);
});
test('약속: 비밀 약속 제목 그대로, 장소 저장', () => {
  const f = baseForm({ mode: 'personalEvent', template: tmpl('비밀 약속'), title: '[비밀] 약속', location: '강남', eventStart: D(2026, 3, 8, 19), eventEnd: D(2026, 3, 8, 21) });
  const [e] = planEvents(f);
  assert.equal(e.title, '[비밀] 약속');
  assert.equal(e.location, '강남');
  assert.equal(e.rule, null);
});
test('복용: 패턴 없음 + 반복 off → 자동 yearly', () => {
  const f = baseForm({ mode: 'personalEvent', template: tmpl('아침 약 복용'), title: '아침 약 복용', eventStart: D(2026, 3, 8, 7) });
  const [e] = planEvents(f);
  assert.deepEqual(e.rule, { freq: 'yearly', byDay: [], until: null });
  assert.equal(e.start, e.end);
});
test('고정: 날짜 패턴 + 반복 off → 반복 없음, 치환', () => {
  const f = baseForm({ mode: 'personalEvent', template: tmpl('정기작업'), title: '[정기작업] (d###) yyyy-mm-dd' });
  const [e] = planEvents(f);
  assert.equal(e.title, '[정기작업] (067) 2026-03-08');
  assert.equal(e.rule, null);
});
test('고정: 반복 + 개별 등록 ON → 날짜별 개별 이벤트', () => {
  const f = baseForm({
    mode: 'personalEvent', template: tmpl('알레르기 약 복용'), title: '(d###) [ALG -/-] yyyy-mm-dd',
    repeatEnabled: true, individual: true, repeatStart: D(2026, 7, 1), repeatEnd: D(2026, 7, 2),
  });
  const ev = planEvents(f);
  assert.deepEqual(ev.map((e) => e.title), ['(182) [ALG -/-] 2026-07-01', '(183) [ALG -/-] 2026-07-02']);
  assert.ok(ev.every((e) => e.rule === null));
  assert.equal(new Date(ev[1].start).getHours(), 9);
});
test('복용: 반복 + 개별 OFF → 주간 RRULE (요일, until)', () => {
  const f = baseForm({
    mode: 'personalEvent', template: tmpl('저녁 약 복용'), title: '저녁 약 복용',
    repeatEnabled: true, individual: false, repeatFrequency: 'weekly', selectedWeekdays: new Set([4, 2]),
    repeatEnd: D(2026, 3, 15),
  });
  const [e] = planEvents(f);
  assert.deepEqual(e.rule, { freq: 'weekly', byDay: [2, 4], until: +D(2026, 3, 15) });
});
test('개인 이벤트: 템플릿 없음/제목 없음 → 저장 불가', () => {
  assert.equal(canSave(baseForm({ mode: 'personalEvent' })), false);
  assert.equal(canSave(baseForm({ mode: 'personalEvent', template: tmpl('친구와 약속'), title: '' })), false);
});
