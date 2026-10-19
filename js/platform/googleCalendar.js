// Google Calendar 어댑터 — chrome.identity OAuth + Calendar API v3. (iOS: 시스템 계정 → EventKit 대응)
// 이벤트 id = `${calendarId}|${eventId}`. 반복 이벤트는 singleEvents=true 로 발생 단위 조회 → 발생 단건 수정/삭제.
import { toRRULE } from '../core/recurrence.js';

const API = 'https://www.googleapis.com/calendar/v3';

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];

/** chrome.identity 토큰. interactive=true 면 로그인/동의 창. */
export function chromeToken(interactive = false) {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.identity?.getAuthToken) return reject(new Error('chrome.identity 미지원 환경'));
    const clientId = chrome.runtime.getManifest?.().oauth2?.client_id ?? '';
    if (!clientId || clientId.startsWith('YOUR_')) return reject(new Error('OAuth client_id 미설정'));
    chrome.identity.getAuthToken({ interactive }, (r) => {
      const err = chrome.runtime.lastError;
      if (err || !r) return reject(new Error(err?.message ?? '토큰 없음'));
      resolve(typeof r === 'string' ? r : r.token);
    });
  });
}

export function dropToken(token) {
  return new Promise((resolve) => {
    if (!token || !globalThis.chrome?.identity?.removeCachedAuthToken) return resolve();
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const enc = encodeURIComponent;

function splitId(id) {
  const i = id.lastIndexOf('|');
  return { calId: id.slice(0, i), eventId: id.slice(i + 1) };
}

/** Google event → raw 이벤트. 종일 이벤트는 로컬 자정 시작. */
export function fromGoogle(calId, ev) {
  const t = (x) => (x?.dateTime ? Date.parse(x.dateTime) : x?.date ? new Date(`${x.date}T00:00:00`).getTime() : NaN);
  return {
    id: `${calId}|${ev.id}`,
    title: ev.summary ?? '',
    notes: ev.description ?? '',
    location: ev.location ?? '',
    start: t(ev.start),
    end: t(ev.end),
    recurring: !!ev.recurringEventId,
  };
}

export function toGoogle({ title, notes, location, start, end, rule }) {
  const body = {
    summary: title,
    description: notes ?? '',
    location: location ?? '',
    start: { dateTime: new Date(start).toISOString(), timeZone: tz() },
    end: { dateTime: new Date(end).toISOString(), timeZone: tz() },
  };
  if (rule) body.recurrence = [toRRULE(rule, start)];
  return body;
}

export class GoogleCalendar {
  /**
   * @param enabledIds () => string[] — 표시할 캘린더(빈 배열 = 전체)
   * @param token (interactive) => Promise<string>
   */
  constructor({ enabledIds = () => [], token = chromeToken, fetchImpl = (...a) => fetch(...a) } = {}) {
    this.enabledIds = enabledIds;
    this.token = token;
    this.fetch = fetchImpl;
    this.calendarCache = null;
  }

  async request(path, { method = 'GET', body, query } = {}, retry = true) {
    const token = await this.token(false);
    const qs = query ? `?${new URLSearchParams(query)}` : '';
    const res = await this.fetch(`${API}${path}${qs}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && retry) {
      await dropToken(token);
      return this.request(path, { method, body, query }, false);
    }
    if (!res.ok) throw new Error(`Google API ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  async calendars() {
    if (!this.calendarCache) {
      const r = await this.request('/users/me/calendarList');
      this.calendarCache = (r.items ?? []).map((c) => ({ id: c.id, title: c.summary, source: 'Google', primary: !!c.primary }));
    }
    return this.calendarCache;
  }

  async targetIds() {
    const enabled = this.enabledIds();
    const all = (await this.calendars()).map((c) => c.id);
    return enabled.length ? all.filter((id) => enabled.includes(id)) : all;
  }

  async primaryId() {
    return (await this.calendars()).find((c) => c.primary)?.id ?? 'primary';
  }

  async list(from, to, q) {
    const out = [];
    for (const calId of await this.targetIds()) {
      let pageToken;
      do {
        const query = {
          timeMin: new Date(from).toISOString(),
          timeMax: new Date(to).toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '2500',
          ...(q ? { q } : {}),
          ...(pageToken ? { pageToken } : {}),
        };
        const r = await this.request(`/calendars/${enc(calId)}/events`, { query });
        for (const ev of r.items ?? []) {
          if (ev.status === 'cancelled') continue;
          const raw = fromGoogle(calId, ev);
          if (raw.start >= +new Date(from) && raw.start < +new Date(to)) out.push(raw);
        }
        pageToken = r.nextPageToken;
      } while (pageToken);
    }
    return out;
  }

  async get(id) {
    const { calId, eventId } = splitId(id);
    return fromGoogle(calId, await this.request(`/calendars/${enc(calId)}/events/${enc(eventId)}`));
  }

  async add(ev) {
    const calId = await this.primaryId();
    const r = await this.request(`/calendars/${enc(calId)}/events`, { method: 'POST', body: toGoogle(ev) });
    return `${calId}|${r.id}`;
  }

  async update(id, fields) {
    const { calId, eventId } = splitId(id);
    const { recurrence, ...body } = toGoogle(fields);
    await this.request(`/calendars/${enc(calId)}/events/${enc(eventId)}`, { method: 'PATCH', body });
    return true;
  }

  async remove(id) {
    const { calId, eventId } = splitId(id);
    await this.request(`/calendars/${enc(calId)}/events/${enc(eventId)}`, { method: 'DELETE' });
    return true;
  }

  search(q, from, to) {
    return this.list(from, to, q);
  }
}
