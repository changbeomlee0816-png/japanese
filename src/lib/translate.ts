import type { Settings } from '../types';
import { ClaudeError, callClaudeTool, type ClaudeOptions } from './claude';
import { exactPhrase } from '../data/phrases';
import { isKanaOnly, kanaToHangul } from './kana';

/**
 * 번역 엔진.
 *
 *  - Claude (키가 있을 때): 번역 + 읽는 법 + 공손한/편한 말 + 쓰임새. 사진 속 글자도 읽는다.
 *  - 회화집 (항상): 여행에서 자주 쓰는 문장은 검증된 번역을 먼저 쓴다. 인터넷도 필요 없다.
 *  - 무료 번역 MyMemory (키가 없을 때): 아무 문장이나 되지만 품질이 들쭉날쭉하고, 읽는 법은 주지 않는다.
 *  - 사진 글자 읽기 Tesseract (키가 없을 때): 기기에서 글자를 읽은 뒤 무료 번역으로 옮긴다.
 */

export type Direction = 'ko2ja' | 'ja2ko';
export type Engine = 'claude' | 'phrasebook' | 'free' | 'ocr' | 'saved';

export const ENGINE_LABEL: Record<Engine, string> = {
  claude: 'Claude',
  phrasebook: '회화집',
  free: '무료 번역',
  ocr: '기기 글자 인식 + 무료 번역',
  saved: '최근 번역',
};

export interface TextResult {
  engine: Engine;
  direction: Direction;
  source: string;
  target: string;
  /** 일본어 쪽의 읽는 법(가나). ko2ja 면 번역문, ja2ko 면 원문의 읽는 법 */
  reading?: string;
  /** reading 을 한글로 — "어떻게 말하는지" */
  hangul?: string;
  romaji?: string;
  /** 더 공손한 말 / 편한 말 (ko2ja) */
  variants?: Array<{ label: string; text: string; reading?: string; hangul?: string }>;
  note?: string;
}

export interface ImageBlock {
  ja: string;
  reading?: string;
  hangul?: string;
  ko: string;
  price?: string;
  note?: string;
}

export interface ImageResult {
  engine: Engine;
  kind: 'menu' | 'sign' | 'text' | 'other';
  summary: string;
  blocks: ImageBlock[];
}

export class TranslateError extends Error {}

function claudeOpts(settings: Settings, signal?: AbortSignal): ClaudeOptions {
  return { apiKey: settings.anthropicApiKey, model: settings.aiModel, signal };
}

const withHangul = (reading?: string) => (reading ? kanaToHangul(reading) : undefined);

/* ─────────────────────────── 글 번역 ─────────────────────────── */

export async function translateText(text: string, direction: Direction, settings: Settings, signal?: AbortSignal): Promise<TextResult> {
  const source = text.trim();
  if (!source) throw new TranslateError('번역할 글을 입력하세요.');

  // 회화집 문장이면 그게 가장 믿을 만하다 — 키가 있어도 먼저 보여 준다
  if (direction === 'ko2ja') {
    const hit = exactPhrase(source);
    if (hit && !settings.anthropicApiKey) {
      return { engine: 'phrasebook', direction, source, target: hit.ja, reading: hit.reading, hangul: kanaToHangul(hit.reading) };
    }
  }

  if (settings.anthropicApiKey) {
    try {
      return await translateWithClaude(source, direction, claudeOpts(settings, signal));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      // 키 문제·네트워크 문제면 무료 번역으로라도 — 무엇이 잘못됐는지는 알려 준다
      const fallback = await translateFree(source, direction, signal).catch(() => null);
      if (fallback) return { ...fallback, note: `${e instanceof ClaudeError ? e.message : 'Claude 오류'} — 무료 번역으로 대신했습니다.` };
      throw new TranslateError(e instanceof ClaudeError ? e.message : '번역하지 못했습니다.');
    }
  }
  return translateFree(source, direction, signal);
}

