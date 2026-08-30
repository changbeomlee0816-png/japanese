/**
 * 오프라인 지원.
 *
 * 여행지에서 데이터가 안 터져도 일정은 봐야 한다.
 *  - 앱 껍데기(HTML/JS/CSS)는 미리 받아두고 캐시를 먼저 준다 (cache-first)
 *  - 일정 데이터(Supabase)와 지도·날씨는 항상 네트워크를 먼저 시도하고,
 *    실패하면 마지막으로 성공한 응답을 돌려준다 (network-first)
 *
 * 캐시 이름에 빌드 해시가 들어가 있어 새 버전을 배포하면 옛 캐시는 지워진다.
 */

const VERSION = 'tabi-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

function isShellAsset(url) {
  return url.origin === self.location.origin && (url.pathname.includes('/assets/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest'));
}

function isData(url) {
  return url.hostname.endsWith('supabase.co') || url.hostname.endsWith('open-meteo.com');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 지도 타일·구글 API는 캐시하지 않는다 (용량이 크고 이용약관도 걸린다)
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) return;

  // 페이지 이동: 네트워크 먼저, 안 되면 캐시된 앱 껍데기
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r ?? caches.match('./'))),
    );
    return;
  }

  if (isShellAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (isData(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? Promise.reject(new Error('offline')))),
    );
  }
});
