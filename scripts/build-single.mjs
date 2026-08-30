/**
 * dist/ 빌드 결과를 완전한 단일 HTML 문서 하나로 합친다.
 *
 * 정적 파일 하나만 올릴 수 있는 곳(예: Supabase Storage 공개 버킷)에 배포하기 위한 것이다.
 * scripts/build-artifact.mjs 와 달리 app-src / app-state 를 심지 않는다.
 * 그 표식이 있으면 앱이 "Artifact 자체 발행 모드"로 동작하기 때문이다.
 *
 * 출력: dist-single/index.html
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'dist', 'assets');
const outDir = join(root, 'dist-single');

const assets = readdirSync(assetsDir);
const jsName = assets.find((f) => f.endsWith('.js'));
const cssName = assets.find((f) => f.endsWith('.css'));
if (!jsName || !cssName) {
  throw new Error('dist/assets 에서 번들을 찾지 못했습니다. 먼저 `npm run build`를 실행하세요.');
}

const js = readFileSync(join(assetsDir, jsName), 'utf8');
const css = readFileSync(join(assetsDir, cssName), 'utf8');

const CLOSE = '</' + 'script';
if (js.includes(CLOSE) || css.includes(CLOSE)) {
  throw new Error(`번들에 ${CLOSE} 가 들어 있어 단일 파일로 인라인할 수 없습니다.`);
}

const close = '<' + '/script>';
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F2F7">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">
<meta name="description" content="여행 일정을 넣으면 이동 경로·비용·현지 맛집까지 정리해주는 여행 계획 앱">
<title>Tabi 여행 계획</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${js}${close}
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'index.html');
writeFileSync(out, html, 'utf8');
console.log(`단일 파일 생성: ${out} (${(html.length / 1024).toFixed(1)} kB)`);
