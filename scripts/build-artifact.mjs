/**
 * Vite 빌드 결과를 단일 HTML 파일로 합친다.
 *
 * 공유 링크(Artifact)에서 쓰는 형태다. 이 문서는 자기 자신의 소스를 그대로 담고 있어서,
 * 일정이 바뀌면 상태만 갈아끼운 새 문서를 스스로 발행할 수 있다 (src/lib/share.ts 참고).
 *
 * 출력: dist-artifact/tabi.html — Artifact 발행용 본문 조각(문서 골격은 발행 시 감싸진다)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const assetsDir = join(distDir, 'assets');
const outDir = join(root, 'dist-artifact');

const assets = readdirSync(assetsDir);
const jsName = assets.find((f) => f.endsWith('.js'));
const cssName = assets.find((f) => f.endsWith('.css'));
if (!jsName || !cssName) {
  throw new Error('dist/assets 에서 번들을 찾지 못했습니다. 먼저 `npm run build`를 실행하세요.');
}

const js = readFileSync(join(assetsDir, jsName), 'utf8');
const css = readFileSync(join(assetsDir, cssName), 'utf8');

// 번들 안에 </script> 가 있으면 인라인 스크립트가 조기 종료된다.
// 문자열 리터럴이 아니라면 손댈 수 없으므로 빌드를 멈춘다.
const CLOSE = '</' + 'script';
if (js.includes(CLOSE) || css.includes(CLOSE)) {
  throw new Error(`번들에 ${CLOSE} 가 들어 있어 단일 파일로 인라인할 수 없습니다.`);
}

/**
 * 링크를 처음 여는 사람이 빈 화면을 보지 않도록 예시 일정을 문서에 심어 둔다.
 * 앱과 같은 코드(createSampleTrip)로 만들어 두 경로가 어긋나지 않게 한다.
 */
function buildSeed() {
  const tmp = join(outDir, '.sample.mjs');
  mkdirSync(outDir, { recursive: true });
  execFileSync('npx', ['esbuild', 'src/lib/sample.ts', '--bundle', '--format=esm', `--outfile=${tmp}`, '--log-level=error'], {
    cwd: root,
    stdio: 'inherit',
  });
  return tmp;
}

const seedModule = await import(buildSeed());
const seedTrip = seedModule.createSampleTrip();
rmSync(join(outDir, '.sample.mjs'), { force: true });

const initialState = JSON.stringify({
  trips: [seedTrip],
  publishedAt: new Date().toISOString(),
}).replace(/</g, '\\u003c');
const close = '<' + '/script>';

// 폰트는 Artifact CSP가 허용하는 Google Fonts에서만 불러올 수 있다.
const html = `<title>Tabi 여행 계획</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap">
<style id="app-css">${css}</style>
<div id="root"></div>
<script id="app-state" type="application/json">${initialState}${close}
<script id="app-src" type="module">${js}${close}
`;

mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'tabi.html');
writeFileSync(out, html, 'utf8');

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`단일 파일 생성: ${out}`);
console.log(`  JS ${kb(js.length)} · CSS ${kb(css.length)} · 합계 ${kb(html.length)}`);
