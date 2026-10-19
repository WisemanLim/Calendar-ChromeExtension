// 앱 루트 — iOS RootView 대응: 설정·템플릿·이벤트 저장소 로드 → 온보딩 노출 분기 → 메인 캘린더.
// 같은 app.html 을 팝업(기본)과 사이드패널(?view=panel)에서 공용 사용.
import { h, root } from './ui/dom.js';
import { AppSettings } from './platform/settings.js';
import { TemplateStore } from './platform/templateStore.js';
import { EventStore } from './platform/eventStore.js';
import { LocalCalendar } from './platform/localCalendar.js';
import { GoogleCalendar, chromeToken, dropToken } from './platform/googleCalendar.js';
import { WeatherService } from './platform/weather.js';
import { CalendarView } from './ui/calendarView.js';
import { showOnboarding } from './ui/onboarding.js';

const isPanel = new URLSearchParams(location.search).get('view') === 'panel';
document.body.classList.add(isPanel ? 'panel' : 'popup');

async function boot() {
  const settings = await new AppSettings().load();
  const templates = await new TemplateStore().load();
  const google = () => new GoogleCalendar({ enabledIds: () => settings.enabledCalendarIDs });
  const events = await new EventStore(settings.storageMode === 'google' ? google() : new LocalCalendar()).init();
  const weather = await new WeatherService().loadCache();

  let windowId = null;
  globalThis.chrome?.windows?.getCurrent?.((w) => { windowId = w?.id ?? null; });

  const ctx = {
    settings,
    templates,
    events,
    weather,
    canOpenPanel: !isPanel && !!globalThis.chrome?.sidePanel?.open,
    openPanel() {
      // 사용자 제스처 안에서 동기 호출해야 함 → windowId 는 미리 확보
      chrome.sidePanel.open({ windowId }).then(() => window.close()).catch((e) => console.error(e));
    },
    applyTheme() {
      const s = settings.appColorScheme;
      if (s === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = s;
    },
    async connectGoogle() {
      await chromeToken(true); // 로그인/동의
      const adapter = google();
      await adapter.calendars(); // 연결 확인
      await settings.set('storageMode', 'google');
      events.setAdapter(adapter);
      await events.refresh();
    },
    async useLocal(signOut = false) {
      if (signOut) await chromeToken(false).then(dropToken).catch(() => {});
      await settings.set('storageMode', 'local');
      events.setAdapter(new LocalCalendar());
      await events.refresh();
    },
  };
  ctx.applyTheme();

  // 메인은 전용 호스트에 렌더 — #app 에 올라가는 시트·온보딩은 재렌더 영향 없음
  const host = h('div', { class: 'main-host' });
  root().append(host);
  const view = new CalendarView(ctx, host);
  await view.reload();
  // 날씨: 하루 1회 자동 갱신 (실패 시 이모지 대체)
  weather.requestAndFetch().then((updated) => updated && view.render());

  if (settings.shouldShowOnboarding) showOnboarding(ctx, () => view.render());
  globalThis.__wc = { ctx, view }; // 디버그/E2E 용
}

boot().catch((e) => {
  console.error(e);
  root().textContent = `초기화 실패: ${e.message}`;
});
