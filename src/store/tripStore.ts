import { useSyncExternalStore } from 'react';
import type { Category, Day, Item, PlaceRef, Settings, Trip, TravelMode } from '../types';
import { uid } from '../lib/id';
import { addDaysISO, addMinutes, todayISO, toMinutes } from '../lib/time';
import { createSampleTrip } from '../lib/sample';
import { defaultDuration, parsePlanText } from '../lib/parsePlan';
import { importSheetRows, type SheetImportResult } from '../lib/importSheet';
import { DEFAULT_RATE_TO_KRW } from '../lib/fares';
import { regionById } from '../data/regions';
import type { PoiEntry } from '../data/poi';
import { optimizeDay } from '../lib/optimize';
import { estimateTransport } from '../lib/transport';
import type { TransportLeg } from '../types';
import { isPublishable, knownReadOnly, markDirty, readEmbeddedState } from '../lib/share';
import { markDirty as cloudMarkDirty } from '../lib/cloud';

const TRIP_KEY = 'tabi.trips.v1';
const ACTIVE_KEY = 'tabi.activeTripId.v1';
const SETTINGS_KEY = 'tabi.settings.v1';
/** 공유 링크로 열었을 때 쓰는 캐시 키 — 내 일정(TRIP_KEY)과 절대 섞이지 않게 분리한다 */
const SHARED_PREFIX = 'tabi.shared.';

/** ?t= 로 열렸다면 그 일정 id. 이 경우 내 로컬 일정은 건드리지 않는다. */
function linkedTripId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('t');
  } catch {
    return null;
  }
}

const linkedId = linkedTripId();

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

/**
 * 예전 형식 마이그레이션.
 *
 * 이동을 별도 항목으로 저장하던 때의 데이터를 두 장소 + 연결선 형태로 옮긴다.
 * 저장된 게 없으면 아무 일도 하지 않는다.
 */
interface LegacyTransport {
  mode: TransportLeg['mode'];
  from?: { name: string };
  to?: { name: string };
  distanceM?: number;
  manualDuration?: boolean;
}

