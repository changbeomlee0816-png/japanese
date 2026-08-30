import type { Category, LatLng } from '../types';

/**
 * 내장 장소 사전.
 *
 * 두 가지 일을 한다.
 *  1) 자유 텍스트로 적은 일정을 좌표로 바꾸는 지오코딩 폴백 (Google 키가 없어도 동작)
 *  2) 지역별 "둘러보기" 목록 — blurb 가 있는 항목이 추천 카드로 노출된다
 *
 * Google Maps 키가 있으면 검색 결과가 항상 우선한다.
 */
export interface PoiEntry {
  name: string;
  coord: LatLng;
  /** 표시용 지역 이름 */
  area: string;
  /** regions.ts 의 Region.id */
  regionId: string;
  aliases: string[];
  category?: Category;
  /** 한 줄 소개 — 있으면 둘러보기 목록에 나온다 */
  blurb?: string;
  /** 보통 얼마나 머무는지(분) */
  stayMin?: number;
  /** 대표 명소 — 둘러보기 상단에 먼저 나온다 */
  top?: boolean;
  tags?: string[];
  /** 일반적인 영업시간. 계절·요일에 따라 달라지므로 참고용 경고에만 쓴다 */
  hours?: { open: string; close: string; /** 0=일요일 */ closedDays?: number[] };
}

