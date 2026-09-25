import { useCallback, useEffect, useState } from 'react';

/**
 * 실시간 환율 — 1 현지 통화 = ? 원.
 *
 * Frankfurter(유럽중앙은행 기준환율, 키 불필요)를 먼저 쓰고, 안 되면 ExchangeRate-API 무료판.
 * 받은 값은 기기에 남겨 두어 오프라인에서도 마지막 환율을 쓴다. 기준환율이라 은행·카드 환율과는
 * 수수료만큼 차이가 난다.
 */

export interface FxRate {
  rate: number;
  /** 기준일 "YYYY-MM-DD" */
  date: string;
  source: 'frankfurter' | 'er-api' | 'cache';
  fetchedAt: number;
}

const KEY = 'tabi.fx.';
const FRESH_MS = 6 * 60 * 60 * 1000;

function readCache(currency: string): FxRate | null {
  try {
    const raw = localStorage.getItem(KEY + currency);
    return raw ? (JSON.parse(raw) as FxRate) : null;
  } catch {
    return null;
  }
}

function writeCache(currency: string, fx: FxRate) {
  try {
    localStorage.setItem(KEY + currency, JSON.stringify(fx));
  } catch {
    /* 못 남겨도 이번엔 쓴다 */
  }
}

async function fromFrankfurter(currency: string, signal?: AbortSignal): Promise<FxRate> {
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=KRW`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as { date?: string; rates?: { KRW?: number } };
  if (!json.rates?.KRW) throw new Error('no rate');
  return { rate: json.rates.KRW, date: json.date ?? '', source: 'frankfurter', fetchedAt: Date.now() };
}

async function fromErApi(currency: string, signal?: AbortSignal): Promise<FxRate> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as { rates?: { KRW?: number }; time_last_update_unix?: number };
  if (!json.rates?.KRW) throw new Error('no rate');
  const date = json.time_last_update_unix ? new Date(json.time_last_update_unix * 1000).toISOString().slice(0, 10) : '';
  return { rate: json.rates.KRW, date, source: 'er-api', fetchedAt: Date.now() };
}

export async function fetchRate(currency: string, signal?: AbortSignal): Promise<FxRate> {
  if (currency === 'KRW') return { rate: 1, date: '', source: 'cache', fetchedAt: Date.now() };
  try {
    const fx = await fromFrankfurter(currency, signal);
    writeCache(currency, fx);
    return fx;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    const fx = await fromErApi(currency, signal);
    writeCache(currency, fx);
    return fx;
  }
}

/** 원화로 바꾼 값을 보기 좋게 반올림 — 1원 단위 */
export function toKRW(amount: number, rate: number): number {
  return Math.round(amount * rate);
}

export function useFxRate(currency: string): {
  fx: FxRate | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
} {
  const [fx, setFx] = useState<FxRate | null>(() => (currency === 'KRW' ? null : readCache(currency)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (currency === 'KRW') { setFx(null); return; }
    const cached = readCache(currency);
    setFx(cached);
    // 몇 시간 안에 받은 게 있으면 그대로 쓴다
    if (cached && Date.now() - cached.fetchedAt < FRESH_MS && tick === 0) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetchRate(currency, controller.signal)
      .then((next) => setFx(next))
      .catch((e) => { if ((e as Error)?.name !== 'AbortError') setError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [currency, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { fx, loading, error, refresh };
}
