import { useSyncExternalStore } from 'react';
import type { Category, Day, Item, PlaceRef, Settings, Trip, TravelMode } from '../types';
import { uid } from '../lib/id';
import { addDaysISO, addMinutes, todayISO, toMinutes } from '../lib/time';
import { createSampleTrip } from '../lib/sample';
import { defaultDuration, parsePlanText } from '../lib/parsePlan';
import { DEFAULT_RATE_TO_KRW } from '../lib/fares';
import { isPublishable, knownReadOnly, markDirty, readEmbeddedState } from '../lib/share';

const TRIP_KEY = 'tabi.trips.v1';
const ACTIVE_KEY = 'tabi.activeTripId.v1';
const SETTINGS_KEY = 'tabi.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  googleMapsApiKey: '',
  autoShift: true,
  departureAlertMin: 15,
  notificationsEnabled: false,
  minLocalScore: 60,
  theme: 'system',
};

interface State {
  trips: Trip[];
  activeTripId: string;
  settings: Settings;
}

/* ------------------------------------------------------------------ *
 * 저장소
 * ------------------------------------------------------------------ */

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[store] 저장 실패', e);
  }
}

function latestUpdate(trips: Trip[]): string {
  return trips.reduce((max, t) => (t.updatedAt > max ? t.updatedAt : max), '');
}

/**
 * 초기 상태를 고른다.
 *
 * 공유(Artifact) 모드에서는 문서에 심어둔 일정이 정본이다. 다만 직전 방문에서
 * 발행하지 못하고 남은 로컬 편집이 더 최신이면 그쪽을 살려 두고 다시 발행하게 한다.
 * 읽기 전용 뷰에서는 항상 공유본을 그대로 보여준다 — 안 그러면 나만 다른 화면을 보게 된다.
 */
function loadInitial(): State {
  const localTrips = readJSON<Trip[]>(TRIP_KEY, []);
  const embedded = isPublishable() ? readEmbeddedState() : null;

  let trips: Trip[];
  if (embedded) {
    const localIsNewer =
      !knownReadOnly() && localTrips.length > 0 && latestUpdate(localTrips) > embedded.publishedAt;
    trips = localIsNewer ? localTrips : embedded.trips;
  } else if (localTrips.length > 0) {
    trips = localTrips;
  } else {
    trips = [createSampleTrip()];
    writeJSON(TRIP_KEY, trips);
    writeJSON(ACTIVE_KEY, trips[0].id);
  }

  const storedActive = readJSON<string>(ACTIVE_KEY, '');
  const activeTripId = trips.some((t) => t.id === storedActive) ? storedActive : trips[0].id;
  return {
    trips,
    activeTripId,
    settings: { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>(SETTINGS_KEY, {}) },
  };
}

