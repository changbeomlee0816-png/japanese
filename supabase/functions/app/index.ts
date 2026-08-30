/**
 * 여행 계획 앱을 서빙하는 정적 페이지 엔드포인트.
 *
 * Storage 공개 버킷은 HTML을 text/plain으로 강제해서 브라우저가 렌더링하지 않는다.
 * 그래서 여기서 파일을 읽어 text/html로 다시 내보낸다.
 *
 * 이 함수는 공개 문서 하나만 돌려준다. 사용자 데이터는 담지 않으며,
 * 일정 읽기/쓰기는 전부 별도의 trip_* RPC(링크 uuid + 수정 토큰 검사)를 거친다.
 * 브라우저가 인증 헤더 없이 열어야 하므로 JWT 검증은 꺼져 있다.
 */

const SITE_URL = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/site/index.html`;
const TTL_MS = 60_000;

let cached: { body: string; at: number } | null = null;

async function loadPage(): Promise<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.body;
  const res = await fetch(SITE_URL, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`storage ${res.status}`);
  const body = await res.text();
  cached = { body, at: Date.now() };
  return body;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const html = await loadPage();
    return new Response(req.method === 'HEAD' ? null : html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // 앱을 새로 올리면 1분 안에 반영된다
        'cache-control': 'public, max-age=60',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    });
  } catch (e) {
    console.error('페이지를 불러오지 못했습니다', e);
    return new Response('앱을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
});
