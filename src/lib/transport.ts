import type { LatLng, TransportInfo, TravelMode } from '../types';
import { haversine, routeDistance } from './geo';
import { estimateFare } from './fares';

/**
 * 이동 구간을 일정 항목으로 넣기 위한 계산.
 *
 * 장소 사이의 이동은 원래 자동으로 추정해 구간으로만 보여주는데,
 * 비행기·페리처럼 일정에 명시해야 하는 이동은 항목으로 직접 넣을 수 있어야 한다.
 * 여기서는 이동수단을 고르면 소요시간·거리·요금을 계산해 준다.
 */

export type TransportMode = TransportInfo['mode'];

interface Profile {
  label: string;
  /** 순수 이동 속도(km/h) */
  kmh: number;
  /**
   * 타기 전후로 드는 시간(분).
   * 비행기는 수속·보안·탑승·수하물, 기차는 역까지 여유 시간 같은 것들이다.
   */
  overheadMin: number;
  /** 직선거리 대신 실제 경로 거리를 쓸지 — 비행기·페리는 직선에 가깝다 */
  straight: boolean;
  /** 이 수단이 어울리는 최소 거리(m) — 아래면 목록에서 흐리게 표시 */
  minM: number;
}

const PROFILES: Record<TransportMode, Profile> = {
  flight: { label: '비행기', kmh: 620, overheadMin: 150, straight: true, minM: 200000 },
  train: { label: '기차 · 신칸센', kmh: 190, overheadMin: 25, straight: true, minM: 30000 },
  subway: { label: '지하철 · 전철', kmh: 32, overheadMin: 10, straight: false, minM: 0 },
  bus: { label: '버스', kmh: 28, overheadMin: 12, straight: false, minM: 0 },
  taxi: { label: '택시 · 차', kmh: 26, overheadMin: 4, straight: false, minM: 0 },
  walk: { label: '도보', kmh: 4.6, overheadMin: 1, straight: false, minM: 0 },
  ferry: { label: '배 · 페리', kmh: 35, overheadMin: 40, straight: true, minM: 3000 },
};

export const TRANSPORT_MODES: TransportMode[] = ['flight', 'train', 'subway', 'bus', 'taxi', 'walk', 'ferry'];

export function transportLabel(mode: TransportMode): string {
  return PROFILES[mode].label;
}

/** 이 거리에 어울리는 수단인지 — UI에서 추천 표시에 쓴다 */
export function suitsDistance(mode: TransportMode, distanceM: number): boolean {
  const p = PROFILES[mode];
  if (distanceM < p.minM) return false;
  if (mode === 'walk' && distanceM > 5000) return false;
  if (mode === 'subway' && distanceM > 120000) return false;
  if (mode === 'taxi' && distanceM > 100000) return false;
  return true;
}

/** 거리에 가장 어울리는 수단을 고른다 */
export function suggestTransport(distanceM: number): TransportMode {
  if (distanceM < 1200) return 'walk';
  if (distanceM < 60000) return 'subway';
  if (distanceM < 700000) return 'train';
  return 'flight';
}

export function transportDistance(from: LatLng, to: LatLng, mode: TransportMode): number {
  return PROFILES[mode].straight ? haversine(from, to) : routeDistance(from, to);
}

export interface TransportEstimate {
  distanceM: number;
  durationMin: number;
  /** 이동 자체에 걸리는 시간 (수속 제외) */
  moveMin: number;
  overheadMin: number;
  /** 1인 요금 추정. 비행기는 값이 워낙 달라 0으로 두고 직접 넣게 한다 */
  fare: number;
  /** 요금을 추정하지 않은 경우의 안내 */
  fareNote?: string;
}

/** 두 지점과 이동수단으로 소요시간·거리·요금을 계산한다 */
export function estimateTransport(
  from: LatLng,
  to: LatLng,
  mode: TransportMode,
  currency: string,
): TransportEstimate {
  const p = PROFILES[mode];
  const distanceM = transportDistance(from, to, mode);
  const moveMin = Math.round((distanceM / 1000 / p.kmh) * 60);
  const durationMin = Math.max(1, moveMin + p.overheadMin);

  if (mode === 'flight') {
    return {
      distanceM,
      durationMin,
      moveMin,
      overheadMin: p.overheadMin,
      fare: 0,
      fareNote: '항공권은 노선·시기에 따라 몇 배씩 차이가 나서 추정하지 않습니다. 예약 금액을 직접 넣어주세요.',
    };
  }

  if (mode === 'ferry') {
    return {
      distanceM,
      durationMin,
      moveMin,
      overheadMin: p.overheadMin,
      fare: 0,
      fareNote: '항로마다 요금이 달라 추정하지 않습니다. 직접 넣어주세요.',
    };
  }

  // 나머지는 기존 요금 모델을 쓴다
  const legacy: TravelMode =
    mode === 'walk' ? 'WALKING' : mode === 'taxi' ? 'DRIVING' : 'TRANSIT';

  return {
    distanceM,
    durationMin,
    moveMin,
    overheadMin: p.overheadMin,
    fare: estimateFare(distanceM, legacy, currency),
  };
}

/** 이동 항목의 제목 — "비행기 · 김포 → 하네다" */
export function transportTitle(info: TransportInfo): string {
  return `${transportLabel(info.mode)} · ${info.from.name} → ${info.to.name}`;
}
