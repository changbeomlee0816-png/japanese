import type { LatLng } from '../types';

/**
 * 내장 장소 사전.
 *
 * Google Maps API 키가 없어도 "대충 적은 일정"을 좌표로 바꿀 수 있도록 하는 오프라인 폴백이다.
 * 키가 있으면 Places API 결과가 항상 우선한다.
 */
export interface PoiEntry {
  name: string;
  coord: LatLng;
  area: string;
  aliases: string[];
}

export const POI: PoiEntry[] = [
  // ── 도쿄 ─────────────────────────────────────────────
  { name: '나리타 국제공항', coord: { lat: 35.772, lng: 140.3929 }, area: '도쿄', aliases: ['나리타공항', '나리타', 'narita', 'nrt', '成田空港'] },
  { name: '하네다 공항', coord: { lat: 35.5494, lng: 139.7798 }, area: '도쿄', aliases: ['하네다공항', '하네다', 'haneda', 'hnd', '羽田空港'] },
  { name: '도쿄역', coord: { lat: 35.6812, lng: 139.7671 }, area: '도쿄', aliases: ['tokyo station', '동경역', '東京駅'] },
  { name: '신주쿠역', coord: { lat: 35.6896, lng: 139.7006 }, area: '도쿄', aliases: ['신주쿠', 'shinjuku', '新宿'] },
  { name: '시부야 스크램블 교차로', coord: { lat: 35.6595, lng: 139.7005 }, area: '도쿄', aliases: ['시부야', 'shibuya', '渋谷', '스크램블'] },
  { name: '하라주쿠 다케시타 거리', coord: { lat: 35.6702, lng: 139.7027 }, area: '도쿄', aliases: ['하라주쿠', 'harajuku', '原宿', '다케시타도리'] },
  { name: '메이지 신궁', coord: { lat: 35.6764, lng: 139.6993 }, area: '도쿄', aliases: ['메이지신궁', 'meiji shrine', '明治神宮'] },
  { name: '아사쿠사 센소지', coord: { lat: 35.7148, lng: 139.7967 }, area: '도쿄', aliases: ['아사쿠사', 'asakusa', 'sensoji', '센소지', '浅草', '雷門', '가미나리몬'] },
  { name: '도쿄 스카이트리', coord: { lat: 35.7101, lng: 139.8107 }, area: '도쿄', aliases: ['스카이트리', 'skytree', 'スカイツリー'] },
  { name: '도쿄 타워', coord: { lat: 35.6586, lng: 139.7454 }, area: '도쿄', aliases: ['도쿄타워', 'tokyo tower', '東京タワー'] },
  { name: '우에노 공원', coord: { lat: 35.7148, lng: 139.7737 }, area: '도쿄', aliases: ['우에노', 'ueno', '上野'] },
  { name: '아키하바라', coord: { lat: 35.6984, lng: 139.7731 }, area: '도쿄', aliases: ['akihabara', '秋葉原', '아키바'] },
  { name: '긴자', coord: { lat: 35.6717, lng: 139.765 }, area: '도쿄', aliases: ['ginza', '銀座'] },
  { name: '츠키지 장외시장', coord: { lat: 35.6654, lng: 139.7707 }, area: '도쿄', aliases: ['츠키지', 'tsukiji', '築地'] },
  { name: '도요스 시장', coord: { lat: 35.6449, lng: 139.786 }, area: '도쿄', aliases: ['도요스', 'toyosu', '豊洲'] },
  { name: '오다이바', coord: { lat: 35.6297, lng: 139.7756 }, area: '도쿄', aliases: ['odaiba', 'お台場'] },
  { name: '신주쿠 교엔', coord: { lat: 35.6852, lng: 139.71 }, area: '도쿄', aliases: ['신주쿠교엔', 'shinjuku gyoen', '新宿御苑'] },
  { name: '시모키타자와', coord: { lat: 35.6613, lng: 139.668 }, area: '도쿄', aliases: ['시모키타', 'shimokitazawa', '下北沢'] },
  { name: '나카메구로', coord: { lat: 35.644, lng: 139.6987 }, area: '도쿄', aliases: ['nakameguro', '中目黒'] },
  { name: '롯폰기 힐즈', coord: { lat: 35.6604, lng: 139.7292 }, area: '도쿄', aliases: ['롯폰기', 'roppongi', '六本木'] },
  { name: '이케부쿠로', coord: { lat: 35.7295, lng: 139.7109 }, area: '도쿄', aliases: ['ikebukuro', '池袋'] },
  { name: '도쿄 디즈니랜드', coord: { lat: 35.6329, lng: 139.8804 }, area: '도쿄', aliases: ['디즈니랜드', 'disneyland', 'ディズニーランド'] },
  { name: '팀랩 플래닛 도쿄', coord: { lat: 35.6497, lng: 139.79 }, area: '도쿄', aliases: ['팀랩', 'teamlab', 'チームラボ'] },
  { name: '기치조지', coord: { lat: 35.7031, lng: 139.5797 }, area: '도쿄', aliases: ['kichijoji', '吉祥寺', '이노카시라공원'] },
  { name: '지브리 미술관', coord: { lat: 35.6962, lng: 139.5704 }, area: '도쿄', aliases: ['ghibli', '지브리', 'ジブリ美術館'] },

  // ── 교토 ─────────────────────────────────────────────
  { name: '교토역', coord: { lat: 34.9858, lng: 135.7588 }, area: '교토', aliases: ['kyoto station', '京都駅'] },
  { name: '기요미즈데라', coord: { lat: 34.9949, lng: 135.785 }, area: '교토', aliases: ['청수사', 'kiyomizu', '清水寺', '기요미즈'] },
  { name: '후시미 이나리 신사', coord: { lat: 34.9671, lng: 135.7727 }, area: '교토', aliases: ['후시미이나리', 'fushimi inari', '伏見稲荷', '천개의토리이'] },
  { name: '아라시야마 대나무숲', coord: { lat: 35.017, lng: 135.6717 }, area: '교토', aliases: ['아라시야마', 'arashiyama', '嵐山', '치쿠린'] },
  { name: '킨카쿠지', coord: { lat: 35.0394, lng: 135.7292 }, area: '교토', aliases: ['금각사', 'kinkakuji', '金閣寺'] },
  { name: '긴카쿠지', coord: { lat: 35.027, lng: 135.7982 }, area: '교토', aliases: ['은각사', 'ginkakuji', '銀閣寺'] },
  { name: '니조성', coord: { lat: 35.0142, lng: 135.7481 }, area: '교토', aliases: ['nijo castle', '二条城'] },
  { name: '기온', coord: { lat: 35.0037, lng: 135.7754 }, area: '교토', aliases: ['gion', '祇園', '하나미코지'] },
  { name: '폰토초', coord: { lat: 35.0064, lng: 135.7707 }, area: '교토', aliases: ['pontocho', '先斗町'] },
  { name: '니시키 시장', coord: { lat: 35.005, lng: 135.7648 }, area: '교토', aliases: ['니시키시장', 'nishiki', '錦市場'] },
  { name: '산넨자카', coord: { lat: 34.9967, lng: 135.7808 }, area: '교토', aliases: ['니넨자카', '産寧坂', 'sannenzaka'] },
  { name: '헤이안 신궁', coord: { lat: 35.016, lng: 135.7823 }, area: '교토', aliases: ['헤이안신궁', 'heian', '平安神宮'] },

  // ── 오사카 ───────────────────────────────────────────
  { name: '오사카역 · 우메다', coord: { lat: 34.7025, lng: 135.4959 }, area: '오사카', aliases: ['우메다', 'umeda', '梅田', 'osaka station', '오사카역'] },
  { name: '난바역', coord: { lat: 34.6659, lng: 135.5015 }, area: '오사카', aliases: ['난바', 'namba', '難波'] },
  { name: '도톤보리', coord: { lat: 34.6687, lng: 135.5013 }, area: '오사카', aliases: ['dotonbori', '道頓堀', '글리코'] },
  { name: '신사이바시', coord: { lat: 34.6738, lng: 135.501 }, area: '오사카', aliases: ['shinsaibashi', '心斎橋'] },
  { name: '오사카성', coord: { lat: 34.6873, lng: 135.5262 }, area: '오사카', aliases: ['osaka castle', '大阪城'] },
  { name: '유니버설 스튜디오 재팬', coord: { lat: 34.6654, lng: 135.4323 }, area: '오사카', aliases: ['usj', 'universal', '유니버셜', 'ユニバ'] },
  { name: '신세카이 · 츠텐카쿠', coord: { lat: 34.6524, lng: 135.5063 }, area: '오사카', aliases: ['신세카이', '츠텐카쿠', 'shinsekai', 'tsutenkaku', '通天閣'] },
  { name: '구로몬 시장', coord: { lat: 34.6657, lng: 135.5062 }, area: '오사카', aliases: ['구로몬시장', 'kuromon', '黒門市場'] },
  { name: '간사이 국제공항', coord: { lat: 34.4342, lng: 135.2328 }, area: '오사카', aliases: ['간사이공항', 'kansai', 'kix', '関西空港'] },
  { name: '아메리카무라', coord: { lat: 34.672, lng: 135.4985 }, area: '오사카', aliases: ['아메무라', 'amerikamura', 'アメ村'] },

  // ── 간사이 근교 ──────────────────────────────────────
  { name: '나라 공원', coord: { lat: 34.6851, lng: 135.843 }, area: '나라', aliases: ['나라', 'nara', '奈良', '사슴공원'] },
  { name: '도다이지', coord: { lat: 34.689, lng: 135.8398 }, area: '나라', aliases: ['동대사', 'todaiji', '東大寺'] },
  { name: '고베 산노미야', coord: { lat: 34.6949, lng: 135.1955 }, area: '고베', aliases: ['고베', 'kobe', 'sannomiya', '三宮'] },
  { name: '기타노 이진칸', coord: { lat: 34.701, lng: 135.19 }, area: '고베', aliases: ['기타노', 'kitano', '北野異人館'] },
  { name: '히메지성', coord: { lat: 34.8394, lng: 134.6939 }, area: '히메지', aliases: ['히메지', 'himeji', '姫路城'] },

  // ── 하코네 · 후지 ────────────────────────────────────
  { name: '하코네유모토', coord: { lat: 35.2323, lng: 139.1067 }, area: '하코네', aliases: ['하코네', 'hakone', '箱根湯本'] },
  { name: '오와쿠다니', coord: { lat: 35.2443, lng: 139.0195 }, area: '하코네', aliases: ['owakudani', '大涌谷'] },
  { name: '가와구치코', coord: { lat: 35.5104, lng: 138.7689 }, area: '후지', aliases: ['카와구치코', 'kawaguchiko', '河口湖'] },
  { name: '후지산 5합목', coord: { lat: 35.3606, lng: 138.7274 }, area: '후지', aliases: ['후지산', 'mt fuji', '富士山'] },

  // ── 홋카이도 ─────────────────────────────────────────
  { name: '삿포로역', coord: { lat: 43.0687, lng: 141.3508 }, area: '삿포로', aliases: ['삿포로', 'sapporo', '札幌駅'] },
  { name: '오도리 공원', coord: { lat: 43.0606, lng: 141.3565 }, area: '삿포로', aliases: ['오도리', 'odori', '大通公園'] },
  { name: '스스키노', coord: { lat: 43.0554, lng: 141.3534 }, area: '삿포로', aliases: ['susukino', 'すすきの'] },
  { name: '오타루 운하', coord: { lat: 43.199, lng: 141.0032 }, area: '오타루', aliases: ['오타루', 'otaru', '小樽'] },
  { name: '신치토세 공항', coord: { lat: 42.7752, lng: 141.6923 }, area: '삿포로', aliases: ['신치토세', 'chitose', 'cts', '新千歳空港'] },

  // ── 규슈 ─────────────────────────────────────────────
  { name: '하카타역', coord: { lat: 33.5897, lng: 130.4207 }, area: '후쿠오카', aliases: ['하카타', 'hakata', '博多駅'] },
  { name: '텐진', coord: { lat: 33.5914, lng: 130.3989 }, area: '후쿠오카', aliases: ['tenjin', '天神'] },
  { name: '나카스 포장마차 거리', coord: { lat: 33.593, lng: 130.406 }, area: '후쿠오카', aliases: ['나카스', 'nakasu', '中洲', '야타이'] },
  { name: '다자이후 텐만구', coord: { lat: 33.5215, lng: 130.535 }, area: '후쿠오카', aliases: ['다자이후', 'dazaifu', '太宰府'] },
  { name: '후쿠오카 공항', coord: { lat: 33.5859, lng: 130.4508 }, area: '후쿠오카', aliases: ['fuk', '福岡空港'] },
  { name: '유후인', coord: { lat: 33.2645, lng: 131.356 }, area: '오이타', aliases: ['yufuin', '由布院'] },
  { name: '벳푸', coord: { lat: 33.2794, lng: 131.5006 }, area: '오이타', aliases: ['beppu', '別府'] },

  // ── 그 외 ────────────────────────────────────────────
  { name: '나고야역', coord: { lat: 35.1706, lng: 136.8816 }, area: '나고야', aliases: ['나고야', 'nagoya', '名古屋駅'] },
  { name: '오스칸논', coord: { lat: 35.1595, lng: 136.9008 }, area: '나고야', aliases: ['오스', 'osu', '大須観音'] },
  { name: '히로시마 평화기념공원', coord: { lat: 34.3955, lng: 132.4536 }, area: '히로시마', aliases: ['히로시마', 'hiroshima', '平和記念公園'] },
  { name: '미야지마 이쓰쿠시마 신사', coord: { lat: 34.296, lng: 132.3197 }, area: '히로시마', aliases: ['미야지마', 'miyajima', '厳島神社'] },
  { name: '겐로쿠엔', coord: { lat: 36.562, lng: 136.6624 }, area: '가나자와', aliases: ['가나자와', 'kanazawa', 'kenrokuen', '兼六園'] },
  { name: '나하 국제거리', coord: { lat: 26.216, lng: 127.687 }, area: '오키나와', aliases: ['오키나와', '나하', 'naha', 'okinawa', '国際通り'] },
  { name: '츄라우미 수족관', coord: { lat: 26.6944, lng: 127.8779 }, area: '오키나와', aliases: ['츄라우미', 'churaumi', '美ら海水族館'] },
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
