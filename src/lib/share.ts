import { useSyncExternalStore } from 'react';
import type { Trip } from '../types';

/**
 * 공유 모드.
 *
 * 이 앱은 두 가지 환경에서 돈다.
 *  - local    : 로컬 개발 서버나 정적 호스팅. 데이터는 이 브라우저에만 남는다.
 *  - shared   : claude.ai Artifact로 발행된 페이지. 편집 권한이 있으면 페이지가
 *               자기 자신의 새 버전을 발행해서, 링크를 연 모든 사람이 같은 일정을 본다.
 *  - readonly : Artifact이지만 이 사람에게 쓰기 권한이 없는 경우.
 *
 * 여행 데이터(trips)만 공유한다. 구글맵 API 키를 비롯한 설정은 발행 문서에 절대 넣지 않는다
 * (넣으면 링크를 연 모든 사람에게 키가 노출된다).
 */
export type ShareMode = 'local' | 'shared' | 'readonly';
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface ArtifactNamespace {
  publish(html: string): Promise<{ version: string }>;
}

interface DownloadsNamespace {
  save(request: { filename: string; data: string | Blob }): Promise<{ status: 'saved' }>;
}

interface ClaudeGlobal {
  use(name: 'artifact'): Promise<ArtifactNamespace | null>;
  use(name: 'downloads'): Promise<DownloadsNamespace | null>;
}

const STATE_EL = 'app-state';
const SRC_EL = 'app-src';
const CSS_EL = 'app-css';
const READONLY_KEY = 'tabi.readonly.v1';
const UI_KEY = 'tabi.ui.restore.v1';

export interface EmbeddedState {
  trips: Trip[];
  publishedAt: string;
}

/* ------------------------------------------------------------------ *
 * 발행 문서에 심어둔 상태 읽기
 * ------------------------------------------------------------------ */

export function readEmbeddedState(): EmbeddedState | null {
  const el = document.getElementById(STATE_EL);
  if (!el?.textContent?.trim()) return null;
  try {
    const parsed = JSON.parse(el.textContent) as Partial<EmbeddedState>;
    if (!Array.isArray(parsed.trips) || parsed.trips.length === 0) return null;
    return { trips: parsed.trips, publishedAt: parsed.publishedAt ?? '' };
  } catch (e) {
    console.warn('[share] 심어둔 상태를 읽지 못했습니다', e);
    return null;
  }
}

/** Artifact 안에서 실행 중인지 — 문서에 자기 소스가 들어 있어야 재발행이 가능하다 */
export function isPublishable(): boolean {
  return !!document.getElementById(SRC_EL) && !!document.getElementById(STATE_EL);
}

/* ------------------------------------------------------------------ *
 * 문서 재구성
 * ------------------------------------------------------------------ */

/** `</script>`가 그대로 들어가면 문서가 깨지므로 막아준다 */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * 페이지의 정본을 다시 만들어 낸다.
 *
 * 살아 있는 DOM을 직렬화하지 않는다. 문서에 원본 그대로 들어 있는
 * 스타일(app-css)과 스크립트(app-src)를 다시 쓰고, 상태만 갈아끼운다.
 */
/** 갤러리·브라우저 탭에 보이는 이름 — 재발행해도 바뀌지 않게 고정한다 */
export const DOC_TITLE = 'Tabi 여행 계획';

const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap">';

