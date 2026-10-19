// 표시 포맷 — 이모지·무지개 색·HH:mm 제목·음력·날씨. iOS CalendarView/WeatherService 포팅.

const pad = (n) => String(n).padStart(2, '0');

/** 이벤트 갯수 → 얼굴 이모지 (0~1=😀, 2~3=😊, 4+=🤯). */
export function eventDayEmoji(count) {
  if (count <= 1) return '😀';
  if (count <= 3) return '😊';
  return '🤯';
}

/** 이벤트 갯수 → 무지개 7단계 색 (0=기본, 1=노, 2=주, 3=초, 4=남, 5=보, 6+=빨). 0 이면 null(기본색). */
export function eventCountColor(count) {
  switch (count) {
    case 0: return null;
    case 1: return 'rgb(242, 217, 0)';
    case 2: return 'rgb(255, 140, 0)';
    case 3: return 'rgb(38, 184, 64)';
    case 4: return 'rgb(20, 38, 166)';
    case 5: return 'rgb(140, 26, 204)';
    default: return 'rgb(217, 26, 26)';
  }
}

/** 히어로 숫자 색: 이벤트 있으면 무지개색 opacity 0.28, 없으면 회색 0.15. */
export function heroColor(count) {
  const c = eventCountColor(count);
  return c ? c.replace('rgb(', 'rgba(').replace(')', ', 0.28)') : 'rgba(128, 128, 128, 0.15)';
}

export function hhmm(date) {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "HH:mm 제목". */
export function displayTitle(title, start) {
  return `${hhmm(start)} ${title}`;
}

/** 비밀 약속: 제목이 [비밀] 로 시작. */
export const isSecret = (title) => title.startsWith('[비밀]');

/** 음력 날짜 "음력 (윤)M월 D일" — Intl chinese 달력. */
export function lunarDateString(date) {
  try {
    const parts = new Intl.DateTimeFormat('ko-KR-u-ca-chinese', { month: 'numeric', day: 'numeric' })
      .formatToParts(new Date(date));
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    if (!month || !day) return '';
    const leap = month.startsWith('윤') ? '윤' : '';
    return `음력 ${leap}${month.replace(/\D/g, '')}월 ${day.replace(/\D/g, '')}일`;
  } catch {
    return '';
  }
}

export const WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAY_FULL = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

export const weekdayFull = (date) => WEEKDAY_FULL[new Date(date).getDay()];
export const monthYearString = (date) => `${MONTHS[new Date(date).getMonth()]} ${new Date(date).getFullYear()}`;

// MARK: 날씨 — WMO 코드(Open-Meteo) 매핑

export const WEATHER_ICON = {
  clear: '☀️',
  partlyCloudy: '⛅',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  heavyRain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
};

export function weatherFromWmo(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partlyCloudy';
  if (code === 3) return 'overcast';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 66, 80, 81].includes(code)) return 'rain';
  if ([65, 67, 82].includes(code)) return 'heavyRain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  return 'clear';
}
