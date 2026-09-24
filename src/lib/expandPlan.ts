import type { Day, Item } from '../types';
import { lookupPoi, spotsForRegion, type PoiEntry } from '../data/poi';
import { REGIONS, findRegion, regionById } from '../data/regions';
import { defaultDuration } from './parsePlan';
import { fillWindow, type DraftItem, type Interest } from './autoPlan';
import { fromMinutes, toMinutes } from './time';
import { uid } from './id';
import { ClaudeError, callClaudeTool, type ClaudeOptions } from './claude';
import { CATEGORIES, clampInt, normalizeTime } from './aiPlan';

/**
 * 포괄적인 일정을 구체적인 경로로 펼친다.
 *
 *   14:00~18:00 교토 관광     →   14:00 기요미즈데라 → 15:40 산넨자카 → 16:40 기온
 *   오후 난바 쇼핑            →   도톤보리 → 신사이바시 → 아메리카무라
 *
 * "어디서 무엇을" 은 적었지만 "어느 가게·어느 절" 까지는 안 적은 줄을 찾아
 * 그 시간대를 실제로 돌 수 있는 장소들로 채운다.
 */

export interface BroadBlock {
  /** 날짜 안에서의 위치 */
  dayId: string;
  date: string;
  itemId: string;
  item: Item;
  /** 펼칠 지역 — 내장 사전에 없는 곳이면 undefined (Claude 만 펼칠 수 있다) */
  regionId?: string;
  /** 사람이 읽는 지역 이름 */
  areaLabel: string;
  /** 첫 번째로 들를 장소 ("아사쿠사 산책" 의 센소지) */
  anchor?: PoiEntry;
  /** 들르지는 않고 거기서 가까운 곳부터 도는 기준점 ("난바 쇼핑" 의 난바역) */
  origin?: { lat: number; lng: number };
  start: number;
  end: number;
  interests: Interest[];
  lunch: boolean;
  dinner: boolean;
}

/** 구체적인 장소가 아니라 "하는 일" 을 뜻하는 말 */
const GENERIC = [
  '관광', '구경', '투어', '시내', '일대', '주변', '근처', '자유', '자유시간', '자유일정', '여행', '산책', '탐방', '돌아보기',
  '둘러보기', '돌기', '명소', '데이트', '나들이', '쇼핑', '맛집', '먹방', '먹거리', '카페', '카페투어', '사원', '절',
  '신사', '사찰', '투어', '야경', '구석구석', '코스', '일정', '하루', '오후', '오전', '종일', '반나절', '거리', '골목',
  '관광지', '핫플', '핫플레이스', '가볼만한곳', '가볼곳', '둘러봄', '구경하기', '산책하기', '관광하기', 'sightseeing', 'tour',
];

const INTEREST_WORDS: Array<{ interest: Interest; words: string[] }> = [
  { interest: 'shopping', words: ['쇼핑', '구매', '아울렛', '면세'] },
  { interest: 'food', words: ['맛집', '먹방', '먹거리', '식도락', '미식'] },
  { interest: 'cafe', words: ['카페', '디저트'] },
  { interest: 'history', words: ['절', '사원', '사찰', '신사', '역사', '유적', '박물관'] },
  { interest: 'night', words: ['야경', '밤'] },
  { interest: 'nature', words: ['산책', '자연', '공원', '숲'] },
  { interest: 'photo', words: ['사진', '인생샷'] },
  { interest: 'market', words: ['시장'] },
  { interest: 'onsen', words: ['온천'] },
];

/** 펼칠 가치가 있는 최소 시간 */
const MIN_WINDOW = 100;

function words(text: string): string[] {
  return text.replace(/[()[\],.~\-–·/]/g, ' ').split(/\s+/).filter(Boolean);
}

/** 낱말 하나가 '하는 일' 인가 — "구경", "구경하기", "쇼핑을". "신사이바시" 는 아니다 */
const SUFFIX = /^(?:하기|하고|하러|을|를|이|가|은|는|도|만|위주|중심|투어|코스)?$/;
function isGenericWord(w: string): boolean {
  return GENERIC.some((g) => w === g || (w.startsWith(g) && SUFFIX.test(w.slice(g.length))));
}

/** 제목에서 지역 이름을 빼고 남은 말이 모두 '하는 일' 인가 */
function isGenericRest(rest: string): boolean {
  const ws = words(rest);
  return ws.every(isGenericWord);
}

function stripRegion(title: string): { region?: (typeof REGIONS)[number]; rest: string } {
  const region = findRegion(title);
  if (!region) return { rest: title };
  let rest = title;
  for (const name of [region.name, ...region.aliases].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    rest = rest.replace(re, ' ');
  }
  return { region, rest: rest.trim() };
}

