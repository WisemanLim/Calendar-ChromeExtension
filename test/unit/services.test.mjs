// Epic 7·8 — 날씨(Open-Meteo)·알림(chrome.alarms)·Google Calendar 어댑터 시험 (fetch/chrome 목).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../../js/platform/storage.js';
import { WeatherService, parseOpenMeteo, openMeteoUrl } from '../../js/platform/weather.js';
import { scheduleEventReminder, reminderTime, ALARM_PREFIX } from '../../js/platform/notifications.js';
import { GoogleCalendar, fromGoogle, toGoogle } from '../../js/platform/googleCalendar.js';
import { EventStore } from '../../js/platform/eventStore.js';
import { dateKey } from '../../js/core/calendarLogic.js';

const D = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);
beforeEach(() => storage._resetMemory());
afterEach(() => { delete globalThis.chrome; });

// MARK: Weather
const meteo = { daily: { time: ['2026-06-12', '2026-06-13'], weather_code: [0, 61], temperature_2m_max: [27.6, 21.2] } };

test('Open-Meteo 파싱 (+구버전 weathercode)', () => {
  assert.deepEqual(parseOpenMeteo(meteo), { weather: { '2026-06-12': 'clear', '2026-06-13': 'rain' }, temp: { '2026-06-12': 28, '2026-06-13': 21 } });
  assert.deepEqual(parseOpenMeteo({ daily: { time: ['x'], weathercode: [3] } }).weather, { x: 'overcast' });
  assert.match(openMeteoUrl(37.5, 127), /daily=weather_code,temperature_2m_max&timezone=auto&forecast_days=16&past_days=7/);
});
test('날씨: 당일 캐시 있으면 미조회, force/새 날이면 조회, 위치 거부 시 비어 있음', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { json: async () => meteo }; };
  const w = await new WeatherService({ fetchImpl, locate: async () => ({ lat: 37.5, lon: 127 }) }).loadCache();
  assert.equal(await w.requestAndFetch(), true);
  assert.equal(w.dailyWeather['2026-06-13'], 'rain');
  assert.equal(await w.requestAndFetch(), false); // 오늘 이미 조회
  assert.equal(await w.requestAndFetch(true), true);
  await storage.set('wc.lastFetchDate', +D(2020, 1, 1)); // 어제 이전 → 재조회
  assert.equal(await w.requestAndFetch(), true);
  assert.equal(calls, 3);
  const w2 = await new WeatherService({ fetchImpl, locate: async () => { throw new Error('denied'); } });
  assert.equal(await w2.requestAndFetch(true), false);
  assert.equal(w2.status, 'denied');
  assert.deepEqual(w2.dailyWeather, {});
});

// MARK: Notifications
test('알림: 당일 09:00 예약, 지난 시각은 미예약', async () => {
  const alarms = [];
  globalThis.chrome = { alarms: { create: async (name, info) => alarms.push({ name, ...info }) } };
  assert.equal(+reminderTime(D(2026, 6, 12, 19)), +D(2026, 6, 12, 9));
  const name = await scheduleEventReminder('회의', D(2026, 6, 12, 19), +D(2026, 6, 1));
  assert.ok(name.startsWith(ALARM_PREFIX));
  assert.equal(alarms[0].when, +D(2026, 6, 12, 9));
  delete globalThis.chrome; // storage 를 메모리 백엔드로 읽기
  assert.deepEqual(await storage.get(name), { title: '회의' });
  globalThis.chrome = { alarms: { create: async (n, i) => alarms.push(i) } };
  assert.equal(await scheduleEventReminder('지난', D(2026, 6, 12, 19), +D(2026, 6, 12, 10)), null);
  assert.equal(alarms.length, 1);
});

