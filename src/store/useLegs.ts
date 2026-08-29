import { useEffect, useMemo, useRef, useState } from 'react';
import type { Day, Leg, TravelMode } from '../types';
import { estimateLeg, fetchDirections, mapsLoaded } from '../lib/maps';
import { routeDistance, suggestMode } from '../lib/geo';
import { dateTimeOf } from '../lib/time';

/** 같은 구간을 반복 조회하지 않도록 세션 캐시 (Directions 호출은 유료다) */
const cache = new Map<string, Leg>();

function keyOf(day: Day, index: number, mode: TravelMode, currency: string): string {
  const a = day.items[index];
  const b = day.items[index + 1];
  const c1 = a.place.coord!;
  const c2 = b.place.coord!;
  return [
    c1.lat.toFixed(5), c1.lng.toFixed(5),
    c2.lat.toFixed(5), c2.lng.toFixed(5),
    mode, currency, day.date, a.startTime,
  ].join('|');
}

export interface LegsResult {
  legs: Array<Leg | null>;
  loading: boolean;
  /** Directions API로 실측한 구간 수 */
  liveCount: number;
}

/**
 * 하루 일정의 연속된 두 장소 사이 이동 구간을 계산한다.
 * 지도 API가 준비돼 있으면 실제 경로를, 아니면 거리 기반 추정을 돌려준다.
 */
export function useLegs(day: Day | undefined, currency: string, enabled: boolean): LegsResult {
  const [, forceRender] = useState(0);
  const [loading, setLoading] = useState(false);
  const inflight = useRef(new Set<string>());

  const plan = useMemo(() => {
    if (!day) return [];
    const out: Array<{ index: number; mode: TravelMode; key: string } | null> = [];
    for (let i = 0; i < day.items.length - 1; i += 1) {
      const a = day.items[i];
      const b = day.items[i + 1];
      if (!a.place.coord || !b.place.coord) {
        out.push(null);
        continue;
      }
      const dist = routeDistance(a.place.coord, b.place.coord);
      const mode = a.modeToNext ?? suggestMode(dist);
      out.push({ index: i, mode, key: keyOf(day, i, mode, currency) });
    }
    return out;
  }, [day, currency]);

  useEffect(() => {
    if (!day || !enabled || !mapsLoaded()) return;
    let cancelled = false;

    const pending = plan.filter((p): p is NonNullable<typeof p> => !!p && !cache.has(p.key) && !inflight.current.has(p.key));
    if (pending.length === 0) return;

    setLoading(true);
    (async () => {
      for (const p of pending) {
        if (cancelled) return;
        inflight.current.add(p.key);
        const a = day.items[p.index];
        const b = day.items[p.index + 1];
        try {
          const leg = await fetchDirections(
            a.place.coord!,
            b.place.coord!,
            p.mode,
            a.id,
            b.id,
            currency,
            dateTimeOf(day.date, a.startTime),
          );
          cache.set(p.key, leg);
        } catch (e) {
          console.warn('[legs] Directions 실패, 추정으로 대체', e);
          cache.set(p.key, estimateLeg(a.place.coord!, b.place.coord!, p.mode, a.id, b.id, currency));
        } finally {
          inflight.current.delete(p.key);
        }
        if (!cancelled) forceRender((n) => n + 1);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [day, plan, currency, enabled]);

  const legs = useMemo(() => {
    if (!day) return [];
    return plan.map((p, i) => {
      if (!p) return null;
      const cached = cache.get(p.key);
      if (cached) return cached;
      const a = day.items[i];
      const b = day.items[i + 1];
      return estimateLeg(a.place.coord!, b.place.coord!, p.mode, a.id, b.id, currency);
    });
  }, [day, plan, currency]);

  const liveCount = legs.filter((l) => l?.source === 'google').length;

  return { legs, loading, liveCount };
}

export function clearLegCache() {
  cache.clear();
}
