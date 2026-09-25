import type { ChecklistItem, Expense, Member, Trip } from '../types';

/**
 * 같은 링크로 여럿이 동시에 고쳤을 때 합치기.
 *
 * 공유 일정은 문서 하나를 통째로 저장한다(마지막에 저장한 쪽이 이긴다). 일정표는 그래도 괜찮지만
 * 가계부·체크리스트는 여러 사람이 동시에 한 줄씩 보태는 곳이라, 그대로 두면 먼저 적은 사람의
 * 지출이 사라진다. 그래서 저장하기 직전에 서버본을 받아 이 세 가지만 id 로 합친다.
 *
 *  - 같은 id 가 양쪽에 있으면 updatedAt 이 늦은 쪽
 *  - 지운 것은 deleted 로 남아 있으므로 다른 사람 화면에서 되살아나지 않는다
 *  - 일정표(days)·제목 등 나머지는 지금처럼 내 것을 쓴다
 */

interface Stamped {
  id: string;
  updatedAt?: string;
}

export function mergeById<T extends Stamped>(mine: T[] | undefined, theirs: T[] | undefined): T[] | undefined {
  if (!mine && !theirs) return undefined;
  const byId = new Map<string, T>();
  for (const e of theirs ?? []) byId.set(e.id, e);
  for (const e of mine ?? []) {
    const other = byId.get(e.id);
    if (!other || (e.updatedAt ?? '') >= (other.updatedAt ?? '')) byId.set(e.id, e);
  }
  // 원래 순서를 최대한 지킨다: 내 순서 → 내게 없던 것
  const order = [...(mine ?? []).map((e) => e.id), ...(theirs ?? []).map((e) => e.id)];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(byId.get(id)!);
  }
  return out;
}

/** 멤버는 지우지 않는다(지출이 가리키고 있을 수 있다) — 이름만 바꾼다 */
function mergeMembers(mine: Member[] | undefined, theirs: Member[] | undefined): Member[] | undefined {
  if (!mine && !theirs) return undefined;
  const out = [...(mine ?? [])];
  for (const m of theirs ?? []) if (!out.some((x) => x.id === m.id)) out.push(m);
  return out;
}

export function mergeTrip(mine: Trip, theirs: Trip | undefined): Trip {
  if (!theirs) return mine;
  return {
    ...mine,
    members: mergeMembers(mine.members, theirs.members),
    expenses: mergeById<Expense>(mine.expenses, theirs.expenses),
    checklist: mergeById<ChecklistItem>(mine.checklist, theirs.checklist),
  };
}

/** 서버본과 합친다. 서버에만 있는 여행은 그대로 살린다 */
export function mergeTrips(mine: Trip[], theirs: Trip[]): Trip[] {
  const theirById = new Map(theirs.map((t) => [t.id, t]));
  const merged = mine.map((t) => mergeTrip(t, theirById.get(t.id)));
  for (const t of theirs) if (!mine.some((m) => m.id === t.id)) merged.push(t);
  return merged;
}

/** 두 버전의 합칠 부분이 실제로 다른가 — 같으면 화면을 다시 그리지 않는다 */
export function collectionsDiffer(a: Trip[], b: Trip[]): boolean {
  const pick = (ts: Trip[]) => JSON.stringify(ts.map((t) => [t.id, t.members, t.expenses, t.checklist]));
  return pick(a) !== pick(b);
}
