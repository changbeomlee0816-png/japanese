import type { Trip } from '../types';

/**
 * Supabase 연동 (의존성 없이 REST RPC만 사용).
 *
 * 보안 모델은 DB 쪽에 있다.
 *  - trips 테이블은 RLS를 켜고 정책을 두지 않아 anon 키로 직접 읽고 쓸 수 없다.
 *  - 읽기는 trip_get(id) — 링크에 담긴 uuid를 알아야만 가능하다.
 *  - 쓰기는 trip_save(id, edit_token, ...) — 수정 토큰까지 맞아야 한다.
 * 따라서 여기 있는 anon 키는 공개돼도 되는 값이다.
 */

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export function cloudConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_KEY;
}

export class CloudError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CloudError('네트워크에 연결할 수 없습니다', 'offline');
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { message?: string } | null;
    const message = detail?.message ?? `요청 실패 (${res.status})`;
    // DB 함수가 raise 한 메시지를 그대로 코드로 쓴다
    const code =
      message === 'not_authorized' ? 'not_authorized'
        : message === 'payload_too_large' ? 'too_large'
          : message === 'rate_limited' ? 'rate_limited'
            : res.status === 404 ? 'not_found'
              : 'upstream_error';
    throw new CloudError(message, code);
  }

  return (await res.json()) as T;
}

export interface CloudTrip {
  id: string;
  title: string;
  data: { trips: Trip[] };
  updated_at: string;
}

/** 공유 링크 하나 만들기. 수정 토큰은 이때 딱 한 번 받는다. */
export async function createSharedTrip(title: string, trips: Trip[]): Promise<{ id: string; editToken: string }> {
  const rows = await rpc<Array<{ id: string; edit_token: string }>>('trip_create', {
    p_title: title,
    p_data: { trips },
  });
  const row = rows[0];
  if (!row) throw new CloudError('공유 링크를 만들지 못했습니다', 'upstream_error');
  return { id: row.id, editToken: row.edit_token };
}

/** 링크에 담긴 id로 일정 읽기 */
export async function fetchSharedTrip(id: string): Promise<CloudTrip | null> {
  const rows = await rpc<CloudTrip[]>('trip_get', { p_id: id });
  return rows[0] ?? null;
}

/** 변경 여부만 확인 (폴링용, 응답이 타임스탬프 하나뿐이라 가볍다) */
export async function fetchUpdatedAt(id: string): Promise<string | null> {
  return await rpc<string | null>('trip_head', { p_id: id });
}

/** 수정 토큰이 맞을 때만 저장된다 */
export async function saveSharedTrip(
  id: string,
  editToken: string,
  title: string,
  trips: Trip[],
): Promise<string> {
  return await rpc<string>('trip_save', {
    p_id: id,
    p_token: editToken,
    p_title: title,
    p_data: { trips },
  });
}
