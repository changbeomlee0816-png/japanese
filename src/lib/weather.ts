import { useEffect, useState } from 'react';
import type { LatLng } from '../types';

/**
 * 날씨 예보 (Open-Meteo).
 *
 * API 키가 필요 없고 CORS가 열려 있어 브라우저에서 바로 부른다.
 * 예보는 보통 16일 앞까지만 나온다 — 그보다 먼 날짜는 조용히 비워 둔다.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const CACHE_KEY = 'tabi.weather.v1';
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3시간

export interface DayWeather {
  date: string;
  /** WMO weather code */
  code: number;
  maxC: number;
  minC: number;
  /** 강수 확률(%) */
  rainPct: number;
}

/** WMO 코드 → 사람이 읽는 설명 */
export function weatherLabel(code: number): string {
  if (code === 0) return '맑음';
  if (code <= 2) return '대체로 맑음';
  if (code === 3) return '흐림';
  if (code <= 48) return '안개';
  if (code <= 57) return '이슬비';
  if (code <= 67) return '비';
  if (code <= 77) return '눈';
  if (code <= 82) return '소나기';
  if (code <= 86) return '진눈깨비';
  return '뇌우';
}

/** 우산이 필요한 날씨인지 */
export function isWet(code: number, rainPct: number): boolean {
  return (code >= 51 && code <= 99) || rainPct >= 60;
}

/** 날씨를 한 글자 그림으로 (외부 아이콘 없이) */
export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

interface CacheEntry {
  at: number;
  key: string;
  days: DayWeather[];
}

function readCache(key: string): DayWeather[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.key !== key || Date.now() - entry.at > CACHE_TTL_MS) return null;
    return entry.days;
  } catch {
    return null;
  }
}

function writeCache(key: string, days: DayWeather[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), key, days } satisfies CacheEntry));
  } catch {
    /* 저장 실패는 무시 — 캐시가 없을 뿐이다 */
  }
}

export async function fetchWeather(center: LatLng, startDate: string, endDate: string): Promise<DayWeather[]> {
  const key = `${center.lat.toFixed(2)},${center.lng.toFixed(2)},${startDate},${endDate}`;
  const cached = readCache(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(center.lat),
    longitude: String(center.lng),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    start_date: startDate,
    end_date: endDate,
  });

  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(`weather ${res.status}`);

  const json = (await res.json()) as {
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: (number | null)[];
    };
  };

  const d = json.daily;
  if (!d) return [];

  const days: DayWeather[] = d.time.map((date, i) => ({
    date,
    code: d.weather_code[i] ?? 0,
    maxC: Math.round(d.temperature_2m_max[i] ?? 0),
    minC: Math.round(d.temperature_2m_min[i] ?? 0),
    rainPct: Math.round(d.precipitation_probability_max[i] ?? 0),
  }));

  writeCache(key, days);
  return days;
}

/**
 * 여행 기간의 날씨. 예보 범위를 벗어난 날짜는 빠진 채로 돌아온다.
 * 실패해도 화면은 그대로 동작해야 하므로 오류는 조용히 삼킨다.
 */
export function useWeather(center: LatLng | undefined, dates: string[]): Map<string, DayWeather> {
  const [map, setMap] = useState<Map<string, DayWeather>>(new Map());

  const first = dates[0];
  const last = dates[dates.length - 1];
  const lat = center?.lat;
  const lng = center?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined || !first || !last) return;

    // 예보는 오늘부터 16일까지만 의미가 있다
    const today = new Date();
    const limit = new Date(today.getTime() + 16 * 86400000).toISOString().slice(0, 10);
    const todayISO = today.toISOString().slice(0, 10);
    const from = first < todayISO ? todayISO : first;
    const to = last > limit ? limit : last;
    if (from > to) return;

    let cancelled = false;
    fetchWeather({ lat, lng }, from, to)
      .then((days) => {
        if (!cancelled) setMap(new Map(days.map((d) => [d.date, d])));
      })
      .catch((e) => {
        console.warn('[weather] 예보를 불러오지 못했습니다', e);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, first, last]);

  return map;
}
