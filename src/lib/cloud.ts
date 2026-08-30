import { useSyncExternalStore } from 'react';
import type { Trip } from '../types';
import {
  CloudError,
  cloudConfigured,
  createSharedTrip,
  fetchSharedTrip,
  fetchUpdatedAt,
  saveSharedTrip,
} from './supabase';

/**
 * 공유 링크 동기화.
 *
 * 링크 구조
 *   보기 링크 : https://.../?t=<일정 id>
 *   수정 링크 : https://.../?t=<일정 id>#k=<수정 토큰>
 *
 * 수정 토큰은 URL 프래그먼트(#)에 담는다. 프래그먼트는 서버로 전송되지 않아
 * 호스팅 서버 로그에 남지 않는다. 앱은 토큰을 받는 즉시 브라우저에 저장하고
 * 주소창에서 지워, 주소를 그대로 복사해도 수정 권한이 새어 나가지 않게 한다.
 */

export type CloudMode = 'off' | 'owner' | 'viewer';
export type CloudStatus = 'idle' | 'loading' | 'dirty' | 'saving' | 'saved' | 'error';

interface CloudState {
  mode: CloudMode;
  status: CloudStatus;
  tripId: string | null;
  error: string | null;
  lastSyncedAt: string | null;
  /** 다른 기기에서 수정본이 올라왔을 때 */
  remoteUpdate: boolean;
}

const TOKEN_PREFIX = 'tabi.editToken.';
const SAVE_DEBOUNCE_MS = 1800;
const POLL_MS = 15000;

let state: CloudState = {
  mode: 'off',
  status: 'idle',
  tripId: null,
  error: null,
  lastSyncedAt: null,
  remoteUpdate: false,
};

const listeners = new Set<() => void>();

