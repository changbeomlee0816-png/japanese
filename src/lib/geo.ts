import type { LatLng, TravelMode } from '../types';

const EARTH_R = 6371000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 사이의 대권 거리(m) */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * 도로/노선은 직선보다 길다. 거리대별 우회 계수를 곱해 실제 이동거리를 근사한다.
 * (짧을수록 골목을 돌아가므로 계수가 크고, 멀수록 간선/철도라 1에 가까워진다)
 */
export function routeDistance(a: LatLng, b: LatLng): number {
  const straight = haversine(a, b);
  const factor = straight < 800 ? 1.35 : straight < 5000 ? 1.28 : straight < 40000 ? 1.2 : 1.12;
  return straight * factor;
}

/** 이동수단별 평균 속도(km/h)와 고정 오버헤드(분) — 추정 경로 계산에 쓴다 */
const PROFILE: Record<TravelMode, { kmh: number; overheadMin: number }> = {
  WALKING: { kmh: 4.6, overheadMin: 1 },
  BICYCLING: { kmh: 14, overheadMin: 2 },
  // 대기/환승/개찰 시간을 오버헤드로 반영
  TRANSIT: { kmh: 26, overheadMin: 9 },
  DRIVING: { kmh: 24, overheadMin: 3 },
};

export function estimateDurationMin(distanceM: number, mode: TravelMode): number {
  const p = PROFILE[mode];
  // 장거리 철도는 평균 속도가 크게 올라간다
  const kmh = mode === 'TRANSIT' && distanceM > 60000 ? 110 : p.kmh;
  return Math.max(1, Math.round((distanceM / 1000 / kmh) * 60 + p.overheadMin));
}

/** 거리만 보고 가장 그럴듯한 이동수단을 고른다 */
export function suggestMode(distanceM: number): TravelMode {
  if (distanceM < 1100) return 'WALKING';
  if (distanceM < 2000) return 'WALKING';
  return 'TRANSIT';
}

/** 여러 좌표를 감싸는 경계 상자 */
export function bounds(points: LatLng[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

export function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) return { lat: 35.6812, lng: 139.7671 };
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** Google encoded polyline 디코더 (지도 폴백 렌더링에 사용) */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
