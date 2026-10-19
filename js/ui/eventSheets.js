// 이벤트 수정 / 복사·반복복사 / 검색 — iOS EventEditSheet · EventCopySheet · EventSearchView 포팅.
import { h, openSheet, section, row, toast,
  toDateInput, toTimeInput, toDateTimeInput, fromDateInput, fromTimeInput, fromDateTimeInput } from './dom.js';
import { addDays, addYears, combine, startOfDay } from '../core/calendarLogic.js';
import { loadImage } from '../platform/imageStore.js';

const HOUR = 3600000;

// MARK: 수정 — 시작 변경 시 종료 = 시작 + 원본 간격(originalDuration)

export async function openEditSheet(ctx, item) {
  const ev = (await ctx.events.get(item.id).catch(() => null)) ?? item;
  const s = {
    title: item.title,
    notes: ev.notes ?? '',
    start: new Date(ev.start ?? item.start),
    end: new Date(ev.end ?? +item.start + HOUR),
    location: ev.location ?? '',
  };
  const originalDuration = s.end - s.start;
  const image = await loadImage(item.id);

  const sheet = openSheet({
    title: '일정 편집',
    right: { label: '저장', role: 'save', onClick: save },
  });
  const refreshSave = () => sheet.setRightDisabled(!s.title.trim());

  const endInput = h('input', { type: 'datetime-local', value: toDateTimeInput(s.end), 'aria-label': '종료', onchange: (e) => { if (e.target.value) s.end = fromDateTimeInput(e.target.value); } });
  const startInput = h('input', { type: 'datetime-local', value: toDateTimeInput(s.start), 'aria-label': '시작', onchange: (e) => {
    if (!e.target.value) return;
    s.start = fromDateTimeInput(e.target.value);
    s.end = new Date(+s.start + originalDuration);
    endInput.value = toDateTimeInput(s.end);
  } });
  const notes = h('textarea', { value: s.notes, 'aria-label': '메모', placeholder: '메모', oninput: (e) => { s.notes = e.target.value; autoGrow(); } });
  const autoGrow = () => { notes.style.height = 'auto'; notes.style.height = `${Math.max(80, notes.scrollHeight)}px`; };

  sheet.setBody(
    section('제목', [row(h('input', { value: s.title, 'aria-label': '제목', oninput: (e) => { s.title = e.target.value; refreshSave(); } }))]),
    section('시간', [row(h('span', { class: 'grow' }, '시작'), startInput), row(h('span', { class: 'grow' }, '종료'), endInput)]),
    section('장소', [row(h('input', { value: s.location, placeholder: '장소 (선택)', 'aria-label': '장소', oninput: (e) => { s.location = e.target.value; } }))]),
    section('메모', [row(notes)]),
    image ? section('사진', [row(h('img', { class: 'photo', src: image, alt: '첨부 사진' }))]) : null,
    item.recurring ? h('div', { class: 'section caption' }, '반복 일정 — 이 날짜의 일정만 변경됩니다.') : null,
  );
  requestAnimationFrame(autoGrow);
  refreshSave();

  async function save() {
    const loc = s.location.trim();
    const ok = await ctx.events.update(item.id, {
      title: s.title,
      notes: s.notes || null,
      start: +s.start,
      end: s.end < s.start ? +s.start : +s.end,
      location: loc || null,
    });
    if (!ok) toast('저장하지 못했습니다');
    sheet.close();
  }
  return sheet;
}

// MARK: 복사 / 반복복사 (내용포함·제외)

