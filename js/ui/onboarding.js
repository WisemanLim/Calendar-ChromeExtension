// 온보딩 4단계 — iOS OnboardingView.swift 포팅.
// 1 소개+사용 방식 선택 → 2 입력 모드(일기·업무) → 3 개인 이벤트 → 4 연동 & 알림. 완료 시 onboardingCompleted / lastSeenVersion 저장.
import { h, root } from './dom.js';
import { PLANNER_MODES } from '../core/plannerMode.js';
import { currentVersion } from '../platform/settings.js';

export function showOnboarding(ctx, onFinish) {
  const { settings } = ctx;
  let page = 0;
  const last = 3;
  const el = h('div', { class: 'onb', role: 'dialog', 'aria-label': '온보딩' });

  const card = (...c) => h('div', { class: 'card' }, c);
  const feat = (items) => items.map(([i, t]) => h('div', { class: 'feat' }, `${i}  ${t}`));

  const pages = [
    () => [
      h('div', { class: 'big' }, '🗓️'),
      h('h1', {}, 'Wise Calendar'),
      h('div', { class: 'subt' }, '나만의 플래너 — Chrome 확장 프로그램'),
      card(h('b', {}, '😊 오늘 일정을 한눈에! 크게 보고 빠르게 입력하자'), h('div', { class: 'caption' }, '좌우 드래그로 날짜 이동 · 하단 달력으로 빠른 점프')),
      feat([['🔢', '큰 날짜 히어로 화면'], ['↔', '드래그로 날짜·주·월 이동'], ['⛅', '주간 날씨 + 이벤트 현황 한눈에']]),
      h('div', { class: 'feat', style: { fontWeight: 600, marginTop: '14px' } }, '사용 방식 선택'),
      PLANNER_MODES.map((m) => h('button', { class: 'mode', role: 'radio', 'aria-checked': String(settings.plannerMode === m.id), onclick: async () => { await settings.set('plannerMode', m.id); render(); } },
        h('span', {}, `${m.icon}  ${m.title}`),
        settings.plannerMode === m.id ? h('span', { class: 'ck' }, '✔') : null)),
      h('div', { class: 'caption' }, '선택한 방식은 설정에서 언제든지 변경할 수 있습니다.'),
    ],
    () => [
      h('div', { class: 'big' }, '📖 💼'),
      h('h1', {}, '입력 모드'),
      h('div', { class: 'subt' }, '두 가지 기록 방식을 골라 사용하세요'),
      card(h('b', {}, '📖 일기 모드'), h('div', {}, '하루를 글로 기록합니다.'),
        feat([['✍️', '자유로운 본문 입력'], ['⏱', '에디터 열린 시각 = 시작, 저장 시각 = 종료 자동 기록'], ['⏲', '경과 시간 실시간 표시']])),
      card(h('b', {}, '💼 업무 이벤트 모드'), h('div', {}, '잊지 말아야 할 일들을 체크리스트로.'),
        feat([['☑', '항목별 완료 토글'], ['⏰', '기한(Due Date) 필수 설정 · 초과 시 빨간색'], ['🗓', '회의·세미나/컨퍼런스·회식 템플릿']])),
    ],
    () => [
      h('div', { class: 'big' }, '🗂️'),
      h('h1', {}, '개인 이벤트'),
      h('div', { class: 'subt' }, '템플릿으로 빠르게 입력하세요'),
      card(h('b', {}, '👴💊 복용'), h('div', { class: 'caption' }, '아침 7시 · 점심 12시 · 저녁 18시'),
        h('div', {}, '아침/점심/저녁 프리셋으로 빠르게 입력하고 약 봉투 사진도 첨부할 수 있습니다.'),
        h('span', { class: 'badge' }, '📷 사진 첨부 (파일 접근 허용 시)')),
      card(h('b', {}, '💑 약속'), h('div', { class: 'caption' }, '연인 · 친구 · 동호회 · 비밀 약속'),
        h('div', {}, '시작/종료 시각과 장소를 입력합니다. [비밀] 약속은 목록에서 흐리게 표시됩니다.')),
      card(h('b', {}, '🔄📅 고정/반복'), h('div', { class: 'caption' }, '정기 작업 · 매일/매주/매년 반복'),
        h('div', {}, '(d###) 연중 일련일, yyyy-mm-dd 날짜 패턴이 저장 시 자동 치환됩니다.'),
        h('span', { class: 'badge' }, '↻ 개별 등록 / 반복 일정')),
    ],
    () => [
      h('div', { class: 'big' }, '🔗 🔔'),
      h('h1', {}, '연동 & 알림'),
      h('div', { class: 'subt' }, '캘린더 연동과 알림을 설정하세요'),
      card(h('b', {}, '🗓 캘린더'),
        feat([['💾', '기본: 이 브라우저에 저장 (로그인 불필요)'], ['🔗', '설정(⚙) → 캘린더 연동 → Google Calendar'], ['☑', '표시할 Google 캘린더 선택']])),
      card(h('b', {}, '🔔 알림'), h('div', {}, '오전 9시 알림 덕분에 일정을 하나도 안 놓쳤다!'),
        h('button', { class: 'chip on', style: { marginTop: '8px' }, onclick: async (e) => {
          await settings.set('notificationsEnabled', true);
          e.target.textContent = '알림 허용됨 ✓';
        } }, settings.notificationsEnabled ? '알림 허용됨 ✓' : '알림 허용'),
        feat([['⏰', '이벤트 저장 시 당일 오전 9시 알림 예약'], ['⚙', '설정에서 언제든지 알림 on/off'], ['🌐', '브라우저·OS 에서 알림 허용 시에만 표시']])),
    ],
  ];

  async function next() {
    if (page === last) {
      await settings.set('onboardingCompleted', true);
      await settings.set('lastSeenVersion', currentVersion());
      el.remove();
      onFinish?.();
    } else {
      page += 1;
      render();
    }
  }

  function render() {
    el.replaceChildren(
      h('div', { class: 'page' }, pages[page]()),
      h('div', { class: 'dots' }, pages.map((_, i) => h('i', { class: i === page ? 'on' : '' }))),
      h('button', { class: 'cta', onclick: next }, page === last ? '시작하기' : '다음'),
    );
  }

  render();
  root().append(el);
}