/** 이 항목이 포괄적인 일정인지, 그렇다면 무엇으로 펼칠지 */
function classify(item: Item, fallbackRegionId?: string): Pick<BroadBlock, 'regionId' | 'areaLabel' | 'anchor' | 'origin' | 'interests'> | null {
  if (item.transportToNext) return null;
  const title = item.title.trim();
  if (!title) return null;
  // 역·숙소는 펼치지 않는다 — 단 "난바 쇼핑" 처럼 할 일이 붙어 있으면 역 이름이 동네를 가리킨 것이다
  if ((item.category === 'transport' || item.category === 'stay') && !words(title).some(isGenericWord)) return null;

  // 이름 전체가 실제 장소면 구체적인 일정이다 — "후시미 이나리 신사" 의 '신사' 는 할 일이 아니라 이름이다
  const exact = lookupPoi(title);
  const norm = (t: string) => t.toLowerCase().replace(/[\s·・]/g, '');
  if (exact && exact.category !== 'transport') {
    // 이름을 떼어 내고 남는 말이 없거나 할 일이 아니면 구체적인 장소다. "도톤보리 먹방" 은 남는 말이 할 일이라 펼친다
    const names = [exact.name, ...exact.aliases].sort((a, b) => b.length - a.length);
    const hit = names.find((n) => norm(title).includes(norm(n)));
    if (hit) {
      const rest = words(title.replace(new RegExp(hit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' '));
      if (rest.length === 0 || !rest.some(isGenericWord)) return null;
    }
  }

  const interests = INTEREST_WORDS.filter(({ words: ws }) => ws.some((w) => title.includes(w))).map((x) => x.interest);

  // ① "교토 관광", "오사카 시내 구경" — 지역 이름 + 하는 일
  const { region, rest } = stripRegion(title);
  if (region && region.id !== 'korea' && (rest === '' || isGenericRest(rest))) {
    return { regionId: region.id, areaLabel: region.name, interests };
  }

  // ② "난바 쇼핑", "아사쿠사 산책" — 구체적인 동네 + 하는 일 → 거기서 시작해 이어 간다
  const ws = words(title);
  const generic = ws.filter(isGenericWord);
  if (generic.length > 0 && generic.length < ws.length) {
    const placePart = ws.filter((w) => !generic.includes(w)).join(' ');
    const hit = lookupPoi(placePart);
    if (hit && hit.regionId !== 'korea') {
      // 역·공항("난바" → 난바역)은 출발점으로만 쓰고 들르는 곳에는 넣지 않는다
      return hit.category === 'transport'
        ? { regionId: hit.regionId, areaLabel: placePart, origin: hit.coord, interests }
        : { regionId: hit.regionId, areaLabel: hit.name, anchor: hit, interests };
    }
    // 내장 사전에 없는 곳("타이베이 시내 관광") — Claude 만 펼칠 수 있다
    if (!hit && /[가-힣a-z]/i.test(placePart)) return { areaLabel: placePart, interests };
  }

  // ③ "자유시간", "관광" — 하는 일만. 여행 지역에서 펼친다
  if (isGenericRest(title) && fallbackRegionId && fallbackRegionId !== 'korea') {
    return { regionId: fallbackRegionId, areaLabel: regionById(fallbackRegionId)?.name ?? '', interests };
  }
  return null;
}

/** 여러 날짜에서 펼칠 일정을 찾는다 */
export function findBroadBlocks(days: Day[], tripRegionId?: string): BroadBlock[] {
  const blocks: BroadBlock[] = [];
  for (const day of days) {
    const items = day.items;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item.startTime) continue;
      // 앞뒤 일정이 가리키는 지역이 있으면 그걸 기본으로 쓴다
      const nearRegion = [items[i - 1], items[i + 1]]
        .map((it) => (it ? lookupPoi(it.title)?.regionId : undefined))
        .find((r) => r && r !== 'korea');
      const kind = classify(item, nearRegion ?? tripRegionId);
      if (!kind) continue;

      const start = toMinutes(item.startTime);
      const next = items.slice(i + 1).find((it) => it.startTime && toMinutes(it.startTime) > start);
      // 범위를 적었으면 그대로, 기본값이면 다음 일정 전까지
      const implicit =
        item.durationMin === defaultDuration(item.category) || item.durationMin === lookupPoi(item.title)?.stayMin;
      const end = !implicit
        ? start + item.durationMin
        : next
          ? Math.max(start + item.durationMin, toMinutes(next.startTime) - 15)
          : start + Math.max(item.durationMin, 180);
      if (end - start < MIN_WINDOW) continue;

      // 같은 날 다른 곳에서 이미 밥을 먹으면 그 끼니는 넣지 않는다
      const others = items.filter((it) => it !== item && it.startTime);
      const eatsAt = (from: number, to: number) =>
        others.some((it) => it.category === 'food' && toMinutes(it.startTime) >= from && toMinutes(it.startTime) <= to);
      const lunch = start <= 11 * 60 + 30 && end >= 13 * 60 && !eatsAt(11 * 60, 14 * 60);
      const dinner = start <= 18 * 60 && end >= 19 * 60 + 30 && !eatsAt(17 * 60 + 30, 20 * 60 + 30);

      blocks.push({ dayId: day.id, date: day.date, itemId: item.id, item, ...kind, start, end, lunch, dinner });
    }
  }
  return blocks;
}

