// 날씨 서비스 — iOS WeatherService 의 Open-Meteo(무료·무키) 경로 포팅 + 위치(navigator.geolocation).
// 캐시: wc.dailyWeather / wc.dailyTemperature / wc.lastFetchDate.
// 일별 갱신: 마지막 조회일이 오늘이 아니면 무조건 재조회. 오늘이면 캐시 사용(force=새로고침 시 재조회).
// 위치 거부 또는 조회 실패 시 dailyWeather 비어 있음 → 주간 스트립 이모지 대체.
import * as storage from './storage.js';
import { isSameDay } from '../core/calendarLogic.js';
import { weatherFromWmo } from '../core/eventFormat.js';

const K = { weather: 'wc.dailyWeather', temp: 'wc.dailyTemperature', last: 'wc.lastFetchDate' };

export function openMeteoUrl(lat, lon) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max&timezone=auto&forecast_days=16&past_days=7`;
}

/** Open-Meteo 응답 → { weather: {key: condition}, temp: {key: int} }. 구버전 weathercode 키도 대응. */
export function parseOpenMeteo(json) {
  const d = json?.daily ?? {};
  const codes = d.weather_code ?? d.weathercode ?? [];
  const temps = d.temperature_2m_max ?? [];
  const weather = {};
  const temp = {};
  (d.time ?? []).forEach((key, i) => {
    if (codes[i] == null) return;
    weather[key] = weatherFromWmo(codes[i]);
    if (temps[i] != null) temp[key] = Math.round(temps[i]);
  });
  return { weather, temp };
}

function position() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('geolocation unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 3600000 },
    );
  });
}

export class WeatherService {
  constructor({ fetchImpl = (...a) => fetch(...a), locate = position } = {}) {
    this.fetch = fetchImpl;
    this.locate = locate;
    this.dailyWeather = {};
    this.dailyTemperature = {};
    this.status = 'idle'; // idle | ok | denied | error
  }

  async loadCache() {
    this.dailyWeather = await storage.get(K.weather, {});
    this.dailyTemperature = await storage.get(K.temp, {});
    return this;
  }

  /** 조회 필요 시 위치→Open-Meteo. 갱신되면 true. */
  async requestAndFetch(force = false) {
    const last = await storage.get(K.last, null);
    if (!force && last && isSameDay(last, new Date()) && Object.keys(this.dailyWeather).length) return false;
    let pos;
    try {
      pos = await this.locate();
    } catch (e) {
      this.status = 'denied';
      console.warn('[Weather] 위치 권한 거부/실패 — 날씨 조회 불가', e?.message);
      return false;
    }
    try {
      const res = await this.fetch(openMeteoUrl(pos.lat.toFixed(4), pos.lon.toFixed(4)));
      const { weather, temp } = parseOpenMeteo(await res.json());
      if (!Object.keys(weather).length) throw new Error('empty');
      this.dailyWeather = weather;
      this.dailyTemperature = temp;
      await storage.set(K.weather, weather);
      await storage.set(K.temp, temp);
      await storage.set(K.last, Date.now());
      this.status = 'ok';
      return true;
    } catch (e) {
      this.status = 'error';
      console.warn('[Weather] Open-Meteo 실패', e?.message);
      return false;
    }
  }
}
