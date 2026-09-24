import type { Category } from '../types';
import { regionById } from '../data/regions';
import { LOCAL_RESTAURANTS } from '../data/restaurants';
import { haversine } from './geo';
import { INTEREST_LABEL, PACE_LABEL, briefCandidates, type PlanBrief, type PlanDraft, type DraftDay, type DraftItem } from './autoPlan';
import { addDaysISO } from './time';
import { ClaudeError, callClaudeTool, type ClaudeOptions, type ToolSpec } from './claude';

/**
 * Claude에게 일정을 맡기는 엔진. 호출 자체는 claude.ts 가 맡는다.
 */

export { AI_MODELS, DEFAULT_AI_MODEL } from './claude';

export const CATEGORIES: Category[] = ['sight', 'food', 'cafe', 'shopping', 'stay', 'transport', 'activity', 'etc'];

/** 응답 형태를 못 박는다. strict 라서 모든 칸이 필수 — 없는 값은 빈 문자열/0 으로 받는다 */
const PLAN_TOOL = {
  name: 'submit_plan',
  description: '완성한 여행 일정을 제출한다. 반드시 이 도구로만 답한다.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '이 계획을 한 줄로 (예: "오사카 3일 · 먹거리 중심 · 느긋하게")' },
      tips: {
        type: 'array',
        description: '알아두면 좋은 것 3~6개. 휴무일·마감시간·예약·교통패스처럼 실제로 도움이 되는 것만.',
        items: { type: 'string' },
      },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            dayNumber: { type: 'integer', description: '1부터 시작하는 며칠째' },
            title: { type: 'string', description: '그날을 요약하는 동네 이름 (예: "아사쿠사 · 스카이트리")' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  startTime: { type: 'string', description: '"HH:mm" 24시간제' },
                  durationMin: { type: 'integer', description: '그 장소에 머무는 시간(분)' },
                  title: { type: 'string', description: '장소 이름. 후보 목록에 있으면 그 이름을 그대로 쓴다' },
                  category: { type: 'string', enum: CATEGORIES },
                  cost: { type: 'integer', description: '1인 예상 비용(현지 통화). 모르면 0' },
                  notes: { type: 'string', description: '왜 여기인지, 무엇을 하면 좋은지 한 줄. 없으면 빈 문자열' },
                },
                required: ['startTime', 'durationMin', 'title', 'category', 'cost', 'notes'],
                additionalProperties: false,
              },
            },
          },
          required: ['dayNumber', 'title', 'items'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'tips', 'days'],
    additionalProperties: false,
  },
} as const;

/** 예전 이름 — 호출하는 쪽이 instanceof 로 쓴다 */
export { ClaudeError as AiPlanError } from './claude';

/** Claude 에게 일정을 짜게 한다. 실패하면 ClaudeError 를 던지고, 호출한 쪽이 규칙 엔진으로 돌아간다 */
export async function buildAiPlan(brief: PlanBrief, startDate: string, opts: ClaudeOptions): Promise<PlanDraft> {
  const payload = await callClaudeTool<AiPayload>(opts, {
    system: SYSTEM_PROMPT,
    content: buildUserPrompt(brief, startDate),
    tool: PLAN_TOOL as unknown as ToolSpec,
  });
  return toDraft(payload, brief, startDate);
}

/* ─────────────────────────── 프롬프트 ─────────────────────────── */

const SYSTEM_PROMPT = `당신은 한국인 여행자를 위한 일정 플래너입니다.
사용자가 대충 적은 메모를 읽고, 실제로 그대로 다닐 수 있는 하루 단위 일정을 짭니다.

반드시 지킬 것:
- 답은 submit_plan 도구 호출 하나로만 합니다. 도구 밖에 설명을 쓰지 마세요.
- 모든 시각은 "HH:mm" 24시간제입니다.
- 하루는 보통 09:00~10:00 에 시작해서 21:00 전에 끝냅니다.
- 장소 사이 이동시간을 반드시 비워 둡니다. 앞 일정이 끝나는 시각에 다음 일정을 붙이지 마세요.
- 하루에 도시를 여러 번 가로지르지 마세요. 같은 날은 가까운 동네끼리 묶습니다.
- 점심(12시 전후)과 저녁(18~19시)을 매일 넣습니다.
- 후보 목록에 있는 장소는 이름을 목록에 적힌 그대로 씁니다(좌표를 그 이름으로 찾습니다).
  목록에 없는 곳을 넣어도 되지만, 실제로 있는 곳이어야 합니다. 지어내지 마세요.
- 사용자가 "꼭 가고 싶다"고 적은 곳은 반드시 넣고, "빼달라"고 한 곳은 넣지 않습니다.
- 영업시간과 휴무일을 지킵니다. 아침에만 여는 시장을 오후에 넣지 마세요.
- tips 에는 실제로 도움이 되는 것만 적습니다. 확실하지 않은 요금·운영시간은 단정하지 말고
  "확인하세요"라고 적습니다. 일반론("편한 신발을 신으세요")은 쓰지 마세요.
- 숙소와 항공편은 넣지 않습니다. 사용자가 직접 넣습니다.`;

