import type { Category, Day, Item, TransportMode } from '../types';
import { uid } from './id';
import { addDaysISO, addMinutes, fromMinutes, pad, todayISO, toMinutes } from './time';
import { lookupPoi } from '../data/poi';

/**
 * "대충 적은 일정" 텍스트를 구조화한다.
 *
 * 지원하는 형태:
 *   9/12  |  2026-09-12  |  9월 12일  |  Day 1  |  1일차  |  둘째날
 *   10:00 나리타공항 도착
 *   - 오후 2시 시부야 스크램블 (90분, 1200엔)
 *   점심 이치란 라멘
 *   저녁: 도톤보리 #식사
 */

const DAY_HEADER_PATTERNS: RegExp[] = [
  /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/,           // 2026-09-12
  /^(\d{1,2})[/.](\d{1,2})\s*(?:\(|$|일|:)/,          // 9/12
  /^(\d{1,2})월\s*(\d{1,2})일/,                       // 9월 12일
];

const DAY_INDEX_PATTERNS: RegExp[] = [
  /^day\s*(\d+)/i,
  /^(\d+)\s*일\s*차/,
  /^d\s*[-]?\s*(\d+)\b/i,
];

const ORDINAL_DAYS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];

const KEYWORD_TIME: Record<string, string> = {
  새벽: '05:30',
  아침: '08:00',
  조식: '08:00',
  오전: '10:00',
  점심: '12:00',
  중식: '12:00',
  브런치: '11:00',
  오후: '14:00',
  저녁: '18:30',
  석식: '18:30',
  디너: '19:00',
  밤: '21:00',
  야식: '22:30',
  체크인: '15:00',
  체크아웃: '10:00',
};

/** 줄에 적힌 이동수단 — "비행기", "신칸센", "지하철" 같은 말로 찾는다 */
const TRANSPORT_WORDS: Array<{ mode: TransportMode; words: string[] }> = [
  { mode: 'flight', words: ['비행기', '항공', '비행', 'flight', '탑승', 'ktx항공'] },
  { mode: 'train', words: ['신칸센', 'ktx', '고속철', '특급', '기차', '열차', 'train', '하루카', '라피트', 'nex'] },
  { mode: 'ferry', words: ['페리', '배편', '여객선', 'ferry', '크루즈'] },
  { mode: 'bus', words: ['버스', '리무진', 'bus'] },
  { mode: 'taxi', words: ['택시', '렌터카', '자동차', 'taxi', '차량'] },
  { mode: 'subway', words: ['지하철', '전철', '전차', 'jr', '메트로', 'subway', '모노레일'] },
  { mode: 'walk', words: ['도보', '걸어서', 'walk'] },
];

/** "A → B" 형태의 화살표 */
const ARROW = /\s*(?:→|->|=>|➔|➡|▶|>>)\s*/;

const CATEGORY_RULES: Array<{ cat: Category; words: string[] }> = [
  { cat: 'transport', words: ['공항', '역', '터미널', '버스', '신칸센', '기차', '페리', '렌터카', 'airport', 'station'] },
  { cat: 'stay', words: ['호텔', '숙소', '료칸', '체크인', '체크아웃', '게스트하우스', 'hotel', 'airbnb'] },
  { cat: 'food', words: ['점심', '저녁', '아침', '식사', '맛집', '라멘', '스시', '초밥', '이자카야', '고기', '우동', '소바', '돈카츠', '규동', '식당', '레스토랑', '야키니쿠', '오코노미야키', '조식', '브런치', '야식'] },
  { cat: 'cafe', words: ['카페', '커피', '디저트', '빙수', '베이커리', 'cafe', 'coffee'] },
  { cat: 'shopping', words: ['쇼핑', '돈키', '백화점', '드럭스토어', '아울렛', '면세', '마트', '상점가', 'shopping', 'mall'] },
  { cat: 'activity', words: ['체험', '온천', '스파', '유람선', '공연', '콘서트', '클래스', '수업', '티켓', '입장', '놀이공원', '디즈니', '유니버설'] },
  { cat: 'sight', words: ['신사', '절', '사찰', '공원', '전망대', '박물관', '미술관', '성', '타워', '거리', '시장', '관광'] },
];