export interface Expansion {
  block: BroadBlock;
  items: DraftItem[];
}

/** 내장 사전으로 펼친다 — 지역을 모르는 일정은 건너뛴다 */
export function expandLocally(days: Day[], blocks: BroadBlock[], seed = 0): Expansion[] {
  // 여행 전체에서 이미 가는 곳은 다시 넣지 않는다
  const exclude = new Set<string>();
  for (const d of days) for (const it of d.items) {
    const hit = lookupPoi(it.title);
    if (hit) exclude.add(hit.name);
    exclude.add(it.title);
  }
  const usedMeals = new Set<string>(exclude);

  const out: Expansion[] = [];
  for (const block of blocks) {
    if (!block.regionId) continue;
    const items = fillWindow({
      regionId: block.regionId,
      interests: block.interests,
      start: block.start,
      end: block.end,
      exclude,
      usedMeals,
      anchor: block.anchor,
      origin: block.origin,
      lunch: block.lunch,
      dinner: block.dinner,
      seed,
    });
    if (items.length === 0) continue;
    for (const it of items) exclude.add(it.title);
    out.push({ block, items });
  }
  return out;
}

/** 펼친 결과를 날짜들에 끼워 넣는다 — 포괄적인 줄 하나가 구체적인 줄 여러 개로 바뀐다 */
export function applyExpansions(days: Day[], expansions: Expansion[]): Day[] {
  if (expansions.length === 0) return days;
  const byItem = new Map(expansions.map((e) => [e.block.itemId, e]));
  return days.map((day) => {
    if (!day.items.some((it) => byItem.has(it.id))) return day;
    const items: Item[] = [];
    for (const it of day.items) {
      const exp = byItem.get(it.id);
      if (!exp) { items.push(it); continue; }
      const label = `${it.title} (${fromMinutes(exp.block.start)}~${fromMinutes(exp.block.end)})`;
      exp.items.forEach((d, k) => {
        items.push({
          id: uid('item'),
          title: d.title,
          category: d.category,
          place: d.coord
            ? { name: d.title, address: d.address, coord: d.coord, source: 'local' }
            : { name: d.title, address: d.address },
          startTime: d.startTime,
          durationMin: d.durationMin,
          cost: d.cost,
          // 원래 적은 말은 첫 장소에 남겨 둔다 — 무엇을 펼친 건지 알 수 있게
          notes: [k === 0 ? `「${label}」을 펼침` : '', d.notes ?? ''].filter(Boolean).join(' · ') || undefined,
        });
      });
    }
    return { ...day, items };
  });
}

/* ─────────────────────────── Claude 로 펼치기 ─────────────────────────── */

const EXPAND_TOOL = {
  name: 'submit_routes',
  description: '각 포괄적인 일정을 구체적인 장소 목록으로 펼쳐 제출한다. 반드시 이 도구로만 답한다.',
  input_schema: {
    type: 'object',
    properties: {
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '요청에 적힌 블록 id 그대로' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  startTime: { type: 'string', description: '"HH:mm" 24시간제' },
                  durationMin: { type: 'integer' },
                  title: { type: 'string', description: '실제 장소 이름. 후보 목록에 있으면 그 이름 그대로' },
                  category: { type: 'string', enum: CATEGORIES },
                  cost: { type: 'integer', description: '1인 예상 비용(현지 통화). 모르면 0' },
                  notes: { type: 'string', description: '거기서 할 일 한 줄. 없으면 빈 문자열' },
                },
                required: ['startTime', 'durationMin', 'title', 'category', 'cost', 'notes'],
                additionalProperties: false,
              },
            },
          },
          required: ['id', 'items'],
          additionalProperties: false,
        },
      },
    },
    required: ['blocks'],
    additionalProperties: false,
  },
};

