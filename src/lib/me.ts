import { useSyncExternalStore } from 'react';

/**
 * 이 기기를 쓰는 사람이 동행 중 누구인지 — 여행마다 기기에만 기억한다.
 * 가계부의 "낸 사람" 과 체크리스트의 "체크한 사람" 기본값이 된다. 공유본에는 올리지 않는다.
 */

const KEY = 'tabi.me.';
const listeners = new Set<() => void>();
let version = 0;

export function getMe(tripId: string): string | null {
  try {
    return localStorage.getItem(KEY + tripId);
  } catch {
    return null;
  }
}

export function setMe(tripId: string, memberId: string) {
  try {
    localStorage.setItem(KEY + tripId, memberId);
  } catch {
    /* 저장소를 못 쓰면 이번 세션만 */
  }
  version += 1;
  listeners.forEach((l) => l());
}

export function useMe(tripId: string): string | null {
  useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => version,
    () => version,
  );
  return getMe(tripId);
}
