// 앱 설정 — iOS AppSettings.swift 포팅. 키 이름 동일 유지 + storageMode(로컬/Google) 추가.
import * as storage from './storage.js';

export const AppColorScheme = {
  order: ['system', 'dark', 'light'],
  icon: { system: '🖥️', dark: '🌙', light: '☀️' },
  next: (s) => ({ system: 'dark', dark: 'light', light: 'system' })[s] ?? 'system',
};

const KEYS = {
  plannerMode: 'settings.plannerMode',
  notificationsEnabled: 'settings.notificationsEnabled',
  onboardingCompleted: 'settings.onboardingCompleted',
  enabledCalendarIDs: 'settings.enabledCalendarIDs',
  lastSeenVersion: 'settings.lastSeenVersion',
  appColorScheme: 'settings.appColorScheme',
  storageMode: 'settings.storageMode',
};

const DEFAULTS = {
  plannerMode: 'todo',
  notificationsEnabled: false,
  onboardingCompleted: false,
  enabledCalendarIDs: [], // 빈 배열 = 전체
  lastSeenVersion: '',
  appColorScheme: 'system',
  storageMode: 'local', // 'local' | 'google'
};

export function currentVersion() {
  return globalThis.chrome?.runtime?.getManifest?.().version ?? '1.0.0';
}

export class AppSettings {
  constructor() {
    Object.assign(this, DEFAULTS);
    this.listeners = new Set();
  }

  async load() {
    for (const [prop, key] of Object.entries(KEYS)) {
      this[prop] = await storage.get(key, DEFAULTS[prop]);
    }
    if (!['diary', 'todo', 'personalEvent'].includes(this.plannerMode)) this.plannerMode = 'todo';
    return this;
  }

  async set(prop, value) {
    this[prop] = value;
    await storage.set(KEYS[prop], value);
    this.listeners.forEach((fn) => fn(prop, value));
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** 온보딩 노출: 최초 설치 / 재설치(저장소 초기화) / 버전 업데이트. */
  get shouldShowOnboarding() {
    return !this.onboardingCompleted || this.lastSeenVersion !== currentVersion();
  }
}