const EXPAND_SYSTEM = `당신은 한국인 여행자의 일정을 다듬는 플래너입니다.
사용자가 "14:00~18:00 교토 관광" 처럼 포괄적으로 적은 시간대를, 실제로 그대로 걸어 다닐 수 있는
구체적인 장소 순서로 바꿉니다.

반드시 지킬 것:
- 답은 submit_routes 도구 호출 하나로만 합니다.
- 각 블록의 시간대 안에서만 일정을 짭니다. 시작 시각보다 이르거나 끝 시각을 넘기지 마세요.
- 장소 사이 이동시간을 비워 둡니다. 가까운 곳끼리 이어서 동선이 되돌아가지 않게 합니다.
- 블록 앞뒤에 이미 있는 일정과 같은 곳은 넣지 않습니다.
- "쇼핑", "절 구경" 처럼 할 일을 적었으면 그 성격에 맞는 곳을 고릅니다.
- 식사는 블록 설명에 "점심 필요"/"저녁 필요"라고 적힌 경우에만 넣습니다.
- 후보 목록에 있는 장소는 목록의 이름을 그대로 씁니다. 목록에 없는 곳도 되지만 실제로 있는 곳이어야 합니다.
- 영업시간을 지킵니다. 확실하지 않으면 notes 에 "영업시간 확인" 이라고 적습니다.`;

/** Claude 로 펼친다 — 내장 사전에 없는 지역도 된다. 실패하면 ClaudeError 를 던진다 */
export async function expandWithClaude(days: Day[], blocks: BroadBlock[], opts: ClaudeOptions): Promise<Expansion[]> {
  if (blocks.length === 0) return [];
  const lines: string[] = ['## 펼칠 블록'];
  blocks.forEach((b, i) => {
    const day = days.find((d) => d.id === b.dayId);
    const idx = day?.items.findIndex((it) => it.id === b.itemId) ?? -1;
    const before = idx > 0 ? day!.items[idx - 1] : undefined;
    const after = day && idx >= 0 ? day.items[idx + 1] : undefined;
    const needs = [b.lunch ? '점심 필요' : '', b.dinner ? '저녁 필요' : ''].filter(Boolean).join(', ') || '식사 넣지 않음';
    lines.push(
      `- id: b${i} · ${b.date} · ${fromMinutes(b.start)}~${fromMinutes(b.end)} · "${b.item.title}"` +
        `${b.item.notes ? ` (메모: ${b.item.notes})` : ''} · 지역: ${b.areaLabel} · ${needs}` +
        `${before ? ` · 바로 앞: ${before.startTime} ${before.title}` : ''}${after ? ` · 바로 뒤: ${after.startTime} ${after.title}` : ''}`,
    );
  });

  const regions = [...new Set(blocks.map((b) => b.regionId).filter(Boolean))] as string[];
  for (const id of regions) {
    lines.push('', `## ${regionById(id)?.name ?? id} 후보 장소`);
    for (const poi of spotsForRegion(id)) {
      if (poi.category === 'transport') continue;
      lines.push(`- ${poi.name} [${poi.area}]${poi.stayMin ? ` 보통 ${poi.stayMin}분` : ''}${poi.hours ? ` ${poi.hours.open}~${poi.hours.close}` : ''}${poi.tags?.length ? ` ${poi.tags.join('·')}` : ''}`);
    }
  }
  const already = [...new Set(days.flatMap((d) => d.items.map((it) => it.title)))];
  lines.push('', `## 여행에 이미 있는 곳 (다시 넣지 말 것)`, already.join(', '));

  const payload = await callClaudeTool<{ blocks?: Array<{ id?: string; items?: Array<Record<string, unknown>> }> }>(opts, {
    system: EXPAND_SYSTEM,
    content: lines.join('\n'),
    tool: EXPAND_TOOL,
  });

  const out: Expansion[] = [];
  for (const raw of payload.blocks ?? []) {
    const index = Number(String(raw.id ?? '').replace(/\D/g, ''));
    const block = blocks[index];
    if (!block) continue;
    const items: DraftItem[] = [];
    for (const r of raw.items ?? []) {
      const title = String(r.title ?? '').trim();
      const time = normalizeTime(r.startTime as string | undefined);
      if (!title || !time) continue;
      const minutes = toMinutes(time);
      // 시간대 밖으로 나간 답은 버린다
      if (minutes < block.start - 5 || minutes >= block.end) continue;
      const hit = lookupPoi(title);
      items.push({
        title,
        category: CATEGORIES.includes(r.category as never) ? (r.category as DraftItem['category']) : 'sight',
        startTime: time,
        durationMin: clampInt(r.durationMin, 15, block.end - minutes, 60),
        cost: clampInt(r.cost, 0, 10_000_000, 0),
        notes: String(r.notes ?? '').trim() || hit?.blurb,
        address: hit?.area,
        coord: hit && hit.category !== 'transport' ? hit.coord : undefined,
      });
    }
    items.sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (items.length) out.push({ block, items });
  }
  if (out.length === 0) throw new ClaudeError('Claude가 펼친 일정을 돌려주지 않았습니다.', 'shape');
  return out;
}
