// MV3 서비스 워커 — 알림 발화(chrome.alarms → chrome.notifications) + 사이드패널 설정.
const ALARM_PREFIX = 'wc-remind:';

chrome.runtime.onInstalled.addListener(() => {
  // 툴바 아이콘 클릭 = 팝업. 사이드패널은 팝업의 ⇥ 버튼/Chrome 사이드패널 메뉴로 연다.
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const { [alarm.name]: payload } = await chrome.storage.local.get(alarm.name);
  await chrome.storage.local.remove(alarm.name);
  if (!payload) return;
  chrome.notifications.create(alarm.name, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '일정 알림',
    message: payload.title,
    priority: 1,
  });
});

chrome.notifications.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  chrome.action.openPopup?.().catch(() => {});
});
