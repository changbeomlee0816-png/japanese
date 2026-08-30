/** 앱 전체에서 쓰는 도메인 타입 정의 */

export type Category =
  | 'sight'      // 관광
  | 'food'       // 식사
  | 'cafe'       // 카페
  | 'shopping'   // 쇼핑
  | 'stay'       // 숙소
  | 'transport'  // 이동(공항/역 등)
  | 'activity'   // 액티비티
  | 'etc';

export type TravelMode = 'WALKING' | 'TRANSIT' | 'DRIVING' | 'BICYCLING';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceRef {
  name: string;
  address?: string;
  /** 좌표를 못 찾은 경우 undefined — UI에서 "위치 찾기"로 유도한다 */
  coord?: LatLng;
  placeId?: string;
  /** 좌표 출처: google=Places API, local=내장 사전, manual=직접 입력 */
  source?: 'google' | 'local' | 'manual';
}

export interface TransportInfo {
  mode: 'flight' | 'train' | 'subway' | 'bus' | 'taxi' | 'walk' | 'ferry';
  from: PlaceRef;
  to: PlaceRef;
  distanceM: number;
  /** 사용자가 소요시간을 직접 고쳤는지 */
  manualDuration?: boolean;
}

export interface Item {
  id: string;
  title: string;
  category: Category;
  place: PlaceRef;
  /** "HH:mm" — 그날의 계획 시작 시각 */
  startTime: string;
  /** 머무는 시간(분) */
  durationMin: number;
  /** 이 장소에서 쓰는 예상 비용(현지 통화 기준) */
  cost: number;
  notes?: string;
  /** 다음 장소로 갈 때 쓰려는 이동수단 */
  modeToNext?: TravelMode;
  /** 시각을 고정한다 — 예약이 있거나 순서를 바꾸면 안 되는 일정. 동선 최적화가 건드리지 않는다 */
  pinned?: boolean;
  /**
   * 이 항목이 장소가 아니라 이동 구간일 때 채워진다.
   * durationMin 은 소요시간, cost 는 1인 요금이 된다.
   */
  transport?: TransportInfo;
  /** 실시간 추적용 */
  actualStart?: string; // ISO
  actualEnd?: string;   // ISO
  done?: boolean;
}

export interface Day {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  title?: string;
  items: Item[];
}

export interface Trip {
  id: string;
  title: string;
  /** 도시/지역 이름 — 맛집 추천과 요금 모델의 기준 */
  destination: string;
  /** regions.ts 의 Region.id — 둘러보기와 지도 중심의 기준 */
  regionId?: string;
  /** 통화 코드 (JPY, KRW, USD, EUR ...) */
  currency: string;
  /** 현지 통화 1단위 = ? KRW */
  rateToKRW: number;
  travelers: number;
  days: Day[];
  /** 가고 싶은 곳 — 날짜를 아직 안 정한 후보들 */
  saved?: Item[];
  updatedAt: string;
}

/** 두 지점 사이의 이동 구간 */
export interface Leg {
  fromItemId: string;
  toItemId: string;
  mode: TravelMode;
  distanceM: number;
  durationMin: number;
  /** 현지 통화 기준 1인 예상 요금 */
  fare: number;
  /** 대중교통 환승 안내 등 사람이 읽는 요약 */
  summary: string;
  steps?: LegStep[];
  /** google=Directions API 실측, estimate=거리 기반 추정 */
  source: 'google' | 'estimate';
  /** 경로 폴리라인 (encoded) */
  polyline?: string;
}

export interface LegStep {
  mode: TravelMode;
  instruction: string;
  durationMin: number;
  /** 지하철/버스 노선명 */
  line?: string;
  headsign?: string;
  departureStop?: string;
  arrivalStop?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  genre: string;
  coord: LatLng;
  /** 5점 만점 */
  rating: number;
  reviewCount: number;
  /** 1~4 (₩~₩₩₩₩) */
  priceLevel: number;
  address?: string;
  /** 0~100, 관광객 대비 현지 리뷰 비중 추정치 */
  localScore: number;
  note?: string;
  openHint?: string;
  source: 'google' | 'local';
  mapUrl?: string;
}

export interface Settings {
  googleMapsApiKey: string;
  /** 실제 시작이 밀리면 이후 일정을 자동으로 밀어줄지 */
  autoShift: boolean;
  /** 출발 알림을 몇 분 전에 띄울지 */
  departureAlertMin: number;
  notificationsEnabled: boolean;
  /** 현지인 맛집 필터 최소 점수 */
  minLocalScore: number;
  theme: 'system' | 'light' | 'dark';
}

export type TabKey = 'plan' | 'map' | 'food' | 'cost' | 'settings';
