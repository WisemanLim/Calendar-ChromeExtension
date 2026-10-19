// Google Calendar 어댑터 — chrome.identity OAuth + Calendar API v3. (iOS: 시스템 계정 → EventKit 대응)
// 이벤트 id = `${calendarId}|${eventId}`. 반복 이벤트는 singleEvents=true 로 발생 단위 조회 → 발생 단건 수정/삭제.
import { toRRULE } from '../core/recurrence.js';
import * as defaultStorage from './storage.js';

const API = 'https://www.googleapis.com/calendar/v3';

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];

// MARK: 인증 — 브라우저(Chrome) 로그인 계정으로 권한 요청
// A) manifest oauth2.client_id 설정됨 → chrome.identity.getAuthToken({ account }) : Chrome 로그인 계정 그대로 사용
// B) 미설정 + 설정 화면에 입력한 client ID(웹 애플리케이션 유형) → launchWebAuthFlow + login_hint=로그인 계정
// C) 둘 다 없음 → NO_CLIENT (설정 화면이 등록 안내 표시)

const WEB_TOKEN_KEY = 'google.webToken';

export class AuthSetupError extends Error {
  constructor() {
    super('Google OAuth 클라이언트 ID 가 없습니다');
    this.code = 'NO_CLIENT';
  }
}

const isPlaceholder = (id) => !id || id.startsWith('YOUR_');

export function manifestClientId() {
  const id = globalThis.chrome?.runtime?.getManifest?.().oauth2?.client_id ?? '';
  return isPlaceholder(id) ? '' : id;
}

/** Chrome 에 로그인된 프로필 계정 { email, id } (미로그인 시 email ''). */
export function profileAccount() {
  return new Promise((resolve) => {
    const gp = globalThis.chrome?.identity?.getProfileUserInfo;
    if (!gp) return resolve({ email: '', id: '' });
    try {
      gp({ accountStatus: 'ANY' }, (info) => resolve({ email: info?.email ?? '', id: info?.id ?? '' }));
    } catch {
      gp((info) => resolve({ email: info?.email ?? '', id: info?.id ?? '' }));
    }
  });
}

/** launchWebAuthFlow 리다이렉트 URI (Google Cloud 에 등록할 값). */
export const redirectUrl = () => globalThis.chrome?.identity?.getRedirectURL?.() ?? '';

/** 웹 OAuth(implicit) 인가 URL. */
export function authUrl({ clientId, redirectUri, loginHint, silent }) {
  const q = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    include_granted_scopes: 'true',
    prompt: silent ? 'none' : 'consent',
  });
  if (loginHint) q.set('login_hint', loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/** 리다이렉트 URL 해시 → { token, exp } (오류면 throw). */
export function parseAuthRedirect(url, now = Date.now()) {
  const p = new URLSearchParams(new URL(url).hash.slice(1));
  if (p.get('error')) throw new Error(p.get('error'));
  const token = p.get('access_token');
  if (!token) throw new Error('토큰 없음');
  return { token, exp: now + (Number(p.get('expires_in') ?? 3600) - 60) * 1000 };
}

function chromeToken(interactive, account) {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.identity?.getAuthToken) return reject(new Error('chrome.identity 미지원 환경'));
    const opts = { interactive, scopes: SCOPES };
    if (account?.id) opts.account = { id: account.id };
    chrome.identity.getAuthToken(opts, (r) => {
      const err = chrome.runtime.lastError;
      if (err || !r) return reject(new Error(err?.message ?? '토큰 없음'));
      resolve(typeof r === 'string' ? r : r.token);
    });
  });
}

async function webToken(clientId, interactive, account, storage) {
  const cached = await storage.get(WEB_TOKEN_KEY, null);
  if (cached?.token && cached.exp > Date.now() && cached.clientId === clientId) return cached.token;
  if (!globalThis.chrome?.identity?.launchWebAuthFlow) throw new Error('chrome.identity 미지원 환경');
  const url = authUrl({ clientId, redirectUri: redirectUrl(), loginHint: account?.email, silent: !interactive });
  const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive });
  const t = parseAuthRedirect(redirect);
  await storage.set(WEB_TOKEN_KEY, { ...t, clientId });
  return t.token;
}

/**
 * 토큰 제공자 생성. clientId() = 설정 화면에 입력한 client ID.
 * interactive=true 면 Chrome 로그인 계정으로 동의 화면을 띄운다.
 */
export function createTokenProvider({ clientId = () => '', storage = defaultStorage }) {
  return async (interactive = false) => {
    const account = await profileAccount();
    if (manifestClientId()) return chromeToken(interactive, account);
    const id = clientId().trim();
    if (!id) throw new AuthSetupError();
    return webToken(id, interactive, account, storage);
  };
}

/** 토큰 폐기 (만료/401/연동 해제). */
export async function dropToken(token, storage = defaultStorage) {
  if (storage) {
    const cached = await storage.get(WEB_TOKEN_KEY, null);
    if (!token || cached?.token === token) await storage.remove(WEB_TOKEN_KEY);
  }
  if (token && globalThis.chrome?.identity?.removeCachedAuthToken) {
    await new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, () => resolve()));
  }
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
   * @param token (interactive) => Promise<string> — createTokenProvider() 결과
   */
  constructor({ enabledIds = () => [], token, storage = defaultStorage, fetchImpl = (...a) => fetch(...a) } = {}) {
    this.enabledIds = enabledIds;
    this.token = token ?? createTokenProvider({ storage });
    this.storage = storage;
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
      await dropToken(token, this.storage);
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