/** 줄에서 이동수단을 찾는다. 없으면 null */
function findTransportMode(text: string): TransportMode | null {
  const lower = text.toLowerCase();
  for (const rule of TRANSPORT_WORDS) {
    if (rule.words.some((w) => lower.includes(w))) return rule.mode;
  }
  return null;
}

export function inferCategory(text: string): Category {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((w) => lower.includes(w.toLowerCase()))) return rule.cat;
  }
  return 'sight';
}

interface ParsedTime {
  time?: string;
  /** 종료 시각이 함께 적힌 경우의 체류·이동 시간(분) */
  durationMin?: number;
  rest: string;
}

/**
 * 문장 앞에서 시각 하나를 읽는다.
 * "10:00", "오후 2시", "14시 30분", "9시반" 을 모두 받아 분 단위로 돌려준다.
 */
function parseClock(text: string): { minutes: number; length: number; hasMarker: boolean } | null {
  const m = text.match(
    /^\s*(오전|오후|am|pm)?\s*(\d{1,2})\s*(?::|시)\s*(반|\d{1,2})?\s*분?\s*(오전|오후|am|pm)?/i,
  );
  if (!m) return null;

  let hour = Number(m[2]);
  const minute = m[3] === '반' ? 30 : Number(m[3] ?? 0);
  const marker = (m[1] ?? m[4] ?? '').toLowerCase();
  if ((marker === '오후' || marker === 'pm') && hour < 12) hour += 12;
  if ((marker === '오전' || marker === 'am') && hour === 12) hour = 0;
  if (hour > 29 || minute > 59) return null;

  return { minutes: (hour % 24) * 60 + minute, length: m[0].length, hasMarker: !!marker };
}

/** 시각 뒤에 오는 범위 구분자 — "07:10 ~ 09:05", "9시-11시", "10:00부터 12:00까지" */
const RANGE_SEP = /^\s*(?:~+|-|–|—|to|부터|에서)\s*/i;

/**
 * 줄 앞머리에서 시각(과 범위)을 뽑아낸다.
 *
 * "07:10 ~ 09:05 아사쿠사" 처럼 범위를 적으면 그 사이가 그 장소에 머무는 시간,
 * 이동 줄이라면 이동에 걸리는 시간이 된다.
 */
function extractTime(raw: string): ParsedTime {
  const first = parseClock(raw);

  if (first) {
    const afterFirst = raw.slice(first.length);
    const sep = afterFirst.match(RANGE_SEP);

    if (sep) {
      const second = parseClock(afterFirst.slice(sep[0].length));
      if (second) {
        // "오후 2시 ~ 3시반" 처럼 끝 시각에 오전/오후가 없으면 시작과 같은 반나절로 본다.
        // 그러지 않으면 14:00~03:30 이 되어 13시간짜리 일정이 된다.
        let endMin = second.minutes;
        if (!second.hasMarker && endMin < first.minutes && endMin + 720 > first.minutes) {
          endMin += 720;
        }
        // 그래도 이르면 자정을 넘긴 것으로 본다 (23:00 ~ 01:00)
        const span = (endMin - first.minutes + 1440) % 1440;
        const rest = afterFirst
          .slice(sep[0].length + second.length)
          .replace(/^\s*(까지|사이)?\s*[:,\-–]?\s*/, '');
        return {
          time: fromMinutes(first.minutes),
          durationMin: span > 0 ? span : undefined,
          rest,
        };
      }
    }

    return {
      time: fromMinutes(first.minutes),
      rest: afterFirst.replace(/^[\s:,~\-–]+/, ''),
    };
  }

  // 아침/점심/저녁 같은 키워드
  for (const [word, time] of Object.entries(KEYWORD_TIME)) {
    if (raw.startsWith(word)) {
      const rest = raw.slice(word.length).replace(/^[\s:~\-–]+/, '');
      return { time, rest: rest || word };
    }
  }
  return { rest: raw };
}

