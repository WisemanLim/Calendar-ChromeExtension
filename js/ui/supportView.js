// 고객지원 — iOS SupportView.swift 포팅 (도움말 센터 · FAQ · 앱 정보 · 일반적인 문제 · 동기화 가이드 · 이메일 · 디버그 로그).
import { h, openSheet, section, row, toast } from './dom.js';
import { currentVersion } from '../platform/settings.js';

const SUPPORT_EMAIL = 'support@wisecalendar.app';

const link = (title, onClick) => h('div', { class: 'row link', role: 'button', onclick: onClick }, h('span', { class: 'grow' }, title));
const info = (title, desc) => h('div', { class: 'row', style: { display: 'block' } },
  h('div', { style: { fontWeight: 600, fontSize: '14px' } }, title),
  h('div', { class: 'caption', style: { marginTop: '3px', lineHeight: 1.45 } }, desc));

export function openSupport() {
  const v = currentVersion();
  const sheet = openSheet({ title: '고객지원', push: true });
  sheet.setBody(
    section('가이드', [link('도움말 센터', helpCenter), link('자주 묻는 질문', faq)]),
    section('앱 정보', [
      row(h('span', { class: 'grow' }, '현재 버전'), h('span', { class: 'caption' }, v)),
      h('div', { class: 'row', role: 'button', style: { cursor: 'pointer' }, onclick: checkUpdate }, h('span', { class: 'btn-link' }, '업데이트 확인')),
    ]),
    section('문제 해결', [
      link('일반적인 문제', issues),
      link('동기화 문제 해결 안내서', syncGuide),
      h('div', { class: 'row', role: 'button', style: { cursor: 'pointer' }, onclick: () => mail('Wise Calendar 문의') }, h('span', { class: 'btn-link' }, '이메일 보내기')),
      link('디버그 로그 보내기', debugLog),
    ]),
    h('div', { class: 'caption', style: { textAlign: 'center', marginTop: '16px' } }, `v${v}`),
  );
  return sheet;
}

function checkUpdate() {
  if (!globalThis.chrome?.runtime?.requestUpdateCheck) return toast('Chrome 웹 스토어에서 자동 업데이트됩니다');
  chrome.runtime.requestUpdateCheck((status) => {
    toast(status === 'update_available' ? '업데이트가 있습니다 — 브라우저 재시작 시 적용' : status === 'no_update' ? '최신 버전입니다' : '잠시 후 다시 시도하세요');
  });
}

function mail(subject, body = '') {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
  window.open(url, '_blank');
}

function helpCenter() {
  openSheet({ title: '도움말 센터', push: true }).setBody(
    section('기본 사용법', [
      info('↔ 날짜 이동', '히어로 영역을 좌우로 드래그(스와이프)하거나 하단 달력의 날짜를 클릭하세요.'),
      info('📅 월·연도 이동', '상단 헤더의 ‹ › 버튼으로 월과 연도를 변경합니다. 하단 달력을 좌우로 드래그해도 월이 바뀝니다.'),
      info('● Today 이동', '선택한 날짜가 오늘이 아닐 때 상단에 Today 버튼이 표시됩니다.'),
      info('⌕ 이벤트 검색', '상단 ⌕ 버튼을 누르면 제목·메모 기준으로 이벤트를 검색합니다.'),
    ]),
    section('이벤트 관리', [
      info('＋ 이벤트 추가', '+ 버튼 클릭 또는 히어로 영역 더블클릭으로 이벤트를 추가합니다.\n+ 버튼(또는 히어로 영역)을 길게 누르면 1회만 다른 입력 방식으로 추가할 수 있습니다.'),
      info('✎ 이벤트 편집·삭제', '일정 목록에서 이벤트를 클릭하면 편집, 우클릭 또는 길게 누르면 복사·삭제 메뉴가 표시됩니다.'),
      info('⧉ 이벤트 복사', "'복사(내용포함/제외)' 또는 '반복복사'를 선택하면 목표 날짜(범위)를 지정해 복사합니다."),
    ]),
    section('플래너 모드', [
      info('📖 일기 모드', '자유 텍스트로 하루를 기록합니다. 에디터 오픈~저장 시각이 자동으로 기록됩니다.'),
      info('💼 업무 이벤트 모드', '할 일 체크리스트와 회의·세미나·회식 템플릿을 제공합니다. 기한 초과 항목은 빨간색으로 표시됩니다.'),
      info('🗂️ 개인 이벤트 모드', '복용·약속·고정/반복 템플릿으로 빠르게 이벤트를 입력합니다.'),
    ]),
  );
}

