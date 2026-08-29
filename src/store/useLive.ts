import { useEffect, useMemo, useRef, useState } from 'react';
import type { Day, Item, Leg, Settings } from '../types';
import { dateTimeOf, todayISO } from '../lib/time';

export type ItemStatus = 'done' | 'current' | 'upcoming' | 'overdue' | 'missed';

export interface LiveItemState {
  item: Item;
  index: number;
  status: ItemStatus;
  plannedStart: Date;
  plannedEnd: Date;
  /** 진행 중일 때 0~1 */
  progress: number;
  /** 계획 대비 실제 시작 차이(분). 양수면 지연 */
  delayMin: number | null;
}

export interface LiveState {
  isToday: boolean;
  now: Date;
  states: LiveItemState[];
  currentIndex: number | null;
  nextIndex: number | null;
  /** 다음 장소로 지금 출발해야 하는가 */
  departureDue: boolean;
  /** 다음 일정까지 남은 밀리초 */
  msToNext: number | null;
  /** 이동에 걸리는 시간(분) */
  travelMin: number | null;
  /** 늦어진 총 시간(분). 현재 항목이 계획 종료를 넘겼을 때 */
  runningLateMin: number;
}

/** n밀리초마다 리렌더되는 현재 시각 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function computeLive(
  day: Day | undefined,
  legs: Array<Leg | null>,
  now: Date,
  alertMin: number,
): LiveState {
  const empty: LiveState = {
    isToday: false,
    now,
    states: [],
    currentIndex: null,
    nextIndex: null,
    departureDue: false,
    msToNext: null,
    travelMin: null,
    runningLateMin: 0,
  };
  if (!day || day.items.length === 0) return empty;

  const isToday = day.date === todayISO(now);

  // 계획 종료를 넘긴 항목이 여러 개여도, 지금 손대야 할 건 가장 이른 하나다
  let firstOverdue = -1;
  day.items.forEach((item, i) => {
    if (item.done || firstOverdue >= 0) return;
    const end = new Date(dateTimeOf(day.date, item.startTime).getTime() + item.durationMin * 60000);
    if (now > end) firstOverdue = i;
  });

  const states: LiveItemState[] = day.items.map((item, index) => {
    const plannedStart = dateTimeOf(day.date, item.startTime);
    const plannedEnd = new Date(plannedStart.getTime() + item.durationMin * 60000);
    const actual = item.actualStart ? new Date(item.actualStart) : null;

    let status: ItemStatus;
    if (item.done) status = 'done';
    else if (now >= plannedStart && now <= plannedEnd) status = 'current';
    else if (now > plannedEnd) status = index === firstOverdue ? 'overdue' : 'missed';
    else status = 'upcoming';

    const span = Math.max(1, plannedEnd.getTime() - plannedStart.getTime());
    const progress = Math.max(0, Math.min(1, (now.getTime() - plannedStart.getTime()) / span));

    return {
      item,
      index,
      status,
      plannedStart,
      plannedEnd,
      progress,
      delayMin: actual ? Math.round((actual.getTime() - plannedStart.getTime()) / 60000) : null,
    };
  });

  const currentIndex = states.findIndex((s) => s.status === 'current');
  const nextIndex = states.findIndex((s) => s.status === 'upcoming' && !s.item.done);

  let msToNext: number | null = null;
  let travelMin: number | null = null;
  let departureDue = false;

  if (nextIndex >= 0) {
    const next = states[nextIndex];
    msToNext = next.plannedStart.getTime() - now.getTime();
    const leg = nextIndex > 0 ? legs[nextIndex - 1] : null;
    travelMin = leg?.durationMin ?? null;
    if (travelMin !== null) {
      const departBy = next.plannedStart.getTime() - travelMin * 60000;
      departureDue = now.getTime() >= departBy - alertMin * 60000;
    }
  }

  // 계획보다 얼마나 밀렸는지 = 가장 이른 미완료 초과 항목의 초과분
  const overdue = states.find((s) => s.status === 'overdue');
  const runningLateMin = overdue ? Math.round((now.getTime() - overdue.plannedEnd.getTime()) / 60000) : 0;

  return {
    isToday,
    now,
    states,
    currentIndex: currentIndex >= 0 ? currentIndex : null,
    nextIndex: nextIndex >= 0 ? nextIndex : null,
    departureDue,
    msToNext,
    travelMin,
    runningLateMin,
  };
}

/** 출발 시각이 되면 브라우저 알림을 한 번씩 띄운다 */
export function useDepartureNotification(live: LiveState, day: Day | undefined, settings: Settings) {
  const fired = useRef(new Set<string>());

  useEffect(() => {
    if (!settings.notificationsEnabled || !live.isToday || !day) return;
    if (!live.departureDue || live.nextIndex === null) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const next = day.items[live.nextIndex];
    const key = `${day.id}:${next.id}`;
    if (fired.current.has(key)) return;
    fired.current.add(key);

    new Notification('이제 이동할 시간이에요', {
      body: `${next.startTime} ${next.title}${live.travelMin ? ` · 이동 ${live.travelMin}분` : ''}`,
      tag: key,
    });
  }, [live.departureDue, live.nextIndex, live.isToday, live.travelMin, day, settings.notificationsEnabled]);
}

/** 현재 여행에서 "오늘"에 해당하는 날짜 인덱스 */
export function useTodayIndex(days: Day[]): number {
  return useMemo(() => {
    const today = todayISO();
    const exact = days.findIndex((d) => d.date === today);
    if (exact >= 0) return exact;
    const upcoming = days.findIndex((d) => d.date > today);
    return upcoming >= 0 ? upcoming : Math.max(0, days.length - 1);
  }, [days]);
}
