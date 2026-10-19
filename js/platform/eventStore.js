// 이벤트 저장소 파사드 — iOS EventStoreManager 포팅.
// 어댑터(로컬/Google)에 위임하고, 월 단위 일별 캐시 + 이벤트 수 캐시(wc.eventCountCache)를 유지한다.
import * as storage from './storage.js';
import { dateKey, monthRange } from '../core/calendarLogic.js';
import { displayTitle, isSecret } from '../core/eventFormat.js';
import { isOverdue, isTodoNotes } from '../core/plannerLogic.js';
import { removeImage } from './imageStore.js';

const COUNT_KEY = 'wc.eventCountCache';

/** raw → CalendarEventItem (표시용). */
export function toItem(raw, now = new Date()) {
  return {
    ...raw,
    isTodo: isTodoNotes(raw.notes),
    isOverdue: isOverdue(raw.notes, raw.start, now),
    isSecret: isSecret(raw.title),
    displayTitle: displayTitle(raw.title, raw.start),
  };
}

export class EventStore {
  constructor(adapter) {
    this.adapter = adapter;
    this.days = new Map(); // dateKey → items
    this.loadedMonths = new Set(); // 'yyyy-m'
    this.counts = {};
    this.listeners = new Set();
    this.gen = 0; // invalidate 세대 — 진행 중이던 이전 세대 로드 결과는 버린다
  }

  async init() {
    this.counts = await storage.get(COUNT_KEY, {});
    return this;
  }

  setAdapter(adapter) {
    this.adapter = adapter;
    this.invalidate();
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn());
  }

  invalidate() {
    this.gen += 1;
    this.days.clear();
    this.loadedMonths.clear();
  }

  /** 달 전체 이벤트를 단일 조회로 일별 캐시에 채운다. 이미 로드된 달은 건너뜀. */
  async loadMonth(year, month) {
    const mk = `${year}-${month}`;
    if (this.loadedMonths.has(mk)) return;
    const [from, to] = monthRange(year, month);
    const gen = this.gen;
    const raws = await this.adapter.list(from, to);
    if (gen !== this.gen) return;
    const now = new Date();
    const byDay = new Map();
    for (const r of raws.filter((r) => r.title).sort((a, b) => a.start - b.start)) {
      const k = dateKey(r.start);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(toItem(r, now));
    }
    for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
      const k = dateKey(d);
      this.days.set(k, byDay.get(k) ?? []);
      this.counts[k] = this.days.get(k).length;
    }
    this.loadedMonths.add(mk);
    await storage.set(COUNT_KEY, this.counts);
  }

  /** 표시할 날짜들이 속한 달을 모두 로드. */
  async ensure(dates) {
    const months = new Set(dates.map((d) => `${new Date(d).getFullYear()}-${new Date(d).getMonth() + 1}`));
    for (const mk of months) {
      const [y, m] = mk.split('-').map(Number);
      await this.loadMonth(y, m);
    }
  }

  eventsFor(date) {
    return this.days.get(dateKey(date)) ?? [];
  }

  /** 이벤트 수 — 로드된 캐시 우선, 없으면 영속 캐시. */
  countFor(date) {
    const k = dateKey(date);
    return this.days.get(k)?.length ?? this.counts[k] ?? 0;
  }

  async refresh() {
    this.invalidate();
    this.emit();
  }

  get(id) {
    return this.adapter.get(id);
  }

  /** 이벤트 저장. 성공 시 id, 실패 시 null. */
  async add({ title, notes = null, start, end, location = null, rule = null }) {
    try {
      const id = await this.adapter.add({ title: title || '(제목 없음)', notes, start, end, location, rule });
      await this.refresh();
      return id;
    } catch (e) {
      console.error('[EventStore] add failed', e);
      return null;
    }
  }

  /** 여러 건 저장 후 1회 갱신 (반복 개별 등록). 실패 건은 null. */
  async addMany(list) {
    const ids = [];
    for (const { title, notes = null, start, end, location = null, rule = null } of list) {
      try {
        ids.push(await this.adapter.add({ title: title || '(제목 없음)', notes, start, end, location, rule }));
      } catch (e) {
        console.error('[EventStore] add failed', e);
        ids.push(null);
      }
    }
    await this.refresh();
    return ids;
  }

  async update(id, { title, notes, start, end, location }) {
    try {
      const ok = await this.adapter.update(id, { title: title || '(제목 없음)', notes, start, end, location });
      await this.refresh();
      return ok;
    } catch (e) {
      console.error('[EventStore] update failed', e);
      return false;
    }
  }

  async remove(id) {
    try {
      const ok = await this.adapter.remove(id);
      if (ok) await removeImage(id);
      await this.refresh();
      return ok;
    } catch (e) {
      console.error('[EventStore] remove failed', e);
      return false;
    }
  }

  /** 제목 또는 메모에 query 포함 (from~to). */
  async search(query, from, to) {
    const q = query.trim();
    if (!q) return [];
    const now = new Date();
    return (await this.adapter.search(q, from, to))
      .filter((r) => r.title)
      .sort((a, b) => a.start - b.start)
      .map((r) => toItem(r, now));
  }

  calendars() {
    return this.adapter.calendars();
  }
}
