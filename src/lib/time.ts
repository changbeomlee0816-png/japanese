/** 시간/날짜 유틸 — 앱 전체가 "HH:mm" 문자열과 로컬 Date를 섞어 쓰기 때문에 여기로 모았다 */

export const pad = (n: number) => String(n).padStart(2, '0');

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  const wrapped = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

export function addMinutes(hhmm: string, delta: number): string {
  return fromMinutes(toMinutes(hhmm) + delta);
}

/** "YYYY-MM-DD" + "HH:mm" → 로컬 시간대 Date */
export function dateTimeOf(date: string, hhmm: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, mo - 1, d, h || 0, mi || 0, 0, 0);
}

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return todayISO(dt);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDateKo(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}년 ${m}월 ${d}일 (${WEEKDAYS[dt.getDay()]})`;
}

export function formatDateShort(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  const dt = dateTimeOf(date, '00:00');
  return `${m}/${d} ${WEEKDAYS[dt.getDay()]}`;
}

/** 분 단위를 "1시간 20분" 같은 한국어로 */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
}

/** 남은 시간 카운트다운 "2시간 13분 뒤" / "12분 지남" */
export function formatRelative(ms: number): string {
  const abs = Math.abs(ms);
  const min = Math.floor(abs / 60000);
  const label = min < 1 ? '곧' : formatDuration(min);
  if (min < 1) return ms >= 0 ? '곧' : '방금';
  return ms >= 0 ? `${label} 뒤` : `${label} 지남`;
}

export function diffDays(a: string, b: string): number {
  return Math.round((dateTimeOf(b, '00:00').getTime() - dateTimeOf(a, '00:00').getTime()) / 86400000);
}