/** (90분), [2시간], 90min 등 체류시간 */
function extractDuration(text: string): { durationMin?: number; rest: string } {
  const m = text.match(/[([]?\s*(\d+(?:\.\d+)?)\s*(시간|h|hr|hours?)\s*(\d+)?\s*(분|m|min)?\s*[)\]]?/i);
  if (m) {
    const hours = Number(m[1]);
    const mins = Number(m[3] ?? 0);
    return { durationMin: Math.round(hours * 60 + mins), rest: text.replace(m[0], ' ').trim() };
  }
  // \b는 한글 뒤에서 동작하지 않으므로 뒤에 글자가 이어지지 않는지 직접 확인한다
  const m2 = text.match(/[([]?\s*(\d{1,3})\s*(분|min|m)(?![a-z가-힣])\s*[)\]]?/i);
  if (m2) return { durationMin: Number(m2[1]), rest: text.replace(m2[0], ' ').trim() };
  return { rest: text };
}

/** 5000엔, ¥5000, 1만원, 30 USD 등 비용 */
function extractCost(text: string): { cost?: number; rest: string } {
  const m = text.match(/(?:[¥₩$€]\s*)?(\d[\d,]*(?:\.\d+)?)\s*(엔|円|yen|원|won|달러|usd|유로|eur)?/i);
  if (!m) return { rest: text };
  const hasCurrencyMark = !!m[2] || /[¥₩$€]/.test(m[0]);
  if (!hasCurrencyMark) return { rest: text };
  const value = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return { rest: text };
  return { cost: value, rest: text.replace(m[0], ' ').replace(/[()[\]]/g, ' ').trim() };
}

