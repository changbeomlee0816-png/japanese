import type { Category, Item, LatLng, Trip } from '../types';
import { uid } from './id';
import { addDaysISO, todayISO } from './time';
import { lookupPoi } from '../data/poi';

function mk(
  title: string,
  category: Category,
  startTime: string,
  durationMin: number,
  cost: number,
  notes?: string,
  /** 내장 사전에 없는 가게는 좌표를 직접 준다 */
  coord?: LatLng,
): Item {
  const poi = coord ? { name: title, area: '', coord } : lookupPoi(title);
  return {
    id: uid('item'),
    title,
    category,
    place: poi
      ? { name: poi.name, address: poi.area ? `${poi.area} (내장 데이터)` : undefined, coord: poi.coord, source: 'local' }
      : { name: title },
    startTime,
    durationMin,
    cost,
    notes,
  };
}

/** 처음 열었을 때 보여줄 예시 여행 — 바로 감을 잡고 수정해서 쓰라는 용도 */
export function createSampleTrip(): Trip {
  const d1 = todayISO();

  return {
    id: uid('trip'),
    title: '도쿄 3일',
    destination: '도쿄',
    regionId: 'tokyo',
    currency: 'JPY',
    rateToKRW: 9.4,
    travelers: 2,
    updatedAt: new Date().toISOString(),
    saved: [],
    days: [
      {
        id: uid('day'),
        date: d1,
        title: '아사쿠사 · 스카이트리',
        items: [
          mk('나리타 국제공항', 'transport', '09:30', 60, 0, '입국 심사 + 스이카 충전'),
          mk('아사쿠사 센소지', 'sight', '12:00', 90, 0, '가미나리몬 사진'),
          mk('도쿄 스카이트리', 'sight', '14:30', 90, 2100, '전망대 티켓 미리 예약'),
          mk('우에노 공원', 'sight', '17:00', 60, 0),
          mk('토리키조쿠 (鳥貴族)', 'food', '19:00', 90, 3000, '균일가 야키토리', { lat: 35.6604, lng: 139.7005 }),
        ],
      },
      {
        id: uid('day'),
        date: addDaysISO(d1, 1),
        title: '시부야 · 하라주쿠',
        items: [
          mk('메이지 신궁', 'sight', '09:30', 70, 0),
          mk('하라주쿠 다케시타 거리', 'shopping', '11:20', 80, 4000),
          mk('시부야 스크램블 교차로', 'sight', '13:30', 60, 0, '스타벅스 2층에서 보기'),
          mk('나카메구로', 'cafe', '15:30', 90, 1200, '메구로강 산책'),
          mk('신주쿠역', 'food', '19:00', 100, 3500, '오모이데요코초 이자카야'),
        ],
      },
      {
        id: uid('day'),
        date: addDaysISO(d1, 2),
        title: '츠키지 · 긴자 · 귀국',
        items: [
          mk('츠키지 장외시장', 'food', '08:30', 80, 2500, '계란말이 · 참치덮밥'),
          mk('긴자', 'shopping', '10:30', 90, 8000),
          mk('도쿄역', 'transport', '13:00', 40, 0, '에키벤 구입'),
          mk('나리타 국제공항', 'transport', '15:30', 90, 0, '3시간 전 도착'),
        ],
      },
    ],
  };
}
