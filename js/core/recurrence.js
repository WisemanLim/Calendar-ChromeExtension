// 반복 규칙 — 로컬 저장소용 발생일 전개 + Google Calendar RRULE 변환.
// rule = { freq: 'daily'|'weekly'|'yearly', byDay: [1..7] (1=일요일, EKWeekday 준용), until: ms|null }
import { addDays, dateKey, startOfDay } from './calendarLogic.js';

const DAY_MS = 86400000;
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** until(날짜) 당일 끝까지 포함. */
const untilLimit = (until) => (until == null ? Infinity : startOfDay(until).getTime() + DAY_MS - 1);

/**
 * 이벤트 발생 목록 — 시작 시각이 [from, to) 에 드는 것만.
 * 반환: [{ start, end, key }] (ms). exdates(yyyy-MM-dd)는 제외.
 */
export function occurrences(event, from, to) {
  const s = new Date(event.start);
  const duration = event.end - event.start;
  const lo = new Date(from).getTime();
  const hi = new Date(to).getTime();
  const out = [];
  const push = (startDate) => {
    const t = startDate.getTime();
    if (t < lo || t >= hi || t < event.start) return;
    const key = dateKey(startDate);
    if (event.exdates?.includes(key)) return;
    out.push({ start: t, end: t + duration, key });
  };

  const rule = event.rule;
  if (!rule) {
    push(s);
    return out;
  }
  const limit = Math.min(untilLimit(rule.until), hi - 1);
  const at = (day) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), s.getHours(), s.getMinutes(), s.getSeconds());

  if (rule.freq === 'yearly') {
    const y0 = Math.max(s.getFullYear(), new Date(lo).getFullYear());
    const y1 = new Date(limit === Infinity ? hi : limit).getFullYear();
    for (let y = y0; y <= y1; y++) {
      const c = new Date(y, s.getMonth(), s.getDate(), s.getHours(), s.getMinutes(), s.getSeconds());
      if (c.getMonth() !== s.getMonth()) continue; // 2/29 → 평년 건너뜀
      if (c.getTime() <= limit) push(c);
    }
    return out;
  }

  const weekdays = rule.freq === 'weekly' ? (rule.byDay?.length ? rule.byDay : [s.getDay() + 1]) : null;
  let day = startOfDay(Math.max(event.start, lo));
  while (day.getTime() <= limit) {
    if (!weekdays || weekdays.includes(day.getDay() + 1)) {
      const c = at(day);
      if (c.getTime() <= limit) push(c);
    }
    day = addDays(day, 1);
  }
  return out;
}

/** 로컬 자정 기준 until 당일 23:59:59 → UTC basic 포맷 (yyyymmddThhmmssZ). */
function utcBasic(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** rule → RFC 5545 RRULE 문자열 (Google Calendar recurrence[]). */
export function toRRULE(rule, start) {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.freq === 'weekly') {
    const days = rule.byDay?.length ? [...rule.byDay].sort() : [new Date(start).getDay() + 1];
    parts.push(`BYDAY=${days.map((d) => BYDAY[d - 1]).join(',')}`);
  }
  if (rule.until != null) parts.push(`UNTIL=${utcBasic(untilLimit(rule.until))}`);
  return `RRULE:${parts.join(';')}`;
}
