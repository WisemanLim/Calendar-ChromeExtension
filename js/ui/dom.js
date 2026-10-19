// DOM 헬퍼 — 요소 생성, 제스처(롱프레스·스와이프), 시트/액션시트/컨텍스트메뉴/토스트.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && !['list', 'form'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

export const root = () => document.getElementById('app');

// MARK: 날짜 ↔ input 값

const pad = (n) => String(n).padStart(2, '0');
export const toDateInput = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const toTimeInput = (d) => { d = new Date(d); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const toDateTimeInput = (d) => `${toDateInput(d)}T${toTimeInput(d)}`;
export const fromDateInput = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const fromTimeInput = (s, base = new Date()) => {
  const [hh, mm] = s.split(':').map(Number);
  const b = new Date(base);
  return new Date(b.getFullYear(), b.getMonth(), b.getDate(), hh, mm);
};
export const fromDateTimeInput = (s) => {
  const [d, t] = s.split('T');
  return fromTimeInput(t, fromDateInput(d));
};

// MARK: 제스처

/** 롱프레스(기본 0.6s). 발동 후 이어지는 click 은 억제 (iOS addButtonLongPressed 대응). */
export function longPress(el, cb, ms = 600) {
  let timer = null;
  let fired = false;
  let x0 = 0;
  let y0 = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    fired = false;
    x0 = e.clientX; y0 = e.clientY;
    timer = setTimeout(() => { fired = true; cb(e); }, ms);
  });
  el.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel();
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, cancel));
  el.addEventListener('click', (e) => {
    if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; }
  }, true);
}

/**
 * 드래그 스와이프. axis 판정 후 onMove(dx, dy, axis) / onEnd(dx, dy, axis).
 * ignore(target) 가 true 면 무시.
 */
export function drag(el, { onMove, onEnd, ignore } = {}) {
  let start = null;
  let axis = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || ignore?.(e.target)) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    axis = null;
  });
  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!axis && Math.hypot(dx, dy) > 12) {
      axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
    if (axis) onMove?.(dx, dy, axis);
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (axis) {
      onEnd?.(dx, dy, axis);
      // 드래그 직후 click 1회 억제 (다음 tick 에 해제)
      const swallow = (ev) => { ev.stopImmediatePropagation(); ev.preventDefault(); };
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
    }
    start = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// MARK: 시트

const sheets = [];

/**
 * 시트 열기. left/right = { label, onClick, disabled } | Node.
 * push=true 면 NavigationLink 처럼 옆에서 등장(뒤로 버튼).
 * 반환: { el, body, close, setRightDisabled }
 */
export function openSheet({ title, left, right = [], body, push = false, onClose, className = '' }) {
  const mkBtn = (b) => (b instanceof Node ? b : h('button', { onclick: b.onClick, disabled: b.disabled, dataset: { role: b.role ?? '' } }, b.label));
  const rightBtns = (Array.isArray(right) ? right : [right]).map(mkBtn);
  const bodyEl = h('div', { class: 'sheet-body' }, body);
  const sheet = {
    el: null,
    body: bodyEl,
    close() {
      const i = sheets.indexOf(sheet);
      if (i >= 0) sheets.splice(i, 1);
      sheet.el.remove();
      onClose?.();
    },
    setRightDisabled(disabled, idx = rightBtns.length - 1) {
      if (rightBtns[idx]) rightBtns[idx].disabled = disabled;
    },
    setBody(...nodes) {
      bodyEl.replaceChildren();
      append(bodyEl, nodes);
    },
  };
  const leftBtn = left ?? (push ? { label: '‹ 뒤로', onClick: () => sheet.close() } : { label: '취소', onClick: () => sheet.close() });
  sheet.el = h('div', { class: `sheet ${push ? 'push' : ''} ${className}`, role: 'dialog', 'aria-label': title },
    h('div', { class: 'navbar' },
      h('div', { class: 'l' }, mkBtn(leftBtn)),
      h('div', { class: 'c' }, title),
      h('div', { class: 'r' }, rightBtns)),
    bodyEl);
  sheets.push(sheet);
  root().append(sheet.el);
  return sheet;
}

export const topSheet = () => sheets[sheets.length - 1];
export const closeAllSheets = () => [...sheets].reverse().forEach((s) => s.close());

// MARK: 섹션/행 빌더 (iOS Form/List)

export function section(header, rows, footer) {
  return h('div', { class: 'section' },
    header ? h('div', { class: 'hd' }, header) : null,
    h('div', { class: 'group' }, rows),
    footer ? h('div', { class: 'ft' }, footer) : null);
}

export const row = (...children) => h('div', { class: 'row' }, children);

export function toggle(checked, onChange, label = '') {
  const input = h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'toggle' }, input, h('span'));
}

export function segment(options, value, onChange) {
  const el = h('div', { class: 'segment', role: 'tablist' });
  const render = (v) => el.replaceChildren(...options.map((o) =>
    h('button', { class: v === o.id ? 'on' : '', role: 'tab', 'aria-selected': String(v === o.id), onclick: () => { render(o.id); onChange(o.id); } }, o.title)));
  render(value);
  return el;
}

// MARK: 액션시트 (iOS confirmationDialog)

export function actionSheet({ title, message, actions }) {
  const close = () => bd.remove();
  const bd = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === bd) close(); } },
    h('div', { class: 'action-sheet', role: 'menu' },
      h('div', { class: 'grp' },
        h('div', { class: 'msg' }, h('b', {}, title), message),
        actions.map((a) => h('button', { onclick: () => { close(); a.onClick(); } }, a.label))),
      h('div', { class: 'grp' }, h('button', { class: 'cancel', onclick: close }, '취소'))));
  root().append(bd);
  return close;
}

// MARK: 컨텍스트 메뉴

export function contextMenu(x, y, items) {
  const app = root().getBoundingClientRect();
  const layer = h('div', { class: 'ctx-layer', onpointerdown: () => close(), oncontextmenu: (e) => { e.preventDefault(); close(); } });
  const menu = h('div', { class: 'ctx', role: 'menu' },
    items.map((it) => h('button', { class: it.danger ? 'danger' : '', role: 'menuitem', onclick: () => { close(); it.onClick(); } },
      h('span', {}, it.label), h('span', {}, it.icon ?? ''))));
  function close() { layer.remove(); menu.remove(); }
  root().append(layer, menu);
  const w = menu.offsetWidth;
  const hgt = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(x - app.left, app.width - w - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y - app.top, app.height - hgt - 8))}px`;
  return close;
}

export function toast(msg, ms = 1800) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  root().append(t);
  setTimeout(() => t.remove(), ms);
}