function set(patch: Partial<CloudState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useCloud(): CloudState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function cloudState(): CloudState {
  return state;
}

/* ------------------------------------------------------------------ *
 * 토큰 보관
 * ------------------------------------------------------------------ */

function readToken(id: string): string | null {
  try {
    return localStorage.getItem(TOKEN_PREFIX + id);
  } catch {
    return null;
  }
}

function writeToken(id: string, token: string) {
  try {
    localStorage.setItem(TOKEN_PREFIX + id, token);
  } catch {
    /* 저장하지 못해도 이번 세션 동안은 메모리로 동작한다 */
  }
}

let memoryToken: string | null = null;

function currentToken(): string | null {
  return memoryToken ?? (state.tripId ? readToken(state.tripId) : null);
}

/* ------------------------------------------------------------------ *
 * 링크
 * ------------------------------------------------------------------ */

function baseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function viewLink(id = state.tripId): string {
  return id ? `${baseUrl()}?t=${id}` : baseUrl();
}

export function editLink(id = state.tripId): string {
  const token = currentToken();
  return id && token ? `${baseUrl()}?t=${id}#k=${token}` : viewLink(id);
}

/** 주소창을 보기 링크로 정리한다 (토큰은 저장해 두고 URL에서 지운다) */
function normalizeUrl(id: string) {
  window.history.replaceState(null, '', `${window.location.pathname}?t=${id}`);
}

/* ------------------------------------------------------------------ *
 * 시작
 * ------------------------------------------------------------------ */

type ApplyTrips = (trips: Trip[]) => void;

let applyTrips: ApplyTrips = () => {};
let lastSyncedAt: string | null = null;
let pollTimer: number | undefined;

/**
 * 앱 시작 시 한 번. URL에 ?t= 가 있으면 그 일정을 불러온다.
 * 반환값이 true면 스토어의 로컬 일정 대신 공유본이 적용된다.
 */
export async function initCloud(onTrips: ApplyTrips): Promise<CloudMode> {
  applyTrips = onTrips;

  if (!cloudConfigured()) {
    set({ mode: 'off' });
    return 'off';
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get('t');
  if (!id) {
    set({ mode: 'off' });
    return 'off';
  }

  // 프래그먼트로 넘어온 수정 토큰을 저장하고 주소창에서 지운다
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const incoming = hash.get('k');
  if (incoming) {
    memoryToken = incoming;
    writeToken(id, incoming);
  }
  normalizeUrl(id);

  const token = incoming ?? readToken(id);
  memoryToken = token;
  set({ tripId: id, status: 'loading', mode: token ? 'owner' : 'viewer' });

  try {
    const trip = await fetchSharedTrip(id);
    if (!trip) {
      set({ status: 'error', error: '이 링크의 일정을 찾을 수 없습니다. 주소를 다시 확인해 주세요.' });
      return state.mode;
    }
    lastSyncedAt = trip.updated_at;
    applyTrips(trip.data.trips);
    set({ status: 'idle', error: null, lastSyncedAt: trip.updated_at });
    startPolling();
  } catch (e) {
    set({ status: 'error', error: describe(e) });
  }

  return state.mode;
}

function describe(e: unknown): string {
  if (e instanceof CloudError) {
    switch (e.code) {
      case 'offline':
        return '인터넷 연결을 확인해 주세요.';
      case 'not_authorized':
        return '이 링크로는 일정을 수정할 수 없습니다.';
      case 'too_large':
        return '일정이 너무 커서 저장하지 못했습니다.';
      case 'rate_limited':
        return '잠시 뒤에 다시 시도해 주세요.';
      case 'not_found':
        return '일정을 찾을 수 없습니다.';
      default:
        return '서버와 통신하지 못했습니다.';
    }
  }
  return '알 수 없는 오류가 발생했습니다.';
}

/* ------------------------------------------------------------------ *
 * 공유 링크 만들기
 * ------------------------------------------------------------------ */

export async function publishTrip(title: string, trips: Trip[]): Promise<string> {
  set({ status: 'saving', error: null });
  try {
    const { id, editToken } = await createSharedTrip(title, trips);
    memoryToken = editToken;
    writeToken(id, editToken);
    normalizeUrl(id);
    lastSyncedAt = new Date().toISOString();
    set({ mode: 'owner', tripId: id, status: 'saved', lastSyncedAt });
    startPolling();
    return viewLink(id);
  } catch (e) {
    set({ status: 'error', error: describe(e) });
    throw e;
  }
}

/**
 * 이 브라우저를 공유 링크에서 떼어낸다. 링크와 데이터는 서버에 그대로 남는다.
 * 원래 쓰던 내 일정으로 돌아가야 하므로 주소를 바꾸고 실제로 다시 읽어들인다.
 */
export function detach() {
  stopPolling();
  memoryToken = null;
  lastSyncedAt = null;
  set({ mode: 'off', tripId: null, status: 'idle', error: null, remoteUpdate: false });
  window.location.href = window.location.pathname;
}

/* ------------------------------------------------------------------ *
 * 저장
 * ------------------------------------------------------------------ */

let pending: { title: string; trips: Trip[] } | null = null;
let saveTimer: number | undefined;

export function markDirty(trips: Trip[], title: string) {
  if (state.mode !== 'owner' || !state.tripId) return;
  pending = { title, trips };
  if (state.status !== 'saving') set({ status: 'dirty' });
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
}

export async function flush(): Promise<void> {
  window.clearTimeout(saveTimer);
  const token = currentToken();
  if (!pending || !state.tripId || !token || state.mode !== 'owner') return;

  const payload = pending;
  pending = null;
  set({ status: 'saving', error: null });

  try {
    const updatedAt = await saveSharedTrip(state.tripId, token, payload.title, payload.trips);
    lastSyncedAt = updatedAt;
    set({ status: 'saved', lastSyncedAt: updatedAt, error: null, remoteUpdate: false });
  } catch (e) {
    pending = payload; // 다음 기회에 다시 시도한다
    if (e instanceof CloudError && e.code === 'not_authorized') {
      set({ mode: 'viewer', status: 'error', error: '수정 권한이 없어 저장하지 못했습니다.' });
      return;
    }
    set({ status: 'error', error: describe(e) });
  }
}

/* ------------------------------------------------------------------ *
 * 다른 사람의 변경 가져오기
 * ------------------------------------------------------------------ */

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(() => void poll(), POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
}

function stopPolling() {
  window.clearInterval(pollTimer);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', onVisible);
}

function onVisible() {
  if (document.visibilityState === 'visible') void poll();
}

async function poll() {
  if (!state.tripId || document.visibilityState === 'hidden') return;
  if (state.status === 'saving' || state.status === 'dirty' || pending) return;

  try {
    const updatedAt = await fetchUpdatedAt(state.tripId);
    if (!updatedAt || updatedAt === lastSyncedAt) return;

    if (state.mode === 'viewer') {
      // 보기만 하는 쪽은 바로 최신본으로 갱신한다
      await pull();
    } else {
      // 수정 권한이 있는 쪽은 내 편집을 덮어쓰지 않도록 알림만 띄운다
      set({ remoteUpdate: true });
    }
  } catch {
    /* 폴링 실패는 조용히 넘긴다 — 다음 주기에 다시 시도한다 */
  }
}

/** 서버의 최신 일정을 가져와 화면에 반영한다 */
export async function pull(): Promise<void> {
  if (!state.tripId) return;
  set({ status: 'loading' });
  try {
    const trip = await fetchSharedTrip(state.tripId);
    if (trip) {
      lastSyncedAt = trip.updated_at;
      applyTrips(trip.data.trips);
      set({ status: 'idle', lastSyncedAt: trip.updated_at, remoteUpdate: false, error: null });
    } else {
      set({ status: 'error', error: '일정을 찾을 수 없습니다.' });
    }
  } catch (e) {
    set({ status: 'error', error: describe(e) });
  }
}
