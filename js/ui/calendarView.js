// 메인 캘린더 — iOS CalendarView.swift 포팅.
// Row1: ⚙ | [Today] < 년 > | 🔍 ＋ · Row2: < MONTH YEAR > · Row3: 주간 스트립 · 히어로(큰 날짜 + 일정 목록) · 미니 달력 2개.
import { h, longPress, drag, actionSheet, contextMenu, toast } from './dom.js';
import { addDays, addMonths, addYears, dateKey, isSameDay, monthGrid, weekDates } from '../core/calendarLogic.js';
import {
  WEATHER_ICON, WEEKDAY_ABBR, eventCountColor, eventDayEmoji, heroColor, lunarDateString, monthYearString, weekdayFull,
} from '../core/eventFormat.js';
import { PLANNER_MODES } from '../core/plannerMode.js';
import { openEditor } from './editor.js';
import { openEditSheet, openCopySheet, openSearch } from './eventSheets.js';
import { openSettings } from './settingsView.js';

export class CalendarView {
  constructor(ctx, container) {
    this.ctx = ctx;
    this.container = container;
    this.currentDate = new Date();
    this.selectedDate = new Date();
    ctx.events.onChange(() => this.reload());
  }

  get activeMode() {
    return this.ctx.settings.plannerMode;
  }

  // MARK: 데이터

  visibleDates() {
    return [...weekDates(this.selectedDate), this.currentDate, addMonths(this.currentDate, 1), this.selectedDate];
  }

  async reload() {
    this.render();
    try {
      await this.ctx.events.ensure(this.visibleDates());
    } catch (e) {
      console.error(e);
      toast(this.ctx.settings.storageMode === 'google' ? 'Google 캘린더 연결 실패 — 설정을 확인하세요' : '이벤트를 불러오지 못했습니다');
    }
    this.render();
  }

  select(date) {
    this.selectedDate = date;
    // 선택일이 표시 월과 다르면 월 동기화
    if (date.getFullYear() !== this.currentDate.getFullYear() || date.getMonth() !== this.currentDate.getMonth()) {
      this.currentDate = date;
    }
    this.reload();
  }

  changeMonth(n) {
    this.currentDate = addMonths(this.currentDate, n);
    this.selectedDate = this.currentDate;
    this.reload();
  }

  changeYear(n) {
    this.currentDate = addYears(this.currentDate, n);
    this.selectedDate = this.currentDate;
    this.reload();
  }

  goToToday() {
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.reload();
  }

  async refresh() {
    await Promise.all([
      this.ctx.weather.requestAndFetch(true),
      this.ctx.events.refresh(),
    ]);
    toast('새로고침 완료');
  }

  // MARK: 이벤트 추가 (＋ 탭 = 현재 모드, 롱프레스 = 1회 다른 모드)

  openEditor(mode = this.activeMode) {
    openEditor(this.ctx, mode, this.selectedDate);
  }

  showModeOverridePicker() {
    actionSheet({
      title: '입력 방식 선택',
      message: '이번 1회만 다른 입력 방식으로 이벤트를 추가합니다.',
      actions: PLANNER_MODES.filter((m) => m.id !== this.ctx.settings.plannerMode).map((m) => ({
        label: m.title,
        onClick: () => this.openEditor(m.id),
      })),
    });
  }

  // MARK: 렌더