let state: State = loadInitial();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(updater: (prev: State) => State) {
  const prev = state;
  state = updater(state);
  writeJSON(TRIP_KEY, state.trips);
  writeJSON(ACTIVE_KEY, state.activeTripId);
  writeJSON(SETTINGS_KEY, state.settings);
  // 설정(구글맵 키 포함)은 절대 발행하지 않는다. 여행 데이터가 바뀐 경우에만 공유본을 갱신한다.
  if (state.trips !== prev.trips) markDirty(state.trips);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => state;

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useActiveTrip(): Trip {
  const s = useStore();
  return s.trips.find((t) => t.id === s.activeTripId) ?? s.trips[0];
}

export function useSettings(): Settings {
  return useStore().settings;
}

/* ------------------------------------------------------------------ *
 * 헬퍼
 * ------------------------------------------------------------------ */

function mapActiveTrip(fn: (trip: Trip) => Trip) {
  set((prev) => ({
    ...prev,
    trips: prev.trips.map((t) => (t.id === prev.activeTripId ? { ...fn(t), updatedAt: new Date().toISOString() } : t)),
  }));
}

function mapDay(trip: Trip, dayId: string, fn: (day: Day) => Day): Trip {
  return { ...trip, days: trip.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

function sortByTime(items: Item[]): Item[] {
  return [...items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

/* ------------------------------------------------------------------ *
 * 여행 단위 액션
 * ------------------------------------------------------------------ */

export const actions = {
  setActiveTrip(id: string) {
    set((prev) => ({ ...prev, activeTripId: id }));
  },

  createTrip(title: string, destination: string, currency: string, startDate: string, dayCount: number): string {
    const id = uid('trip');
    const days: Day[] = Array.from({ length: Math.max(1, dayCount) }, (_, i) => ({
      id: uid('day'),
      date: addDaysISO(startDate, i),
      items: [],
    }));
    const trip: Trip = {
      id,
      title: title || '새 여행',
      destination,
      currency,
      rateToKRW: DEFAULT_RATE_TO_KRW[currency.toUpperCase()] ?? 1,
      travelers: 1,
      days,
      updatedAt: new Date().toISOString(),
    };
    set((prev) => ({ ...prev, trips: [trip, ...prev.trips], activeTripId: id }));
    return id;
  },

  duplicateTrip(id: string) {
    const src = state.trips.find((t) => t.id === id);
    if (!src) return;
    const copy: Trip = {
      ...structuredClone(src),
      id: uid('trip'),
      title: `${src.title} (복사본)`,
      updatedAt: new Date().toISOString(),
    };
    copy.days = copy.days.map((d) => ({ ...d, id: uid('day'), items: d.items.map((i) => ({ ...i, id: uid('item') })) }));
    set((prev) => ({ ...prev, trips: [copy, ...prev.trips], activeTripId: copy.id }));
  },

  deleteTrip(id: string) {
    set((prev) => {
      const trips = prev.trips.filter((t) => t.id !== id);
      const next = trips.length ? trips : [createSampleTrip()];
      return {
        ...prev,
        trips: next,
        activeTripId: prev.activeTripId === id ? next[0].id : prev.activeTripId,
      };
    });
  },

  updateTrip(patch: Partial<Trip>) {
    mapActiveTrip((trip) => ({ ...trip, ...patch }));
  },

  /* ---------------- 날짜(Day) ---------------- */

  addDay() {
    mapActiveTrip((trip) => {
      const last = trip.days[trip.days.length - 1];
      const date = last ? addDaysISO(last.date, 1) : todayISO();
      return { ...trip, days: [...trip.days, { id: uid('day'), date, items: [] }] };
    });
  },

  insertDayAfter(dayId: string) {
    mapActiveTrip((trip) => {
      const idx = trip.days.findIndex((d) => d.id === dayId);
      if (idx < 0) return trip;
      const date = addDaysISO(trip.days[idx].date, 1);
      const days = [...trip.days];
      days.splice(idx + 1, 0, { id: uid('day'), date, items: [] });
      return { ...trip, days };
    });
  },

  updateDay(dayId: string, patch: Partial<Day>) {
    mapActiveTrip((trip) => mapDay(trip, dayId, (d) => ({ ...d, ...patch })));
  },

  removeDay(dayId: string) {
    mapActiveTrip((trip) => ({ ...trip, days: trip.days.filter((d) => d.id !== dayId) }));
  },

  duplicateDay(dayId: string) {
    mapActiveTrip((trip) => {
      const idx = trip.days.findIndex((d) => d.id === dayId);
      if (idx < 0) return trip;
      const src = trip.days[idx];
      const clone: Day = {
        id: uid('day'),
        date: addDaysISO(src.date, 1),
        title: src.title,
        items: src.items.map((i) => ({ ...i, id: uid('item'), actualStart: undefined, actualEnd: undefined, done: false })),
      };
      const days = [...trip.days];
      days.splice(idx + 1, 0, clone);
      return { ...trip, days };
    });
  },

  /* ---------------- 항목(Item) ---------------- */

  addItem(dayId: string, partial: Partial<Item> & { title: string }) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => {
        const category = partial.category ?? 'sight';
        const last = day.items[day.items.length - 1];
        const startTime =
          partial.startTime ?? (last ? addMinutes(last.startTime, last.durationMin + 30) : '09:00');
        const item: Item = {
          id: uid('item'),
          title: partial.title,
          category,
          place: partial.place ?? { name: partial.title },
          startTime,
          durationMin: partial.durationMin ?? defaultDuration(category),
          cost: partial.cost ?? 0,
          notes: partial.notes,
          modeToNext: partial.modeToNext,
        };
        return { ...day, items: sortByTime([...day.items, item]) };
      }),
    );
  },

  updateItem(dayId: string, itemId: string, patch: Partial<Item>) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => ({
        ...day,
        items: day.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
      })),
    );
  },

  setItemPlace(dayId: string, itemId: string, place: PlaceRef) {
    actions.updateItem(dayId, itemId, { place });
  },

  setItemMode(dayId: string, itemId: string, mode: TravelMode) {
    actions.updateItem(dayId, itemId, { modeToNext: mode });
  },

  setItemCategory(dayId: string, itemId: string, category: Category) {
    actions.updateItem(dayId, itemId, { category });
  },

  removeItem(dayId: string, itemId: string) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => ({ ...day, items: day.items.filter((i) => i.id !== itemId) })),
    );
  },

  duplicateItem(dayId: string, itemId: string) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => {
        const idx = day.items.findIndex((i) => i.id === itemId);
        if (idx < 0) return day;
        const src = day.items[idx];
        const clone: Item = {
          ...src,
          id: uid('item'),
          startTime: addMinutes(src.startTime, src.durationMin + 15),
          actualStart: undefined,
          actualEnd: undefined,
          done: false,
        };
        const items = [...day.items];
        items.splice(idx + 1, 0, clone);
        return { ...day, items };
      }),
    );
  },

  /** 드래그로 순서를 바꾸면 시각도 앞뒤 항목에 맞춰 다시 배분한다 */
  reorderItem(dayId: string, fromIndex: number, toIndex: number) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => {
        if (fromIndex === toIndex) return day;
        const items = [...day.items];
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        return { ...day, items: redistributeTimes(items) };
      }),
    );
  },

  moveItemToDay(fromDayId: string, itemId: string, toDayId: string) {
    mapActiveTrip((trip) => {
      const from = trip.days.find((d) => d.id === fromDayId);
      const item = from?.items.find((i) => i.id === itemId);
      if (!from || !item) return trip;
      return {
        ...trip,
        days: trip.days.map((d) => {
          if (d.id === fromDayId) return { ...d, items: d.items.filter((i) => i.id !== itemId) };
          if (d.id === toDayId) return { ...d, items: sortByTime([...d.items, item]) };
          return d;
        }),
      };
    });
  },

  /** 특정 항목 이후의 모든 일정을 delta분 만큼 민다 */
  shiftFrom(dayId: string, itemId: string, deltaMin: number) {
    if (!deltaMin) return;
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => {
        const idx = day.items.findIndex((i) => i.id === itemId);
        if (idx < 0) return day;
        return {
          ...day,
          items: day.items.map((it, i) =>
            i >= idx ? { ...it, startTime: addMinutes(it.startTime, deltaMin) } : it,
          ),
        };
      }),
    );
  },

  shiftDay(dayId: string, deltaMin: number) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => ({
        ...day,
        items: day.items.map((it) => ({ ...it, startTime: addMinutes(it.startTime, deltaMin) })),
      })),
    );
  },

  /* ---------------- 실시간 추적 ---------------- */

  checkIn(dayId: string, itemId: string, at = new Date()) {
    actions.updateItem(dayId, itemId, { actualStart: at.toISOString() });
  },

  checkOut(dayId: string, itemId: string, at = new Date()) {
    actions.updateItem(dayId, itemId, { actualEnd: at.toISOString(), done: true });
  },

  setDone(dayId: string, itemId: string, done: boolean) {
    actions.updateItem(dayId, itemId, { done });
  },

  resetProgress(dayId: string) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => ({
        ...day,
        items: day.items.map((i) => ({ ...i, actualStart: undefined, actualEnd: undefined, done: false })),
      })),
    );
  },

  /* ---------------- 일괄 입력 ---------------- */

  /** 자유 텍스트를 파싱해서 현재 여행에 날짜/항목으로 밀어넣는다 */
  importPlanText(text: string, mode: 'replace' | 'append' = 'append') {
    const trip = state.trips.find((t) => t.id === state.activeTripId);
    const start = trip?.days[0]?.date ?? todayISO();
    const result = parsePlanText(text, start);
    if (result.days.length === 0) return result;

    mapActiveTrip((prev) => {
      if (mode === 'replace') return { ...prev, days: result.days };
      const byDate = new Map(prev.days.map((d) => [d.date, { ...d, items: [...d.items] }]));
      for (const parsed of result.days) {
        const existing = byDate.get(parsed.date);
        if (existing) existing.items = sortByTime([...existing.items, ...parsed.items]);
        else byDate.set(parsed.date, parsed);
      }
      const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      return { ...prev, days };
    });
    return result;
  },

  /* ---------------- 설정 ---------------- */

  updateSettings(patch: Partial<Settings>) {
    set((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  },

  importState(raw: string) {
    const parsed = JSON.parse(raw) as { trips?: Trip[]; settings?: Partial<Settings> };
    if (!parsed.trips?.length) throw new Error('여행 데이터가 없습니다.');
    set((prev) => ({
      trips: parsed.trips!,
      activeTripId: parsed.trips![0].id,
      settings: { ...prev.settings, ...parsed.settings },
    }));
  },

  exportState(): string {
    return JSON.stringify({ trips: state.trips, settings: state.settings }, null, 2);
  },
};

/**
 * 순서를 바꾼 뒤 시각 재배분:
 * 첫 항목의 시작 시각을 유지하고, 이후는 "체류시간 + 30분 이동"으로 이어 붙인다.
 */
function redistributeTimes(items: Item[]): Item[] {
  if (items.length === 0) return items;
  const GAP = 30;
  let cursor = items[0].startTime;
  return items.map((item, i) => {
    if (i === 0) return item;
    cursor = addMinutes(cursor, items[i - 1].durationMin + GAP);
    return { ...item, startTime: cursor };
  });
}