export function buildDocument(trips: Trip[]): string {
  const css = document.getElementById(CSS_EL)?.textContent ?? '';
  const src = document.getElementById(SRC_EL)?.textContent ?? '';
  const state: EmbeddedState = { trips, publishedAt: new Date().toISOString() };
  const close = '<' + '/script>';

  return [
    '<!doctype html>',
    '<html lang="ko">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">',
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F2F7">',
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">',
    `<title>${DOC_TITLE}</title>`,
    FONT_LINK,
    `<style id="${CSS_EL}">${css}</style>`,
    '</head>',
    '<body>',
    '<div id="root"></div>',
    `<script id="${STATE_EL}" type="application/json">${safeJson(state)}${close}`,
    `<script id="${SRC_EL}" type="module">${src}${close}`,
    '</body>',
    '</html>',
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * 발행 상태 스토어
 * ------------------------------------------------------------------ */

interface ShareState {
  mode: ShareMode;
  status: SaveStatus;
  lastSavedAt: string | null;
  error: string | null;
}

let state: ShareState = {
  mode: 'local',
  status: 'idle',
  lastSavedAt: null,
  error: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(patch: Partial<ShareState>) {
  state = { ...state, ...patch };
  emit();
}

export function useShare(): ShareState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function shareState(): ShareState {
  return state;
}

/** 예전 방문에서 이미 쓰기 권한이 없다고 확인된 경우 */
export function knownReadOnly(): boolean {
  try {
    return localStorage.getItem(READONLY_KEY) === '1';
  } catch {
    return false;
  }
}

function markReadOnly() {
  try {
    localStorage.setItem(READONLY_KEY, '1');
  } catch {
    /* 저장 못 해도 동작에는 지장 없다 */
  }
  set({ mode: 'readonly', status: 'idle', error: null });
}

/* ------------------------------------------------------------------ *
 * 발행
 * ------------------------------------------------------------------ */

let namespace: ArtifactNamespace | null | undefined;
let pending: Trip[] | null = null;
let timer: number | undefined;
/** 시트가 열려 있는 동안에는 발행을 미룬다 — 발행 성공 시 화면이 새로고침되기 때문 */
let holdCount = 0;

const DEBOUNCE_MS = 2500;

async function namespaceOnce(): Promise<ArtifactNamespace | null> {
  if (namespace !== undefined) return namespace;
  const claude = (window as unknown as { claude?: ClaudeGlobal }).claude;
  if (!claude?.use) {
    namespace = null;
    return null;
  }
  namespace = await claude.use('artifact');
  return namespace;
}

/** 앱 시작 시 한 번 — 공유 모드인지 판별한다 */
export async function initShare(): Promise<ShareMode> {
  if (!isPublishable()) {
    set({ mode: 'local' });
    return 'local';
  }
  if (knownReadOnly()) {
    set({ mode: 'readonly' });
    return 'readonly';
  }
  const ns = await namespaceOnce();
  const mode: ShareMode = ns ? 'shared' : 'readonly';
  set({ mode });
  // 판별을 기다리는 동안 이미 편집했다면 그 변경분부터 발행한다
  if (mode === 'shared' && pending) {
    set({ status: 'dirty' });
    schedule();
  }
  if (mode === 'readonly') pending = null;
  return mode;
}

/** 편집 중(시트 열림 등)에는 발행을 보류한다 */
export function holdPublishing(): () => void {
  holdCount += 1;
  return () => {
    holdCount = Math.max(0, holdCount - 1);
    if (holdCount === 0 && pending) schedule();
  };
}

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void flush(), DEBOUNCE_MS);
}

/** 상태가 바뀌었음을 알린다. 실제 발행은 잠시 뒤 한 번에 모아서 한다. */
export function markDirty(trips: Trip[]) {
  if (state.mode === 'readonly') return;
  // 아직 모드 판별 중(local)일 수도 있으므로 변경분은 일단 담아 둔다.
  // 발행 가능한 문서가 아니면 initShare가 mode를 'local'로 확정하고 여기서 끝난다.
  pending = trips;
  if (state.mode !== 'shared') return;
  if (state.status !== 'saving') set({ status: 'dirty' });
  schedule();
}

/** 지금 바로 발행 (저장 버튼) */
export async function flush(): Promise<void> {
  window.clearTimeout(timer);
  if (!pending || state.mode !== 'shared') return;
  if (holdCount > 0) return; // 시트가 닫히면 다시 예약된다

  const ns = await namespaceOnce();
  if (!ns) {
    markReadOnly();
    return;
  }

  const payload = pending;
  set({ status: 'saving', error: null });

  // 발행에 성공하면 이 화면도 새 버전으로 새로고침된다. 보던 위치를 남겨 둔다.
  saveUiState();

  try {
    await ns.publish(buildDocument(payload));
    pending = null;
    set({ status: 'saved', lastSavedAt: new Date().toISOString() });
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'upstream_error';
    if (code === 'not_writer' || code === 'not_granted' || code === 'consent_required' || code === 'not_declared') {
      markReadOnly();
      return;
    }
    if (code === 'conflict') {
      // 다른 사람이 먼저 저장했다. 화면은 이미 최신 버전으로 새로고침되는 중이므로 아무것도 하지 않는다.
      set({ status: 'idle', error: null });
      return;
    }
    if (code === 'rate_limited') {
      set({ status: 'dirty', error: '저장이 너무 잦아 잠시 뒤 다시 시도합니다' });
      window.setTimeout(() => void flush(), 15000);
      return;
    }
    set({
      status: 'error',
      error: code === 'too_large' ? '일정이 너무 커서 저장하지 못했습니다' : '저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    });
  }
}

/* ------------------------------------------------------------------ *
 * 파일 내려받기
 * ------------------------------------------------------------------ */

export type SaveOutcome = 'saved' | 'declined' | 'unavailable';

/**
 * 파일을 사용자에게 건넨다.
 *
 * 공유 링크(Artifact) 안에서는 `<a download>`가 동작하지 않으므로 downloads 기능을 쓴다.
 * 직접 호스팅한 경우에는 평범한 blob 링크로 내려받는다.
 */
export async function saveFile(filename: string, data: string | Blob): Promise<SaveOutcome> {
  const claude = (window as unknown as { claude?: ClaudeGlobal }).claude;
  if (claude?.use) {
    try {
      const downloads = await claude.use('downloads');
      if (downloads) {
        await downloads.save({ filename, data });
        return 'saved';
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') return 'declined';
      console.warn('[share] 저장 실패', e);
      return 'unavailable';
    }
  }

  try {
    const blob =
      data instanceof Blob
        ? data
        : new Blob([data], { type: filename.endsWith('.json') ? 'application/json' : 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return 'saved';
  } catch (e) {
    console.warn('[share] 내려받기 실패', e);
    return 'unavailable';
  }
}

/* ------------------------------------------------------------------ *
 * 새로고침 너머로 보던 위치 유지
 * ------------------------------------------------------------------ */

export interface UiState {
  tab: string;
  dayIndex: number;
  scrollY: number;
}

let uiSnapshot: UiState = { tab: 'plan', dayIndex: 0, scrollY: 0 };

export function setUiSnapshot(next: Partial<UiState>) {
  uiSnapshot = { ...uiSnapshot, ...next };
}

function saveUiState() {
  try {
    sessionStorage.setItem(UI_KEY, JSON.stringify({ ...uiSnapshot, scrollY: window.scrollY }));
  } catch {
    /* 무시 */
  }
}

export function takeUiState(): UiState | null {
  try {
    const raw = sessionStorage.getItem(UI_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(UI_KEY);
    return JSON.parse(raw) as UiState;
  } catch {
    return null;
  }
}