export const POI: PoiEntry[] = [
  // ── 도쿄 ─────────────────────────────────────────────
  { name: '나리타 국제공항', coord: { lat: 35.772, lng: 140.3929 }, area: '도쿄', regionId: 'tokyo', category: 'transport', stayMin: 60, aliases: ['나리타공항', '나리타', 'narita', 'nrt', '成田空港'] },
  { name: '하네다 공항', coord: { lat: 35.5494, lng: 139.7798 }, area: '도쿄', regionId: 'tokyo', category: 'transport', stayMin: 60, aliases: ['하네다공항', '하네다', 'haneda', 'hnd', '羽田空港'] },
  { name: '도쿄역', coord: { lat: 35.6812, lng: 139.7671 }, area: '도쿄', regionId: 'tokyo', category: 'transport', stayMin: 40, blurb: '붉은 벽돌 역사와 지하 상점가. 에키벤 사기 좋다', aliases: ['tokyo station', '동경역', '東京駅'] },
  { name: '아사쿠사 센소지', coord: { lat: 35.7148, lng: 139.7967 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 90, top: true, blurb: '도쿄에서 가장 오래된 절. 가미나리몬과 나카미세 거리', tags: ['역사', '사진'], hours: { open: '06:00', close: '17:00' }, aliases: ['아사쿠사', 'asakusa', 'sensoji', '센소지', '浅草', '雷門', '가미나리몬'] },
  { name: '시부야 스크램블 교차로', coord: { lat: 35.6595, lng: 139.7005 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 60, top: true, blurb: '세계에서 가장 붐비는 횡단보도. 밤에 더 좋다', tags: ['야경', '사진'], aliases: ['시부야', 'shibuya', '渋谷', '스크램블'] },
  { name: '도쿄 스카이트리', coord: { lat: 35.7101, lng: 139.8107 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 90, top: true, blurb: '634m 전망대. 해질녘 티켓은 미리 예약', tags: ['전망', '야경'], hours: { open: '10:00', close: '22:00' }, aliases: ['스카이트리', 'skytree', 'スカイツリー'] },
  { name: '메이지 신궁', coord: { lat: 35.6764, lng: 139.6993 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 70, blurb: '도심 한복판의 울창한 숲길. 아침이 조용하다', tags: ['자연', '역사'], hours: { open: '05:00', close: '18:00' }, aliases: ['메이지신궁', 'meiji shrine', '明治神宮'] },
  { name: '하라주쿠 다케시타 거리', coord: { lat: 35.6702, lng: 139.7027 }, area: '도쿄', regionId: 'tokyo', category: 'shopping', stayMin: 80, blurb: '10대 패션과 크레페. 주말엔 발 디딜 틈이 없다', aliases: ['하라주쿠', 'harajuku', '原宿', '다케시타도리'] },
  { name: '도쿄 타워', coord: { lat: 35.6586, lng: 139.7454 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 70, blurb: '스카이트리보다 낮지만 시내가 더 가깝게 보인다', tags: ['전망', '야경'], hours: { open: '09:00', close: '22:30' }, aliases: ['도쿄타워', 'tokyo tower', '東京タワー'] },
  { name: '우에노 공원', coord: { lat: 35.7148, lng: 139.7737 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 90, blurb: '박물관과 동물원이 모여 있는 공원. 봄엔 벚꽃 명소', tags: ['자연', '박물관'], aliases: ['우에노', 'ueno', '上野'] },
  { name: '아키하바라', coord: { lat: 35.6984, lng: 139.7731 }, area: '도쿄', regionId: 'tokyo', category: 'shopping', stayMin: 90, blurb: '애니메이션·게임·전자상가. 층마다 세계가 다르다', aliases: ['akihabara', '秋葉原', '아키바'] },
  { name: '긴자', coord: { lat: 35.6717, lng: 139.765 }, area: '도쿄', regionId: 'tokyo', category: 'shopping', stayMin: 90, blurb: '백화점과 플래그십. 주말 낮엔 차 없는 거리', aliases: ['ginza', '銀座'] },
  { name: '츠키지 장외시장', coord: { lat: 35.6654, lng: 139.7707 }, area: '도쿄', regionId: 'tokyo', category: 'food', stayMin: 80, top: true, blurb: '아침 해산물과 계란말이. 오후엔 대부분 닫는다', tags: ['시장', '아침'], hours: { open: '05:00', close: '14:00', closedDays: [0] }, aliases: ['츠키지', 'tsukiji', '築地'] },
  { name: '도요스 시장', coord: { lat: 35.6449, lng: 139.786 }, area: '도쿄', regionId: 'tokyo', category: 'food', stayMin: 90, blurb: '참치 경매를 볼 수 있는 새 수산시장. 예약 필요', tags: ['시장', '아침'], hours: { open: '05:00', close: '14:00', closedDays: [0] }, aliases: ['도요스', 'toyosu', '豊洲'] },
  { name: '오다이바', coord: { lat: 35.6297, lng: 139.7756 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 120, blurb: '바다 건너 도쿄 야경과 레인보우 브리지', tags: ['야경', '가족'], aliases: ['odaiba', 'お台場'] },
  { name: '신주쿠 교엔', coord: { lat: 35.6852, lng: 139.71 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 80, blurb: '넓고 잘 가꾼 정원. 벚꽃과 단풍 모두 좋다', tags: ['자연'], hours: { open: '09:00', close: '18:00', closedDays: [1] }, aliases: ['신주쿠교엔', 'shinjuku gyoen', '新宿御苑'] },
  { name: '시모키타자와', coord: { lat: 35.6613, lng: 139.668 }, area: '도쿄', regionId: 'tokyo', category: 'shopping', stayMin: 100, blurb: '빈티지 옷가게와 작은 카페가 모인 동네', tags: ['카페', '빈티지'], aliases: ['시모키타', 'shimokitazawa', '下北沢'] },
  { name: '나카메구로', coord: { lat: 35.644, lng: 139.6987 }, area: '도쿄', regionId: 'tokyo', category: 'cafe', stayMin: 90, blurb: '메구로강 산책과 감각적인 카페들. 벚꽃철이 절정', tags: ['카페', '산책'], aliases: ['nakameguro', '中目黒'] },
  { name: '롯폰기 힐즈', coord: { lat: 35.6604, lng: 139.7292 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 90, blurb: '전망대와 미술관. 도쿄타워가 가장 예쁘게 보인다', tags: ['전망', '야경'], aliases: ['롯폰기', 'roppongi', '六本木'] },
  { name: '신주쿠역', coord: { lat: 35.6896, lng: 139.7006 }, area: '도쿄', regionId: 'tokyo', category: 'transport', stayMin: 40, blurb: '세계 최대 이용객. 오모이데요코초 골목이 바로 옆', aliases: ['신주쿠', 'shinjuku', '新宿'] },
  { name: '이케부쿠로', coord: { lat: 35.7295, lng: 139.7109 }, area: '도쿄', regionId: 'tokyo', category: 'shopping', stayMin: 90, aliases: ['ikebukuro', '池袋'] },
  { name: '도쿄 디즈니랜드', coord: { lat: 35.6329, lng: 139.8804 }, area: '도쿄', regionId: 'tokyo', category: 'activity', stayMin: 480, blurb: '하루를 통째로 비워야 한다. 티켓은 날짜 지정', tags: ['가족'], hours: { open: '09:00', close: '21:00' }, aliases: ['디즈니랜드', 'disneyland', 'ディズニーランド'] },
  { name: '팀랩 플래닛 도쿄', coord: { lat: 35.6497, lng: 139.79 }, area: '도쿄', regionId: 'tokyo', category: 'activity', stayMin: 90, blurb: '맨발로 물에 들어가는 디지털 아트. 예약 필수', tags: ['전시', '사진'], hours: { open: '09:00', close: '22:00' }, aliases: ['팀랩', 'teamlab', 'チームラボ'] },
  { name: '기치조지', coord: { lat: 35.7031, lng: 139.5797 }, area: '도쿄', regionId: 'tokyo', category: 'sight', stayMin: 100, blurb: '이노카시라 공원과 골목 상점가. 살고 싶은 동네 1위', tags: ['자연', '산책'], aliases: ['kichijoji', '吉祥寺', '이노카시라공원'] },
  { name: '지브리 미술관', coord: { lat: 35.6962, lng: 139.5704 }, area: '도쿄', regionId: 'tokyo', category: 'activity', stayMin: 120, blurb: '한 달 전 예약 필수. 사진 촬영 금지', tags: ['가족', '전시'], hours: { open: '10:00', close: '18:00', closedDays: [2] }, aliases: ['ghibli', '지브리', 'ジブリ美術館'] },

  // ── 교토 ─────────────────────────────────────────────
  { name: '교토역', coord: { lat: 34.9858, lng: 135.7588 }, area: '교토', regionId: 'kyoto', category: 'transport', stayMin: 40, aliases: ['kyoto station', '京都駅'] },
  { name: '기요미즈데라', coord: { lat: 34.9949, lng: 135.785 }, area: '교토', regionId: 'kyoto', category: 'sight', stayMin: 90, top: true, blurb: '절벽에 걸친 목조 무대. 언덕길 상점가와 함께 걷는다', tags: ['역사', '사진'], hours: { open: '06:00', close: '18:00' }, aliases: ['청수사', 'kiyomizu', '清水寺', '기요미즈'] },
  { name: '후시미 이나리 신사', coord: { lat: 34.9671, lng: 135.7727 }, area: '교토', regionId: 'kyoto', category: 'sight', stayMin: 100, top: true, blurb: '붉은 토리이가 산으로 이어진다. 이른 아침이 한산', tags: ['사진', '등산'], hours: { open: '00:00', close: '23:59' }, aliases: ['후시미이나리', 'fushimi inari', '伏見稲荷', '천개의토리이'] },
  { name: '아라시야마 대나무숲', coord: { lat: 35.017, lng: 135.6717 }, area: '교토', regionId: 'kyoto', category: 'sight', stayMin: 120, top: true, blurb: '대나무 길과 도게츠교. 원숭이 공원도 가까이', tags: ['자연', '사진'], aliases: ['아라시야마', 'arashiyama', '嵐山', '치쿠린'] },
  { name: '킨카쿠지', coord: { lat: 35.0394, lng: 135.7292 }, area: '교토', regionId: 'kyoto', category: 'sight', stayMin: 60, top: true, blurb: '금박을 입힌 누각이 연못에 비친다', tags: ['역사', '사진'], hours: { open: '09:00', close: '17:00' }, aliases: ['금각사', 'kinkakuji', '金閣寺'] },
  { name: '긴카쿠지', coord: { lat: 35.027, lng: 135.7982 }, area: '교토', regionId: 'kyoto', category: 'sight', stayMin: 70, blurb: '소박한 정원. 철학의 길과 이어 걷기 좋다', tags: ['자연', '산책'], hours: { open: '08:30', close: '17:00' }, aliases: ['은각사', 'ginkakuji', '銀閣寺'] },
  { name: '기온', coord: { lat: 35.0037, lng: 135.7754 }, area: '교토', regionId: 'kyoto', category: 'sight', stayMin: 80, blurb: '목조 찻집이 늘어선 화류계 거리. 해질녘이 좋다', tags: ['야경', '역사'], aliases: ['gion', '祇園', '하나미코지'] },
  { name: '니시키 시장', coord: { lat: 35.005, lng: 135.7648 }, area: '교토', regionId: 'kyoto', category: 'food', stayMin: 70, top: true, blurb: '400년 된 부엌. 서서 먹는 주전부리가 많다', tags: ['시장'], hours: { open: '09:30', close: '18:00' }, aliases: ['니시키시장', 'nishiki', '錦市場'] },
  { name: '니조성', coord: { lat: 35.0142, lng: 135.7481 }, area: '교토', regionId: 'kyoto', category: 'sight', stayMin: 80, blurb: '밟으면 소리 나는 마루. 쇼군의 교토 거처', tags: ['역사'], hours: { open: '08:45', close: '17:00' }, aliases: ['nijo castle', '二条城'] },
  { name: '폰토초', coord: { lat: 35.0064, lng: 135.7707 }, area: '교토', regionId: 'kyoto', category: 'food', stayMin: 90, blurb: '강변 좁은 골목의 식당가. 여름엔 강 위 자리', tags: ['야경'], aliases: ['pontocho', '先斗町'] },
  { name: '산넨자카', coord: { lat: 34.9967, lng: 135.7808 }, area: '교토', regionId: 'kyoto', category: 'shopping', stayMin: 60, blurb: '기요미즈데라로 오르는 돌계단 상점가', tags: ['사진'], aliases: ['니넨자카', '産寧坂', 'sannenzaka'] },
  { name: '헤이안 신궁', coord: { lat: 35.016, lng: 135.7823 }, area: '교토', regionId: 'kyoto', category: 'sight', stayMin: 60, hours: { open: '06:00', close: '18:00' }, aliases: ['헤이안신궁', 'heian', '平安神宮'] },

  // ── 오사카 ───────────────────────────────────────────
  { name: '도톤보리', coord: { lat: 34.6687, lng: 135.5013 }, area: '오사카', regionId: 'osaka', category: 'food', stayMin: 90, top: true, blurb: '글리코 간판과 먹거리 골목. 밤이 본무대', tags: ['야경', '먹거리'], aliases: ['dotonbori', '道頓堀', '글리코'] },
  { name: '오사카성', coord: { lat: 34.6873, lng: 135.5262 }, area: '오사카', regionId: 'osaka', category: 'sight', stayMin: 90, top: true, blurb: '천수각과 넓은 공원. 벚꽃철에 특히 붐빈다', tags: ['역사', '자연'], hours: { open: '09:00', close: '17:00' }, aliases: ['osaka castle', '大阪城'] },
  { name: '구로몬 시장', coord: { lat: 34.6657, lng: 135.5062 }, area: '오사카', regionId: 'osaka', category: 'food', stayMin: 70, top: true, blurb: '해산물을 그 자리에서 구워 준다. 오전이 신선', tags: ['시장'], hours: { open: '09:00', close: '18:00' }, aliases: ['구로몬시장', 'kuromon', '黒門市場'] },
  { name: '유니버설 스튜디오 재팬', coord: { lat: 34.6654, lng: 135.4323 }, area: '오사카', regionId: 'osaka', category: 'activity', stayMin: 480, blurb: '하루 통째로. 익스프레스 패스는 미리 사두면 편하다', tags: ['가족'], hours: { open: '09:00', close: '21:00' }, aliases: ['usj', 'universal', '유니버셜', 'ユニバ'] },
  { name: '신세카이 · 츠텐카쿠', coord: { lat: 34.6524, lng: 135.5063 }, area: '오사카', regionId: 'osaka', category: 'sight', stayMin: 70, blurb: '쇼와 시대가 그대로 남은 거리. 쿠시카츠의 본거지', tags: ['레트로'], aliases: ['신세카이', '츠텐카쿠', 'shinsekai', 'tsutenkaku', '通天閣'] },
  { name: '신사이바시', coord: { lat: 34.6738, lng: 135.501 }, area: '오사카', regionId: 'osaka', category: 'shopping', stayMin: 90, blurb: '지붕 덮인 긴 상점가. 비 오는 날에도 걷기 좋다', aliases: ['shinsaibashi', '心斎橋'] },
  { name: '아메리카무라', coord: { lat: 34.672, lng: 135.4985 }, area: '오사카', regionId: 'osaka', category: 'shopping', stayMin: 70, blurb: '오사카의 젊은 거리. 빈티지와 스트리트 패션', tags: ['빈티지'], aliases: ['아메무라', 'amerikamura', 'アメ村'] },
  { name: '오사카역 · 우메다', coord: { lat: 34.7025, lng: 135.4959 }, area: '오사카', regionId: 'osaka', category: 'transport', stayMin: 60, blurb: '공중정원 전망대와 백화점이 모인 북쪽 중심', tags: ['전망'], aliases: ['우메다', 'umeda', '梅田', 'osaka station', '오사카역'] },
  { name: '난바역', coord: { lat: 34.6659, lng: 135.5015 }, area: '오사카', regionId: 'osaka', category: 'transport', stayMin: 30, aliases: ['난바', 'namba', '難波'] },
  { name: '간사이 국제공항', coord: { lat: 34.4342, lng: 135.2328 }, area: '오사카', regionId: 'osaka', category: 'transport', stayMin: 60, aliases: ['간사이공항', 'kansai', 'kix', '関西空港'] },

  // ── 나라 · 고베 ──────────────────────────────────────
  { name: '나라 공원', coord: { lat: 34.6851, lng: 135.843 }, area: '나라', regionId: 'nara', category: 'sight', stayMin: 120, top: true, blurb: '사슴이 자유롭게 다닌다. 센베는 사자마자 몰려든다', tags: ['자연', '가족'], hours: { open: '00:00', close: '23:59' }, aliases: ['나라', 'nara', '奈良', '사슴공원'] },
  { name: '도다이지', coord: { lat: 34.689, lng: 135.8398 }, area: '나라', regionId: 'nara', category: 'sight', stayMin: 70, top: true, blurb: '세계 최대급 목조 건물과 대불', tags: ['역사'], hours: { open: '07:30', close: '17:30' }, aliases: ['동대사', 'todaiji', '東大寺'] },
  { name: '고베 산노미야', coord: { lat: 34.6949, lng: 135.1955 }, area: '고베', regionId: 'kobe', category: 'shopping', stayMin: 90, blurb: '고베의 중심가. 여기서 이진칸과 항구로 갈린다', aliases: ['고베', 'kobe', 'sannomiya', '三宮'] },
  { name: '기타노 이진칸', coord: { lat: 34.701, lng: 135.19 }, area: '고베', regionId: 'kobe', category: 'sight', stayMin: 90, blurb: '언덕 위 서양식 저택 거리. 항구가 내려다보인다', tags: ['사진'], aliases: ['기타노', 'kitano', '北野異人館'] },
  { name: '히메지성', coord: { lat: 34.8394, lng: 134.6939 }, area: '히메지', regionId: 'kobe', category: 'sight', stayMin: 120, blurb: '원형 그대로 남은 백로성. 오사카에서 1시간', tags: ['역사'], hours: { open: '09:00', close: '17:00' }, aliases: ['히메지', 'himeji', '姫路城'] },

  // ── 하코네 · 후지 ────────────────────────────────────
  { name: '하코네유모토', coord: { lat: 35.2323, lng: 139.1067 }, area: '하코네', regionId: 'hakone', category: 'stay', stayMin: 60, blurb: '온천 마을의 입구. 여기서 순환 코스가 시작된다', tags: ['온천'], aliases: ['하코네', 'hakone', '箱根湯本'] },
  { name: '오와쿠다니', coord: { lat: 35.2443, lng: 139.0195 }, area: '하코네', regionId: 'hakone', category: 'sight', stayMin: 60, top: true, blurb: '화산 연기와 검은 달걀. 로프웨이로 오른다', tags: ['자연'], hours: { open: '09:00', close: '16:00' }, aliases: ['owakudani', '大涌谷'] },
  { name: '가와구치코', coord: { lat: 35.5104, lng: 138.7689 }, area: '후지', regionId: 'fuji', category: 'sight', stayMin: 120, top: true, blurb: '호수에 비친 후지산. 오전에 구름이 덜 낀다', tags: ['자연', '사진'], aliases: ['카와구치코', 'kawaguchiko', '河口湖'] },
  { name: '후지산 5합목', coord: { lat: 35.3606, lng: 138.7274 }, area: '후지', regionId: 'fuji', category: 'sight', stayMin: 90, blurb: '차로 갈 수 있는 가장 높은 곳. 겨울엔 통제', tags: ['자연'], aliases: ['후지산', 'mt fuji', '富士山'] },

  // ── 홋카이도 ─────────────────────────────────────────
  { name: '삿포로역', coord: { lat: 43.0687, lng: 141.3508 }, area: '삿포로', regionId: 'sapporo', category: 'transport', stayMin: 40, aliases: ['삿포로', 'sapporo', '札幌駅'] },
  { name: '오도리 공원', coord: { lat: 43.0606, lng: 141.3565 }, area: '삿포로', regionId: 'sapporo', category: 'sight', stayMin: 60, top: true, blurb: '도심을 가로지르는 긴 공원. 겨울엔 눈축제', tags: ['자연'], aliases: ['오도리', 'odori', '大通公園'] },
  { name: '스스키노', coord: { lat: 43.0554, lng: 141.3534 }, area: '삿포로', regionId: 'sapporo', category: 'food', stayMin: 120, top: true, blurb: '홋카이도 최대 번화가. 라멘 골목과 징기스칸', tags: ['야경', '먹거리'], aliases: ['susukino', 'すすきの'] },
  { name: '니조 시장', coord: { lat: 43.0578, lng: 141.3549 }, area: '삿포로', regionId: 'sapporo', category: 'food', stayMin: 60, blurb: '아침 해산물 덮밥. 성게와 연어알이 유명', tags: ['시장', '아침'], hours: { open: '07:00', close: '18:00' }, aliases: ['니조시장', 'nijo market', '二条市場'] },
  { name: '오타루 운하', coord: { lat: 43.199, lng: 141.0032 }, area: '오타루', regionId: 'otaru', category: 'sight', stayMin: 90, top: true, blurb: '가스등이 켜지는 저녁이 가장 예쁘다', tags: ['야경', '사진'], aliases: ['오타루', 'otaru', '小樽'] },
  { name: '신치토세 공항', coord: { lat: 42.7752, lng: 141.6923 }, area: '삿포로', regionId: 'sapporo', category: 'transport', stayMin: 90, blurb: '공항 자체가 관광지. 먹거리와 상점이 많다', aliases: ['신치토세', 'chitose', 'cts', '新千歳空港'] },

  // ── 규슈 ─────────────────────────────────────────────
  { name: '하카타역', coord: { lat: 33.5897, lng: 130.4207 }, area: '후쿠오카', regionId: 'fukuoka', category: 'transport', stayMin: 60, blurb: '역 안에 백화점과 라멘 거리가 다 있다', aliases: ['하카타', 'hakata', '博多駅'] },
  { name: '텐진', coord: { lat: 33.5914, lng: 130.3989 }, area: '후쿠오카', regionId: 'fukuoka', category: 'shopping', stayMin: 90, top: true, blurb: '후쿠오카 최대 번화가. 지하상가가 넓다', aliases: ['tenjin', '天神'] },
  { name: '나카스 포장마차 거리', coord: { lat: 33.593, lng: 130.406 }, area: '후쿠오카', regionId: 'fukuoka', category: 'food', stayMin: 90, top: true, blurb: '해 지면 강변에 야타이가 늘어선다. 현금 준비', tags: ['야경', '먹거리'], hours: { open: '18:00', close: '02:00' }, aliases: ['나카스', 'nakasu', '中洲', '야타이'] },
  { name: '다자이후 텐만구', coord: { lat: 33.5215, lng: 130.535 }, area: '후쿠오카', regionId: 'fukuoka', category: 'sight', stayMin: 90, top: true, blurb: '학문의 신을 모신 신사. 참배길 매화떡이 명물', tags: ['역사'], hours: { open: '06:30', close: '19:00' }, aliases: ['다자이후', 'dazaifu', '太宰府'] },
  { name: '후쿠오카 공항', coord: { lat: 33.5859, lng: 130.4508 }, area: '후쿠오카', regionId: 'fukuoka', category: 'transport', stayMin: 60, blurb: '지하철로 하카타역까지 5분. 세계에서 손꼽히게 가깝다', aliases: ['fuk', '福岡空港'] },
  { name: '유후인', coord: { lat: 33.2645, lng: 131.356 }, area: '오이타', regionId: 'yufuin', category: 'sight', stayMin: 180, top: true, blurb: '온천과 아기자기한 상점가. 킨린코 호수까지 걸어서', tags: ['온천'], aliases: ['yufuin', '由布院'] },
  { name: '벳푸 지옥순례', coord: { lat: 33.2794, lng: 131.5006 }, area: '오이타', regionId: 'yufuin', category: 'sight', stayMin: 150, blurb: '색이 다른 온천 웅덩이 일곱 곳을 도는 코스', tags: ['온천'], hours: { open: '08:00', close: '17:00' }, aliases: ['벳푸', 'beppu', '別府'] },

  // ── 그 외 ────────────────────────────────────────────
  { name: '나고야역', coord: { lat: 35.1706, lng: 136.8816 }, area: '나고야', regionId: 'nagoya', category: 'transport', stayMin: 40, aliases: ['나고야', 'nagoya', '名古屋駅'] },
  { name: '오스칸논', coord: { lat: 35.1595, lng: 136.9008 }, area: '나고야', regionId: 'nagoya', category: 'shopping', stayMin: 90, top: true, blurb: '절 앞 상점가. 빈티지와 먹거리가 섞여 있다', tags: ['빈티지'], aliases: ['오스', 'osu', '大須観音'] },
  { name: '히로시마 평화기념공원', coord: { lat: 34.3955, lng: 132.4536 }, area: '히로시마', regionId: 'hiroshima', category: 'sight', stayMin: 120, top: true, blurb: '원폭 돔과 자료관. 시간을 넉넉히 두는 편이 좋다', tags: ['역사'], hours: { open: '08:30', close: '18:00' }, aliases: ['히로시마', 'hiroshima', '平和記念公園'] },
  { name: '미야지마 이쓰쿠시마 신사', coord: { lat: 34.296, lng: 132.3197 }, area: '히로시마', regionId: 'hiroshima', category: 'sight', stayMin: 180, top: true, blurb: '바다 위에 뜬 붉은 도리이. 페리로 10분', tags: ['사진', '자연'], hours: { open: '06:30', close: '18:00' }, aliases: ['미야지마', 'miyajima', '厳島神社'] },
  { name: '겐로쿠엔', coord: { lat: 36.562, lng: 136.6624 }, area: '가나자와', regionId: 'kanazawa', category: 'sight', stayMin: 90, top: true, blurb: '일본 3대 정원. 계절마다 표정이 완전히 다르다', tags: ['자연'], hours: { open: '07:00', close: '18:00' }, aliases: ['가나자와', 'kanazawa', 'kenrokuen', '兼六園'] },
  { name: '히가시차야가이', coord: { lat: 36.5721, lng: 136.6668 }, area: '가나자와', regionId: 'kanazawa', category: 'sight', stayMin: 70, blurb: '금박 공예와 옛 찻집 거리', tags: ['역사'], aliases: ['히가시차야', 'higashi chaya', 'ひがし茶屋街'] },
  { name: '나하 국제거리', coord: { lat: 26.216, lng: 127.687 }, area: '오키나와', regionId: 'okinawa', category: 'shopping', stayMin: 120, top: true, blurb: '나하의 중심 거리. 기념품과 이자카야가 늘어선다', aliases: ['오키나와', '나하', 'naha', 'okinawa', '国際通り'] },
  { name: '츄라우미 수족관', coord: { lat: 26.6944, lng: 127.8779 }, area: '오키나와', regionId: 'okinawa', category: 'activity', stayMin: 180, top: true, blurb: '거대 수조의 고래상어. 나하에서 차로 2시간', tags: ['가족'], hours: { open: '08:30', close: '18:30' }, aliases: ['츄라우미', 'churaumi', '美ら海水族館'] },
  { name: '나하 공항', coord: { lat: 26.1958, lng: 127.6458 }, area: '오키나와', regionId: 'okinawa', category: 'transport', stayMin: 60, aliases: ['naha airport', 'oka', '那覇空港'] },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s·・,.'"()\-–—]/g, '');
}

/** 자유 텍스트에서 가장 잘 맞는 장소를 찾는다. 확신이 낮으면 null */
export function lookupPoi(query: string): PoiEntry | null {
  const q = normalize(query);
  if (q.length < 2) return null;

  let best: { entry: PoiEntry; score: number } | null = null;

  for (const entry of POI) {
    const candidates = [entry.name, ...entry.aliases].map(normalize);
    for (const c of candidates) {
      let score = 0;
      if (c === q) score = 100;
      else if (q.includes(c) && c.length >= 2) score = 60 + c.length;
      else if (c.includes(q) && q.length >= 3) score = 40 + q.length;
      if (score > (best?.score ?? 0)) best = { entry, score };
    }
  }
  return best && best.score >= 40 ? best.entry : null;
}

/** 목적지 이름으로 지역 중심 좌표 추정 (지도 초기 위치용) */
export function lookupArea(destination: string): LatLng | null {
  const hit = lookupPoi(destination);
  if (hit) return hit.coord;
  const q = normalize(destination);
  const byArea = POI.find((p) => normalize(p.area) === q || q.includes(normalize(p.area)));
  return byArea ? byArea.coord : null;
}

/** 둘러보기용 — 지역에 속한, 소개글이 있는 장소들 */
export function spotsForRegion(regionId: string): PoiEntry[] {
  return POI.filter((p) => p.regionId === regionId && !!p.blurb).sort((a, b) => {
    if (!!a.top !== !!b.top) return a.top ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });
}
