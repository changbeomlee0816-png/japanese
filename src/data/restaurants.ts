import type { Restaurant } from '../types';

/**
 * 내장 "현지인 추천" 맛집 데이터.
 *
 * API 키가 없을 때의 오프라인 폴백이며, 참고용 큐레이션이다.
 * 영업시간·가격·평점은 수시로 바뀌므로 UI에서 참고용임을 명시하고,
 * 키가 있으면 Google Places Nearby Search 결과가 우선한다.
 *
 * localScore: 관광객보다 현지인 비중이 높다고 알려진 정도(주관적 큐레이션 지표).
 */
type Seed = Omit<Restaurant, 'id' | 'source'>;

const seeds: Seed[] = [
  // ── 도쿄 ─────────────────────────────────────────────
  { name: '오레류 시오라멘 (俺流塩らーめん)', genre: '라멘', coord: { lat: 35.6931, lng: 139.7005 }, rating: 4.1, reviewCount: 3200, priceLevel: 1, address: '도쿄 신주쿠', localScore: 78, note: '맑은 시오라멘. 늦게까지 열어 야근족이 많다.', openHint: '대부분 24시간' },
  { name: '후운지 (風雲児)', genre: '츠케멘', coord: { lat: 35.6884, lng: 139.6949 }, rating: 4.3, reviewCount: 5100, priceLevel: 1, address: '도쿄 신주쿠', localScore: 82, note: '닭+생선 육수 츠케멘. 점심 줄이 길어 11시 전 도착 추천.', openHint: '11:00–15:00, 17:00–21:00' },
  { name: '우오가시 니혼이치 (魚がし日本一)', genre: '서서 먹는 스시', coord: { lat: 35.6952, lng: 139.7031 }, rating: 4.0, reviewCount: 2400, priceLevel: 2, address: '도쿄 신주쿠', localScore: 74, note: '서서 먹는 스탠딩 스시. 퇴근길 직장인 단골.', openHint: '11:00–23:00' },
  { name: '텐동 텐야 (てんや)', genre: '텐동', coord: { lat: 35.6816, lng: 139.7665 }, rating: 3.8, reviewCount: 1800, priceLevel: 1, address: '도쿄 전역 체인', localScore: 70, note: '가성비 텐동 체인. 혼밥하기 편하다.', openHint: '11:00–22:00' },
  { name: '아사쿠사 이마한 (浅草今半)', genre: '스키야키', coord: { lat: 35.7128, lng: 139.7935 }, rating: 4.4, reviewCount: 2600, priceLevel: 4, address: '도쿄 아사쿠사', localScore: 62, note: '특별한 날 스키야키. 예약 권장.', openHint: '11:30–21:30' },
  { name: '토리키조쿠 (鳥貴族)', genre: '야키토리 이자카야', coord: { lat: 35.6604, lng: 139.7005 }, rating: 3.9, reviewCount: 4200, priceLevel: 1, address: '도쿄 시부야', localScore: 85, note: '전 메뉴 균일가 야키토리. 현지 20~30대가 가장 많이 가는 체인.', openHint: '17:00–01:00' },
  { name: '카츠쿠라 (かつくら)', genre: '돈카츠', coord: { lat: 35.6712, lng: 139.7639 }, rating: 4.2, reviewCount: 2100, priceLevel: 2, address: '도쿄 긴자', localScore: 68, note: '교토식 돈카츠. 밥·양배추 리필.', openHint: '11:00–22:00' },
  { name: '츠키지 스시잔마이 본점', genre: '스시', coord: { lat: 35.666, lng: 139.7702 }, rating: 4.0, reviewCount: 8900, priceLevel: 3, address: '도쿄 츠키지', localScore: 55, note: '24시간 스시. 새벽에도 열려 있어 첫날 야식으로 좋다.', openHint: '24시간' },
  { name: '이치란 시부야점', genre: '돈코츠 라멘', coord: { lat: 35.6595, lng: 139.7017 }, rating: 4.0, reviewCount: 12000, priceLevel: 1, address: '도쿄 시부야', localScore: 45, note: '1인 칸막이석. 관광객 비중이 높은 편.', openHint: '24시간' },
  { name: '킨노토리쿠라 (金の鶏蔵)', genre: '야키토리', coord: { lat: 35.6446, lng: 139.6981 }, rating: 4.2, reviewCount: 900, priceLevel: 2, address: '도쿄 나카메구로', localScore: 88, note: '동네 주민 위주 숯불 야키토리.', openHint: '17:00–24:00' },

  // ── 교토 ─────────────────────────────────────────────
  { name: '이노다 커피 본점 (イノダコーヒ)', genre: '킷사텐', coord: { lat: 35.0086, lng: 135.7621 }, rating: 4.3, reviewCount: 4300, priceLevel: 2, address: '교토 나카교구', localScore: 80, note: '1940년대부터의 교토 킷사텐. 아침 세트가 유명.', openHint: '07:00–18:00' },
  { name: '멘야 이노이치 (麺屋 猪一)', genre: '라멘', coord: { lat: 35.0002, lng: 135.7639 }, rating: 4.4, reviewCount: 2100, priceLevel: 2, address: '교토 시모교구', localScore: 76, note: '가다랑어 육수 라멘. 미슐랭 빕구르망.', openHint: '11:00–15:00, 18:00–21:00' },
  { name: '니시키 시장 노점들', genre: '길거리 음식', coord: { lat: 35.005, lng: 135.7648 }, rating: 4.1, reviewCount: 15000, priceLevel: 1, address: '교토 니시키코지도리', localScore: 58, note: '두유 도넛, 타코타마고 등. 오후 5시면 대부분 닫는다.', openHint: '09:30–18:00' },
  { name: '가츠쿠라 산조점', genre: '돈카츠', coord: { lat: 35.0091, lng: 135.7688 }, rating: 4.2, reviewCount: 3300, priceLevel: 2, address: '교토 산조', localScore: 66, note: '돈카츠 본고장 교토 브랜드.', openHint: '11:00–21:30' },
  { name: '기온 카라코로 (祇園 唐紅)', genre: '오반자이', coord: { lat: 35.0035, lng: 135.7758 }, rating: 4.3, reviewCount: 700, priceLevel: 3, address: '교토 기온', localScore: 84, note: '교토 가정식 오반자이 코스. 카운터 예약제.', openHint: '17:30–22:00' },
  { name: '오멘 긴카쿠지점 (おめん)', genre: '우동', coord: { lat: 35.0265, lng: 135.7961 }, rating: 4.2, reviewCount: 1600, priceLevel: 2, address: '교토 긴카쿠지 앞', localScore: 72, note: '채소 듬뿍 츠케우동. 은각사 산책 후 코스.', openHint: '11:00–21:00' },

  // ── 오사카 ───────────────────────────────────────────
  { name: '하리주 (はり重)', genre: '규카츠·스키야키', coord: { lat: 34.6684, lng: 135.5019 }, rating: 4.3, reviewCount: 2800, priceLevel: 3, address: '오사카 도톤보리', localScore: 70, note: '1919년 창업 정육점 직영. 1층 croquette도 유명.', openHint: '11:30–21:00' },
  { name: '치보 (千房)', genre: '오코노미야키', coord: { lat: 34.6689, lng: 135.5024 }, rating: 4.0, reviewCount: 6400, priceLevel: 2, address: '오사카 도톤보리', localScore: 60, note: '오사카 대표 오코노미야키 체인.', openHint: '11:00–23:00' },
  { name: '다이키 스이산 (大起水産) 회전스시', genre: '회전초밥', coord: { lat: 34.6672, lng: 135.5011 }, rating: 4.1, reviewCount: 5200, priceLevel: 2, address: '오사카 난바', localScore: 79, note: '수산회사 직영이라 회전초밥치고 신선도가 좋다.', openHint: '11:00–23:00' },
  { name: '쿠시카츠 다루마 신세카이 총본점', genre: '쿠시카츠', coord: { lat: 34.6521, lng: 135.5061 }, rating: 4.0, reviewCount: 7100, priceLevel: 1, address: '오사카 신세카이', localScore: 63, note: '소스 두 번 찍기 금지. 원조 격 가게.', openHint: '11:00–22:30' },
  { name: '우메다 타키무라 (滝村)', genre: '이자카야', coord: { lat: 34.7038, lng: 135.4989 }, rating: 4.3, reviewCount: 800, priceLevel: 2, address: '오사카 우메다', localScore: 90, note: '샐러리맨 골목 이자카야. 관광객이 거의 없다.', openHint: '17:00–23:30' },
  { name: '구로몬 하마토쿠 (浜藤)', genre: '복어·해산물', coord: { lat: 34.6655, lng: 135.5063 }, rating: 4.2, reviewCount: 1100, priceLevel: 3, address: '오사카 구로몬시장', localScore: 74, note: '시장 안 복어 전문점. 겨울 추천.', openHint: '11:00–21:00' },

  // ── 후쿠오카 ─────────────────────────────────────────
  { name: '신신 라멘 텐진본점 (Shin Shin)', genre: '하카타 라멘', coord: { lat: 33.5906, lng: 130.3979 }, rating: 4.2, reviewCount: 6800, priceLevel: 1, address: '후쿠오카 텐진', localScore: 76, note: '가는 면·맑은 돈코츠. 현지인도 줄 선다.', openHint: '11:00–03:00' },
  { name: '하카타 모츠나베 오오야마', genre: '모츠나베', coord: { lat: 33.5903, lng: 130.4204 }, rating: 4.3, reviewCount: 5400, priceLevel: 2, address: '후쿠오카 하카타역', localScore: 72, note: '미소 국물 곱창전골. 하카타역 안이라 이동 동선이 좋다.', openHint: '11:00–23:00' },
  { name: '나카스 야타이 (포장마차)', genre: '야타이', coord: { lat: 33.5931, lng: 130.4058 }, rating: 4.0, reviewCount: 9000, priceLevel: 2, address: '후쿠오카 나카스 강변', localScore: 68, note: '해 지면 강변에 열린다. 현금 준비.', openHint: '18:00–02:00' },
  { name: '우오베이 (魚べい) 하카타점', genre: '회전초밥', coord: { lat: 33.5889, lng: 130.4184 }, rating: 4.1, reviewCount: 3100, priceLevel: 1, address: '후쿠오카 하카타', localScore: 86, note: '가족 단위 현지인이 많은 저가 회전초밥.', openHint: '11:00–22:00' },

  // ── 삿포로 ───────────────────────────────────────────
  { name: '스미레 (すみれ) 삿포로 본점', genre: '미소 라멘', coord: { lat: 43.0234, lng: 141.3872 }, rating: 4.4, reviewCount: 4100, priceLevel: 2, address: '삿포로 나카노시마', localScore: 80, note: '진한 미소 라멘의 기준. 시내에서 조금 떨어져 있다.', openHint: '11:00–21:00' },
  { name: '다루마 징기스칸 (だるま) 본점', genre: '징기스칸', coord: { lat: 43.0549, lng: 141.3527 }, rating: 4.3, reviewCount: 6200, priceLevel: 2, address: '삿포로 스스키노', localScore: 71, note: '양고기 구이. 좁고 붐비지만 회전은 빠르다.', openHint: '17:00–23:00' },
  { name: '니조 시장 해산물 덮밥', genre: '카이센동', coord: { lat: 43.0578, lng: 141.3549 }, rating: 4.1, reviewCount: 3800, priceLevel: 3, address: '삿포로 니조시장', localScore: 57, note: '아침 카이센동. 관광객 비중이 높다.', openHint: '07:00–18:00' },
];

export const LOCAL_RESTAURANTS: Restaurant[] = seeds.map((s, i) => ({
  ...s,
  id: `local_${i}`,
  source: 'local' as const,
  mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name)}`,
}));
