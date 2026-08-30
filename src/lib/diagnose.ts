import type { Day, Leg } from '../types';
import { lookupPoi } from '../data/poi';
import { addMinutes, dateTimeOf, toMinutes } from './time';
import { totalDistance } from './optimize';

/**
 * 하루 일정 점검.
 *
 * 짜고 나서야 알게 되는 문제들 — 이동 시간이 모자라거나, 문 닫은 시간에 가거나,
 * 하루가 지나치게 길거나 — 를 미리 짚어준다. 고칠 수 있는 것만 말한다.
 */

export type IssueLevel = 'warn' | 'info';

export interface Issue {
  level: IssueLevel;
  /** 화면에 뜨는 문장 */
  text: string;
  /** 관련된 항목 id — 눌러서 그 일정으로 갈 수 있게 */
  itemId?: string;
}

export interface Diagnosis {
  issues: Issue[];
  /** 첫 일정 시작부터 마지막 종료까지(분) */
  spanMin: number;
  /** 총 이동거리(m) */
  distanceM: number;
  /** 순수 이동시간(분) */
  travelMin: number;
}

const LONG_DAY_MIN = 12 * 60;
const FAR_DAY_M = 60000;

function withinHours(hhmm: string, durationMin: number, hours: { open: string; close: string }): boolean {
  const start = toMinutes(hhmm);
  const end = start + durationMin;
  const open = toMinutes(hours.open);
  let close = toMinutes(hours.close);
  if (close <= open) close += 1440; // 새벽까지 영업
  return start >= open && end <= close;
}

export function diagnoseDay(day: Day, legs: Array<Leg | null>): Diagnosis {
  const issues: Issue[] = [];
  const items = day.items;

  const distanceM = totalDistance(items);
  const travelMin = legs.reduce((n, l) => n + (l?.durationMin ?? 0), 0);

  let spanMin = 0;
  if (items.length > 0) {
    const first = toMinutes(items[0].startTime);
    const last = items.reduce((max, it) => Math.max(max, toMinutes(it.startTime) + it.durationMin), first);
    spanMin = last - first;
  }

  // 1) 이동 시간이 일정 간격보다 긴 구간
  for (let i = 0; i < items.length - 1; i += 1) {
    const leg = legs[i];
    if (!leg) continue;
    const gap = toMinutes(items[i + 1].startTime) - (toMinutes(items[i].startTime) + items[i].durationMin);
    if (gap < leg.durationMin) {
      issues.push({
        level: 'warn',
        itemId: items[i + 1].id,
        text: `${items[i].title} → ${items[i + 1].title} 이동에 ${leg.durationMin}분이 걸리는데 ${Math.max(0, gap)}분밖에 없어요`,
      });
    }
  }

  // 2) 영업시간 밖 방문
  const weekday = dateTimeOf(day.date, '12:00').getDay();
  for (const item of items) {
    const poi = lookupPoi(item.place.name || item.title);
    const hours = poi?.hours;
    if (!hours) continue;

    if (hours.closedDays?.includes(weekday)) {
      issues.push({
        level: 'warn',
        itemId: item.id,
        text: `${item.title}은(는) 이 요일에 쉽니다`,
      });
    } else if (!withinHours(item.startTime, item.durationMin, hours)) {
      issues.push({
        level: 'warn',
        itemId: item.id,
        text: `${item.title} 방문 시간(${item.startTime}–${addMinutes(item.startTime, item.durationMin)})이 영업시간(${hours.open}–${hours.close}) 밖이에요`,
      });
    }
  }

  // 3) 하루가 너무 길다
  if (spanMin > LONG_DAY_MIN) {
    issues.push({
      level: 'info',
      text: `첫 일정부터 마지막까지 ${Math.round(spanMin / 60)}시간이에요. 하나 덜어내는 걸 고려해 보세요`,
    });
  }

  // 4) 이동거리가 많다
  if (distanceM > FAR_DAY_M) {
    issues.push({
      level: 'info',
      text: `이동거리가 ${(distanceM / 1000).toFixed(0)}km입니다. 동선을 정리하면 줄어들 수 있어요`,
    });
  }

  // 5) 위치를 못 찾은 항목
  const missing = items.filter((i) => !i.place.coord);
  if (missing.length > 0) {
    issues.push({
      level: 'info',
      itemId: missing[0].id,
      text: `위치가 지정되지 않은 일정 ${missing.length}개 — 경로와 비용에서 빠집니다`,
    });
  }

  // 6) 같은 곳을 두 번
  const seen = new Map<string, number>();
  for (const item of items) {
    const key = item.place.name || item.title;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [name, n] of seen) {
    if (n > 1) issues.push({ level: 'info', text: `${name}이(가) ${n}번 들어가 있어요` });
  }

  // 7) 식사 시간에 식사 일정이 없다
  if (items.length >= 3) {
    const hasMealAround = (target: number) =>
      items.some(
        (i) =>
          (i.category === 'food' || i.category === 'cafe') &&
          Math.abs(toMinutes(i.startTime) - target) <= 120,
      );
    const startsBeforeLunch = toMinutes(items[0].startTime) <= 12 * 60;
    const endsAfterDinner = toMinutes(items[items.length - 1].startTime) >= 18 * 60;
    if (startsBeforeLunch && !hasMealAround(12 * 60)) {
      issues.push({ level: 'info', text: '점심 시간대에 식사 일정이 없어요' });
    }
    if (endsAfterDinner && !hasMealAround(19 * 60)) {
      issues.push({ level: 'info', text: '저녁 시간대에 식사 일정이 없어요' });
    }
  }

  return { issues, spanMin, distanceM, travelMin };
}