export async function openCopySheet(ctx, item, { includeNotes, isRepeat = false }) {
  const ev = (await ctx.events.get(item.id).catch(() => null)) ?? item;
  const today = startOfDay(new Date());
  const s = {
    target: today,
    repeatEnd: addDays(today, 1),
    title: item.title,
    notes: includeNotes ? ev.notes ?? '' : '',
    startHour: new Date(ev.start ?? item.start),
    endHour: new Date(ev.end ?? +item.start + HOUR),
  };
  const sheet = openSheet({
    title: isRepeat ? '반복 복사' : '이벤트 복사',
    right: { label: isRepeat ? '반복복사' : '복사', role: 'save', onClick: save },
  });
  const refreshSave = () => sheet.setRightDisabled(!s.title.trim());
  const endDate = h('input', { type: 'date', value: toDateInput(s.repeatEnd), min: toDateInput(s.target), 'aria-label': '종료일', onchange: (e) => { if (e.target.value) s.repeatEnd = fromDateInput(e.target.value); } });

  sheet.setBody(
    section(isRepeat ? '반복 날짜 범위' : '복사할 날짜 선택', [
      row(h('span', { class: 'grow' }, isRepeat ? '시작일' : '복사 날짜'),
        h('input', { type: 'date', value: toDateInput(s.target), 'aria-label': isRepeat ? '시작일' : '복사 날짜', onchange: (e) => {
          if (!e.target.value) return;
          s.target = fromDateInput(e.target.value);
          endDate.min = toDateInput(s.target);
          if (s.repeatEnd < s.target) { s.repeatEnd = s.target; endDate.value = toDateInput(s.target); }
        } })),
      isRepeat ? row(h('span', { class: 'grow' }, '종료일'), endDate) : null,
    ]),
    section('제목', [row(h('input', { value: s.title, 'aria-label': '제목', oninput: (e) => { s.title = e.target.value; refreshSave(); } }))]),
    section('시간', [
      row(h('span', { class: 'grow' }, '시작'), h('input', { type: 'time', value: toTimeInput(s.startHour), 'aria-label': '시작', onchange: (e) => { if (e.target.value) s.startHour = fromTimeInput(e.target.value); } })),
      row(h('span', { class: 'grow' }, '종료'), h('input', { type: 'time', value: toTimeInput(s.endHour), 'aria-label': '종료', onchange: (e) => { if (e.target.value) s.endHour = fromTimeInput(e.target.value); } })),
    ]),
    includeNotes ? section('내용', [row(h('textarea', { value: s.notes, 'aria-label': '내용', oninput: (e) => { s.notes = e.target.value; } }))]) : null,
  );
  refreshSave();

  async function save() {
    const days = [];
    for (let d = s.target; d <= (isRepeat ? s.repeatEnd : s.target); d = addDays(d, 1)) days.push(d);
    const list = days.map((d) => {
      const start = +combine(d, s.startHour);
      const rawEnd = +combine(d, s.endHour);
      return {
        title: s.title,
        notes: includeNotes && s.notes ? s.notes : null,
        start,
        end: rawEnd <= start ? start + HOUR : rawEnd,
      };
    });
    const ids = await ctx.events.addMany(list);
    toast(ids.every(Boolean) ? `${ids.length}건 복사했습니다` : '일부 복사에 실패했습니다');
    sheet.close();
  }
  return sheet;
}

// MARK: 검색 — 제목·메모, -1년 ~ +2년

const fmtResult = (ms) => {
  const d = new Date(ms);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} (${wd}) ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function openSearch(ctx, onSelect) {
  const sheet = openSheet({ title: '이벤트 검색' });
  const results = h('div', { class: 'section results' });
  let seq = 0;
  const input = h('input', { type: 'search', placeholder: '이벤트 검색', 'aria-label': '이벤트 검색', oninput: () => run(input.value) });

  async function run(q) {
    const my = ++seq;
    const trimmed = q.trim();
    if (!trimmed) return results.replaceChildren();
    const now = new Date();
    let found = [];
    try {
      found = await ctx.events.search(trimmed, addYears(now, -1), addYears(now, 2));
    } catch (e) {
      console.error(e);
    }
    if (my !== seq) return;
    results.replaceChildren(found.length
      ? h('div', { class: 'group' }, found.map((it) => h('div', { class: 'row', role: 'button', style: { cursor: 'pointer', display: 'block' }, onclick: () => { sheet.close(); onSelect(new Date(it.start)); } },
        h('div', { style: { fontWeight: 500 } }, it.title),
        h('div', { class: 'sub' }, fmtResult(it.start)))))
      : h('div', { class: 'caption', style: { textAlign: 'center', padding: '30px 0' } }, '검색 결과 없음', h('br'), `'${trimmed}'에 해당하는 이벤트가 없습니다.`));
  }

  sheet.setBody(section(null, [row('⌕', input)]), results);
  setTimeout(() => input.focus(), 50);
  return sheet;
}