const TEXT_TOOL = {
  name: 'submit_translation',
  description: '번역 결과를 제출한다. 반드시 이 도구로만 답한다.',
  input_schema: {
    type: 'object',
    properties: {
      translation: { type: 'string', description: '번역문' },
      reading: { type: 'string', description: '일본어 쪽의 읽는 법. 히라가나로, 조사 は·を·へ 는 소리 나는 대로 わ·お·え 로, 어절마다 띄어 쓴다' },
      romaji: { type: 'string', description: 'reading 의 로마자 (헵번식)' },
      polite: { type: 'string', description: '한국어→일본어일 때 더 공손한 말(점원·어른에게). 번역문과 같으면 빈 문자열' },
      politeReading: { type: 'string', description: 'polite 의 읽는 법 (reading 과 같은 규칙). 없으면 빈 문자열' },
      casual: { type: 'string', description: '한국어→일본어일 때 친구에게 쓰는 편한 말. 없으면 빈 문자열' },
      casualReading: { type: 'string', description: 'casual 의 읽는 법. 없으면 빈 문자열' },
      note: { type: 'string', description: '여행자에게 도움이 되는 한 줄 (언제 쓰는지, 표지판이면 무슨 뜻인지). 없으면 빈 문자열' },
    },
    required: ['translation', 'reading', 'romaji', 'polite', 'politeReading', 'casual', 'casualReading', 'note'],
    additionalProperties: false,
  },
};

const TEXT_SYSTEM = `당신은 일본을 여행하는 한국인을 돕는 통역사입니다.

한국어→일본어:
- translation 에는 여행자가 점원·역무원에게 그대로 말해도 되는 자연스러운 정중체(です・ます)를 씁니다.
- reading 은 translation 을 읽는 법입니다. 한자는 모두 히라가나로 풀고, 조사는 소리 나는 대로 적습니다.
- polite 는 더 공손한 표현(없으면 빈 문자열), casual 은 친구 사이 말투입니다.
- 사람 이름·가게 이름 같은 고유명사는 일본에서 쓰는 표기로 옮깁니다.

일본어→한국어:
- translation 에는 자연스러운 한국어를 씁니다. 메뉴·표지판이면 무엇인지 알 수 있게 옮깁니다.
- reading 은 원문 일본어를 읽는 법(히라가나)입니다. polite·casual 은 빈 문자열로 둡니다.
- note 에는 알아 두면 좋은 뜻이나 주의(예: "정기 휴일 안내입니다")를 한 줄로 씁니다.

답은 submit_translation 도구 호출 하나로만 합니다.`;

async function translateWithClaude(source: string, direction: Direction, opts: ClaudeOptions): Promise<TextResult> {
  const payload = await callClaudeTool<Record<string, string>>(opts, {
    system: TEXT_SYSTEM,
    content: `${direction === 'ko2ja' ? '한국어→일본어' : '일본어→한국어'}\n\n${source}`,
    tool: TEXT_TOOL,
    maxTokens: 2000,
    effort: 'low',
  });
  const translation = (payload.translation ?? '').trim();
  if (!translation) throw new ClaudeError('번역문이 비어 있습니다.', 'shape');
  const reading = (payload.reading ?? '').trim() || undefined;

  const variants: TextResult['variants'] = [];
  if (direction === 'ko2ja') {
    const polite = (payload.polite ?? '').trim();
    const casual = (payload.casual ?? '').trim();
    if (polite && polite !== translation) {
      const r = (payload.politeReading ?? '').trim() || undefined;
      variants.push({ label: '더 공손하게', text: polite, reading: r, hangul: withHangul(r) });
    }
    if (casual && casual !== translation) {
      const r = (payload.casualReading ?? '').trim() || undefined;
      variants.push({ label: '친구에게', text: casual, reading: r, hangul: withHangul(r) });
    }
  }

  return {
    engine: 'claude',
    direction,
    source,
    target: translation,
    reading,
    hangul: withHangul(reading),
    romaji: (payload.romaji ?? '').trim() || undefined,
    variants,
    note: (payload.note ?? '').trim() || undefined,
  };
}

