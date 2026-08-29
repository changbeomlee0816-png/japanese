import { useSyncExternalStore } from 'react';
import type { LatLng, Leg, LegStep, PlaceRef, Restaurant, TravelMode } from '../types';
import { estimateDurationMin, routeDistance, suggestMode } from './geo';
import { estimateFare } from './fares';
import { lookupPoi } from '../data/poi';
import { LOCAL_RESTAURANTS } from '../data/restaurants';

/* ------------------------------------------------------------------ *
 * 스크립트 로더
 * ------------------------------------------------------------------ */

let loadPromise: Promise<typeof google> | null = null;
let loadedKey = '';
let ready = false;
const readyListeners = new Set<() => void>();

export function mapsLoaded(): boolean {
  return ready || (typeof google !== 'undefined' && !!google.maps?.places);
}

function markReady() {
  if (ready) return;
  ready = true;
  for (const l of readyListeners) l();
}

/**
 * 지도 스크립트가 준비되면 리렌더한다.
 * 지도·검색·맛집이 전부 "키가 있으면 실제 데이터"로 바뀌므로 앱 루트에서 한 번 구독한다.
 */
export function useMapsReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      readyListeners.add(cb);
      return () => readyListeners.delete(cb);
    },
    () => ready,
    () => false,
  );
}

/** Google Maps JS API를 한 번만 로드한다. 키가 바뀌면 새로고침이 필요하다. */
export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (!apiKey) return Promise.reject(new Error('NO_API_KEY'));
  if (loadPromise && loadedKey === apiKey) return loadPromise;
  if (loadPromise && loadedKey !== apiKey) {
    return Promise.reject(new Error('KEY_CHANGED_RELOAD_REQUIRED'));
  }

  loadedKey = apiKey;
  loadPromise = new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps?.places) {
      markReady();
      resolve(google);
      return;
    }
    const script = document.createElement('script');
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      libraries: 'places,geometry,routes',
      language: 'ko',
      region: 'JP',
      loading: 'async',
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error('SCRIPT_LOAD_FAILED'));
    script.onload = () => {
      if (typeof google !== 'undefined' && google.maps?.places) {
        markReady();
        resolve(google);
      } else {
        reject(new Error('MAPS_NOT_READY'));
      }
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/* ------------------------------------------------------------------ *
 * 장소 검색
 * ------------------------------------------------------------------ */

const PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'priceLevel',
  'primaryTypeDisplayName',
  'googleMapsURI',
  'regularOpeningHours',
];

export interface PlaceHit {
  placeId: string;
  name: string;
  address: string;
  coord: LatLng;
}

/**
 * 텍스트로 장소를 검색한다.
 * API 키가 없거나 실패하면 내장 사전(POI)으로 폴백해서 최소한 좌표는 잡아준다.
 */
export async function searchPlace(query: string, bias?: LatLng): Promise<PlaceHit | null> {
  if (mapsLoaded()) {
    try {
      const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
      const { places } = await Place.searchByText({
        textQuery: query,
        fields: PLACE_FIELDS,
        language: 'ko',
        maxResultCount: 1,
        ...(bias
          ? { locationBias: { center: new google.maps.LatLng(bias.lat, bias.lng), radius: 50000 } }
          : {}),
      });
      const p = places?.[0];
      if (p?.location) {
        return {
          placeId: p.id,
          name: p.displayName ?? query,
          address: p.formattedAddress ?? '',
          coord: { lat: p.location.lat(), lng: p.location.lng() },
        };
      }
    } catch (e) {
      console.warn('[maps] searchPlace 실패, 내장 사전으로 폴백', e);
    }
  }

  const poi = lookupPoi(query);
  return poi ? { placeId: '', name: poi.name, address: `${poi.area} (내장 데이터)`, coord: poi.coord } : null;
}

