// 플래너 모드/템플릿 순수 로직 — iOS PlannerLogic.swift 포팅.

const pad = (n, w = 2) => String(n).padStart(w, '0');

// MARK: day-of-year

/** 그 해 일련일(1 = 1월 1일). */
export function dayOfYear(date) {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((today - jan1) / 86400000) + 1;
}

/** 특정 연도의 day-of-year 에 해당하는 날짜. 범위 밖이면 null. */
export function dateFromDayOfYear(day, year) {
  if (day < 1) return null;
  const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  if (day > daysInYear) return null;
  return new Date(year, 0, day);
}

// MARK: 고정 이벤트 표기 [#ddd] 제목

export function fixedTitle(day, title) {
  return `[#${day}] ${title}`;
}

/** `[#ddd] 제목` 파싱 → { dayOfYear, title }. 형식 불일치면 null. */
export function parseFixedTitle(raw) {
  const m = /^\[#(-?\d+)\](.*)$/.exec(raw);
  if (!m) return null;
  return { dayOfYear: Number(m[1]), title: m[2].trim() };
}

// MARK: 투두 인코딩 (event.notes)

/** 체크리스트 → notes. `- [ ] 항목` / `- [x] 항목`. */
export function encodeTodos(items) {
  return items.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text}`).join('\n');
}

/** notes → 체크리스트. 체크박스 라인만 파싱. */
export function decodeTodos(notes) {
  return String(notes || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((s) => s.startsWith('- [') && s.length >= 5)
    .map((s) => {
      const mark = s[3];
      const close = s.indexOf(']');
      if (close < 0) return null;
      return { text: s.slice(close + 1).trim(), done: mark === 'x' || mark === 'X' };
    })
    .filter(Boolean);
}

/** notes 가 체크리스트인지 (EventStoreManager isTodo 판정). */
export function isTodoNotes(notes) {
  const n = notes || '';
  return n.includes('- [ ]') || n.includes('- [x]');
}

/** 기한 초과: 체크리스트 && 시작 < now && 미완료 항목 존재. */
export function isOverdue(notes, start, now = new Date()) {
  return isTodoNotes(notes) && new Date(start) < now && (notes || '').includes('- [ ]');
}

// MARK: 타이틀 날짜 패턴

const DATE_PATTERNS = ['yyyy-mm-dd', 'yyyy/mm/dd', 'yy-mm-dd', 'yyyy.mm.dd', 'dd-mm-yyyy', 'd###'];

/** 타이틀의 날짜 패턴을 실제 날짜 문자열로 치환. yyyy 계열 먼저 처리해 yy-mm-dd 충돌 방지. */
export function substituteTitlePatterns(title, date) {
  const d = new Date(date);
  const yyyy = pad(d.getFullYear(), 4);
  const yy = pad(d.getFullYear() % 100);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const ddd = pad(dayOfYear(d), 3);
  return title
    .replaceAll('yyyy-mm-dd', `${yyyy}-${mm}-${dd}`)
    .replaceAll('yyyy/mm/dd', `${yyyy}/${mm}/${dd}`)
    .replaceAll('yy-mm-dd', `${yy}-${mm}-${dd}`)
    .replaceAll('yyyy.mm.dd', `${yyyy}.${mm}.${dd}`)
    .replaceAll('dd-mm-yyyy', `${dd}-${mm}-${yyyy}`)
    .replaceAll('d###', ddd);
}

export function hasTitleDatePattern(title) {
  return DATE_PATTERNS.some((p) => title.includes(p));
}
