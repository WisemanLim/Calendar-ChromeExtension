// 로컬 캘린더 어댑터 — chrome.storage 에 이벤트 보관 (iOS EKEventStore 대응).
// 반복 이벤트는 master 1건 + rule 로 저장하고, 조회 시 발생일로 전개한다.
// 발생(occurrence) id = `${masterId}@yyyy-MM-dd`. 발생 단건 수정/삭제 = EKSpan.thisEvent 동작.
import * as storage from './storage.js';
import { occurrences } from '../core/recurrence.js';

export const EVENTS_KEY = 'events.local.v1';

let seq = 0;
const uid = () => globalThis.crypto?.randomUUID?.() ?? `e-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function splitId(id) {
  const at = id.indexOf('@');
  return at < 0 ? { masterId: id, key: null } : { masterId: id.slice(0, at), key: id.slice(at + 1) };
}

export class LocalCalendar {
  async all() {
    return storage.get(EVENTS_KEY, []);
  }

  async save(list) {
    await storage.set(EVENTS_KEY, list);
  }

  async calendars() {
    return [{ id: 'local', title: '이 브라우저', source: 'Local' }];
  }

  /** 시작 시각이 [from, to) 인 발생 목록 (raw: { id, title, notes, location, start, end, recurring }). */
  async list(from, to) {
    const out = [];
    for (const ev of await this.all()) {
      for (const o of occurrences(ev, from, to)) {
        out.push({
          id: ev.rule ? `${ev.id}@${o.key}` : ev.id,
          title: ev.title,
          notes: ev.notes ?? '',
          location: ev.location ?? '',
          start: o.start,
          end: o.end,
          recurring: !!ev.rule,
        });
      }
    }
    return out;
  }

  async get(id) {
    const { masterId, key } = splitId(id);
    const ev = (await this.all()).find((e) => e.id === masterId);
    if (!ev) return null;
    if (!key) return { ...ev, recurring: !!ev.rule };
    const [y, m, d] = key.split('-').map(Number);
    const o = occurrences(ev, new Date(y, m - 1, d), new Date(y, m - 1, d + 1))[0];
    return o ? { ...ev, id, start: o.start, end: o.end, recurring: true } : null;
  }

  /** { title, notes, location, start, end, rule } → id. */
  async add(ev) {
    const list = await this.all();
    const id = uid();
    list.push({
      id,
      title: ev.title,
      notes: ev.notes ?? null,
      location: ev.location ?? null,
      start: +ev.start,
      end: +ev.end,
      rule: ev.rule ?? null,
      exdates: [],
    });
    await this.save(list);
    return id;
  }

  /** 단건 수정. 반복 발생이면 해당일 제외 후 독립 이벤트로 분리. */
  async update(id, fields) {
    const { masterId, key } = splitId(id);
    const list = await this.all();
    const ev = list.find((e) => e.id === masterId);
    if (!ev) return false;
    if (key) {
      ev.exdates = [...(ev.exdates ?? []), key];
      list.push({ ...ev, ...fields, id: uid(), rule: null, exdates: [], start: +fields.start, end: +fields.end });
    } else {
      Object.assign(ev, fields, { start: +fields.start, end: +fields.end });
    }
    await this.save(list);
    return true;
  }

  /** 단건 삭제. 반복 발생이면 해당일만 제외. */
  async remove(id) {
    const { masterId, key } = splitId(id);
    let list = await this.all();
    const ev = list.find((e) => e.id === masterId);
    if (!ev) return false;
    if (key) ev.exdates = [...(ev.exdates ?? []), key];
    else list = list.filter((e) => e.id !== masterId);
    await this.save(list);
    return true;
  }

  async search(q, from, to) {
    const needle = q.toLowerCase();
    return (await this.list(from, to)).filter(
      (e) => e.title.toLowerCase().includes(needle) || e.notes.toLowerCase().includes(needle),
    );
  }
}
