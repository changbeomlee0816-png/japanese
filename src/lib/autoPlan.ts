import type { Category, TransportMode } from '../types';
import { POI, lookupPoi, spotsForRegion, type PoiEntry } from '../data/poi';
import { LOCAL_RESTAURANTS } from '../data/restaurants';
import { REGIONS, findRegion, regionById, type Region } from '../data/regions';
import { estimateDurationMin, haversine, suggestMode } from './geo';
import { addDaysISO, addMinutes, fromMinutes, toMinutes } from './time';

/**
 * 메모 한 줄에서 일정을 만들어 내는 계획 엔진.
 *
 * 두 가지 엔진이 같은 결과 형태를 내놓는다.
 *  - 이 파일: 내장 장소 사전만으로 짜는 규칙 기반 엔진. 키도 네트워크도 필요 없다.
 *  - aiPlan.ts: Claude에게 맡기는 엔진. 키가 있을 때만 쓰고, 실패하면 여기로 돌아온다.
 *
 * 메모를 읽어 브리프(어디를·며칠·누구와·무엇을 좋아하는지)로 만드는 일은
 * 두 엔진이 공유한다. AI 쪽도 이 브리프를 그대로 프롬프트에 싣는다.
 */

/* ─────────────────────────── 결과 형태 ─────────────────────────── */

export interface DraftItem {
  title: string;
  category: Category;
  /** "HH:mm" */
  startTime: string;
  durationMin: number;
  cost: number;
  notes?: string;
  address?: string;
  /** 다음 장소로 가는 이동을 못 박아 둘 때 */
  transportToNext?: { mode: TransportMode; note?: string };
}

export interface DraftDay {
  date: string;
  title?: string;
  items: DraftItem[];
}

export interface PlanDraft {
  days: DraftDay[];
  /** 이 계획을 한 줄로 */
  summary: string;
  /** 알아두면 좋은 것들 */
  tips: string[];
  engine: 'local' | 'claude';
}

/* ─────────────────────────── 브리프 ─────────────────────────── */

export type Interest =
  | 'food' | 'cafe' | 'shopping' | 'nature' | 'history'
  | 'night' | 'view' | 'kids' | 'photo' | 'market' | 'onsen' | 'activity';

export const INTEREST_LABEL: Record<Interest, string> = {
  food: '맛집', cafe: '카페', shopping: '쇼핑', nature: '자연', history: '역사·사찰',
  night: '야경', view: '전망', kids: '아이와 함께', photo: '사진', market: '시장',
  onsen: '온천', activity: '액티비티',
};

export type Pace = 'relaxed' | 'normal' | 'packed';

export const PACE_LABEL: Record<Pace, string> = {
  relaxed: '느긋하게', normal: '보통', packed: '알차게',
};

export interface PlanBrief {
  regionId: string;
  regionName: string;
  days: number;
  travelers: number;
  pace: Pace;
  interests: Interest[];
  /** 메모에 직접 적힌, 꼭 가야 하는 곳 */
  mustVisit: string[];
  /** 빼달라고 적은 곳 */
  avoid: string[];
  /** 원문 그대로 — AI 엔진이 뉘앙스까지 읽도록 */
  memo: string;
}

/** 관심사 → 이 태그/분류를 가진 장소에 점수를 준다 */
const INTEREST_MATCH: Record<Interest, { tags: string[]; categories: Category[] }> = {
  food: { tags: ['먹거리', '시장'], categories: ['food'] },
  cafe: { tags: ['카페'], categories: ['cafe'] },
  shopping: { tags: ['빈티지', '레트로'], categories: ['shopping'] },
  nature: { tags: ['자연', '산책', '등산'], categories: [] },
  history: { tags: ['역사', '박물관', '전시'], categories: [] },
  night: { tags: ['야경'], categories: [] },
  view: { tags: ['전망', '야경'], categories: [] },
  kids: { tags: ['가족', '박물관'], categories: ['activity'] },
  photo: { tags: ['사진', '전망'], categories: [] },
  market: { tags: ['시장', '아침'], categories: ['food'] },
  onsen: { tags: ['온천'], categories: ['activity'] },
  activity: { tags: ['등산', '온천'], categories: ['activity'] },
};

