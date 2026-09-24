/**
 * Claude Messages API 를 브라우저에서 직접 부르는 얇은 클라이언트.
 *
 * 공식 SDK 대신 fetch 를 쓰는 이유: @anthropic-ai/sdk 는 트리셰이킹 후에도 번들에 183KB 를
 * 더한다(측정값). 오프라인으로 열려야 하는 PWA 라 supabase.ts·xlsx.ts 와 같은 방식을 택했다.
 * 요청 형태는 공식 문서의 raw HTTP 예제를 따른다.
 *
 * 키는 이 브라우저의 localStorage 에만 있고 api.anthropic.com 외에는 아무 데도 가지 않는다.
 * (api.anthropic.com 은 anthropic-dangerous-direct-browser-access 헤더가 있으면 CORS 를 허용한다 — 확인함)
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export const AI_MODELS = [
  { id: 'claude-opus-5', label: 'Opus 5', hint: '가장 똑똑함 · 비용 높음' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', hint: '균형' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', hint: '가장 저렴 · 빠름' },
] as const;

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

export class ClaudeError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'rate' | 'network' | 'shape' | 'refusal' | 'other') {
    super(message);
  }
}

export interface ClaudeOptions {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } };

/**
 * 도구 하나로 구조화된 답을 받는다.
 *
 * 도구를 강제(tool_choice: tool)하지 않고 auto + 지시문을 쓴다 — 확장 사고가 켜진 모델과 충돌하지 않는다.
 * 대신 strict 스키마로 모양을 못 박고, 혹시 본문에 JSON 을 적어 오면 그것도 읽는다.
 */
export async function callClaudeTool<T>(
  opts: ClaudeOptions,
  req: {
    system: string;
    content: string | ContentBlock[];
    tool: ToolSpec;
    maxTokens?: number;
    /** 번역처럼 짧고 빨라야 하는 일은 low. Haiku 4.5 는 effort 를 받지 않는다 */
    effort?: 'low' | 'medium' | 'high';
  },
): Promise<T> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: req.maxTokens ?? 16000,
    system: req.system,
    messages: [{ role: 'user', content: req.content }],
    tools: [{ ...req.tool, strict: true }],
    tool_choice: { type: 'auto' },
  };
  if (req.effort && !opts.model.startsWith('claude-haiku')) body.output_config = { effort: req.effort };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ClaudeError('네트워크에 연결하지 못했습니다.', 'network');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) throw new ClaudeError('API 키가 올바르지 않습니다.', 'auth');
    if (res.status === 429) throw new ClaudeError('요청이 너무 잦습니다. 잠시 뒤 다시 시도하세요.', 'rate');
    if (res.status === 529) throw new ClaudeError('Claude가 지금 붐빕니다. 잠시 뒤 다시 시도하세요.', 'rate');
    throw new ClaudeError(`Claude가 응답하지 않았습니다 (${res.status}). ${shorten(detail)}`, 'other');
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown; text?: string }>;
    stop_reason?: string;
  };
  if (json.stop_reason === 'refusal') throw new ClaudeError('Claude가 이 요청에 답하지 않았습니다.', 'refusal');

  const call = json.content?.find((b) => b.type === 'tool_use' && b.name === req.tool.name);
  const payload = call?.input ?? extractJson(json.content);
  if (!payload || typeof payload !== 'object') throw new ClaudeError('Claude의 답을 읽지 못했습니다.', 'shape');
  return payload as T;
}

/** 도구를 안 쓰고 본문에 JSON 을 적어 온 경우의 보험 */
function extractJson(content: Array<{ type: string; text?: string }> | undefined): unknown {
  const text = content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function shorten(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
}