function migrateTrips(trips: Trip[]): Trip[] {
  let changed = false;

  const migrated = trips.map((trip) => ({
    ...trip,
    days: trip.days.map((day) => {
      if (!day.items.some((i) => (i as unknown as { transport?: unknown }).transport)) return day;
      changed = true;

      const items: Item[] = [];
      for (const item of day.items) {
        const legacy = (item as unknown as { transport?: LegacyTransport }).transport;
        if (!legacy) {
          items.push(item);
          continue;
        }
        // 이동 항목은 도착지 장소로 바꾸고, 직전 항목에 연결선을 단다
        const prev = items[items.length - 1];
        const leg: TransportLeg = {
          mode: legacy.mode,
          durationMin: item.durationMin,
          cost: item.cost,
          distanceM: legacy.distanceM ?? 0,
          manualDuration: legacy.manualDuration,
        };
        if (prev) items[items.length - 1] = { ...prev, transportToNext: leg };
        items.push({
          ...item,
          title: legacy.to?.name ?? item.place.name,
          category: 'transport',
          durationMin: 0,
          cost: 0,
          startTime: addMinutes(item.startTime, item.durationMin),
          transportToNext: undefined,
          ...({ transport: undefined } as object),
        });
      }
      return { ...day, items };
    }),
  }));

  return changed ? migrated : trips;
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
  // 공유 링크로 들어온 경우: 서버 응답이 오기 전까지 지난번에 본 내용을 보여준다.
  // 내 로컬 일정을 읽지도, 쓰지도 않는다.
  if (linkedId) {
    const cached = readJSON<Trip[]>(SHARED_PREFIX + linkedId, []);
    const trips = migrateTrips(cached.length > 0 ? cached : [createSampleTrip()]);
    return {
      trips,
      activeTripId: trips[0].id,
      settings: { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>(SETTINGS_KEY, {}) },
    };
  }

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

  trips = migrateTrips(trips);
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
/** 서버에서 받아온 일정을 적용할 때는 다시 저장을 걸지 않는다 */
let suppressSync = 0;

function emit() {
  for (const l of listeners) l();
}

function set(updater: (prev: State) => State) {
  const prev = state;
  state = updater(state);
  if (linkedId) {
    // 공유 링크를 보는 중이다 — 내 로컬 일정은 그대로 두고 이 링크의 캐시만 갱신한다
    writeJSON(SHARED_PREFIX + linkedId, state.trips);
  } else {
    writeJSON(TRIP_KEY, state.trips);
    writeJSON(ACTIVE_KEY, state.activeTripId);
  }
  writeJSON(SETTINGS_KEY, state.settings);
  // 설정(구글맵 키 포함)은 절대 공유하지 않는다. 여행 데이터가 바뀐 경우에만 공유본을 갱신한다.
  if (state.trips !== prev.trips && suppressSync === 0) {
    const active = state.trips.find((t) => t.id === state.activeTripId) ?? state.trips[0];
    markDirty(state.trips);
    cloudMarkDirty(state.trips, active?.title ?? '여행 일정');
  }
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
  /** 공유 서버에서 받아온 일정으로 통째로 교체한다 (저장을 되돌려 걸지 않는다) */
  applyRemoteTrips(input: Trip[]) {
    if (input.length === 0) return;
    const trips = migrateTrips(input);
    suppressSync += 1;
    try {
      set((prev) => ({
        ...prev,
        trips,
        activeTripId: trips.some((t) => t.id === prev.activeTripId) ? prev.activeTripId : trips[0].id,
      }));
    } finally {
      suppressSync -= 1;
    }
  },

  setActiveTrip(id: string) {
    set((prev) => ({ ...prev, activeTripId: id }));
  },

  /** 지역을 고르면 통화·환율·지도 중심이 함께 정해진다 */
  createTrip(input: {
    title?: string;
    regionId: string;
    startDate: string;
    dayCount: number;
    travelers?: number;
  }): string {
    const region = regionById(input.regionId);
    const currency = region?.currency ?? 'JPY';
    const id = uid('trip');
    const days: Day[] = Array.from({ length: Math.max(1, input.dayCount) }, (_, i) => ({
      id: uid('day'),
      date: addDaysISO(input.startDate, i),
      items: [],
    }));
    const trip: Trip = {
      id,
      title: input.title?.trim() || `${region?.name ?? '새'} 여행`,
      destination: region?.name ?? '',
      regionId: input.regionId,
      currency,
      rateToKRW: DEFAULT_RATE_TO_KRW[currency.toUpperCase()] ?? 1,
      travelers: input.travelers ?? 2,
      days,
      saved: [],
      updatedAt: new Date().toISOString(),
    };
    set((prev) => ({ ...prev, trips: [trip, ...prev.trips], activeTripId: id }));
    return id;
  },

  /* ---------------- 가고 싶은 곳 ---------------- */

  /** 둘러보기에서 담기 — 날짜는 나중에 정한다 */
  saveSpot(poi: PoiEntry) {
    mapActiveTrip((trip) => {
      const saved = trip.saved ?? [];
      if (saved.some((i) => i.title === poi.name)) return trip;
      const item: Item = {
        id: uid('item'),
        title: poi.name,
        category: poi.category ?? 'sight',
        place: { name: poi.name, address: poi.area, coord: poi.coord, source: 'local' },
        startTime: '',
        durationMin: poi.stayMin ?? defaultDuration(poi.category ?? 'sight'),
        cost: 0,
      };
      return { ...trip, saved: [...saved, item] };
    });
  },

  removeSaved(itemId: string) {
    mapActiveTrip((trip) => ({ ...trip, saved: (trip.saved ?? []).filter((i) => i.id !== itemId) }));
  },

  /** 보관함의 장소를 특정 날짜 끝에 배치한다 */
  placeSaved(itemId: string, dayId: string) {
    mapActiveTrip((trip) => {
      const item = (trip.saved ?? []).find((i) => i.id === itemId);
      if (!item) return trip;
      return {
        ...trip,
        saved: (trip.saved ?? []).filter((i) => i.id !== itemId),
        days: trip.days.map((d) => {
          if (d.id !== dayId) return d;
          const last = d.items[d.items.length - 1];
          const startTime = last ? addMinutes(last.startTime, last.durationMin + 30) : '10:00';
          return { ...d, items: [...d.items, { ...item, startTime }] };
        }),
      };
    });
  },

  /** 둘러보기에서 곧바로 날짜에 넣기 */
  addSpotToDay(dayId: string, poi: PoiEntry) {
    actions.addItem(dayId, {
      title: poi.name,
      category: poi.category ?? 'sight',
      place: { name: poi.name, address: poi.area, coord: poi.coord, source: 'local' },
      durationMin: poi.stayMin ?? defaultDuration(poi.category ?? 'sight'),
    });
  },

  /** 일정에 있는 항목을 보관함으로 되돌린다 */
  unschedule(dayId: string, itemId: string) {
    mapActiveTrip((trip) => {
      const day = trip.days.find((d) => d.id === dayId);
      const item = day?.items.find((i) => i.id === itemId);
      if (!item) return trip;
      return {
        ...trip,
        saved: [...(trip.saved ?? []), { ...item, startTime: '', done: false, actualStart: undefined, actualEnd: undefined }],
        days: trip.days.map((d) => (d.id === dayId ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d)),
      };
    });
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
          // 넘어온 값을 먼저 펼쳐 transport·pinned 같은 필드가 유실되지 않게 한다
          ...partial,
          id: uid('item'),
          title: partial.title,
          category,
          place: partial.place ?? { name: partial.title },
          startTime,
          durationMin: partial.durationMin ?? defaultDuration(category),
          cost: partial.cost ?? 0,
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

  /**
   * 이동을 넣는다 — 출발·도착 장소를 동선에 세우고 그 사이를 이동으로 잇는다.
   *
   * 인천공항 → 간사이공항 비행기를 넣으면 두 공항이 1번·2번 방문지로 찍히고
   * 그 사이에 비행기 표시가 들어간다. 이미 일정에 있는 장소는 새로 만들지 않는다.
   */
  addTransportLeg(
    dayId: string,
    input: {
      from: PlaceRef;
      to: PlaceRef;
      leg: TransportLeg;
      /** 출발 장소에서 출발하는 시각 */
      departAt: string;
      /** 출발·도착지에서 각각 머무는 시간 (공항 수속 등) */
      fromStayMin?: number;
      toStayMin?: number;
    },
  ) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => {
        const items = [...day.items];
        const sameName = (a: PlaceRef, b: PlaceRef) => a.name === b.name;

        const makeItem = (place: PlaceRef, startTime: string, stayMin: number): Item => ({
          id: uid('item'),
          title: place.name,
          category: inferPlaceCategory(place.name),
          place,
          startTime,
          durationMin: stayMin,
          cost: 0,
        });

        // 출발지: 이미 있으면 쓰고, 없으면 만든다
        let fromIndex = items.findIndex((i) => sameName(i.place, input.from));
        if (fromIndex < 0) {
          const item = makeItem(input.from, input.departAt, input.fromStayMin ?? 0);
          // 시각 순서에 맞는 자리에 끼워 넣는다
          fromIndex = items.findIndex((i) => toMinutes(i.startTime) > toMinutes(input.departAt));
          if (fromIndex < 0) fromIndex = items.length;
          items.splice(fromIndex, 0, item);
        }

        const fromItem = items[fromIndex];
        const arrival = addMinutes(fromItem.startTime, fromItem.durationMin + input.leg.durationMin);

        // 도착지: 출발지 바로 뒤에 온다
        let toIndex = items.findIndex((i, idx) => idx !== fromIndex && sameName(i.place, input.to));
        if (toIndex < 0) {
          items.splice(fromIndex + 1, 0, makeItem(input.to, arrival, input.toStayMin ?? 0));
        } else {
          // 이미 있으면 출발지 바로 뒤로 옮기고 도착 시각을 맞춘다
          const [moved] = items.splice(toIndex, 1);
          const at = toIndex < fromIndex ? fromIndex : fromIndex + 1;
          items.splice(at, 0, { ...moved, startTime: arrival });
        }

        const linkIndex = items.findIndex((i) => i.id === fromItem.id);
        items[linkIndex] = { ...items[linkIndex], transportToNext: input.leg };

        return { ...day, items };
      }),
    );
  },

  /**
   * 붙여넣기로 들어온 이동 중 거리·시간이 비어 있는 것을 채운다.
   *
   * "하카타역 → 다자이후 버스" 처럼 시간을 안 적은 줄은 좌표를 찾기 전에는
   * 계산할 수 없다. 위치를 다 찾은 뒤에 한 번 돌려서 채운다.
   * 채우면 그 뒤 일정 시각도 이동 시간만큼 밀어 준다.
   */
  completeTransportEstimates(): number {
    let filled = 0;
    mapActiveTrip((trip) => ({
      ...trip,
      days: trip.days.map((day) => {
        let touched = false;
        const items = [...day.items];

        for (let i = 0; i < items.length - 1; i += 1) {
          const link = items[i].transportToNext;
          if (!link || link.distanceM > 0) continue;
          const from = items[i].place.coord;
          const to = items[i + 1].place.coord;
          if (!from || !to) continue;

          const est = estimateTransport(from, to, link.mode, trip.currency);
          const durationMin = link.manualDuration && link.durationMin > 0 ? link.durationMin : est.durationMin;
          const added = durationMin - link.durationMin;

          items[i] = {
            ...items[i],
            transportToNext: {
              ...link,
              durationMin,
              distanceM: est.distanceM,
              cost: link.cost > 0 ? link.cost : est.fare,
            },
          };
          // 이동 시간이 늘어난 만큼 뒤 일정을 민다
          if (added !== 0) {
            for (let j = i + 1; j < items.length; j += 1) {
              items[j] = { ...items[j], startTime: addMinutes(items[j].startTime, added) };
            }
          }
          touched = true;
          filled += 1;
        }

        return touched ? { ...day, items } : day;
      }),
    }));
    return filled;
  },

  /** 직접 넣은 이동을 지운다. 장소는 그대로 두고 연결만 끊는다 */
  removeTransportLeg(dayId: string, fromItemId: string) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => ({
        ...day,
        items: day.items.map((i) => (i.id === fromItemId ? { ...i, transportToNext: undefined } : i)),
      })),
    );
  },

  /** 동선 최적화 결과를 실제로 적용한다 (시각은 순서에 맞춰 다시 배분) */
  applyOptimizedOrder(dayId: string) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => {
        const result = optimizeDay(day);
        if (result.savedM <= 0) return day;
        return { ...day, items: redistributeTimes(result.items) };
      }),
    );
  },

  togglePinned(dayId: string, itemId: string) {
    mapActiveTrip((trip) =>
      mapDay(trip, dayId, (day) => ({
        ...day,
        items: day.items.map((i) => (i.id === itemId ? { ...i, pinned: !i.pinned } : i)),
      })),
    );
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

    mergeDays(result.days, mode);
    return result;
  },

  /** 엑셀 표를 현재 여행에 넣는다 */
  importSheet(rows: string[][], mode: 'replace' | 'append' = 'append'): SheetImportResult {
    const trip = state.trips.find((t) => t.id === state.activeTripId);
    const result = importSheetRows(rows, trip?.days[0]?.date ?? todayISO());
    if (result.days.length > 0) mergeDays(result.days, mode);
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
 * 새로 읽어들인 날짜들을 현재 여행에 합친다.
 * 같은 날짜가 이미 있으면 그 날에 이어 붙이고, 없으면 날짜를 새로 만든다.
 */
function mergeDays(incoming: Day[], mode: 'replace' | 'append') {
  mapActiveTrip((prev) => {
    if (mode === 'replace') return { ...prev, days: incoming };
    const byDate = new Map(prev.days.map((d) => [d.date, { ...d, items: [...d.items] }]));
    for (const day of incoming) {
      const existing = byDate.get(day.date);
      if (existing) existing.items = sortByTime([...existing.items, ...day.items]);
      else byDate.set(day.date, day);
    }
    const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    return { ...prev, days };
  });
}

/** 공항·역 같은 이름이면 '이동' 분류로 잡는다 */
function inferPlaceCategory(name: string): Category {
  return /공항|airport|역$|station|터미널|항\b|port/i.test(name) ? 'transport' : 'sight';
}

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