function buildUserPrompt(brief: PlanBrief, startDate: string): string {
  const region = regionById(brief.regionId);
  const candidates = briefCandidates(brief);
  const lines: string[] = [];

  lines.push('## 사용자가 적은 메모');
  lines.push(brief.memo || '(메모 없음)');
  lines.push('');
  lines.push('## 읽어낸 조건');
  lines.push(`- 지역: ${brief.regionName}${region ? ` (${region.country}, ${region.currency})` : ''}`);
  lines.push(`- 기간: ${brief.days}일, ${startDate} 부터 ${addDaysISO(startDate, brief.days - 1)} 까지`);
  lines.push(`- 인원: ${brief.travelers}명`);
  lines.push(`- 속도: ${PACE_LABEL[brief.pace]}`);
  if (brief.interests.length) lines.push(`- 관심사: ${brief.interests.map((i) => INTEREST_LABEL[i]).join(', ')}`);
  if (brief.mustVisit.length) lines.push(`- 꼭 갈 곳: ${brief.mustVisit.join(', ')}`);
  if (brief.avoid.length) lines.push(`- 뺄 곳: ${brief.avoid.join(', ')}`);
  lines.push('');
  lines.push('조건은 메모에서 기계적으로 뽑은 것입니다. 메모 원문과 어긋나면 메모를 따르세요.');
  lines.push('');

  if (candidates.length) {
    lines.push('## 후보 장소 (이 이름 그대로 쓰면 좌표가 자동으로 붙습니다)');
    for (const poi of candidates) {
      const bits = [poi.name, `[${poi.area}]`];
      if (poi.stayMin) bits.push(`보통 ${poi.stayMin}분`);
      if (poi.hours) {
        const closed = poi.hours.closedDays?.map((d) => '일월화수목금토'[d]).join('·');
        bits.push(`${poi.hours.open}~${poi.hours.close}${closed ? ` (${closed} 휴무)` : ''}`);
      }
      if (poi.tags?.length) bits.push(poi.tags.join('·'));
      if (poi.blurb) bits.push(`— ${poi.blurb}`);
      lines.push(`- ${bits.join(' · ')}`);
    }
    lines.push('');
  }

  const eats = nearbyRestaurants(brief);
  if (eats.length) {
    lines.push('## 현지인 비중이 높은 식당 (참고용, 이 중에서 고르지 않아도 됩니다)');
    for (const r of eats) {
      lines.push(`- ${r.name} · ${r.genre} · ${r.address ?? ''}${r.openHint ? ` · ${r.openHint}` : ''}${r.note ? ` — ${r.note}` : ''}`);
    }
    lines.push('');
  }

  lines.push(`${brief.days}일 일정을 submit_plan 으로 제출하세요.`);
  return lines.join('\n');
}

function nearbyRestaurants(brief: PlanBrief) {
  const center = regionById(brief.regionId)?.center;
  if (!center) return [];
  return LOCAL_RESTAURANTS
    .filter((r) => haversine(center, r.coord) < 40_000)
    .sort((a, b) => b.localScore - a.localScore)
    .slice(0, 12);
}

/* ─────────────────────────── 응답 → 초안 ─────────────────────────── */

interface AiPayload {
  summary?: string;
  tips?: string[];
  days?: Array<{
    dayNumber?: number;
    title?: string;
    items?: Array<{
      startTime?: string;
      durationMin?: number;
      title?: string;
      category?: string;
      cost?: number;
      notes?: string;
    }>;
  }>;
}

function toDraft(payload: AiPayload, brief: PlanBrief, startDate: string): PlanDraft {
  const days: DraftDay[] = [];

  for (const [i, day] of (payload.days ?? []).entries()) {
    const index = Number.isFinite(day.dayNumber) ? Math.max(1, Number(day.dayNumber)) - 1 : i;
    const items: DraftItem[] = [];
    for (const raw of day.items ?? []) {
      const title = (raw.title ?? '').trim();
      if (!title) continue;
      items.push({
        title,
        category: CATEGORIES.includes(raw.category as Category) ? (raw.category as Category) : 'sight',
        startTime: normalizeTime(raw.startTime) ?? '09:00',
        durationMin: clampInt(raw.durationMin, 15, 600, 90),
        cost: clampInt(raw.cost, 0, 10_000_000, 0),
        notes: raw.notes?.trim() || undefined,
      });
    }
    if (items.length === 0) continue;
    days.push({ date: addDaysISO(startDate, index), title: day.title?.trim() || undefined, items });
  }

  if (days.length === 0) throw new ClaudeError('Claude가 빈 일정을 돌려줬습니다.', 'shape');

  days.sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    summary: payload.summary?.trim() || `${brief.regionName} ${brief.days}일`,
    tips: (payload.tips ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 8),
    engine: 'claude',
  };
}

export function normalizeTime(value: string | undefined): string | null {
  const m = value?.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