function isDayHeader(line: string): { kind: 'date'; date: string } | { kind: 'index'; index: number } | null {
  const t = line.replace(/^[#\-*•\s]+/, '').trim();
  const year = new Date().getFullYear();

  for (const re of DAY_HEADER_PATTERNS) {
    const m = t.match(re);
    if (!m) continue;
    if (m.length >= 4 && m[3]) {
      return { kind: 'date', date: `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}` };
    }
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { kind: 'date', date: `${year}-${pad(month)}-${pad(day)}` };
    }
  }

  for (const re of DAY_INDEX_PATTERNS) {
    const m = t.match(re);
    if (m) return { kind: 'index', index: Number(m[1]) };
  }

  const ordinal = ORDINAL_DAYS.findIndex((o) => t.startsWith(o));
  if (ordinal >= 0 && /날|일/.test(t.slice(ORDINAL_DAYS[ordinal].length, ORDINAL_DAYS[ordinal].length + 2))) {
    return { kind: 'index', index: ordinal + 1 };
  }
  return null;
}

/** 헤더 없이 나온 항목들이 들어갈 임시 버킷 */
interface Bucket {
  date?: string;
  index?: number;
  items: Item[];
}

export interface ParseResult {
  days: Day[];
  itemCount: number;
  warnings: string[];
}

export function parsePlanText(text: string, startDate = todayISO()): ParseResult {
  const lines = text.split(/\r?\n/);
  const buckets: Bucket[] = [];
  const warnings: string[] = [];
  let current: Bucket | null = null;

  const ensureBucket = (): Bucket => {
    if (!current) {
      current = { index: buckets.length + 1, items: [] };
      buckets.push(current);
    }
    return current;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = isDayHeader(line);
    if (header) {
      current = header.kind === 'date' ? { date: header.date, items: [] } : { index: header.index, items: [] };
      buckets.push(current);
      // "9/12 도쿄 도착" 처럼 헤더 뒤에 내용이 붙는 경우를 위해 나머지를 항목으로도 본다
      const tail = line.replace(/^[#\-*•\s]+/, '').replace(/^\S+\s*/, '').trim();
      if (tail && /\d{1,2}\s*[:시]/.test(tail)) {
        current.items.push(...lineToItems(tail));
      }
      continue;
    }

    const cleaned = line.replace(/^[-*•·▪>\s]+/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!cleaned) continue;

    const parsed = lineToItems(cleaned);
    if (parsed.length > 0) ensureBucket().items.push(...parsed);
    else warnings.push(`해석하지 못한 줄: "${line}"`);
  }

  if (buckets.length === 0) return { days: [], itemCount: 0, warnings: ['일정으로 읽을 내용이 없습니다.'] };

  // 날짜 확정: 명시된 날짜가 있으면 그것을, 없으면 startDate 기준으로 순번 배정
  const anchor = buckets.find((b) => b.date)?.date;
  const base = anchor ?? startDate;
  const anchorIndex = anchor ? buckets.findIndex((b) => b.date === anchor) : 0;

  const days: Day[] = buckets.map((bucket, i) => {
    const date =
      bucket.date ??
      (bucket.index !== undefined
        ? addDaysISO(base, bucket.index - 1 - (anchor ? anchorIndex : 0))
        : addDaysISO(base, i - (anchor ? anchorIndex : 0)));
    return {
      id: uid('day'),
      date,
      items: fillMissingTimes(bucket.items),
    };
  });

  days.sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    itemCount: days.reduce((n, d) => n + d.items.length, 0),
    warnings,
  };
}

/**
 * 한 줄을 항목으로 바꾼다. 해석하지 못하면 빈 배열.
 *
 * 보통은 항목 하나지만, "인천공항 → 간사이공항 비행기" 같은 이동 줄은
 * 출발지·도착지 두 장소와 그 사이를 잇는 이동으로 풀어 낸다.
 */
function lineToItems(line: string): Item[] {
  const { time, durationMin: rangeMin, rest: afterTime } = extractTime(line);
  // 범위로 시간을 적었으면 그 값이 우선이다
  const { durationMin: explicitMin, rest: afterDuration } =
    rangeMin === undefined ? extractDuration(afterTime) : { durationMin: undefined, rest: afterTime };
  const { cost, rest: afterCost } = extractCost(afterDuration);

  const tagMatch = afterCost.match(/#(\S+)/);
  let body = afterCost.replace(/#\S+/g, '').replace(/\s{2,}/g, ' ').replace(/[,\s]+$/, '').trim();
  body = body.replace(/^[:\-–~]\s*/, '');

  if (!body) return [];

  const mode = findTransportMode(`${body} ${tagMatch?.[1] ?? ''}`);
  const arrowParts = body.split(ARROW);

  // ── 이동 줄: "A → B"
  if (arrowParts.length === 2) {
    const strip = (t: string) =>
      TRANSPORT_WORDS.flatMap((r) => r.words)
        .reduce((acc, w) => acc.replace(new RegExp(w, 'gi'), ''), t)
        .replace(/[()[\]]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const fromName = strip(arrowParts[0]);
    const toName = strip(arrowParts[1]);
    if (fromName && toName) {
      const travelMin = rangeMin ?? explicitMin;
      const fromDefaults = placeDefaults(fromName);
      const toDefaults = placeDefaults(toName);
      const from: Item = {
        id: uid('item'),
        title: fromName,
        category: fromDefaults.category,
        place: { name: fromName },
        startTime: time ?? '',
        // 출발지는 곧바로 떠나므로 머무는 시간을 두지 않는다
        durationMin: 0,
        cost: 0,
        transportToNext: {
          mode: mode ?? 'subway',
          // 시간을 안 적었으면 좌표를 찾은 뒤 거리로 계산한다
          durationMin: travelMin ?? 0,
          cost: cost ?? 0,
          distanceM: 0,
          manualDuration: travelMin !== undefined,
        },
      };
      const to: Item = {
        id: uid('item'),
        title: toName,
        category: toDefaults.category,
        place: { name: toName },
        startTime: time && travelMin ? addMinutes(time, travelMin) : '',
        // 공항·역은 도착해서 바로 움직이지만, 관광지면 보통 머무는 시간을 잡아 준다
        durationMin: toDefaults.category === 'transport' ? 0 : toDefaults.stayMin,
        cost: 0,
      };
      return [from, to];
    }
  }

  const defaults = placeDefaults(body);
  // 태그나 문장에 분류가 드러나면 그쪽을 따른다 (#식사 등)
  const hinted = tagMatch?.[1] ? inferCategory(tagMatch[1]) : null;
  const category = hinted ?? defaults.category;

  return [
    {
      id: uid('item'),
      title: body,
      category,
      place: { name: body },
      startTime: time ?? '',
      durationMin: rangeMin ?? explicitMin ?? defaults.stayMin,
      cost: cost ?? 0,
    },
  ];
}

/**
 * 이 이름의 장소를 내장 사전에서 찾아 분류와 보통 머무는 시간을 가져온다.
 * 사전에 없으면 글자에서 추론한다.
 */
function placeDefaults(name: string): { category: Category; stayMin: number } {
  const poi = lookupPoi(name);
  if (poi) {
    const category = poi.category ?? inferCategory(name);
    return { category, stayMin: poi.stayMin ?? defaultDuration(category) };
  }
  const category = inferCategory(name);
  return { category, stayMin: defaultDuration(category) };
}

export function defaultDuration(category: Category): number {
  switch (category) {
    case 'food':
      return 60;
    case 'cafe':
      return 40;
    case 'transport':
      return 30;
    case 'stay':
      return 30;
    case 'shopping':
      return 60;
    case 'activity':
      return 120;
    default:
      return 75;
  }
}

/**
 * 시간이 비어 있는 항목을 앞뒤 맥락으로 채운다.
 * 앞 항목 종료 + 이동 30분을 기본 간격으로 잡는다.
 */
/**
 * 시각이 비어 있는 항목을 앞뒤 맥락으로 채운다.
 *
 * 이동으로 이어진 두 장소는 한 덩어리로 다룬다. 시각순으로 정렬할 때
 * "출발지 → 도착지" 짝이 갈라지면 안 되기 때문이다.
 */
function fillMissingTimes(items: Item[]): Item[] {
  if (items.length === 0) return items;
  const GAP = 30;

  // 이동으로 묶인 항목들을 한 덩어리로 만든다
  const groups: Item[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const group = [items[i]];
    while (items[i].transportToNext && items[i + 1]) {
      i += 1;
      group.push(items[i]);
    }
    groups.push(group);
  }

  // 시각이 없는 덩어리는 앞 덩어리의 시각을 이어받는다.
  // 그래야 정렬 기준이 모든 덩어리에 있어 비교가 일관되고, 쓴 자리도 지켜진다.
  let carried = groups[0]?.[0].startTime || '09:00';
  const withOrder = groups.map((g, i) => {
    if (g[0].startTime) carried = g[0].startTime;
    return { g, i, at: toMinutes(carried) };
  });
  withOrder.sort((a, b) => (a.at !== b.at ? a.at - b.at : a.i - b.i));

  const out: Item[] = [];
  let cursor = withOrder[0]?.g[0].startTime || '09:00';

  for (const { g } of withOrder) {
    for (let i = 0; i < g.length; i += 1) {
      const item = g[i];
      const startTime = item.startTime || cursor;
      out.push({ ...item, startTime });

      // 이동으로 이어지면 이동 시간만큼, 아니면 기본 간격만큼 띄운다
      const link = item.transportToNext;
      cursor = addMinutes(startTime, item.durationMin + (link ? link.durationMin : GAP));
    }
  }

  return out;
}
