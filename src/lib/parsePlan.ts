import type { Category, Day, Item } from '../types';
import { uid } from './id';
import { addDaysISO, addMinutes, fromMinutes, pad, todayISO, toMinutes } from './time';

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

const CATEGORY_RULES: Array<{ cat: Category; words: string[] }> = [
  { cat: 'transport', words: ['공항', '역', '터미널', '버스', '신칸센', '기차', '페리', '렌터카', 'airport', 'station'] },
  { cat: 'stay', words: ['호텔', '숙소', '료칸', '체크인', '체크아웃', '게스트하우스', 'hotel', 'airbnb'] },
  { cat: 'food', words: ['점심', '저녁', '아침', '식사', '맛집', '라멘', '스시', '초밥', '이자카야', '고기', '우동', '소바', '돈카츠', '규동', '식당', '레스토랑', '야키니쿠', '오코노미야키', '조식', '브런치', '야식'] },
  { cat: 'cafe', words: ['카페', '커피', '디저트', '빙수', '베이커리', 'cafe', 'coffee'] },
  { cat: 'shopping', words: ['쇼핑', '돈키', '백화점', '드럭스토어', '아울렛', '면세', '마트', '상점가', 'shopping', 'mall'] },
  { cat: 'activity', words: ['체험', '온천', '스파', '유람선', '공연', '콘서트', '클래스', '수업', '티켓', '입장', '놀이공원', '디즈니', '유니버설'] },
  { cat: 'sight', words: ['신사', '절', '사찰', '공원', '전망대', '박물관', '미술관', '성', '타워', '거리', '시장', '관광'] },
];

export function inferCategory(text: string): Category {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((w) => lower.includes(w.toLowerCase()))) return rule.cat;
  }
  return 'sight';
}

interface ParsedTime {
  time?: string;
  rest: string;
}

/** 줄 앞머리에서 시각을 뽑아낸다 */
function extractTime(raw: string): ParsedTime {
  let text = raw;

  // 10:00 / 10시 30분 / 10시
  const explicit = text.match(/^(오전|오후|am|pm)?\s*(\d{1,2})\s*(?::|시)\s*(\d{1,2})?\s*분?\s*(오전|오후|am|pm)?/i);
  if (explicit) {
    let hour = Number(explicit[2]);
    const minute = Number(explicit[3] ?? 0);
    const marker = (explicit[1] ?? explicit[4] ?? '').toLowerCase();
    if ((marker === '오후' || marker === 'pm') && hour < 12) hour += 12;
    if ((marker === '오전' || marker === 'am') && hour === 12) hour = 0;
    if (hour <= 29 && minute < 60) {
      text = text.slice(explicit[0].length).replace(/^[\s:~\-–]+/, '');
      return { time: `${pad(hour % 24)}:${pad(minute)}`, rest: text };
    }
  }

  // 아침/점심/저녁 같은 키워드
  for (const [word, time] of Object.entries(KEYWORD_TIME)) {
    if (text.startsWith(word)) {
      const rest = text.slice(word.length).replace(/^[\s:~\-–]+/, '');
      return { time, rest: rest || word };
    }
  }
  return { rest: text };
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
        const item = lineToItem(tail);
        if (item) current.items.push(item);
      }
      continue;
    }

    const cleaned = line.replace(/^[-*•·▪>\s]+/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!cleaned) continue;

    const item = lineToItem(cleaned);
    if (item) ensureBucket().items.push(item);
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

/** 한 줄을 항목으로. 제목이 비면 null */
function lineToItem(line: string): Item | null {
  const { time, rest: afterTime } = extractTime(line);
  const { durationMin, rest: afterDuration } = extractDuration(afterTime);
  const { cost, rest: afterCost } = extractCost(afterDuration);

  const tagMatch = afterCost.match(/#(\S+)/);
  let title = afterCost.replace(/#\S+/g, '').replace(/\s{2,}/g, ' ').replace(/[,\s]+$/, '').trim();
  title = title.replace(/^[:\-–~]\s*/, '');

  if (!title) return null;

  const category = inferCategory(`${title} ${tagMatch?.[1] ?? ''} ${line}`);

  return {
    id: uid('item'),
    title,
    category,
    place: { name: title },
    startTime: time ?? '',
    durationMin: durationMin ?? defaultDuration(category),
    cost: cost ?? 0,
  };
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
function fillMissingTimes(items: Item[]): Item[] {
  if (items.length === 0) return items;
  const GAP = 30;
  const out = [...items];

  // 첫 항목이 비면 09:00부터 시작
  let cursor = out[0].startTime || '09:00';
  for (let i = 0; i < out.length; i += 1) {
    if (out[i].startTime) {
      cursor = out[i].startTime;
    } else {
      out[i] = { ...out[i], startTime: cursor };
    }
    cursor = addMinutes(cursor, out[i].durationMin + GAP);
  }

  // 시각이 역행하면(자정 넘김 등) 정렬만 맞춰 준다
  out.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return out.map((it) => ({ ...it, startTime: fromMinutes(toMinutes(it.startTime)) }));
}
