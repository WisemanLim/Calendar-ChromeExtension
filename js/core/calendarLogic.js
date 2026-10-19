// 캘린더 날짜 로직 (순수 함수 — DOM/chrome 비의존, 테스트 가능).
// iOS CalendarLogic.swift 포팅. 그리드 헤더가 SUN-first(일요일 시작)이므로 모든 계산도 SUN-first 기준.

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** 이벤트 캐시 키 (yyyy-MM-dd, 로컬 시간대). */
export function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-MM-dd → 로컬 자정 Date. */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isSameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** 월 덧셈. 말일 초과 시 해당 월 말일로 클램프 (Calendar.date(byAdding: .month) 동작). */
export function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), d.getSeconds());
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return target;
}

export function addYears(date, n) {
  return addMonths(date, n * 12);
}

/** date 의 날짜 + time 의 시:분 결합. */
export function combine(date, time) {
  const d = new Date(date);
  const t = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes(), 0, 0);
}

/** date 날짜의 hour:minute. */
export function dateAt(date, hour, minute = 0) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0);
}

/** 선택일이 포함된 주(일~토) 7일. */
export function weekDates(selectedDate) {
  const start = addDays(startOfDay(selectedDate), -new Date(selectedDate).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * 한 달의 6주(42칸) 그리드.
 * - SUN-first 정렬: 선행 빈칸 = 1일의 요일(일요일=0).
 * - 앞/뒤는 전·다음 달 날짜로 채워 항상 42칸.
 */
export function monthGrid(date, { selectedDate, today = new Date(), eventCount = () => 0 } = {}) {
  const d = new Date(date);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const leading = first.getDay();
  const gridStart = addDays(first, -leading);
  const todayKey = dateKey(today);
  const selKey = selectedDate ? dateKey(selectedDate) : null;
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(gridStart, i);
    const key = dateKey(day);
    const count = eventCount(day);
    return {
      day: day.getDate(),
      date: day,
      key,
      isCurrentMonth: day.getMonth() === d.getMonth(),
      isToday: key === todayKey,
      isSelected: key === selKey,
      eventCount: count,
      hasEvent: count > 0,
    };
  });
}

/** 월 범위 [1일 00:00, 다음달 1일 00:00). */
export function monthRange(year, month /* 1-12 */) {
  return [new Date(year, month - 1, 1), new Date(year, month, 1)];
}