const INTEREST_WORDS: Array<{ interest: Interest; words: string[] }> = [
  { interest: 'food', words: ['맛집', '먹방', '먹거리', '음식', '식도락', '미식', '먹으러', '라멘', '스시', '초밥', '고기'] },
  { interest: 'cafe', words: ['카페', '커피', '디저트', '빵', '베이커리'] },
  { interest: 'shopping', words: ['쇼핑', '드럭스토어', '면세', '백화점', '기념품', '옷', '편집샵'] },
  { interest: 'nature', words: ['자연', '공원', '산책', '숲', '바다', '해변', '단풍', '벚꽃', '꽃'] },
  { interest: 'history', words: ['역사', '절', '사찰', '신사', '유적', '박물관', '미술관', '전통', '고궁', '성'] },
  { interest: 'night', words: ['야경', '밤', '나이트', '야시장', '술', '이자카야', '바'] },
  { interest: 'view', words: ['전망', '뷰', '전망대', '타워'] },
  { interest: 'kids', words: ['아이', '애기', '아기', '어린이', '가족', '부모님', '아들', '딸', '유모차'] },
  { interest: 'photo', words: ['사진', '인생샷', '포토', '스냅'] },
  { interest: 'market', words: ['시장', '재래시장', '노점'] },
  { interest: 'onsen', words: ['온천', '료칸', '스파', '목욕'] },
  { interest: 'activity', words: ['액티비티', '체험', '등산', '하이킹', '스키', '자전거', '테마파크', '놀이공원'] },
];

const PACE_WORDS: Array<{ pace: Pace; words: string[] }> = [
  { pace: 'relaxed', words: ['여유', '느긋', '쉬엄', '천천히', '힐링', '휴양', '푹 쉬', '널널'] },
  { pace: 'packed', words: ['빡세', '알차', '빡빡', '많이 보', '최대한', '부지런', '타이트', '풀로'] },
];

const KO_NUM: Record<string, number> = {
  하루: 1, 이틀: 2, 사흘: 3, 나흘: 4, 닷새: 5, 엿새: 6, 이레: 7,
  일주일: 7, 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7,
};

