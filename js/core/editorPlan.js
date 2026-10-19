// 이벤트 에디터 저장 계획 — iOS EventEditorView.save()/canSave 를 순수 함수로 포팅.
// 폼 상태 → 저장할 이벤트 배열 [{ title, notes, start, end, location, rule }].
import { addDays, combine, startOfDay } from './calendarLogic.js';
import { encodeTodos, hasTitleDatePattern, substituteTitlePatterns } from './plannerLogic.js';

const HOUR = 3600000;

/** 종료 > 시작 이면 종료, 아니면 시작+1h. */
const endOrHour = (start, end) => (end > start ? end : start + HOUR);

export function canSave(f) {
  switch (f.mode) {
    case 'diary':
      return !!(f.title || f.diaryBody);
    case 'todo':
      if (!f.template) return false;
      if (f.template.isTodo) return f.todos.some((t) => t.text);
      return !!f.title;
    case 'personalEvent':
      return !!f.template && !!f.title;
    default:
      return false;
  }
}

function repeatRule(f) {
  return {
    freq: f.repeatFrequency,
    byDay: f.repeatFrequency === 'weekly' ? [...f.selectedWeekdays].sort() : [],
    until: +startOfDay(f.repeatEnd),
  };
}

/** 반복 + 개별 등록: repeatStart~repeatEnd 1일씩 순회, 날짜별 패턴 치환 후 개별 이벤트(반복 없음). */
function individualEvents(f, startTime, endTime) {
  const out = [];
  for (let cur = startOfDay(f.repeatStart); cur <= startOfDay(f.repeatEnd); cur = addDays(cur, 1)) {
    out.push({
      title: substituteTitlePatterns(f.title, cur),
      notes: null,
      start: +combine(cur, startTime),
      end: +combine(cur, endTime),
      location: null,
      rule: null,
    });
  }
  return out;
}

/** 시간 피커 값(시:분)을 선택일에 결합. */
const onDate = (f, time) => +combine(f.date, time);

export function planEvents(f) {
  const loc = (f.location ?? '').trim() || null;
  switch (f.mode) {
    case 'diary':
      return [{
        title: f.title || '일기',
        notes: f.diaryBody,
        start: +f.editorOpenTime,
        end: +(f.now ?? new Date()),
        location: null,
        rule: null,
      }];

    case 'todo': {
      const t = f.template;
      if (t.isTodo) {
        return [{
          title: f.title || '할 일',
          notes: encodeTodos(f.todos.filter((x) => x.text)),
          start: +f.dueDate,
          end: +f.dueDate,
          location: null,
          rule: null,
        }];
      }
      const start = onDate(f, f.eventStart);
      return [{
        title: substituteTitlePatterns(f.title, f.date),
        notes: null,
        start,
        end: endOrHour(start, onDate(f, f.eventEnd)),
        location: loc,
        rule: null,
      }];
    }

    case 'personalEvent': {
      const t = f.template;
      const title = substituteTitlePatterns(f.title, f.date);
      const hasPattern = hasTitleDatePattern(f.title);
      const start = onDate(f, f.eventStart);
      const base = { title, notes: null, start, location: null, rule: null };
      switch (t.category) {
        case 'workEvent':
        case 'appointment':
          return [{ ...base, end: endOrHour(start, onDate(f, f.eventEnd)), location: loc }];
        case 'medication':
        case 'fixed': {
          const rawEnd = onDate(f, f.eventEnd);
          const end = t.category === 'medication' ? start : rawEnd >= start ? rawEnd : start;
          if (f.repeatEnabled && f.individual) return individualEvents(f, start, end);
          let rule = null;
          if (f.repeatEnabled) rule = repeatRule(f);
          else if (!hasPattern) rule = { freq: 'yearly', byDay: [], until: null };
          return [{ ...base, end, rule }];
        }
      }
    }
  }
  return [];
}
