// 로컬 알림 — iOS NotificationManager 대응. chrome.alarms 로 이벤트 당일 오전 9시 예약,
// 발화는 background.js(onAlarm → chrome.notifications). 브라우저/OS 가 알림을 허용한 경우에만 표시된다.
import * as storage from './storage.js';

export const ALARM_PREFIX = 'wc-remind:';

/** 이벤트 날짜의 오전 9시. */
export function reminderTime(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0, 0);
}

const hasAlarms = () => !!globalThis.chrome?.alarms;

/** 단발 알림 예약. 이미 지난 시각이면 예약하지 않음(UNCalendarNotificationTrigger 와 동일). */
export async function scheduleEventReminder(title, date, now = Date.now()) {
  const when = reminderTime(date).getTime();
  if (when <= now || !hasAlarms()) return null;
  const name = `${ALARM_PREFIX}${globalThis.crypto?.randomUUID?.() ?? now + Math.random()}`;
  await storage.set(name, { title });
  await chrome.alarms.create(name, { when });
  return name;
}

/** 'granted' | 'denied' | 'unsupported'. Chrome 알림 권한(사용자가 차단 가능). */
export function permissionLevel() {
  return new Promise((resolve) => {
    if (!globalThis.chrome?.notifications?.getPermissionLevel) return resolve('unsupported');
    chrome.notifications.getPermissionLevel((level) => resolve(level));
  });
}
