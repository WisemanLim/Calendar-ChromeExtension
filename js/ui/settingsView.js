// 설정 — iOS SettingsView.swift 포팅. (1)사용자 테마(플래너 모드) (2)알림 (3)캘린더 연동 (4)고객지원 + 색상 모드 순환.
import { h, openSheet, section, row, toggle, toast } from './dom.js';
import { PLANNER_MODES, modeInfo } from '../core/plannerMode.js';
import { AppColorScheme } from '../platform/settings.js';
import { permissionLevel } from '../platform/notifications.js';
import { openSupport } from './supportView.js';

export function openSettings(ctx) {
  const { settings } = ctx;
  const schemeBtn = h('button', { class: 'icon-btn', 'aria-label': '화면 테마 전환', title: 'system → dark → light' });
  const sheet = openSheet({
    title: '설정',
    left: h('span'),
    right: [schemeBtn, { label: '완료', role: 'done', onClick: () => sheet.close() }],
  });
  const paintScheme = () => {
    schemeBtn.textContent = AppColorScheme.icon[settings.appColorScheme];
    schemeBtn.title = `화면 테마: ${settings.appColorScheme}`;
  };
  schemeBtn.onclick = async () => {
    const saved = settings.set('appColorScheme', AppColorScheme.next(settings.appColorScheme));
    ctx.applyTheme();
    paintScheme();
    await saved;
  };
  paintScheme();

  async function render() {
    const perm = await permissionLevel();
    sheet.setBody(
      section('사용자 테마', [
        row(h('span', { class: 'grow' }, '입력 방식'),
          h('select', { 'aria-label': '입력 방식', onchange: async (e) => { await settings.set('plannerMode', e.target.value); render(); } },
            PLANNER_MODES.map((m) => h('option', { value: m.id, selected: settings.plannerMode === m.id }, `${m.icon} ${m.title}`)))),
        row(h('span', { class: 'caption' }, modeInfo(settings.plannerMode).detail)),
      ]),
      section('알림', [
        row(h('span', { class: 'grow' }, '일정 알림'), toggle(settings.notificationsEnabled, async (on) => { await settings.set('notificationsEnabled', on); render(); }, '일정 알림')),
        settings.notificationsEnabled && perm !== 'granted'
          ? row(h('span', { class: 'caption warn' }, perm === 'unsupported'
            ? '확장 프로그램으로 설치해야 알림을 예약할 수 있습니다.'
            : 'Chrome/OS 설정에서 알림을 허용해야 알림이 표시됩니다.'))
          : null,
      ], '이벤트 저장 시 당일 오전 9시 알림을 예약합니다. 브라우저·OS 에서 알림을 허용한 경우에만 표시됩니다.'),
      await calendarSection(),
      section(null, [h('div', { class: 'row link', role: 'button', onclick: () => openSupport(ctx) }, h('span', { class: 'grow' }, '고객지원'))]),
    );
  }

  async function calendarSection() {
    const google = settings.storageMode === 'google';
    const rows = [
      h('div', { class: 'row', role: 'radio', 'aria-checked': String(!google), style: { cursor: 'pointer' }, onclick: () => switchTo('local') },
        h('div', { class: 'grow' }, h('div', {}, '이 브라우저 (로컬)'), h('div', { class: 'sub' }, 'chrome.storage 에 저장 · 로그인 불필요')),
        !google ? h('span', { class: 'check' }, '✓') : null),
      h('div', { class: 'row', role: 'radio', 'aria-checked': String(google), style: { cursor: 'pointer' }, onclick: () => switchTo('google') },
        h('div', { class: 'grow' }, h('div', {}, 'Google Calendar'), h('div', { class: 'sub' }, 'Chrome 에 로그인된 Google 계정으로 연동')),
        google ? h('span', { class: 'check' }, '✓') : null),
    ];
    if (google) {
      let cals = [];
      try {
        cals = await ctx.events.calendars();
      } catch (e) {
        rows.push(row(h('span', { class: 'caption err' }, `연결 실패: ${e.message}`)));
      }
      const enabled = settings.enabledCalendarIDs;
      for (const c of cals) {
        rows.push(h('div', { class: 'row', role: 'checkbox', 'aria-checked': String(!enabled.length || enabled.includes(c.id)), style: { cursor: 'pointer' }, onclick: () => toggleCalendar(c.id) },
          h('div', { class: 'grow' }, h('div', {}, c.title), h('div', { class: 'sub' }, c.source + (c.primary ? ' · 기본(새 이벤트 저장)' : ''))),
          !enabled.length || enabled.includes(c.id) ? h('span', { class: 'check' }, '✓') : null));
      }
      rows.push(row(h('button', { class: 'btn-danger', onclick: () => switchTo('local', true) }, '연동 해제')));
    }
    return section('캘린더 연동', rows, google
      ? '표시할 캘린더를 선택하세요(모두 해제 = 전체). 새 이벤트는 기본 캘린더에 저장됩니다.'
      : 'Google 캘린더 연동은 Chrome 계정 로그인과 OAuth 동의가 필요합니다. 로컬 데이터는 Google 로 옮겨지지 않습니다.');
  }

  async function switchTo(mode, signOut = false) {
    if (mode === settings.storageMode && !signOut) return;
    if (mode === 'google') {
      try {
        await ctx.connectGoogle();
      } catch (e) {
        toast('Google 연결 실패');
        sheet.setBody(h('div', { class: 'section caption err' }, `Google 연결 실패: ${e.message}`, h('br'), 'manifest.json 의 oauth2.client_id 설정을 확인하세요 (README 참고).'));
        setTimeout(render, 2500);
        return;
      }
    } else {
      await ctx.useLocal(signOut);
    }
    render();
  }

  async function toggleCalendar(id) {
    const all = (await ctx.events.calendars()).map((c) => c.id);
    let enabled = settings.enabledCalendarIDs.length ? [...settings.enabledCalendarIDs] : [...all];
    enabled = enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id];
    await settings.set('enabledCalendarIDs', enabled.length === all.length ? [] : enabled);
    await ctx.events.refresh();
    render();
  }

  render();
  return sheet;
}
