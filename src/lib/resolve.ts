import type { LatLng, Trip } from '../types';
import { searchPlace } from './maps';
import { actions } from '../store/tripStore';

export interface ResolveProgress {
  total: number;
  done: number;
  resolved: number;
  currentTitle: string;
}

/**
 * 좌표가 없는 모든 일정 항목의 위치를 찾아 채운다.
 * 자유 텍스트로 일정을 넣은 직후에 한 번 돌리면 지도·경로·비용이 전부 살아난다.
 */
export async function resolveMissingPlaces(
  trip: Trip,
  bias: LatLng | undefined,
  onProgress?: (p: ResolveProgress) => void,
): Promise<number> {
  const pending: Array<{ dayId: string; itemId: string; title: string }> = [];
  for (const day of trip.days) {
    for (const item of day.items) {
      if (!item.place.coord) pending.push({ dayId: day.id, itemId: item.id, title: item.place.name || item.title });
    }
  }

  let resolved = 0;
  for (let i = 0; i < pending.length; i += 1) {
    const p = pending[i];
    onProgress?.({ total: pending.length, done: i, resolved, currentTitle: p.title });
    try {
      const hit = await searchPlace(p.title, bias);
      if (hit) {
        actions.setItemPlace(p.dayId, p.itemId, {
          name: hit.name,
          address: hit.address,
          coord: hit.coord,
          placeId: hit.placeId || undefined,
          source: hit.placeId ? 'google' : 'local',
        });
        resolved += 1;
      }
    } catch (e) {
      console.warn('[resolve] 실패', p.title, e);
    }
  }
  onProgress?.({ total: pending.length, done: pending.length, resolved, currentTitle: '' });
  return resolved;
}
