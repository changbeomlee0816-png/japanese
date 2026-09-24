import { useSyncExternalStore } from 'react';
import type { Direction, TextResult } from './translate';

/**
 * 최근 번역과 저장한 문장 — 이 기기에만 남는다. 공유 링크로는 넘어가지 않는다.
 */

export interface SavedTranslation {
  id: string;
  direction: Direction;
  source: string;
  target: string;
  reading?: string;
  hangul?: string;
  at: string;
}

interface State {
  history: SavedTranslation[];
  favorites: SavedTranslation[];
}

const KEY = 'tabi.translate.v1';
const MAX_HISTORY = 40;

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      return { history: parsed.history ?? [], favorites: parsed.favorites ?? [] };
    }
  } catch {
    /* 저장소를 못 쓰는 환경 — 빈 상태로 */
  }
  return { history: [], favorites: [] };
}

let state: State = load();
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 가득 찼거나 막혀 있으면 이번 세션에만 남긴다 */
  }
  listeners.forEach((l) => l());
}

export function useTranslateStore(): State {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}

const sameEntry = (a: Pick<SavedTranslation, 'source' | 'target'>, b: Pick<SavedTranslation, 'source' | 'target'>) =>
  a.source === b.source && a.target === b.target;

function toEntry(r: Pick<TextResult, 'direction' | 'source' | 'target' | 'reading' | 'hangul'>): SavedTranslation {
  return {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    direction: r.direction,
    source: r.source,
    target: r.target,
    reading: r.reading,
    hangul: r.hangul,
    at: new Date().toISOString(),
  };
}

export const translateActions = {
  remember(r: TextResult) {
    const entry = toEntry(r);
    set({ ...state, history: [entry, ...state.history.filter((h) => !sameEntry(h, entry))].slice(0, MAX_HISTORY) });
  },
  toggleFavorite(r: Pick<TextResult, 'direction' | 'source' | 'target' | 'reading' | 'hangul'>) {
    const exists = state.favorites.some((f) => sameEntry(f, r));
    set({
      ...state,
      favorites: exists ? state.favorites.filter((f) => !sameEntry(f, r)) : [toEntry(r), ...state.favorites],
    });
  },
  isFavorite(r: Pick<SavedTranslation, 'source' | 'target'>) {
    return state.favorites.some((f) => sameEntry(f, r));
  },
  clearHistory() {
    set({ ...state, history: [] });
  },
};
