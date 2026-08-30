import type { TravelMode } from '../types';

/**
 * 이동 비용 추정 모델.
 *
 * Google Directions API는 대중교통 요금(fare)을 항상 주지 않는다(제공 지역/노선 한정).
 * 그래서 통화권별 요금 체계를 근사식으로 두고, API가 실제 요금을 주면 그 값을 우선 쓴다.
 * 여기 숫자는 "대략 이 정도" 수준의 추정치이며 UI에도 추정임을 표시한다.
 */

interface FareModel {
  /** 대중교통: 기본요금 + 기본거리 초과분 per km, 상한 */
  transit: { base: number; freeKm: number; perKm: number; cap: number };
  /** 장거리(고속철 등) */
  longDistance: { thresholdKm: number; base: number; perKm: number };
  /** 택시: 기본요금 + 기본거리 초과분 per km */
  taxi: { base: number; freeKm: number; perKm: number };
}

const MODELS: Record<string, FareModel> = {
  // 일본: 지하철/사철 기본 180~200엔대, 신칸센은 별도
  JPY: {
    transit: { base: 190, freeKm: 3, perKm: 32, cap: 1400 },
    longDistance: { thresholdKm: 100, base: 5500, perKm: 22 },
    taxi: { base: 500, freeKm: 1.1, perKm: 400 },
  },
  KRW: {
    transit: { base: 1500, freeKm: 10, perKm: 25, cap: 3500 },
    longDistance: { thresholdKm: 100, base: 20000, perKm: 160 },
    taxi: { base: 4800, freeKm: 1.6, perKm: 1000 },
  },
  USD: {
    transit: { base: 2.9, freeKm: 8, perKm: 0.12, cap: 12 },
    longDistance: { thresholdKm: 100, base: 40, perKm: 0.2 },
    taxi: { base: 3.6, freeKm: 1, perKm: 2.2 },
  },
  EUR: {
    transit: { base: 2.2, freeKm: 6, perKm: 0.1, cap: 10 },
    longDistance: { thresholdKm: 100, base: 35, perKm: 0.18 },
    taxi: { base: 4, freeKm: 1, perKm: 2 },
  },
  TWD: {
    transit: { base: 20, freeKm: 5, perKm: 3, cap: 65 },
    longDistance: { thresholdKm: 100, base: 700, perKm: 4 },
    taxi: { base: 85, freeKm: 1.25, perKm: 30 },
  },
  THB: {
    transit: { base: 17, freeKm: 4, perKm: 2.5, cap: 60 },
    longDistance: { thresholdKm: 100, base: 400, perKm: 3 },
    taxi: { base: 35, freeKm: 1, perKm: 12 },
  },
};

const FALLBACK = MODELS.USD;

export function fareModelFor(currency: string): FareModel {
  return MODELS[currency.toUpperCase()] ?? FALLBACK;
}

/** 통화별 반올림 단위 — 엔/원은 10단위, 달러/유로는 0.1단위 */
function roundFare(value: number, currency: string): number {
  const cur = currency.toUpperCase();
  if (cur === 'JPY') return Math.round(value / 10) * 10;
  if (cur === 'KRW') return Math.round(value / 10) * 10;
  if (cur === 'TWD' || cur === 'THB') return Math.round(value);
  return Math.round(value * 10) / 10;
}

/** 1인 기준 이동 요금 추정 (현지 통화) */
export function estimateFare(distanceM: number, mode: TravelMode, currency: string): number {
  const model = fareModelFor(currency);
  const km = distanceM / 1000;

  switch (mode) {
    case 'WALKING':
    case 'BICYCLING':
      return 0;
    case 'DRIVING': {
      const { base, freeKm, perKm } = model.taxi;
      return roundFare(base + Math.max(0, km - freeKm) * perKm, currency);
    }
    case 'TRANSIT':
    default: {
      if (km >= model.longDistance.thresholdKm) {
        const { base, perKm } = model.longDistance;
        return roundFare(base + km * perKm, currency);
      }
      const { base, freeKm, perKm, cap } = model.transit;
      const raw = base + Math.max(0, km - freeKm) * perKm;
      return roundFare(Math.min(raw, cap), currency);
    }
  }
}

const SYMBOL: Record<string, string> = {
  JPY: '¥',
  KRW: '₩',
  USD: '$',
  EUR: '€',
  TWD: 'NT$',
  THB: '฿',
  GBP: '£',
};

export function currencySymbol(currency: string): string {
  return SYMBOL[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

export function formatMoney(value: number, currency: string): string {
  const cur = currency.toUpperCase();
  const decimals = cur === 'JPY' || cur === 'KRW' || cur === 'TWD' ? 0 : value < 100 ? 1 : 0;
  return `${currencySymbol(cur)}${value.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatKRW(value: number): string {
  return `₩${Math.round(value).toLocaleString('ko-KR')}`;
}

/** 통화별 기본 환율(현지 1단위 → KRW). 설정에서 사용자가 덮어쓸 수 있다. */
export const DEFAULT_RATE_TO_KRW: Record<string, number> = {
  JPY: 9.4,
  KRW: 1,
  USD: 1380,
  EUR: 1490,
  TWD: 43,
  THB: 39,
  GBP: 1760,
};

export const MODE_LABEL: Record<TravelMode, string> = {
  WALKING: '도보',
  TRANSIT: '대중교통',
  DRIVING: '택시·차량',
  BICYCLING: '자전거',
};