/** 자동완성 후보 목록 (검색 UI용) */
export async function suggestPlaces(query: string, bias?: LatLng): Promise<PlaceHit[]> {
  if (!query.trim()) return [];

  if (mapsLoaded()) {
    try {
      const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
      const { places } = await Place.searchByText({
        textQuery: query,
        fields: PLACE_FIELDS,
        language: 'ko',
        maxResultCount: 8,
        ...(bias
          ? { locationBias: { center: new google.maps.LatLng(bias.lat, bias.lng), radius: 50000 } }
          : {}),
      });
      const hits = (places ?? [])
        .filter((p) => !!p.location)
        .map((p) => ({
          placeId: p.id,
          name: p.displayName ?? query,
          address: p.formattedAddress ?? '',
          coord: { lat: p.location!.lat(), lng: p.location!.lng() },
        }));
      if (hits.length) return hits;
    } catch (e) {
      console.warn('[maps] suggestPlaces 실패', e);
    }
  }

  const single = await searchPlace(query, bias);
  return single ? [single] : [];
}

export function placeRefFromHit(hit: PlaceHit): PlaceRef {
  return {
    name: hit.name,
    address: hit.address,
    coord: hit.coord,
    placeId: hit.placeId || undefined,
    source: hit.placeId ? 'google' : 'local',
  };
}

/* ------------------------------------------------------------------ *
 * 경로 · 요금
 * ------------------------------------------------------------------ */

function mapMode(mode: TravelMode): google.maps.TravelMode {
  return google.maps.TravelMode[mode];
}

