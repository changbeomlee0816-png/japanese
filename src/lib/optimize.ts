import type { Day, Item } from '../types';
import { routeDistance } from './geo';

/**
 * 하루 동선 최적화.
 *
 * 방문 순서만 바꿔서 총 이동거리를 줄인다. 시각은 순서를 정한 뒤 다시 배분한다.
 *
 * 고정되는 항목(anchor)
 *  - 사용자가 직접 고정한 것 (item.pinned)
 *  - 공항·역 같은 이동 지점, 숙소 — 보통 하루의 시작이나 끝이라 자리를 지켜야 한다
 *  - 좌표가 없는 항목 — 거리를 계산할 수 없으니 건드리지 않는다
 *
 * 나머지만 자리를 바꾼다. 항목이 적어(보통 3~10개) 최근접 이웃으로 초기해를 만든 뒤
 * 2-opt로 다듬으면 사실상 최적에 가깝게 나온다.
 */

export interface OptimizeResult {
  /** 새 순서의 항목들 (시각 재배분 전) */
  items: Item[];
  beforeM: number;
  afterM: number;
  /** 줄어든 거리(m). 0 이하이면 이미 충분히 좋은 순서다 */
  savedM: number;
  /** 자리를 지킨 항목 수 */
  anchoredCount: number;
  /** 자리를 바꾼 항목 수 */
  movedCount: number;
}

function isAnchor(item: Item): boolean {
  if (item.pinned) return true;
  if (!item.place.coord) return true;
  // 직접 넣은 이동이 붙어 있으면 다음 장소와 짝이라 자리를 옮기면 안 된다
  if (item.transportToNext) return true;
  return item.category === 'transport' || item.category === 'stay';
}

/**
 * 순서대로 이었을 때의 총 이동거리.
 *
 * 좌표가 없는 항목은 구간을 끊지 않고 건너뛴다. 그러지 않으면 좌표 없는 항목을
 * 사이에 끼워 넣는 것만으로 거리가 줄어든 것처럼 보인다.
 */
export function totalDistance(items: Item[]): number {
  const points = items.map((i) => i.place.coord).filter((c): c is NonNullable<typeof c> => !!c);
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    sum += routeDistance(points[i], points[i + 1]);
  }
  return sum;
}

/** 두 구간을 뒤집어도 고정 항목이 제자리에 있는지 확인하며 2-opt를 돈다 */
function twoOpt(items: Item[], movable: Set<number>): Item[] {
  const best = [...items];
  let improved = true;
  let guard = 0;

  while (improved && guard < 60) {
    improved = false;
    guard += 1;

    for (let i = 1; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        // 뒤집을 구간 안에 고정 항목이 있으면 건너뛴다
        let ok = true;
        for (let j = i; j <= k; j += 1) {
          if (!movable.has(j)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        if (totalDistance(candidate) < totalDistance(best) - 1) {
          best.splice(0, best.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * 고정 항목 사이의 빈 자리를 최근접 이웃으로 채운다.
 * 예: [공항] _ _ _ [숙소] 라면 가운데 세 자리를 공항에서 가까운 순으로 잇는다.
 */
function nearestNeighborFill(slots: Array<Item | null>, pool: Item[]): Item[] {
  const result = [...slots];
  const remaining = [...pool];

  for (let i = 0; i < result.length; i += 1) {
    if (result[i] !== null) continue;

    // 직전에 확정된 위치를 기준으로 가장 가까운 곳을 고른다
    let ref = null as Item | null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (result[j]) {
        ref = result[j];
        break;
      }
    }

    let pickIndex = 0;
    if (ref?.place.coord) {
      let bestDist = Infinity;
      remaining.forEach((cand, idx) => {
        if (!cand.place.coord) return;
        const d = routeDistance(ref!.place.coord!, cand.place.coord);
        if (d < bestDist) {
          bestDist = d;
          pickIndex = idx;
        }
      });
    }
    result[i] = remaining.splice(pickIndex, 1)[0] ?? null;
  }

  return result.filter((x): x is Item => x !== null);
}

export function optimizeDay(day: Day): OptimizeResult {
  const items = day.items;
  const anchored = items.map(isAnchor);
  const movablePool = items.filter((_, i) => !anchored[i]);

  const before = totalDistance(items);

  if (movablePool.length < 2) {
    return {
      items,
      beforeM: before,
      afterM: before,
      savedM: 0,
      anchoredCount: anchored.filter(Boolean).length,
      movedCount: 0,
    };
  }

  const slots: Array<Item | null> = items.map((it, i) => (anchored[i] ? it : null));
  const seeded = nearestNeighborFill(slots, movablePool);

  const movable = new Set<number>();
  seeded.forEach((it, i) => {
    if (!isAnchor(it)) movable.add(i);
  });

  const tuned = twoOpt(seeded, movable);
  const after = totalDistance(tuned);

  // 개선이 없으면 원래 순서를 그대로 돌려준다
  if (after >= before - 50) {
    return {
      items,
      beforeM: before,
      afterM: before,
      savedM: 0,
      anchoredCount: anchored.filter(Boolean).length,
      movedCount: 0,
    };
  }

  const movedCount = tuned.reduce((n, it, i) => (items[i]?.id === it.id ? n : n + 1), 0);

  return {
    items: tuned,
    beforeM: before,
    afterM: after,
    savedM: before - after,
    anchoredCount: anchored.filter(Boolean).length,
    movedCount,
  };
}
