// 플래너 모드별 이벤트 추가 화면 — iOS EventEditorView.swift 포팅.
// diary: 전체화면 자유 입력 · todo(업무 이벤트): workEvent 템플릿 · personalEvent: 분류(복용/약속/고정) → 템플릿 → 프리필.
import { h, openSheet, section, row, toggle, segment, toast,
  toDateInput, toTimeInput, toDateTimeInput, fromDateInput, fromTimeInput, fromDateTimeInput } from './dom.js';
import { addDays, addYears, dateAt } from '../core/calendarLogic.js';
import { eventDayEmoji } from '../core/eventFormat.js';
import { CATEGORY_TITLES, MedicationPreset, PERSONAL_CATEGORIES, RepeatFrequency, modeInfo, presetForHour } from '../core/plannerMode.js';
import { templateLabel } from '../core/templates.js';
import { canSave, planEvents } from '../core/editorPlan.js';
import { compressImage, saveImage } from '../platform/imageStore.js';
import { scheduleEventReminder } from '../platform/notifications.js';

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function openEditor(ctx, mode, date) {
  const start = dateAt(date, 9);
  const f = {
    mode,
    date,
    title: '',
    // diary
    editorOpenTime: new Date(),
    diaryBody: '',
    // todo
    todos: [{ text: '', done: false }],
    dueDate: dateAt(date, 23, 59),
    // personalEvent / workEvent
    category: mode === 'todo' ? 'workEvent' : 'medication',
    template: null,
    eventStart: start,
    eventEnd: new Date(+start + 3600000),
    location: '',
    medicationPreset: 'morning',
    repeatEnabled: false,
    individual: true,
    repeatFrequency: 'yearly',
    selectedWeekdays: new Set(),
    repeatStart: date,
    repeatEnd: addYears(date, 1),
    image: null,
  };

  if (mode === 'diary') {
    f.title = `[${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}]${eventDayEmoji(ctx.events.countFor(date))}수고했어요.`;
  }

  let timer = null;
  const sheet = openSheet({
    title: `새 ${modeInfo(mode).title}`,
    right: { label: '저장', role: 'save', onClick: () => save(), disabled: true },
    onClose: () => clearInterval(timer),
    className: mode === 'diary' ? 'fullscreen' : '',
  });
  const refreshSave = () => sheet.setRightDisabled(!canSave(f));

  async function save() {
    if (!canSave(f)) return;
    sheet.setRightDisabled(true);
    f.now = new Date();
    const planned = planEvents(f);
    const ids = await ctx.events.addMany(planned);
    for (let i = 0; i < planned.length; i++) {
      if (!ids[i]) continue;
      if (ctx.settings.notificationsEnabled) await scheduleEventReminder(planned[i].title, planned[i].start);
      if (f.image) await saveImage(ids[i], f.image);
    }
    if (ids.some((x) => !x)) toast('일부 이벤트를 저장하지 못했습니다');
    else if (planned.length > 1) toast(`${planned.length}개 이벤트 등록`);
    sheet.close();
  }

  // MARK: diary — 시작=화면 열린 시각, 저장=저장 시각

  function diaryBody() {
    let elapsed = 0;
    const fmt = (s) => {
      const hh = Math.floor(s / 3600);
      const mm = Math.floor((s % 3600) / 60);
      return hh > 0 ? `${hh}:${pad(mm)}:${pad(s % 60)}` : `${pad(mm)}:${pad(s % 60)}`;
    };
    const clock = h('span', { class: 'elapsed', 'aria-label': '경과 시간' }, fmt(0));
    timer = setInterval(() => { clock.textContent = fmt(++elapsed); }, 1000);
    return h('div', { class: 'diary' },
      h('div', { class: 'head' },
        h('input', { value: f.title, placeholder: '제목', 'aria-label': '제목', oninput: (e) => { f.title = e.target.value; refreshSave(); } }),
        clock),
      h('textarea', { placeholder: '오늘의 기록을 자유롭게 작성하세요…', 'aria-label': '본문', oninput: (e) => { f.diaryBody = e.target.value; refreshSave(); } }));
  }

  // MARK: 템플릿 편집기 (업무 이벤트 / 개인 이벤트)

  function render() {
    sheet.setBody(templateEditor());
    refreshSave();
  }

  function selectTemplate(t) {
    f.template = t;
    if (t.isTodo) {
      f.title = '';
      f.todos = [{ text: '', done: false }];
    } else {
      f.title = templateLabel(t);
    }
    // 템플릿 기본 시각 적용
    f.eventStart = dateAt(date, t.defaultStartHour);
    f.eventEnd = new Date(+f.eventStart + t.defaultDurationMinutes * 60000);
    if (t.category === 'medication') f.medicationPreset = presetForHour(t.defaultStartHour);
    render();
  }

  const timeInput = (value, onChange, label) =>
    h('input', { type: 'time', value: toTimeInput(value), 'aria-label': label, onchange: (e) => e.target.value && onChange(fromTimeInput(e.target.value, date)) });

  function templateEditor() {
    const out = [];
    if (mode === 'personalEvent') {
      out.push(section('분류', [row(segment(PERSONAL_CATEGORIES.map((c) => ({ id: c, title: CATEGORY_TITLES[c] })), f.category, (c) => {
        Object.assign(f, { category: c, template: null, title: '', repeatEnabled: false, repeatFrequency: 'yearly', selectedWeekdays: new Set() });
        render();
      }))]));
    }
    out.push(section('템플릿', ctx.templates.inCategory(f.category).map((t) =>
      h('div', { class: 'row link-plain', role: 'option', 'aria-selected': String(f.template?.id === t.id), style: { cursor: 'pointer' }, onclick: () => selectTemplate(t) },
        h('span', { class: 'grow' }, templateLabel(t)),
        f.template?.id === t.id ? h('span', { class: 'check' }, '✓') : null))));

    const t = f.template;
    if (!t) return out;

    out.push(section(t.isTodo ? '제목 (선택)' : '제목 (편집 가능)', [row(
      h('input', { value: f.title, placeholder: t.isTodo ? '할 일 목록 제목' : '제목', 'aria-label': '제목', oninput: (e) => { f.title = e.target.value; refreshSave(); } }))]));

    if (t.isTodo) out.push(...todoSections());
    else out.push(...timeSections(t));
    return out;
  }

  function todoSections() {
    const items = f.todos.map((item, i) => h('div', { class: 'row todo-row' },
      h('button', { class: `tick ${item.done ? 'done' : ''}`, 'aria-label': '완료 토글', onclick: () => { item.done = !item.done; render(); } }, item.done ? '●' : '○'),
      h('input', { class: item.done ? 'done' : '', value: item.text, placeholder: '할 일 입력', 'aria-label': `항목 ${i + 1}`, oninput: (e) => { item.text = e.target.value; refreshSave(); } }),
      f.todos.length > 1 ? h('button', { class: 'del', 'aria-label': '항목 삭제', onclick: () => { f.todos.splice(i, 1); render(); } }, '✕') : null));
    const overdue = f.dueDate < new Date();
    return [
      section('항목', [...items, h('div', { class: 'row' }, h('button', { class: 'btn-link', onclick: () => { f.todos.push({ text: '', done: false }); render(); } }, '⊕ 항목 추가'))]),
      section('목표 시간 (Due Date)', [
        row(h('span', { class: 'grow' }, '기한'),
          h('input', { type: 'datetime-local', value: toDateTimeInput(f.dueDate), 'aria-label': '기한', onchange: (e) => { if (e.target.value) { f.dueDate = fromDateTimeInput(e.target.value); render(); } } })),
        overdue ? row(h('span', { class: 'caption err' }, '⚠ 기한이 지났습니다')) : null,
      ]),
    ];
  }

  function timeSections(t) {
    const startEnd = (title) => section(title, [
      row(h('span', { class: 'grow' }, '시작'), timeInput(f.eventStart, (v) => {
        f.eventStart = v;
        if (t.category === 'fixed' && f.eventEnd < v) f.eventEnd = v;
        render();
      }, '시작')),
      row(h('span', { class: 'grow' }, '종료'), timeInput(f.eventEnd, (v) => { f.eventEnd = v; render(); }, '종료')),
    ]);
    const place = () => section('장소', [row(h('input', { value: f.location, placeholder: '장소 입력 (선택)', 'aria-label': '장소', oninput: (e) => { f.location = e.target.value; } }))]);

    switch (t.category) {
      case 'workEvent':
        return [startEnd('시간'), place()];
      case 'appointment':
        return [startEnd('약속 시간'), place()];
      case 'fixed':
        return [startEnd('시간'), repeatSection()];
      case 'medication':
        return [
          section('복용 시간', [
            row(h('div', { class: 'chips' }, MedicationPreset.map((p) =>
              h('button', { class: `chip ${f.medicationPreset === p.id ? 'on' : ''}`, onclick: () => {
                f.medicationPreset = p.id;
                if (p.hour != null) f.eventStart = dateAt(date, p.hour);
                render();
              } }, p.title)))),
            row(h('span', { class: 'grow' }, '시간'), timeInput(f.eventStart, (v) => { f.eventStart = v; f.medicationPreset = 'custom'; render(); }, '복용 시간')),
          ]),
          section(null, [row(h('button', { class: 'btn-link', onclick: async () => {
            await ctx.templates.update({ ...t, defaultStartHour: f.eventStart.getHours() });
            toast('기본 시간으로 저장했습니다');
          } }, '기본 시간으로 저장'))]),
          repeatSection(),
          photoSection(),
        ];
    }
    return [];
  }

  // MARK: 반복 (매일·매주·매년) + 개별 등록

  function updateRepeatEnd() {
    const s = f.repeatStart;
    f.repeatEnd = f.repeatFrequency === 'daily' ? addDays(s, 1) : f.repeatFrequency === 'weekly' ? addDays(s, 7) : addYears(s, 1);
  }

  function repeatSection() {
    const rows = [row(
      h('span', { class: 'grow' }, '반복 설정'),
      f.repeatEnabled
        ? h('button', { class: f.individual ? 'btn-link' : 'caption', 'aria-pressed': String(f.individual), title: 'ON: 날짜별 개별 이벤트 · OFF: 단일 반복 이벤트', onclick: () => { f.individual = !f.individual; render(); } },
          `${f.individual ? '☑' : '☐'} 개별`)
        : null,
      toggle(f.repeatEnabled, (on) => { f.repeatEnabled = on; if (on) updateRepeatEnd(); render(); }, '반복 설정'))];
    if (f.repeatEnabled) {
      rows.push(row(segment(RepeatFrequency, f.repeatFrequency, (v) => {
        f.repeatFrequency = v;
        if (v !== 'weekly') f.selectedWeekdays = new Set();
        updateRepeatEnd();
        render();
      })));
      if (f.repeatFrequency === 'weekly') {
        rows.push(row(h('div', { class: 'chips wd', style: { flex: 1 } }, WEEKDAY_LABELS.map((l, i) => {
          const rv = i + 1;
          return h('button', { class: `chip ${f.selectedWeekdays.has(rv) ? 'on' : ''}`, onclick: () => {
            if (f.selectedWeekdays.has(rv)) f.selectedWeekdays.delete(rv); else f.selectedWeekdays.add(rv);
            render();
          } }, l);
        }))));
      }
      rows.push(
        row(h('span', { class: 'grow' }, '반복 시작일'), h('input', { type: 'date', value: toDateInput(f.repeatStart), 'aria-label': '반복 시작일', onchange: (e) => {
          if (!e.target.value) return;
          f.repeatStart = fromDateInput(e.target.value);
          updateRepeatEnd();
          render();
        } })),
        row(h('span', { class: 'grow' }, '반복 종료일'), h('input', { type: 'date', value: toDateInput(f.repeatEnd), min: toDateInput(f.repeatStart), 'aria-label': '반복 종료일', onchange: (e) => {
          if (!e.target.value) return;
          const v = fromDateInput(e.target.value);
          f.repeatEnd = v < f.repeatStart ? f.repeatStart : v;
          render();
        } })),
      );
    }
    return section('반복', rows);
  }

  // MARK: 사진 (복용 전용) — 파일 선택 또는 드래그&드롭

  function photoSection() {
    const fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, 'aria-label': '사진 파일', onchange: (e) => attach(e.target.files?.[0]) });
    async function attach(file) {
      if (!file) return;
      try {
        f.image = await compressImage(file);
        render();
      } catch (e) {
        console.error(e);
        toast('사진을 불러오지 못했습니다');
      }
    }
    const drop = h('div', {
      class: 'drop',
      ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
      ondragleave: () => drop.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); attach(e.dataTransfer.files?.[0]); },
    }, '약 봉투 사진을 여기에 끌어다 놓거나 ', h('button', { class: 'btn-link', onclick: () => fileInput.click() }, '사진 선택'), fileInput);
    return section('사진', [
      f.image ? row(h('img', { class: 'photo', src: f.image, alt: '첨부 사진' })) : null,
      f.image ? row(h('button', { class: 'btn-danger', onclick: () => { f.image = null; render(); } }, '사진 제거')) : null,
      row(h('div', { style: { flex: 1 } }, drop)),
    ], '디스크/파일 접근이 허용된 경우에만 첨부할 수 있습니다.');
  }

  if (mode === 'diary') {
    sheet.setBody(diaryBody());
    refreshSave();
  } else {
    render();
  }
  return sheet;
}