function stepMode(step: google.maps.DirectionsStep): TravelMode {
  const raw = String(step.travel_mode ?? 'WALKING');
  return (['WALKING', 'TRANSIT', 'DRIVING', 'BICYCLING'].includes(raw) ? raw : 'WALKING') as TravelMode;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Directions API 결과를 우리 Leg 모델로 변환 */
function toLeg(
  fromItemId: string,
  toItemId: string,
  mode: TravelMode,
  result: google.maps.DirectionsResult,
  currency: string,
): Leg {
  const route = result.routes[0];
  const leg = route.legs[0];
  const distanceM = leg.distance?.value ?? 0;
  const durationMin = Math.round((leg.duration?.value ?? 0) / 60);

  const steps: LegStep[] = (leg.steps ?? []).map((s) => {
    const transit = s.transit;
    return {
      mode: stepMode(s),
      instruction: stripHtml(s.instructions ?? ''),
      durationMin: Math.round((s.duration?.value ?? 0) / 60),
      line: transit?.line?.short_name || transit?.line?.name,
      headsign: transit?.headsign,
      departureStop: transit?.departure_stop?.name,
      arrivalStop: transit?.arrival_stop?.name,
    };
  });

  // Directions가 실제 운임을 주는 지역이면 그 값을 쓰고, 아니면 추정 모델
  const apiFare = (result.routes[0] as unknown as { fare?: { value: number; currency: string } }).fare;
  const fare =
    apiFare && apiFare.currency?.toUpperCase() === currency.toUpperCase()
      ? apiFare.value
      : estimateFare(distanceM, mode, currency);

  const transitLines = steps.filter((s) => s.mode === 'TRANSIT' && s.line).map((s) => s.line!);
  const summary =
    transitLines.length > 0
      ? `${transitLines.join(' → ')}${transitLines.length > 1 ? ` · 환승 ${transitLines.length - 1}회` : ''}`
      : route.summary || (mode === 'WALKING' ? '도보 이동' : '');

  return {
    fromItemId,
    toItemId,
    mode,
    distanceM,
    durationMin,
    fare,
    summary,
    steps,
    source: 'google',
    polyline: route.overview_polyline as unknown as string,
  };
}

/** Google Directions로 실제 경로를 받아온다 */
export async function fetchDirections(
  from: LatLng,
  to: LatLng,
  mode: TravelMode,
  fromItemId: string,
  toItemId: string,
  currency: string,
  departureTime?: Date,
): Promise<Leg> {
  const service = new google.maps.DirectionsService();
  const request: google.maps.DirectionsRequest = {
    origin: from,
    destination: to,
    travelMode: mapMode(mode),
    ...(mode === 'TRANSIT'
      ? { transitOptions: { departureTime: departureTime ?? new Date() } }
      : {}),
    ...(mode === 'DRIVING'
      ? { drivingOptions: { departureTime: departureTime ?? new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS } }
      : {}),
  };
  const result = await service.route(request);
  return toLeg(fromItemId, toItemId, mode, result, currency);
}

/** API 없이 거리 기반으로 추정한 경로 */
export function estimateLeg(
  from: LatLng,
  to: LatLng,
  mode: TravelMode | undefined,
  fromItemId: string,
  toItemId: string,
  currency: string,
): Leg {
  const distanceM = routeDistance(from, to);
  const chosen = mode ?? suggestMode(distanceM);
  const durationMin = estimateDurationMin(distanceM, chosen);
  return {
    fromItemId,
    toItemId,
    mode: chosen,
    distanceM,
    durationMin,
    fare: estimateFare(distanceM, chosen, currency),
    summary:
      chosen === 'TRANSIT' ? '실제 노선은 지도 연동 후 확인' : '',
    source: 'estimate',
  };
}

/* ------------------------------------------------------------------ *
 * 주변 맛집
 * ------------------------------------------------------------------ */

/**
 * Google 결과에는 "현지인 비율" 데이터가 없다.
 * 평점·리뷰 수·가격대로 추정 지표를 만들되, UI에서 추정치임을 밝힌다.
 * (리뷰가 지나치게 많은 곳 = 관광 동선에 걸린 곳일 확률이 높다는 가정)
 */
function estimateLocalScore(rating: number, reviewCount: number, priceLevel: number): number {
  const ratingBonus = (rating - 3.9) * 26;
  const crowdPenalty = Math.log10(Math.max(reviewCount, 50) / 300) * 20;
  const priceBonus = priceLevel <= 2 ? 8 : priceLevel === 4 ? -4 : 0;
  return Math.max(5, Math.min(98, Math.round(62 + ratingBonus - crowdPenalty + priceBonus)));
}

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** 좌표 주변 식당 검색. 키가 없으면 내장 큐레이션에서 가까운 곳을 돌려준다. */
export async function nearbyRestaurants(center: LatLng, radiusM = 900): Promise<Restaurant[]> {
  if (mapsLoaded()) {
    try {
      const { Place, SearchNearbyRankPreference } = (await google.maps.importLibrary(
        'places',
      )) as google.maps.PlacesLibrary;
      const { places } = await Place.searchNearby({
        fields: PLACE_FIELDS,
        locationRestriction: { center: new google.maps.LatLng(center.lat, center.lng), radius: radiusM },
        includedPrimaryTypes: ['restaurant'],
        maxResultCount: 20,
        rankPreference: SearchNearbyRankPreference.POPULARITY,
        language: 'ko',
      });

      const mapped = (places ?? [])
        .filter((p) => !!p.location)
        .map((p): Restaurant => {
          const rating = p.rating ?? 0;
          const reviewCount = p.userRatingCount ?? 0;
          const priceLevel = PRICE_MAP[String(p.priceLevel ?? '')] ?? 2;
          return {
            id: p.id,
            name: p.displayName ?? '이름 없음',
            genre: p.primaryTypeDisplayName ?? '음식점',
            coord: { lat: p.location!.lat(), lng: p.location!.lng() },
            rating,
            reviewCount,
            priceLevel,
            address: p.formattedAddress ?? undefined,
            localScore: estimateLocalScore(rating, reviewCount, priceLevel),
            openHint: p.regularOpeningHours?.weekdayDescriptions?.[new Date().getDay()],
            source: 'google',
            mapUrl: p.googleMapsURI ?? undefined,
          };
        })
        .filter((r) => r.reviewCount >= 20);

      if (mapped.length) return mapped;
    } catch (e) {
      console.warn('[maps] nearbyRestaurants 실패, 내장 데이터로 폴백', e);
    }
  }

  return LOCAL_RESTAURANTS.map((r) => ({
    ...r,
    _dist: routeDistance(center, r.coord),
  }))
    .filter((r) => r._dist < Math.max(radiusM * 4, 4000))
    .sort((a, b) => a._dist - b._dist)
    .slice(0, 12)
    .map(({ _dist, ...rest }) => {
      void _dist;
      return rest;
    });
}
