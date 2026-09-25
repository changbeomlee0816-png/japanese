import type { Category, Settings } from '../types';
import { callClaudeTool } from './claude';
import { prepareImage } from './translate';
import { CATEGORIES, normalizeTime } from './aiPlan';

/**
 * 영수증 사진 → 지출 한 건. Claude 키가 있을 때만 쓴다.
 * 일본 영수증은 세로로 길고 합계(合計)·소계·세금이 뒤섞여 있어서, 기기 글자 인식으로는 금액을 믿기 어렵다.
 */

export interface ReceiptResult {
  merchant: string;
  total: number;
  currency: string;
  date?: string;
  time?: string;
  category: Category;
  method?: 'cash' | 'card';
  /** 산 것들을 한국어로 짧게 */
  summary: string;
}

const RECEIPT_TOOL = {
  name: 'submit_receipt',
  description: '영수증에서 읽은 내용을 제출한다. 반드시 이 도구로만 답한다.',
  input_schema: {
    type: 'object',
    properties: {
      merchant: { type: 'string', description: '가게 이름. 일본어면 한국어 발음이나 뜻을 괄호로 덧붙인다 (예: "ローソン (로손)")' },
      total: { type: 'number', description: '실제로 낸 최종 합계 (合計·お支払い). 소계·세금·거스름돈이 아니다' },
      currency: { type: 'string', description: 'ISO 통화 코드 (JPY, KRW, USD …)' },
      date: { type: 'string', description: '"YYYY-MM-DD". 없으면 빈 문자열' },
      time: { type: 'string', description: '"HH:mm". 없으면 빈 문자열' },
      category: { type: 'string', enum: CATEGORIES, description: 'food=식당·편의점 음식, cafe, shopping, transport=교통, stay=숙소, sight/activity=입장료·체험, etc' },
      method: { type: 'string', enum: ['cash', 'card', ''], description: '現金=cash, クレジット·カード·電子マネー=card, 모르면 빈 문자열' },
      summary: { type: 'string', description: '산 것을 한국어로 짧게 (예: "라멘 2, 교자 1, 생맥주 2")' },
    },
    required: ['merchant', 'total', 'currency', 'date', 'time', 'category', 'method', 'summary'],
    additionalProperties: false,
  },
};

export async function scanReceipt(file: File, settings: Settings, fallbackCurrency: string): Promise<ReceiptResult> {
  const { base64 } = await prepareImage(file);
  const r = await callClaudeTool<Record<string, unknown>>(
    { apiKey: settings.anthropicApiKey, model: settings.aiModel },
    {
      system: '당신은 여행 가계부를 대신 적어 주는 비서입니다. 영수증 사진에서 최종 결제 금액과 가게, 날짜를 정확히 읽습니다. 흐려서 확실하지 않은 숫자는 추측하지 말고 0 으로 둡니다. 답은 submit_receipt 도구 호출 하나로만 합니다.',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: '이 영수증을 가계부에 적을 수 있게 읽어 주세요.' },
      ],
      tool: RECEIPT_TOOL,
      maxTokens: 2000,
      effort: 'low',
    },
  );
  const total = Math.max(0, Number(r.total) || 0);
  const currency = /^[A-Z]{3}$/.test(String(r.currency ?? '')) ? String(r.currency) : fallbackCurrency;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(r.date ?? '')) ? String(r.date) : undefined;
  const category = CATEGORIES.includes(r.category as Category) ? (r.category as Category) : 'etc';
  const method = r.method === 'cash' || r.method === 'card' ? r.method : undefined;
  return {
    merchant: String(r.merchant ?? '').trim(),
    total,
    currency,
    date,
    time: normalizeTime(String(r.time ?? '')) ?? undefined,
    category,
    method,
    summary: String(r.summary ?? '').trim(),
  };
}
