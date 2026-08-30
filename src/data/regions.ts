import type { LatLng } from '../types';

/**
 * 여행지(지역) 목록.
 *
 * 새 여행을 만들 때 도시 이름을 직접 타이핑하는 대신 카드에서 고르게 하려고 만들었다.
 * 지역을 고르면 통화·환율·지도 중심·둘러보기 목록이 한 번에 결정된다.
 */
export interface Region {
  id: string;
  name: string;
  /** 한 줄 소개 — 카드에 그대로 나온다 */
  blurb: string;
  country: string;
  currency: string;
  center: LatLng;
  /** 카드 배경 그라디언트 (라이트/다크 공통으로 쓸 수 있는 채도로 고른다) */
  hue: string;
  /** 보통 며칠 잡는지 */
  suggestedDays: number;
  /** 이 지역과 함께 묶어 가기 좋은 곳 */
  nearby?: string[];
  aliases: string[];
}

export const REGIONS: Region[] = [
  {
    id: 'tokyo',
    name: '도쿄',
    blurb: '아사쿠사에서 시부야까지, 옛 동네와 초고층이 한 도시에',
    country: '일본',
    currency: 'JPY',
    center: { lat: 35.6812, lng: 139.7671 },
    hue: '#FF6B6B',
    suggestedDays: 4,
    nearby: ['hakone', 'fuji'],
    aliases: ['tokyo', '동경', '東京'],
  },
  {
    id: 'osaka',
    name: '오사카',
    blurb: '도톤보리 먹거리와 밤거리, 간사이 여행의 거점',
    country: '일본',
    currency: 'JPY',
    center: { lat: 34.6937, lng: 135.5023 },
    hue: '#FF9F43',
    suggestedDays: 3,
    nearby: ['kyoto', 'nara', 'kobe'],
    aliases: ['osaka', '大阪'],
  },
  {
    id: 'kyoto',
    name: '교토',
    blurb: '천 년 고도. 신사와 골목, 계절이 가장 잘 보이는 도시',
    country: '일본',
    currency: 'JPY',
    center: { lat: 35.0116, lng: 135.7681 },
    hue: '#C44569',
    suggestedDays: 3,
    nearby: ['osaka', 'nara'],
    aliases: ['kyoto', '京都'],
  },
  {
    id: 'fukuoka',
    name: '후쿠오카',
    blurb: '가까운 거리, 라멘과 포장마차. 짧게 다녀오기 좋은 곳',
    country: '일본',
    currency: 'JPY',
    center: { lat: 33.5904, lng: 130.4017 },
    hue: '#0FB9B1',
    suggestedDays: 3,
    nearby: ['yufuin'],
    aliases: ['fukuoka', 'hakata', '福岡', '하카타'],
  },
  {
    id: 'sapporo',
    name: '삿포로',
    blurb: '눈과 해산물, 징기스칸. 홋카이도 여행의 시작점',
    country: '일본',
    currency: 'JPY',
    center: { lat: 43.0618, lng: 141.3545 },
    hue: '#4B7BEC',
    suggestedDays: 4,
    nearby: ['otaru'],
    aliases: ['sapporo', '札幌'],
  },
  {
    id: 'nara',
    name: '나라',
    blurb: '사슴과 대불. 오사카·교토에서 당일치기로',
    country: '일본',
    currency: 'JPY',
    center: { lat: 34.6851, lng: 135.843 },
    hue: '#8B7355',
    suggestedDays: 1,
    nearby: ['osaka', 'kyoto'],
    aliases: ['nara', '奈良'],
  },
  {
    id: 'kobe',
    name: '고베',
    blurb: '항구 야경과 이진칸, 그리고 고베규',
    country: '일본',
    currency: 'JPY',
    center: { lat: 34.6901, lng: 135.1955 },
    hue: '#5F27CD',
    suggestedDays: 1,
    nearby: ['osaka', 'kyoto'],
    aliases: ['kobe', '神戸'],
  },
  {
    id: 'hakone',
    name: '하코네',
    blurb: '온천과 화산 지대. 도쿄에서 1박 2일',
    country: '일본',
    currency: 'JPY',
    center: { lat: 35.2323, lng: 139.1067 },
    hue: '#10AC84',
    suggestedDays: 2,
    nearby: ['tokyo', 'fuji'],
    aliases: ['hakone', '箱根'],
  },
  {
    id: 'fuji',
    name: '후지 · 가와구치코',
    blurb: '호수에 비친 후지산. 맑은 날을 노려서',
    country: '일본',
    currency: 'JPY',
    center: { lat: 35.5104, lng: 138.7689 },
    hue: '#2E86DE',
    suggestedDays: 2,
    nearby: ['tokyo', 'hakone'],
    aliases: ['fuji', 'kawaguchiko', '후지산', '가와구치코', '富士'],
  },
  {
    id: 'nagoya',
    name: '나고야',
    blurb: '히츠마부시와 미소카츠. 중부 일본의 관문',
    country: '일본',
    currency: 'JPY',
    center: { lat: 35.1815, lng: 136.9066 },
    hue: '#EE5A24',
    suggestedDays: 2,
    aliases: ['nagoya', '名古屋'],
  },
  {
    id: 'hiroshima',
    name: '히로시마',
    blurb: '평화기념공원과 바다 위 도리이',
    country: '일본',
    currency: 'JPY',
    center: { lat: 34.3853, lng: 132.4553 },
    hue: '#009432',
    suggestedDays: 2,
    aliases: ['hiroshima', '広島', '미야지마'],
  },
  {
    id: 'okinawa',
    name: '오키나와',
    blurb: '에메랄드빛 바다. 일본 안의 다른 나라',
    country: '일본',
    currency: 'JPY',
    center: { lat: 26.2124, lng: 127.6809 },
    hue: '#00B8D9',
    suggestedDays: 4,
    aliases: ['okinawa', 'naha', '沖縄', '나하'],
  },
  {
    id: 'kanazawa',
    name: '가나자와',
    blurb: '겐로쿠엔과 옛 거리. 조용하게 걷기 좋은 도시',
    country: '일본',
    currency: 'JPY',
    center: { lat: 36.5613, lng: 136.6562 },
    hue: '#A55EEA',
    suggestedDays: 2,
    aliases: ['kanazawa', '金沢'],
  },
  {
    id: 'otaru',
    name: '오타루',
    blurb: '운하와 유리공예. 삿포로에서 반나절',
    country: '일본',
    currency: 'JPY',
    center: { lat: 43.1907, lng: 140.9946 },
    hue: '#576574',
    suggestedDays: 1,
    nearby: ['sapporo'],
    aliases: ['otaru', '小樽'],
  },
  {
    id: 'yufuin',
    name: '유후인 · 벳푸',
    blurb: '온천 마을과 지옥순례. 후쿠오카에서 1박',
    country: '일본',
    currency: 'JPY',
    center: { lat: 33.2645, lng: 131.356 },
    hue: '#F79F1F',
    suggestedDays: 2,
    nearby: ['fukuoka'],
    aliases: ['yufuin', 'beppu', '유후인', '벳푸', '由布院'],
  },
];

const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

export function regionById(id: string): Region | undefined {
  return REGION_BY_ID.get(id);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s·・,.'"()\-–—]/g, '');
}

/** 자유 텍스트(예: 기존 여행의 destination)로 지역을 찾는다 */
export function findRegion(query: string): Region | undefined {
  if (!query) return undefined;
  const q = normalize(query);
  return (
    REGIONS.find((r) => normalize(r.name) === q) ??
    REGIONS.find((r) => r.aliases.some((a) => normalize(a) === q)) ??
    REGIONS.find((r) => q.includes(normalize(r.name)) || r.aliases.some((a) => q.includes(normalize(a))))
  );
}