/* ─────────────────────────── 무료 번역 (MyMemory) ─────────────────────────── */

const MYMEMORY = 'https://api.mymemory.translated.net/get';
/** 한 번에 보낼 수 있는 길이 — MyMemory 는 500바이트까지 받는다 */
const CHUNK_BYTES = 450;

function chunks(text: string): string[] {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  // 문장·줄 단위로 끊어 담는다
  for (const piece of text.split(/(?<=[.!?。！？\n])/)) {
    if (enc.encode(cur + piece).length > CHUNK_BYTES && cur) { out.push(cur); cur = ''; }
    if (enc.encode(piece).length > CHUNK_BYTES) {
      // 한 문장이 너무 길면 글자 단위로 자른다
      let part = '';
      for (const ch of piece) {
        if (enc.encode(part + ch).length > CHUNK_BYTES) { out.push(part); part = ''; }
        part += ch;
      }
      cur = part;
    } else cur += piece;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function decodeEntities(text: string): string {
  if (!/&[#a-z0-9]+;/i.test(text)) return text;
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

export async function freeTranslate(text: string, direction: Direction, signal?: AbortSignal): Promise<string> {
  const pair = direction === 'ko2ja' ? 'ko|ja' : 'ja|ko';
  const parts: string[] = [];
  for (const chunk of chunks(text)) {
    let res: Response;
    try {
      res = await fetch(`${MYMEMORY}?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(pair)}`, { signal });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new TranslateError('인터넷에 연결되어 있지 않습니다. 회화집은 인터넷 없이도 됩니다.');
    }
    if (res.status === 429) {
      throw new TranslateError('오늘 무료 번역 한도를 다 썼습니다. 회화집은 계속 쓸 수 있고, 설정에서 Claude API 키를 넣으면 번역도 계속됩니다.');
    }
    const json = (await res.json().catch(() => null)) as {
      responseData?: { translatedText?: string };
      responseStatus?: number | string;
      quotaFinished?: boolean;
    } | null;
    if (!json || json.quotaFinished || Number(json.responseStatus) === 429) {
      throw new TranslateError('오늘 무료 번역 한도를 다 썼습니다. 설정에서 Claude API 키를 넣으면 계속 쓸 수 있습니다.');
    }
    if (Number(json.responseStatus) !== 200 || !json.responseData?.translatedText) {
      throw new TranslateError('무료 번역이 응답하지 않았습니다. 잠시 뒤 다시 시도하세요.');
    }
    parts.push(decodeEntities(json.responseData.translatedText));
  }
  return parts.join(direction === 'ko2ja' ? '' : ' ').trim();
}

async function translateFree(source: string, direction: Direction, signal?: AbortSignal): Promise<TextResult> {
  const target = await freeTranslate(source, direction, signal);
  // 가나만 있으면 읽는 법을 바로 알 수 있다. 한자가 섞이면 소리 듣기로 대신한다
  const jaSide = direction === 'ko2ja' ? target : source;
  const reading = isKanaOnly(jaSide) ? jaSide : undefined;
  return { engine: 'free', direction, source, target, reading, hangul: withHangul(reading) };
}

/* ─────────────────────────── 사진 번역 ─────────────────────────── */

/** 사진을 긴 변 1568px JPEG 로 줄인다 — Claude 가 권하는 크기이고 올리는 시간도 줄어든다 */
export async function prepareImage(file: File, maxSide = 1568): Promise<{ dataUrl: string; base64: string; canvas: HTMLCanvasElement }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new TranslateError('사진을 열지 못했습니다. JPG·PNG 사진을 골라 주세요.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new TranslateError('사진을 처리하지 못했습니다.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1), canvas };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const IMAGE_TOOL = {
  name: 'submit_image_translation',
  description: '사진 속 일본어를 읽고 번역한 결과를 제출한다. 반드시 이 도구로만 답한다.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['menu', 'sign', 'text', 'other'], description: '메뉴판 / 안내판·표지판 / 그 밖의 글 / 글이 거의 없음' },
      summary: { type: 'string', description: '이 사진이 무엇인지 한국어 한 줄 (예: "라멘 가게 식권 발매기 메뉴입니다")' },
      blocks: {
        type: 'array',
        description: '읽은 글을 읽는 순서대로. 메뉴판이면 요리 하나가 한 블록',
        items: {
          type: 'object',
          properties: {
            ja: { type: 'string', description: '사진에 적힌 일본어 그대로' },
            reading: { type: 'string', description: 'ja 를 읽는 법 (히라가나). 숫자·기호뿐이면 빈 문자열' },
            ko: { type: 'string', description: '한국어 번역' },
            price: { type: 'string', description: '가격이 적혀 있으면 그대로 (예: "¥980"). 없으면 빈 문자열' },
            note: { type: 'string', description: '메뉴면 무엇이 든 요리인지(돼지고기·해산물·매운 정도 등), 표지판이면 해야 할 일. 없으면 빈 문자열' },
          },
          required: ['ja', 'reading', 'ko', 'price', 'note'],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'summary', 'blocks'],
    additionalProperties: false,
  },
};

const IMAGE_SYSTEM = `당신은 일본을 여행하는 한국인을 위해 사진 속 일본어를 읽어 주는 통역사입니다.
- 사진에 보이는 일본어를 빠짐없이, 읽는 순서대로 옮깁니다. 세로쓰기·손글씨도 읽습니다.
- 메뉴판이면 요리마다 한 블록으로 나누고, 가격과 무엇으로 만든 요리인지 note 에 적습니다.
  돼지고기·소고기·해산물·날것·매운 것처럼 먹기 전에 알아야 할 것은 꼭 적습니다.
- 표지판·안내문이면 뜻과 함께 여행자가 해야 할 일(예: "여기서 신발을 벗으세요")을 note 에 적습니다.
- 흐려서 확실하지 않은 글자는 추측하지 말고 ko 에 "(잘 안 보임)" 이라고 적습니다.
답은 submit_image_translation 도구 호출 하나로만 합니다.`;

export async function translateImage(
  file: File,
  settings: Settings,
  onStatus: (message: string) => void,
  signal?: AbortSignal,
): Promise<{ result: ImageResult; preview: string }> {
  onStatus('사진 준비 중…');
  const { dataUrl, base64, canvas } = await prepareImage(file);

  if (settings.anthropicApiKey) {
    onStatus('Claude가 읽는 중…');
    try {
      const payload = await callClaudeTool<{ kind?: string; summary?: string; blocks?: Array<Record<string, string>> }>(
        claudeOpts(settings, signal),
        {
          system: IMAGE_SYSTEM,
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: '이 사진 속 일본어를 읽고 한국어로 옮겨 주세요.' },
          ],
          tool: IMAGE_TOOL,
          maxTokens: 8000,
          effort: 'low',
        },
      );
      const blocks = (payload.blocks ?? [])
        .map((b) => ({
          ja: (b.ja ?? '').trim(),
          reading: (b.reading ?? '').trim() || undefined,
          ko: (b.ko ?? '').trim(),
          price: (b.price ?? '').trim() || undefined,
          note: (b.note ?? '').trim() || undefined,
        }))
        .filter((b) => b.ja || b.ko)
        .map((b) => ({ ...b, hangul: withHangul(b.reading) }));
      const kind = (['menu', 'sign', 'text', 'other'] as const).find((k) => k === payload.kind) ?? 'other';
      return { result: { engine: 'claude', kind, summary: (payload.summary ?? '').trim(), blocks }, preview: dataUrl };
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      onStatus(`${e instanceof ClaudeError ? e.message : 'Claude 오류'} — 기기에서 직접 읽습니다…`);
    }
  }

  // 키가 없거나 Claude 가 실패 — 기기에서 글자를 읽고 무료 번역으로 옮긴다
  const lines = await recognizeJapanese(canvas, onStatus);
  if (lines.length === 0) {
    return { result: { engine: 'ocr', kind: 'other', summary: '사진에서 일본어를 찾지 못했습니다.', blocks: [] }, preview: dataUrl };
  }
  onStatus('번역하는 중…');
  let failure = '';
  const translated = await freeTranslate(lines.join('\n'), 'ja2ko', signal).catch((e) => {
    failure = e instanceof TranslateError ? e.message : '번역하지 못했습니다.';
    return '';
  });
  const koLines = translated.split(/\n/);
  const blocks = lines.map((ja, i) => {
    const reading = isKanaOnly(ja) ? ja : undefined;
    return { ja, reading, hangul: withHangul(reading), ko: (koLines[i] ?? '').trim() || (i === 0 ? translated : '') };
  });
  return {
    result: {
      engine: 'ocr',
      kind: 'text',
      // 글자는 읽었으니 번역이 안 돼도 보여 준다 — 듣기로 발음은 확인할 수 있다
      summary: translated ? `글 ${lines.length}줄을 읽었습니다.` : `글 ${lines.length}줄을 읽었습니다. ${failure}`,
      blocks,
    },
    preview: dataUrl,
  };
}

/* ─────────────────────────── 기기에서 글자 읽기 (Tesseract) ─────────────────────────── */

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const TESSDATA = 'https://tessdata.projectnaptha.com/4.0.0_fast';

interface TesseractWorker {
  recognize(image: HTMLCanvasElement): Promise<{ data: { text: string; lines?: Array<{ text: string; confidence: number }> } }>;
  terminate(): Promise<void>;
}
interface TesseractGlobal {
  createWorker(lang: string, oem: number, options: Record<string, unknown>): Promise<TesseractWorker>;
}

let tesseractLoading: Promise<TesseractGlobal> | null = null;

/** 처음 쓸 때만 받아 온다 (엔진 약 3MB + 일본어 자료 1.5MB). 이후에는 기기에 남아 있다 */
function loadTesseract(): Promise<TesseractGlobal> {
  const existing = (window as unknown as { Tesseract?: TesseractGlobal }).Tesseract;
  if (existing) return Promise.resolve(existing);
  tesseractLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_URL;
    script.async = true;
    script.onload = () => {
      const t = (window as unknown as { Tesseract?: TesseractGlobal }).Tesseract;
      if (t) resolve(t);
      else reject(new TranslateError('글자 인식 엔진을 불러오지 못했습니다.'));
    };
    script.onerror = () => {
      tesseractLoading = null;
      reject(new TranslateError('글자 인식 엔진을 받지 못했습니다. 인터넷 연결을 확인하세요.'));
    };
    document.head.appendChild(script);
  });
  return tesseractLoading;
}

async function recognizeJapanese(canvas: HTMLCanvasElement, onStatus: (m: string) => void): Promise<string[]> {
  onStatus('글자 인식 엔진 준비 중… (처음 한 번만 몇 MB를 받습니다)');
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker('jpn', 1, {
    langPath: TESSDATA,
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') onStatus(`사진 속 글자 읽는 중… ${Math.round(m.progress * 100)}%`);
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    const raw = data.lines?.length ? data.lines.filter((l) => l.confidence >= 40).map((l) => l.text) : data.text.split('\n');
    return raw
      // Tesseract 는 일본어 글자 사이에 빈칸을 넣는다
      .map((l) =>
        l
          .replace(/(?<=[\u3000-\u9FFF\uFF00-\uFFEF])\s+(?=[\u3000-\u9FFF\uFF00-\uFFEF])/g, '')
          // 숫자 사이 빈칸 ("6 0 0円")
          .replace(/(?<=\d)\s+(?=\d)/g, '')
          .trim(),
      )
      .filter((l) => /[\u3041-\u30FF\u4E00-\u9FFF]/.test(l));
  } finally {
    void worker.terminate();
  }
}
