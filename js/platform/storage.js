// 키-값 영속 저장소 — iOS UserDefaults 대응.
// 우선순위: chrome.storage.local (확장) → localStorage (일반 페이지 미리보기) → 메모리 (node 시험).

const mem = new Map();

function backend() {
  if (globalThis.chrome?.storage?.local) return 'chrome';
  try {
    if (globalThis.localStorage) return 'ls';
  } catch { /* 접근 차단 */ }
  return 'mem';
}

export async function get(key, fallback = undefined) {
  switch (backend()) {
    case 'chrome': {
      const r = await chrome.storage.local.get(key);
      return r[key] ?? fallback;
    }
    case 'ls': {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    }
    default:
      return mem.has(key) ? structuredClone(mem.get(key)) : fallback;
  }
}

export async function set(key, value) {
  switch (backend()) {
    case 'chrome': return chrome.storage.local.set({ [key]: value });
    case 'ls': return localStorage.setItem(key, JSON.stringify(value));
    default: mem.set(key, structuredClone(value));
  }
}

export async function remove(key) {
  switch (backend()) {
    case 'chrome': return chrome.storage.local.remove(key);
    case 'ls': return localStorage.removeItem(key);
    default: mem.delete(key);
  }
}

/** 시험용 — 메모리 백엔드 초기화. */
export function _resetMemory() {
  mem.clear();
}