// MARK: Google Calendar
function mockGoogle() {
  const calls = [];
  const db = {
    'me@x.com': [
      { id: 'a1', summary: '회의', description: '- [ ] 안건', location: '본사', start: { dateTime: '2026-06-12T01:00:00Z' }, end: { dateTime: '2026-06-12T02:00:00Z' } },
      { id: 'a2_20260612', summary: '약', recurringEventId: 'a2', start: { dateTime: '2026-06-12T22:00:00Z' }, end: { dateTime: '2026-06-12T22:00:00Z' } },
      { id: 'gone', status: 'cancelled' },
    ],
    'holiday@g': [{ id: 'h1', summary: '공휴일', start: { date: '2026-06-06' }, end: { date: '2026-06-07' } }],
  };
  let tokenN = 0;
  const fetchImpl = async (url, opts) => {
    calls.push({ url, ...opts });
    if (opts.headers.Authorization === 'Bearer t1' && calls.length === 1) return { ok: false, status: 401 };
    const u = new URL(url);
    const json = (b, status = 200) => ({ ok: true, status, json: async () => b });
    if (u.pathname.endsWith('/users/me/calendarList')) {
      return json({ items: [{ id: 'me@x.com', summary: '내 캘린더', primary: true }, { id: 'holiday@g', summary: '공휴일' }] });
    }
    const m = /\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(u.pathname);
    const cal = decodeURIComponent(m[1]);
    if (opts.method === 'POST') return json({ id: 'new1' });
    if (opts.method === 'PATCH') return json({});
    if (opts.method === 'DELETE') return { ok: true, status: 204 };
    if (m[2]) return json(db[cal].find((e) => e.id === m[2]));
    return json({ items: db[cal] });
  };
  const g = new GoogleCalendar({ enabledIds: () => g.enabled ?? [], token: async () => `t${++tokenN}`, fetchImpl });
  globalThis.chrome = { identity: { removeCachedAuthToken: (_o, cb) => cb() }, runtime: {} };
  return { g, calls };
}

test('Google: 401 → 토큰 폐기 후 재시도, 캘린더 목록/primary', async () => {
  const { g, calls } = mockGoogle();
  const cals = await g.calendars();
  assert.equal(cals.length, 2);
  assert.equal(await g.primaryId(), 'me@x.com');
  assert.equal(calls[0].headers.Authorization, 'Bearer t1');
  assert.equal(calls[1].headers.Authorization, 'Bearer t2');
});
test('Google: 조회(singleEvents, 취소 제외, 종일=로컬 자정) + 표시 캘린더 필터', async () => {
  const { g, calls } = mockGoogle();
  const list = await g.list(D(2026, 6, 1), D(2026, 7, 1));
  assert.deepEqual(list.map((e) => e.id).sort(), ['holiday@g|h1', 'me@x.com|a1', 'me@x.com|a2_20260612']);
  assert.ok(list.find((e) => e.id.endsWith('a2_20260612')).recurring);
  assert.equal(dateKey(list.find((e) => e.title === '공휴일').start), '2026-06-06');
  const listUrl = new URL(calls.find((c) => c.url.includes('/events?')).url);
  assert.equal(listUrl.searchParams.get('singleEvents'), 'true');
  g.enabled = ['holiday@g'];
  assert.deepEqual((await g.list(D(2026, 6, 1), D(2026, 7, 1))).map((e) => e.title), ['공휴일']);
});
test('Google: 추가(primary, RRULE)/수정(PATCH, recurrence 없음)/삭제', async () => {
  const { g, calls } = mockGoogle();
  const id = await g.add({ title: '약', notes: null, location: null, start: +D(2026, 6, 12, 7), end: +D(2026, 6, 12, 7), rule: { freq: 'yearly', until: null } });
  assert.equal(id, 'me@x.com|new1');
  const post = calls.find((c) => c.method === 'POST');
  assert.match(post.url, /calendars\/me%40x\.com\/events$/);
  assert.deepEqual(JSON.parse(post.body).recurrence, ['RRULE:FREQ=YEARLY']);
  await g.update('me@x.com|a1', { title: '회의2', notes: '', location: '', start: +D(2026, 6, 12, 10), end: +D(2026, 6, 12, 11) });
  const patch = calls.find((c) => c.method === 'PATCH');
  assert.equal(JSON.parse(patch.body).summary, '회의2');
  assert.equal(JSON.parse(patch.body).recurrence, undefined);
  assert.ok(await g.remove('me@x.com|a2_20260612'));
  assert.match(calls.find((c) => c.method === 'DELETE').url, /events\/a2_20260612$/);
});
test('Google 변환: fromGoogle / toGoogle timeZone', () => {
  const r = fromGoogle('c', { id: 'e', summary: 's', start: { dateTime: '2026-01-01T00:00:00Z' }, end: { dateTime: '2026-01-01T01:00:00Z' } });
  assert.equal(r.end - r.start, 3600000);
  const b = toGoogle({ title: 't', start: 0, end: 1 });
  assert.ok(b.start.timeZone);
  assert.equal(b.recurrence, undefined);
});
test('EventStore + Google 어댑터: todo/overdue 판정 동일', async () => {
  const { g } = mockGoogle();
  const es = await new EventStore(g).init();
  await es.ensure([D(2026, 6, 12)]);
  const meeting = es.eventsFor(new Date(Date.parse('2026-06-12T01:00:00Z'))).find((e) => e.title === '회의');
  assert.ok(meeting.isTodo);
  assert.ok(meeting.isOverdue); // 2026-06-12 < now(2026-10)
});