/** 메모에서 여행 조건을 읽어낸다 */
export function readBrief(memo: string, fallback?: { regionId?: string; days?: number; travelers?: number }): PlanBrief {
  const text = memo.trim();
  const lower = text.toLowerCase();

  // ── 지역: 지역명이 먼저, 없으면 메모에 나온 장소가 속한 지역
  let region: Region | undefined = scanRegion(text);
  if (!region) {
    const counts = new Map<string, number>();
    for (const word of text.split(/[\s,·/\n]+/)) {
      const hit = word.length >= 2 ? lookupPoi(word) : null;
      if (hit && hit.regionId !== 'korea') counts.set(hit.regionId, (counts.get(hit.regionId) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) region = regionById(best[0]);
  }
  if (!region && fallback?.regionId) region = regionById(fallback.regionId);
  if (!region) region = REGIONS[0];

  // ── 기간: "2박 3일" 이 "3일" 보다 우선한다
  let days = fallback?.days ?? region.suggestedDays;
  const nights = text.match(/(\d+)\s*박\s*(\d+)\s*일/);
  if (nights) days = Number(nights[2]);
  else {
    const plain = text.match(/(\d+)\s*일(?!차|째)/);
    if (plain) days = Number(plain[1]);
    else {
      const word = Object.keys(KO_NUM).find((k) => text.includes(k + ' 동안') || text.includes(k + '간') || text.includes(k + ' 여행'));
      if (word) days = KO_NUM[word];
      else {
        const en = lower.match(/(\d+)\s*days?/);
        if (en) days = Number(en[1]);
      }
    }
  }
  days = Math.min(14, Math.max(1, days));

  // ── 인원
  let travelers = fallback?.travelers ?? 2;
  const people = text.match(/(\d+)\s*(?:명|인)(?!천)/);
  if (people) travelers = Number(people[1]);
  else if (/혼자|나 홀로|혼행|solo/i.test(text)) travelers = 1;
  else if (/둘이|커플|부부|친구랑/.test(text)) travelers = 2;
  travelers = Math.min(20, Math.max(1, travelers));

  // ── 속도
  let pace: Pace = 'normal';
  for (const { pace: p, words } of PACE_WORDS) {
    if (words.some((w) => text.includes(w))) { pace = p; break; }
  }

  // ── 관심사
  const interests: Interest[] = [];
  for (const { interest, words } of INTEREST_WORDS) {
    if (words.some((w) => lower.includes(w.toLowerCase()))) interests.push(interest);
  }

  // ── 꼭 가고 싶은 곳 / 빼고 싶은 곳
  const { mustVisit, avoid } = readWishes(text, region);

  return {
    regionId: region.id,
    regionName: region.name,
    days,
    travelers,
    pace,
    interests,
    mustVisit,
    avoid,
    memo: text,
  };
}

const NEGATIVE = /(?:빼|말고|제외|안 ?가|생략|패스|싫)/;

/**
 * "꼭 가고 싶은 곳" 과 "빼고 싶은 곳" 을 가른다.
 *
 * 한국어에서 부정은 장소 이름 뒤에 온다 — "유니버설은 빼줘".
 * 그래서 문장을 통째로 보면 안 된다. 한 문장에 "도톤보리는 꼭 가고 싶고 유니버설은 빼줘"
 * 라고 적으면 도톤보리까지 빼 버린다. 장소마다 그 뒤 ~ 다음 장소 앞까지만 본다.
 */
function readWishes(text: string, region: Region): { mustVisit: string[]; avoid: string[] } {
  const regionWords = new Set([region.name, ...region.aliases].map((w) => w.toLowerCase()));

  // 1) 장소가 문장 어디에 나오는지 위치를 모은다
  const hits: Array<{ name: string; start: number; end: number }> = [];
  const wordRe = /[^\s,·\n]+/g;
  for (let m = wordRe.exec(text); m; m = wordRe.exec(text)) {
    const word = m[0].replace(/(?:은|는|이|가|을|를|도|만|랑|이랑|과|와|에|에서|까지|부터)$/, '');
    if (word.length < 2) continue;
    // "오사카 3일" 의 '오사카' 가 '오사카성' 으로 번지면 안 된다
    if (regionWords.has(word.toLowerCase())) continue;
    const hit = lookupPoi(word);
    // 공항·역은 사용자가 이동으로 직접 넣는다
    if (!hit || hit.category === 'transport') continue;
    if (hits.some((h) => h.name === hit.name)) continue;
    hits.push({ name: hit.name, start: m.index, end: m.index + m[0].length });
  }

  // 2) 장소 뒤 ~ 다음 장소 앞까지의 말만 보고 넣을지 뺄지를 정한다
  const mustVisit: string[] = [];
  const avoid: string[] = [];
  for (let i = 0; i < hits.length; i += 1) {
    const until = hits[i + 1]?.start ?? text.length;
    const scope = text.slice(hits[i].end, until);
    // 문장이 끝나면 그 뒤의 부정은 다른 이야기다
    const clause = scope.split(/[.!?\n]/)[0];
    (NEGATIVE.test(clause) ? avoid : mustVisit).push(hits[i].name);
  }
  return { mustVisit, avoid };
}

function scanRegion(text: string): Region | undefined {
  // 긴 이름이 먼저 걸리도록 — "간사이" 보다 "간사이 국제공항" 이 먼저면 지역을 잘못 잡는다
  const direct = findRegion(text);
  if (direct) return direct;
  return REGIONS.find((r) => text.includes(r.name));
}

/* ─────────────────────────── 규칙 기반 엔진 ─────────────────────────── */

const SLOTS_PER_DAY: Record<Pace, number> = { relaxed: 3, normal: 4, packed: 5 };
const DAY_START: Record<Pace, string> = { relaxed: '10:00', normal: '09:30', packed: '09:00' };
/** 이 시각을 넘기면 새 관광지를 시작하지 않는다 */
const LAST_START = 20 * 60;

/** 규칙 기반으로 일정을 짠다. 키도 네트워크도 필요 없다 */
export function buildLocalPlan(brief: PlanBrief, startDate: string, seed = 0): PlanDraft {
  const region = regionById(brief.regionId);
  const pool = candidatePool(brief);
  const ranked = pool
    .map((poi) => ({ poi, score: scorePoi(poi, brief) + jitter(poi.name, seed) }))
    .filter((c) => c.score > -100)
    .sort((a, b) => b.score - a.score);

  const perDay = SLOTS_PER_DAY[brief.pace];
  const groups = groupByDay(ranked, brief.days, perDay);

  const usedMeals = new Set<string>();
  const days: DraftDay[] = groups.map((group, i) => {
    const ordered = orderByRoute(group, region?.center);
    const items = layOutDay(ordered, brief, DAY_START[brief.pace], usedMeals);
    return {
      date: addDaysISO(startDate, i),
      title: dayTitle(ordered.filter((p) => items.some((it) => it.title === p.name))),
      items,
    };
  });

  return {
    days,
    summary: summarize(brief),
    tips: buildTips(brief, groups.flat()),
    engine: 'local',
  };
}

/** 이 지역 + (기간이 넉넉하면) 근처 지역까지 후보로 본다 */
function candidatePool(brief: PlanBrief): PoiEntry[] {
  const region = regionById(brief.regionId);
  const ids = [brief.regionId];
  if (region?.nearby) {
    // 메모에 이름이 나왔거나, 이 지역만으로는 날짜가 남을 때만 옆 동네를 끌어온다
    const roomy = brief.days > (region.suggestedDays ?? 3);
    for (const id of region.nearby) {
      const near = regionById(id);
      if (!near) continue;
      if (roomy || brief.memo.includes(near.name)) ids.push(id);
    }
  }
  const seen = new Set<string>();
  const out: PoiEntry[] = [];
  for (const id of ids) {
    for (const poi of spotsForRegion(id)) {
      if (seen.has(poi.name)) continue;
      seen.add(poi.name);
      out.push(poi);
    }
  }
  // 공항·역은 자동 계획에 넣지 않는다 — 항공편은 사용자가 직접 넣는 게 맞다
  return out.filter((p) => p.category !== 'transport');
}

function scorePoi(poi: PoiEntry, brief: PlanBrief): number {
  if (brief.avoid.includes(poi.name)) return -1000;
  if (brief.mustVisit.includes(poi.name)) return 1000;

  let score = 10;
  if (poi.top) score += 14;
  for (const interest of brief.interests) {
    const match = INTEREST_MATCH[interest];
    if (poi.tags?.some((t) => match.tags.includes(t))) score += 12;
    if (poi.category && match.categories.includes(poi.category)) score += 8;
  }
  // 관심사를 하나도 안 적었으면 대표 명소 위주로
  if (brief.interests.length === 0 && poi.top) score += 6;
  return score;
}

/** 같은 이름은 항상 같은 값 — "다시 짜기"를 눌렀을 때만 순위가 흔들리게 */
function jitter(name: string, seed: number): number {
  if (seed === 0) return 0;
  let h = seed * 2654435761;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000) * 9;
}

/**
 * 날짜별로 묶는다.
 *
 * 하루는 한 동네에 머무는 게 낫다. 그래서 남은 후보 중 가장 점수가 높은 곳을
 * 그날의 기준점으로 삼고, 거기서 가까운 곳들로 그날을 채운다.
 */
function groupByDay(
  ranked: Array<{ poi: PoiEntry; score: number }>,
  dayCount: number,
  perDay: number,
): PoiEntry[][] {
  const rest = [...ranked];
  const groups: PoiEntry[][] = [];

  for (let d = 0; d < dayCount; d += 1) {
    if (rest.length === 0) { groups.push([]); continue; }
    // 후보가 모자라면 남은 날에 고르게 나눈다. 빈 날을 만드는 것보다 낫다
    const daysLeft = dayCount - d;
    const target = Math.max(1, Math.min(perDay, Math.ceil(rest.length / daysLeft)));
    const seedIdx = 0; // 남은 것 중 최고 점수
    const [seedEntry] = rest.splice(seedIdx, 1);
    const group = [seedEntry.poi];

    while (group.length < target && rest.length > 0) {
      // 점수는 높고 기준점에서는 가까운 곳
      let bestIdx = 0;
      let bestValue = -Infinity;
      for (let i = 0; i < rest.length; i += 1) {
        const km = haversine(seedEntry.poi.coord, rest[i].poi.coord) / 1000;
        const value = rest[i].score - km * 2.2;
        if (value > bestValue) { bestValue = value; bestIdx = i; }
      }
      group.push(rest.splice(bestIdx, 1)[0].poi);
    }
    groups.push(group);
  }
  return groups;
}

/** 그날 안에서 도는 순서 — 최근접 이웃 */
function orderByRoute(group: PoiEntry[], center?: { lat: number; lng: number }): PoiEntry[] {
  // 하루를 통째로 쓰는 곳(테마파크 등)은 아침부터 시작해야 한다
  const allDay = group.filter((p) => (p.stayMin ?? 0) >= 240);
  // 저녁에만 여는 곳(포장마차 거리 등)은 절대 아침에 두면 안 된다 — 하루를 통째로 버린다
  const evening = group.filter((p) => !allDay.includes(p) && p.hours && toMinutes(p.hours.open) >= 16 * 60);
  const rest = group.filter((p) => !allDay.includes(p) && !evening.includes(p));
  if (allDay.length > 0 || evening.length > 0) {
    return [...allDay, ...orderRest(rest, center), ...evening];
  }
  return orderRest(group, center);
}

function orderRest(group: PoiEntry[], center?: { lat: number; lng: number }): PoiEntry[] {
  if (group.length <= 2) return group;
  const rest = [...group];
  // 아침에 여는 곳(시장 등)이 있으면 거기서 시작한다
  const morningIdx = rest.findIndex((p) => p.tags?.includes('아침'));
  const startIdx = morningIdx >= 0 ? morningIdx : nearestTo(rest, center ?? rest[0].coord);
  const route = [rest.splice(startIdx, 1)[0]];

  while (rest.length > 0) {
    const last = route[route.length - 1];
    const idx = nearestTo(rest, last.coord);
    route.push(rest.splice(idx, 1)[0]);
  }

  // 야경 명소는 마지막으로 미룬다
  const night = route.filter((p) => p.tags?.includes('야경'));
  if (night.length > 0 && night.length < route.length) {
    return [...route.filter((p) => !night.includes(p)), ...night];
  }
  return route;
}

function nearestTo(list: PoiEntry[], from: { lat: number; lng: number }): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i += 1) {
    const d = haversine(from, list[i].coord);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** 순서가 정해진 하루에 시각·식사·이동시간을 채워 넣는다 */
function layOutDay(route: PoiEntry[], brief: PlanBrief, dayStart: string, usedMeals: Set<string>): DraftItem[] {
  const items: DraftItem[] = [];
  let clock = toMinutes(dayStart);
  let lunchDone = false;
  let dinnerDone = false;

  const pushMeal = (kind: '점심' | '저녁', near: PoiEntry | undefined) => {
    const spot = nearestRestaurant(near?.coord, brief, usedMeals, clock);
    if (spot) usedMeals.add(spot.name);
    const durationMin = kind === '점심' ? 60 : 90;
    items.push({
      title: spot?.name ?? `${kind} (${near?.area ?? brief.regionName} 근처)`,
      category: 'food',
      startTime: fromMinutes(clock),
      durationMin,
      cost: 0,
      notes: spot ? `${kind} · ${spot.genre}${spot.openHint ? ` · ${spot.openHint}` : ''}` : `${kind} 먹을 곳을 정해두세요`,
      address: spot?.address,
    });
    clock += durationMin;
  };

  for (let i = 0; i < route.length; i += 1) {
    const poi = route[i];

    // 시계가 식사 시간에 걸리면 먼저 밥을 먹는다
    if (!lunchDone && clock >= 11 * 60 && clock <= 14 * 60) { pushMeal('점심', route[i - 1] ?? poi); lunchDone = true; clock += travelMin(route[i - 1], poi); }
    if (!dinnerDone && clock >= 17 * 60 + 30 && clock <= 20 * 60) { pushMeal('저녁', route[i - 1] ?? poi); dinnerDone = true; clock += travelMin(route[i - 1], poi); }

    const durationMin = poi.stayMin ?? 90;
    const openLimited = poi.hours ? clampToHours(clock, durationMin, poi.hours) : clock;
    clock = openLimited;

    // 밤 늦게 새 관광지를 시작하지 않는다. 남은 곳은 저장함으로 보낸다
    if (clock > LAST_START && items.length > 0) break;

    items.push({
      title: poi.name,
      category: poi.category ?? 'sight',
      startTime: fromMinutes(clock),
      durationMin,
      cost: 0,
      notes: poi.blurb,
      address: poi.area,
    });
    clock += durationMin;

    const next = route[i + 1];
    if (next) clock += travelMin(poi, next);
  }

  // 하루가 저녁 전에 끝났으면 저녁을 붙여준다
  if (!dinnerDone && route.length > 0 && clock <= 20 * 60) {
    clock = Math.max(clock, 18 * 60 + 30);
    pushMeal('저녁', route[route.length - 1]);
  }
  return items;
}

/** 두 장소 사이에 비워둘 시간 — 구간 경로는 나중에 useLegs 가 실측으로 덮어쓴다 */
function travelMin(from: PoiEntry | undefined, to: PoiEntry | undefined): number {
  if (!from || !to) return 0;
  const distance = haversine(from.coord, to.coord);
  const minutes = estimateDurationMin(distance, suggestMode(distance));
  // 환승·개찰·길 찾기에 드는 시간을 조금 얹는다. 너무 딱 맞으면 하루가 밀린다
  return Math.max(10, Math.round(minutes * 1.15) + 5);
}

/** 영업시간 밖이면 여는 시각까지 기다린다. 닫기 전에 못 들어가면 그냥 둔다(점검이 잡아준다) */
function clampToHours(clock: number, durationMin: number, hours: { open: string; close: string }): number {
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (clock < open) return open;
  if (clock + durationMin > close && clock < close) return clock;
  return clock;
}

function nearestRestaurant(
  near: { lat: number; lng: number } | undefined,
  brief: PlanBrief,
  used: Set<string>,
  atMinutes: number,
) {
  if (!near) return undefined;
  const wantsLocal = brief.interests.includes('food');
  let best: (typeof LOCAL_RESTAURANTS)[number] | undefined;
  let bestValue = Infinity;
  for (const r of LOCAL_RESTAURANTS) {
    if (used.has(r.name)) continue;
    // 저녁에만 여는 이자카야를 점심에 넣으면 안 된다
    if (!opensAt(r.openHint, atMinutes)) continue;
    const km = haversine(near, r.coord) / 1000;
    if (km > 6) continue;
    // 맛집을 챙긴 여행이면 현지인 비중이 높은 곳을 조금 더 끌어온다
    const value = km - (wantsLocal ? r.localScore / 40 : 0);
    if (value < bestValue) { bestValue = value; best = r; }
  }
  return best;
}

/**
 * openHint("17:00–23:30", "11:00–15:00, 17:00–21:00", "24시간")를 보고
 * 그 시각에 문을 여는지 본다. 읽을 수 없는 표기면 막지 않는다.
 */
function opensAt(hint: string | undefined, minutes: number): boolean {
  if (!hint) return true;
  if (hint.includes('24시간')) return true;
  const ranges = [...hint.matchAll(/(\d{1,2}):(\d{2})\s*[–\-~]\s*(\d{1,2}):(\d{2})/g)];
  if (ranges.length === 0) return true;
  return ranges.some((m) => {
    const open = Number(m[1]) * 60 + Number(m[2]);
    let close = Number(m[3]) * 60 + Number(m[4]);
    if (close <= open) close += 24 * 60; // 자정을 넘겨 닫는 곳
    return minutes >= open && minutes < close;
  });
}

function dayTitle(route: PoiEntry[]): string | undefined {
  const areas = [...new Set(route.map((p) => p.area))];
  if (areas.length === 0) return undefined;
  return areas.slice(0, 2).join(' · ');
}

function summarize(brief: PlanBrief): string {
  const parts = [`${brief.regionName} ${brief.days}일`, `${brief.travelers}인`, PACE_LABEL[brief.pace]];
  if (brief.interests.length > 0) parts.push(brief.interests.slice(0, 3).map((i) => INTEREST_LABEL[i]).join('·'));
  return parts.join(' · ');
}

function buildTips(brief: PlanBrief, picked: PoiEntry[]): string[] {
  const tips: string[] = [];

  for (const poi of picked) {
    const closed = poi.hours?.closedDays;
    if (closed?.length) {
      const names = closed.map((d) => '일월화수목금토'[d]).join('·');
      tips.push(`${poi.name}는 ${names}요일 휴무입니다. 날짜를 확인하세요.`);
    }
  }
  // 자정을 넘겨 닫는 곳(02:00 마감)은 일찍 닫는 게 아니다
  const early = picked.filter(
    (p) => p.hours && toMinutes(p.hours.close) > toMinutes(p.hours.open) && toMinutes(p.hours.close) <= 15 * 60,
  );
  for (const poi of early) tips.push(`${poi.name}는 ${poi.hours!.close}에 닫습니다 — 오전에 넣는 게 안전합니다.`);

  if (picked.some((p) => p.tags?.includes('야경'))) tips.push('야경 명소는 해질녘에 맞춰 마지막 순서로 넣었습니다.');
  if (brief.interests.includes('food')) tips.push('식사는 내장 현지인 맛집에서 가까운 곳으로 넣었습니다. 맛집 탭에서 다른 곳으로 바꿀 수 있습니다.');
  if (brief.pace === 'packed') tips.push('일정이 촘촘합니다. 하루 보기의 점검 카드에서 무리한 구간을 확인하세요.');
  if (brief.mustVisit.length > 0) tips.push(`꼭 가고 싶다고 적은 곳(${brief.mustVisit.join(', ')})은 먼저 넣었습니다.`);

  const perDay = picked.length / Math.max(1, brief.days);
  if (perDay < 2.5) {
    tips.push(
      `내장 장소 사전에 ${brief.regionName} 자료가 ${picked.length}곳뿐이라 하루가 헐겁습니다. ` +
      '설정에서 구글 지도 키를 넣거나, 둘러보기·메모 붙여넣기로 직접 채워 보세요.',
    );
  }
  tips.push('숙소와 항공편은 넣지 않았습니다 — 이동 추가 버튼으로 직접 넣으세요.');
  return [...new Set(tips)].slice(0, 8);
}

/* ─────────────────────────── 초안 → 항목 ─────────────────────────── */

/** 초안의 장소 이름을 내장 사전과 맞춰 좌표·주소를 채운다 */
export function enrichDraft(draft: PlanDraft): PlanDraft {
  return {
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        const hit = lookupPoi(item.title);
        if (!hit) return item;
        return {
          ...item,
          category: item.category ?? hit.category ?? 'sight',
          address: item.address ?? hit.area,
          notes: item.notes ?? hit.blurb,
        };
      }),
    })),
  };
}

/** 초안이 실제로 쓸 만한지 — 빈 날이 있거나 항목이 하나도 없으면 못 쓴다 */
export function draftItemCount(draft: PlanDraft): number {
  return draft.days.reduce((n, d) => n + d.items.length, 0);
}

/** AI 프롬프트에 실을 후보 목록 */
export function briefCandidates(brief: PlanBrief): PoiEntry[] {
  return candidatePool(brief);
}

/** 후보에 없는 이름이 와도 최소한 지역 안인지 확인할 수 있게 */
export function poiNames(regionId: string): string[] {
  return POI.filter((p) => p.regionId === regionId).map((p) => p.name);
}

export { addMinutes };
