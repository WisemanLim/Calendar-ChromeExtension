// 설정 — iOS SettingsView.swift 포팅. (1)사용자 테마(플래너 모드) (2)알림 (3)캘린더 연동 (4)고객지원 + 색상 모드 순환.
import { h, openSheet, section, row, toggle, toast } from './dom.js';
import { PLANNER_MODES, modeInfo } from '../core/plannerMode.js';
import { AppColorScheme } from '../platform/settings.js';
import { permissionLevel } from '../platform/notifications.js';
import { manifestClientId, redirectUrl } from '../platform/googleCalendar.js';
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
      const { email } = await ctx.profileAccount();
      if (email) rows.push(row(h('span', { class: 'grow' }, '연결 계정'), h('span', { class: 'caption' }, email)));
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
      openGoogleConnect(ctx, render);
      return;
    }
    await ctx.useLocal(signOut);
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

// MARK: Google Calendar 연동 — 브라우저 로그인 계정으로 권한 요청

const copyRow = (label, value) => row(
  h('div', { class: 'grow' }, h('div', { class: 'sub' }, label), h('div', { style: { fontSize: '12px', wordBreak: 'break-all', userSelect: 'text' } }, value || '(확장 프로그램으로 설치 시 표시)')),
  value ? h('button', { class: 'btn-link', onclick: async () => {
    try { await navigator.clipboard.writeText(value); toast('복사했습니다'); } catch { toast('복사 실패'); }
  } }, '복사') : null);

export async function openGoogleConnect(ctx, onDone) {
  const { settings } = ctx;
  const sheet = openSheet({ title: 'Google Calendar 연동', push: true });
  const { email } = await ctx.profileAccount();
  const fromManifest = !!manifestClientId();
  let error = '';
  let busy = false;

  const hasClient = () => fromManifest || !!settings.googleClientId.trim();
  let clientInput = null;
  let requestLabel = null;

  /** 권한 요청 버튼 문구 — client ID 유무에 따라 즉시 갱신 (재렌더 없이: 입력 포커스 유지). */
  function paintRequest() {
    if (!requestLabel) return;
    requestLabel.textContent = busy ? '권한 요청 중…'
      : !hasClient() ? '클라이언트 ID 입력 후 권한 요청'
      : email ? `${email} 계정으로 권한 요청` : 'Google 계정으로 권한 요청';
    requestLabel.className = hasClient() && !busy ? 'btn-link' : 'caption';
  }

  function render() {
    // 붙여넣기/입력 즉시 저장 — '뒤로'로 나가도 값 유지 (change 이벤트는 blur 전에 화면을 떠나면 발생하지 않음)
    clientInput = h('input', {
      value: settings.googleClientId,
      placeholder: 'xxxxxxxx.apps.googleusercontent.com',
      'aria-label': 'OAuth 클라이언트 ID',
      oninput: (e) => { settings.set('googleClientId', e.target.value.trim()); error = ''; paintRequest(); },
    });
    requestLabel = h('span', { style: { fontWeight: 600 } });
    paintRequest();
    const extId = globalThis.chrome?.runtime?.id ?? '';
    sheet.setBody(
      section('브라우저 로그인 계정', [
        row(h('span', { class: 'grow' }, email || 'Chrome 에 로그인된 계정 없음'),
          email ? h('span', { class: 'check' }, '●') : null),
      ], email
        ? '이 계정으로 Google 동의 화면을 열어 캘린더 권한을 요청합니다.'
        : 'Chrome 프로필에 로그인하면 해당 계정이 자동 선택됩니다. 로그인하지 않아도 동의 화면에서 계정을 고를 수 있습니다.'),
      section('요청 권한', [
        row(h('span', { class: 'grow' }, '📅 캘린더 일정 보기·추가·수정·삭제'), h('span', { class: 'sub' }, 'calendar.events')),
        row(h('span', { class: 'grow' }, '📋 캘린더 목록 보기'), h('span', { class: 'sub' }, 'calendar.readonly')),
      ]),
      fromManifest ? null : section('OAuth 클라이언트 ID', [
        row(clientInput),
        copyRow('확장 프로그램 ID', extId),
        copyRow('승인된 리디렉션 URI', redirectUrl()),
      ], h('span', {},
        'Google 은 앱별 OAuth 클라이언트가 있어야 캘린더 권한을 줄 수 있습니다. 최초 1회:', h('br'),
        '① Google Cloud Console → Google Calendar API 사용 설정', h('br'),
        '② OAuth 동의 화면 구성(범위: calendar.events, calendar.readonly, 테스트 사용자에 위 계정 추가)', h('br'),
        '③ 사용자 인증 정보 → OAuth 클라이언트 ID → 유형 "웹 애플리케이션" → 승인된 리디렉션 URI 에 위 값 등록', h('br'),
        '④ 발급된 클라이언트 ID 를 위 칸에 붙여넣고 아래 권한 요청')),
      section(null, [
        h('div', { class: 'row', role: 'button', 'aria-label': '권한 요청', style: { cursor: 'pointer', justifyContent: 'center' }, onclick: connect }, requestLabel),
        error ? row(h('span', { class: 'caption err' }, `연결 실패: ${error}`)) : null,
      ]),
    );
  }

  async function connect() {
    if (busy) return;
    if (!hasClient()) {
      error = 'OAuth 클라이언트 ID 를 먼저 입력하세요 (위 ①~④)';
      render();
      clientInput?.focus();
      return;
    }
    if (!fromManifest && !/\.apps\.googleusercontent\.com$/.test(settings.googleClientId.trim())) {
      error = '클라이언트 ID 형식이 아닙니다 (…apps.googleusercontent.com)';
      render();
      return;
    }
    busy = true;
    error = '';
    render();
    try {
      await ctx.connectGoogle();
      toast('Google Calendar 연동 완료');
      sheet.close();
      onDone?.();
      return;
    } catch (e) {
      console.error('[Google] connect failed', e);
      error = e.code === 'NO_CLIENT' ? 'OAuth 클라이언트 ID 를 입력하세요' : friendly(e.message);
    }
    busy = false;
    render();
  }

  render();
  return sheet;
}

function friendly(msg = '') {
  if (/did not approve|access_denied|canceled|cancelled/i.test(msg)) return '권한 요청이 취소되었습니다';
  if (/redirect_uri_mismatch/i.test(msg)) return '리디렉션 URI 가 등록되지 않았습니다 (아래 값 등록)';
  if (/invalid_client|bad client id|unauthorized_client/i.test(msg)) return '클라이언트 ID 가 올바르지 않습니다';
  if (/not signed in|user is not signed/i.test(msg)) return 'Chrome 에 로그인이 필요합니다';
  if (/403/.test(msg)) return 'Google Calendar API 사용 설정 또는 테스트 사용자 등록을 확인하세요';
  return msg;
}