const FAQS = [
  ['Google 캘린더가 표시되지 않아요.', '설정(⚙) → 캘린더 연동에서 Google Calendar 를 선택하고 Google 계정 동의를 완료하세요. 표시할 캘린더도 확인합니다.'],
  ['알림이 오지 않아요.', 'Chrome 설정 → 개인정보 및 보안 → 사이트 설정 → 알림, 그리고 OS 알림 설정에서 Chrome 알림을 허용하세요. 앱 설정(⚙) → 알림 토글도 ON 이어야 합니다.'],
  ['날씨가 표시되지 않아요.', '위치 정보 접근이 필요합니다. 위치를 사용할 수 없거나 조회에 실패하면 이모지로 대체됩니다.'],
  ['플래너 모드를 바꾸고 싶어요.', '설정(⚙) → 사용자 테마 → 입력 방식에서 언제든 변경할 수 있습니다.'],
  ['이벤트를 다른 날로 복사하고 싶어요.', "이벤트를 우클릭(또는 길게 누름)해 '복사(내용포함)' 또는 '복사(내용제외)'를 선택하면 목표 날짜를 지정해 복사합니다."],
  ['앱 테마(다크/라이트)를 변경하고 싶어요.', "설정(⚙)에서 '설정' 제목 옆 아이콘을 누르면 시스템·다크·라이트가 순환 전환됩니다."],
  ['이벤트 검색은 어떻게 하나요?', '메인 화면 상단의 ⌕ 버튼을 누르면 검색 화면이 열립니다. 검색어를 입력하면 -1년 ~ +2년 범위 이벤트를 찾습니다.'],
  ['로컬 데이터는 어디에 저장되나요?', '이 브라우저 프로필의 확장 저장소(chrome.storage.local)에 저장됩니다. 확장을 삭제하면 함께 삭제됩니다.'],
];

function faq() {
  openSheet({ title: '자주 묻는 질문', push: true }).setBody(section(null, FAQS.map(([q, a]) => info(`Q. ${q}`, `A. ${a}`))));
}

function issues() {
  openSheet({ title: '일반적인 문제', push: true }).setBody(
    section('이벤트', [
      info('이벤트가 표시되지 않아요', 'Google 연동 시 설정(⚙) → 캘린더 연동에서 표시 캘린더를 확인하세요. 히어로 영역을 아래로 당기면 새로고침됩니다.'),
      info('추가한 이벤트가 목록에 보이지 않아요', '다른 날로 이동 후 돌아오거나 아래로 당겨 새로고침하세요. 반복 발생 시 이메일로 문의해 주세요.'),
    ]),
    section('날씨', [
      info('날씨 아이콘 대신 이모지가 표시돼요', '위치 정보 없음 또는 날씨 조회 실패 시 이모지로 대체됩니다.'),
      info('날씨 데이터가 오래됐어요', '날씨는 하루 1회 자동 갱신됩니다. 히어로 영역을 아래로 당기면 즉시 다시 조회합니다.'),
    ]),
    section('알림', [
      info('알림이 오지 않아요', 'Chrome·OS 알림 허용 여부와 앱 설정(⚙) → 알림 토글을 확인하세요. 브라우저가 실행 중이어야 알림이 표시됩니다.'),
      info('알림 시간이 맞지 않아요', '현재 모든 알림은 이벤트 당일 오전 9시에 발송됩니다.'),
    ]),
    section('캘린더 연동', [
      info('Google 캘린더가 표시되지 않아요', 'Chrome 에 Google 계정으로 로그인되어 있는지 확인 후, 설정(⚙)에서 연동 해제 → 다시 연결하세요.'),
    ]),
  );
}

function syncGuide() {
  const step = (n, t) => row(h('span', { class: 'nav-btn', style: { color: 'var(--accent)' } }, String(n)), h('span', { class: 'grow' }, t));
  openSheet({ title: '동기화 문제 해결', push: true }).setBody(
    section('Google 캘린더 연동 단계', [
      step(1, 'Chrome 에 Google 계정으로 로그인'),
      step(2, 'Wise Calendar 설정(⚙) → 캘린더 연동'),
      step(3, "'Google Calendar' 선택"),
      step(4, 'Google 계정 동의 화면에서 캘린더 권한 허용'),
      step(5, '표시할 캘린더 선택 → 이벤트 자동 표시'),
    ]),
    section('연동이 안 될 때', [
      info('권한 확인', 'Google 계정 → 보안 → 서드파티 앱 액세스에서 Wise Calendar 권한을 확인하세요.'),
      info('다시 연결', "설정(⚙)에서 '연동 해제' 후 다시 Google Calendar 를 선택하면 해결되는 경우가 많습니다."),
    ]),
    section('로컬 저장', [info('이 브라우저 (로컬)', '로그인 없이 이 브라우저에만 저장됩니다. 다른 기기와 동기화되지 않습니다.')]),
  );
}

export function debugInfo() {
  const v = currentVersion();
  return [
    'Wise Calendar Debug Info',
    '========================',
    `앱 버전: ${v} (Chrome Extension)`,
    `브라우저: ${navigator.userAgent}`,
    `플랫폼: ${navigator.userAgentData?.platform ?? navigator.platform}`,
    `언어/지역: ${navigator.language} / ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    `날짜: ${new Date().toISOString()}`,
  ].join('\n');
}

function debugLog() {
  const text = debugInfo();
  openSheet({ title: '디버그 로그', push: true }).setBody(
    section(null, [h('pre', { class: 'debug' }, text)]),
    section(null, [
      h('div', { class: 'row', role: 'button', style: { cursor: 'pointer' }, onclick: async () => {
        try { await navigator.clipboard.writeText(text); toast('복사했습니다'); } catch { toast('복사 실패'); }
      } }, h('span', { class: 'btn-link' }, '디버그 정보 복사')),
      h('div', { class: 'row', role: 'button', style: { cursor: 'pointer' }, onclick: () => mail('Wise Calendar 디버그 로그', text) }, h('span', { class: 'btn-link' }, '이메일로 보내기')),
    ]),
  );
}