  render() {
    const navBtn = (label, onClick, aria) => h('button', { class: 'nav-btn', onclick: onClick, 'aria-label': aria }, label);

    const addBtn = h('button', { class: 'add-btn', 'aria-label': '이벤트 추가', title: '탭: 추가 · 길게: 1회 다른 입력 방식', onclick: () => this.openEditor() }, '+');
    longPress(addBtn, () => this.showModeOverridePicker());

    const row1 = h('div', { class: 'row1' },
      h('button', { class: 'icon-btn', 'aria-label': '설정', onclick: () => openSettings(this.ctx) }, '⚙︎'),
      this.ctx.canOpenPanel
        ? h('button', { class: 'icon-btn', 'aria-label': '사이드패널로 열기', title: '사이드패널로 열기', onclick: () => this.ctx.openPanel() }, '⇥')
        : null,
      h('div', { class: 'spacer' }),
      !isSameDay(this.selectedDate, new Date()) ? h('button', { class: 'today-btn', onclick: () => this.goToToday() }, 'Today') : null,
      h('div', { class: 'year' },
        navBtn('‹', () => this.changeYear(-1), '이전 연도'),
        h('span', { class: 'year-num' }, String(this.currentDate.getFullYear())),
        navBtn('›', () => this.changeYear(1), '다음 연도')),
      h('div', { class: 'spacer' }),
      h('button', { class: 'icon-btn', 'aria-label': '이벤트 검색', onclick: () => openSearch(this.ctx, (d) => { this.currentDate = d; this.select(d); }) }, '⌕'),
      addBtn);

    const row2 = h('div', { class: 'row2' },
      navBtn('‹', () => this.changeMonth(-1), '이전 달'),
      h('div', { class: 'title' }, monthYearString(this.currentDate)),
      navBtn('›', () => this.changeMonth(1), '다음 달'));

    this.container.replaceChildren(h('div', { class: 'main' }, row1, row2, this.weekStrip(), this.hero(), this.minis()));
  }

  weekStrip() {
    const { weather, events } = this.ctx;
    const el = h('div', { class: 'week', role: 'list', 'aria-label': '주간' },
      weekDates(this.selectedDate).map((d) => {
        const wd = d.getDay();
        const isSel = isSameDay(d, this.selectedDate);
        const isToday = isSameDay(d, new Date());
        const cond = weather.dailyWeather[dateKey(d)];
        return h('div', { class: 'cell', role: 'listitem', dataset: { date: dateKey(d) }, onclick: () => this.select(d) },
          h('div', { class: `wd ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}` }, WEEKDAY_ABBR[wd]),
          h('div', { class: `num ${isSel ? 'selected' : isToday ? 'today' : ''}` }, String(d.getDate())),
          h('div', { class: 'wx', title: cond ?? '' }, cond ? WEATHER_ICON[cond] : eventDayEmoji(events.countFor(d))));
      }));
    // 좌 스와이프 → 다음 주, 우 스와이프 → 이전 주 (임계 50px, 러버밴드 0.25×)
    drag(el, {
      onMove: (dx, _dy, axis) => { if (axis === 'x') el.style.transform = `translateX(${dx * 0.25}px)`; },
      onEnd: (dx, _dy, axis) => {
        el.style.transform = '';
        if (axis !== 'x') return;
        if (dx < -50) this.select(addDays(this.selectedDate, 7));
        else if (dx > 50) this.select(addDays(this.selectedDate, -7));
      },
    });
    return el;
  }

  hero() {
    const { events, weather } = this.ctx;
    const sel = this.selectedDate;
    const count = events.countFor(sel);
    const num = (date, cls, color) => h('div', { class: `hero-num ${cls}`, style: { color } },
      h('div', { class: 'd' }, String(date.getDate())),
      h('div', { class: 'w' }, weekdayFull(date)));
    const main = num(sel, 'cur', heroColor(count));
    const ghost = num(sel, 'ghost', '');
    ghost.style.display = 'none';

    const key = dateKey(sel);
    const cond = weather.dailyWeather[key];
    const temp = weather.dailyTemperature[key];
    const items = events.eventsFor(sel);
    const list = h('div', { class: 'hero-list' },
      h('div', { class: 'info-bar' },
        h('span', { class: 'lunar' }, lunarDateString(sel)),
        h('span', { class: 'spacer' }),
        cond ? h('span', { class: 'wx' }, WEATHER_ICON[cond]) : null,
        cond && temp != null ? h('span', { class: 'temp' }, `${temp}°`) : null),
      items.map((it) => this.eventRow(it)));
    this.pulling = h('div', { class: 'pull' });

    const el = h('div', { class: 'hero', 'aria-label': '선택일', ondblclick: (e) => { if (!e.target.closest('.event-item')) this.openEditor(); } },
      ghost, main, this.pulling, list);
    longPress(el, (e) => { if (!e.target.closest('.event-item')) this.showModeOverridePicker(); });

    // 좌우 스와이프 → 전일/익일 (폭 1/4 이상), 아래로 당기기 → 새로고침
    drag(el, {
      onMove: (dx, dy, axis) => {
        if (axis === 'x') {
          const w = el.clientWidth;
          main.style.transition = 'none';
          main.style.transform = `translateX(${dx}px)`;
          const other = addDays(sel, dx > 0 ? -1 : 1);
          ghost.firstChild.textContent = String(other.getDate());
          ghost.lastChild.textContent = weekdayFull(other);
          ghost.style.display = '';
          ghost.style.transform = `translateX(${dx > 0 ? -w + dx : w + dx}px)`;
        } else if (dy > 0 && list.scrollTop === 0) {
          list.style.transform = `translateY(${dy * 0.35}px)`;
          this.pulling.textContent = dy > 60 ? '↻' : '↓';
        }
      },
      onEnd: (dx, dy, axis) => {
        main.style.transition = '';
        main.style.transform = '';
        ghost.style.display = 'none';
        list.style.transform = '';
        this.pulling.textContent = '';
        if (axis === 'x' && Math.abs(dx) > el.clientWidth / 4) this.select(addDays(sel, dx > 0 ? -1 : 1));
        else if (axis === 'y' && dy > 60 && list.scrollTop === 0) this.refresh();
      },
    });
    return el;
  }

  eventRow(it) {
    const menu = (x, y) => contextMenu(x, y, [
      { label: '복사 (내용포함)', icon: '⧉', onClick: () => openCopySheet(this.ctx, it, { includeNotes: true }) },
      { label: '복사 (내용제외)', icon: '⧉', onClick: () => openCopySheet(this.ctx, it, { includeNotes: false }) },
      { label: '반복복사 (내용포함)', icon: '↻', onClick: () => openCopySheet(this.ctx, it, { includeNotes: true, isRepeat: true }) },
      { label: '반복복사 (내용제외)', icon: '↻', onClick: () => openCopySheet(this.ctx, it, { includeNotes: false, isRepeat: true }) },
      { label: '삭제', icon: '🗑', danger: true, onClick: () => this.ctx.events.remove(it.id) },
    ]);
    const cls = ['event-item', it.isOverdue ? 'overdue' : '', it.isSecret ? 'secret' : ''].join(' ');
    const el = h('div', {
      class: cls,
      role: 'button',
      tabindex: 0,
      dataset: { id: it.id },
      onclick: () => openEditSheet(this.ctx, it),
      oncontextmenu: (e) => { e.preventDefault(); menu(e.clientX, e.clientY); },
      ondblclick: (e) => e.stopPropagation(),
    }, h('span', { class: 'dot' }), h('span', { class: 't' }, it.displayTitle));
    longPress(el, (e) => menu(e.clientX, e.clientY));
    return el;
  }

  minis() {
    const el = h('div', { class: 'minis' },
      this.month(this.currentDate),
      h('div', { class: 'sep' }),
      this.month(addMonths(this.currentDate, 1)));
    drag(el, {
      onMove: (dx, _dy, axis) => { if (axis === 'x') el.style.transform = `translateX(${dx * 0.25}px)`; },
      onEnd: (dx, _dy, axis) => {
        el.style.transform = '';
        if (axis !== 'x') return;
        if (dx < -50) this.changeMonth(1);
        else if (dx > 50) this.changeMonth(-1);
      },
    });
    return el;
  }

  month(date) {
    const { events } = this.ctx;
    const cells = monthGrid(date, { selectedDate: this.selectedDate, eventCount: (d) => events.countFor(d) });
    return h('div', { class: 'month', dataset: { month: `${date.getFullYear()}-${date.getMonth() + 1}` } },
      h('div', { class: 'mt' }, `${date.getMonth() + 1}월`),
      h('div', { class: 'grid' },
        WEEKDAY_ABBR.map((w, i) => h('div', { class: `wh ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}` }, w)),
        cells.map((c) => {
          const color = eventCountColor(c.eventCount);
          const cls = ['day', c.isCurrentMonth ? '' : 'other', c.isToday ? 'today' : '', c.isSelected ? 'selected' : ''].join(' ');
          return h('div', { class: cls, dataset: { date: c.key, count: c.eventCount }, onclick: () => this.select(c.date) },
            h('span', { style: c.isCurrentMonth && color && !c.isSelected ? { color } : {} }, String(c.day)),
            c.hasEvent ? h('i', { style: { background: color ?? 'var(--accent)' } }) : null);
        })));
  }
}
