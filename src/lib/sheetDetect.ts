import { lookupPoi } from '../data/poi';
import { readClockCell, readDayCell } from './parsePlan';

/**
 * 양식을 따르지 않은 엑셀에서 "어느 칸이 무엇인지"를 알아낸다.
 *
 * 사람마다 표를 다르게 만든다. 머리글이 없거나, 제목 줄이 위에 있거나, 칸 순서가 다르거나,
 * 시작·종료를 두 칸에 나눠 적거나, 날짜 대신 시간만 적는다.
 * 그래서 머리글 이름에만 기대지 않고 **칸에 든 내용**을 본다.
 *
 * 두 가지 모양을 알아본다.
 *  - 목록형: 한 줄이 일정 하나.   시간 | 내용 | 장소 | …
 *  - 시간표형: 줄은 시간, 칸은 날짜.  시간 | 1일차 | 2일차 | 3일차
 */

export type Role = 'date' | 'time' | 'end' | 'content' | 'place' | 'address' | 'cost' | 'duration';

export const ROLE_LABEL: Record<Role, string> = {
  date: '날짜', time: '시간', end: '종료 시각', content: '내용', place: '장소명',
  address: '주소', cost: '비용', duration: '소요시간',
};

export interface ListLayout {
  kind: 'list';
  /** 머리글 행 (없으면 -1) */
  headerRow: number;
  /** 첫 데이터 행 */
  dataRow: number;
  roles: Partial<Record<Role, number>>;
  /** 메모로 붙일 나머지 글자 칸 */
  notes: number[];
  /** 칸을 머리글로 알아봤는지, 내용으로 짐작했는지 */
  source: 'header' | 'content';
}

export interface GridLayout {
  kind: 'grid';
  headerRow: number;
  timeCol: number;
  /** 날짜별 칸과 그 칸의 머리글 */
  dayCols: Array<{ col: number; label: string }>;
}

export type SheetLayout = ListLayout | GridLayout;

/* ─────────────────────────── 머리글 이름 ─────────────────────────── */

const HEADER_ALIASES: Record<Role, string[]> = {
  date: ['날짜', '일자', '일차', 'date', 'day', '日付', '日程', '日にち'],
  time: ['시간대', '시간', '시각', '시작', '시작시간', '출발', '출발시간', 'time', 'start', '時間', '時刻', '開始'],
  end: ['종료', '종료시간', '끝', '도착', '도착시간', 'end', 'finish', '終了', '到着'],
  content: ['내용', '일정', '활동', '할일', '할 일', '계획', '스케줄', '메인', 'schedule', 'plan', 'activity', 'content', 'todo', '予定', '内容', 'スケジュール'],
  place: ['장소명', '장소', '방문지', '목적지', '스팟', '관광지', '가게', 'place', 'location', 'spot', 'where', '場所', 'スポット', '行き先'],
  address: ['주소', '위치', 'address', 'addr', '住所'],
  cost: ['비용', '금액', '예산', '가격', '요금', 'cost', 'price', 'budget', 'fee', '費用', '料金', '金額', '予算'],
  duration: ['소요시간', '소요', '체류', '체류시간', '머무는시간', 'duration', '所要時間', '滞在'],
};

const NOTE_ALIASES = ['메모', '비고', '참고', '노트', '설명', 'note', 'notes', 'memo', 'remark', '備考', 'メモ'];

function normHeader(s: string): string {
  return s.toLowerCase().replace(/[\s()（）·・_\-:：/]/g, '');
}

function headerRole(cell: string): Role | 'note' | null {
  const v = normHeader(cell);
  if (!v) return null;
  for (const role of Object.keys(HEADER_ALIASES) as Role[]) {
    if (HEADER_ALIASES[role].some((a) => normHeader(a) === v)) return role;
  }
  if (NOTE_ALIASES.some((a) => normHeader(a) === v)) return 'note';
  return null;
}

/* ─────────────────────────── 칸 하나 판별 ─────────────────────────── */

const DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/;

export function splitDateTime(text: string): { date?: string; time: string } {
  const m = text.match(DATETIME);
  return m ? { date: m[1], time: text.slice(m[1].length).trim() } : { time: text };
}

/** 시각만 든 칸 ("07:10", "7:10~9:05", "오후 2시", "14:00 경") */
export function isTimeCell(text: string): boolean {
  const t = splitDateTime(text).time;
  if (!t) return false;
  const r = readClockCell(t);
  return !!r.time && /^\d|^오|^am|^pm/i.test(t.trim()) && r.rest.replace(/[\s()~\-–경쯤頃까지]/g, '').length <= 1;
}

/** 시각 + 내용이 한 칸에 ("09:00 오사카성") */
function isMixedTimeCell(text: string): boolean {
  const r = readClockCell(text);
  return !!r.time && /^\d|^오|^am|^pm/i.test(text.trim()) && r.rest.trim().length >= 2;
}

function isDateCell(text: string): boolean {
  if (text.length > 20) return false;
  return DATETIME.test(text) || !!readDayCell(text);
}

const MONEY = /^(?:[¥￥₩$€]\s*)?(\d[\d,]*(?:\.\d+)?)\s*(엔|円|yen|jpy|원|won|krw|달러|usd|유로|eur)?$/i;

function isMoneyCell(text: string): boolean {
  const m = text.match(MONEY);
  if (!m) return false;
  const value = Number(m[1].replace(/,/g, ''));
  // 통화 표시가 있거나, 순번(1,2,3)으로 보기 어려운 크기
  return !!m[2] || /[¥￥₩$€]/.test(text) || value >= 100;
}

const DURATION = /^(\d+(?:\.\d+)?)\s*(분|min|m|시간|h|hr|hrs|hours?)(?:\s*(\d+)\s*(분|m|min))?$/i;

export function readDurationCell(text: string): number | null {
  const m = text.trim().match(DURATION);
  if (!m) return null;
  const n = Number(m[1]);
  const hour = /시간|h/i.test(m[2]);
  return Math.round(hour ? n * 60 + Number(m[3] ?? 0) : n);
}

function isAddressCell(text: string): boolean {
  if (text.length < 6) return false;
  return (
    /[都道府県]|[市区町村郡](?![가-힣])|丁目|番地|\d+-\d+-\d+/.test(text) ||
    /[가-힣]+(?:시|도|구|군)\s+[가-힣0-9]+(?:동|읍|면|리|로|길)/.test(text) ||
    (/[가-힣一-龯]/.test(text) && /\d+-\d+/.test(text) && !/→|->/.test(text))
  );
}

function isIndexCell(text: string): boolean {
  return /^\d{1,3}\.?$/.test(text);
}

function hasLetters(text: string): boolean {
  return /[가-힣ぁ-んァ-ン一-龯a-z]/i.test(text);
}

/* ─────────────────────────── 칸별 통계 ─────────────────────────── */

interface ColumnStats {
  n: number;
  time: number;
  mixed: number;
  date: number;
  money: number;
  duration: number;
  address: number;
  poi: number;
  index: number;
  text: number;
  avgLen: number;
}

function columnStats(rows: string[][], col: number, from: number): ColumnStats {
  const s: ColumnStats = { n: 0, time: 0, mixed: 0, date: 0, money: 0, duration: 0, address: 0, poi: 0, index: 0, text: 0, avgLen: 0 };
  let len = 0;
  for (let r = from; r < rows.length; r += 1) {
    const cell = (rows[r]?.[col] ?? '').trim();
    if (!cell) continue;
    s.n += 1;
    len += cell.length;
    if (isTimeCell(cell)) s.time += 1;
    else if (isMixedTimeCell(cell)) s.mixed += 1;
    if (isDateCell(cell)) s.date += 1;
    if (isMoneyCell(cell)) s.money += 1;
    if (readDurationCell(cell) !== null) s.duration += 1;
    if (isAddressCell(cell)) s.address += 1;
    if (isIndexCell(cell)) s.index += 1;
    if (hasLetters(cell) && !isTimeCell(cell) && !isDateCell(cell)) {
      s.text += 1;
      if (cell.length <= 30 && lookupPoi(cell)) s.poi += 1;
    }
  }
  s.avgLen = s.n ? len / s.n : 0;
  return s;
}

const rate = (hit: number, s: ColumnStats) => (s.n ? hit / s.n : 0);

/* ─────────────────────────── 모양 알아내기 ─────────────────────────── */

export function detectLayout(rows: string[][]): SheetLayout {
  const width = Math.max(0, ...rows.slice(0, 200).map((r) => r?.length ?? 0));

  // 1) 시간표형: 한 줄에 날짜 머리글이 둘 이상이고, 그 아래 줄들이 시간으로 시작한다
  const grid = detectGrid(rows, width);
  if (grid) return grid;

  // 2) 머리글: 위쪽 15줄 중 아는 이름이 가장 많이 든 줄
  let headerRow = -1;
  let headerRoles: Partial<Record<Role, number>> = {};
  let headerNotes: number[] = [];
  let bestHits = 1;
  for (let r = 0; r < Math.min(15, rows.length); r += 1) {
    const roles: Partial<Record<Role, number>> = {};
    const notes: number[] = [];
    let hits = 0;
    (rows[r] ?? []).forEach((cell, c) => {
      const role = headerRole(cell ?? '');
      if (!role) return;
      if (role === 'note') { notes.push(c); hits += 1; return; }
      if (roles[role] === undefined) { roles[role] = c; hits += 1; }
    });
    if (hits > bestHits) { bestHits = hits; headerRow = r; headerRoles = roles; headerNotes = notes; }
  }

  const from = headerRow + 1;
  const stats = Array.from({ length: width }, (_, c) => columnStats(rows, c, from));
  const roles: Partial<Record<Role, number>> = { ...headerRoles };
  const taken = new Set<number>([...Object.values(roles), ...headerNotes]);
  const take = (role: Role, col: number) => { roles[role] = col; taken.add(col); };
  const free = (c: number) => !taken.has(c) && stats[c].n > 0;

  // 3) 머리글로 못 찾은 역할은 내용으로 채운다
  if (roles.time === undefined) {
    let best = -1;
    let bestScore = 0.3;
    stats.forEach((s, c) => {
      if (!free(c)) return;
      const score = rate(s.time + s.mixed * 0.9, s) * Math.min(1, (s.time + s.mixed) / 2);
      if (score > bestScore) { bestScore = score; best = c; }
    });
    if (best >= 0) take('time', best);
  }

  // 시작·종료를 나눠 적은 표 — 시간 칸 옆에 또 시간 칸
  if (roles.end === undefined && roles.time !== undefined) {
    for (const c of [roles.time + 1, roles.time + 2]) {
      if (c < width && free(c) && rate(stats[c].time, stats[c]) >= 0.6 && stats[c].time >= 2) { take('end', c); break; }
    }
  }

  if (roles.date === undefined) {
    let best = -1;
    let bestScore = 0;
    stats.forEach((s, c) => {
      if (!free(c) || s.date === 0) return;
      const score = rate(s.date, s);
      if (score >= 0.6 && score > bestScore) { bestScore = score; best = c; }
    });
    if (best >= 0) take('date', best);
  }

  const pick = (role: Role, test: (s: ColumnStats) => number, min: number) => {
    if (roles[role] !== undefined) return;
    let best = -1;
    let bestScore = min;
    stats.forEach((s, c) => {
      if (!free(c)) return;
      const score = test(s);
      if (score >= bestScore) { bestScore = score; best = c; }
    });
    if (best >= 0) take(role, best);
  };

  pick('cost', (s) => (s.money >= 1 ? rate(s.money, s) : 0), 0.6);
  pick('duration', (s) => (s.duration >= 1 ? rate(s.duration, s) : 0), 0.6);
  pick('address', (s) => (s.address >= 1 ? rate(s.address, s) : 0), 0.5);

  // 4) 글자 칸: 장소명과 내용을 가른다
  const textCols = stats
    .map((s, c) => ({ c, s }))
    .filter(({ c, s }) => free(c) && s.text > 0 && rate(s.index, s) < 0.8 && rate(s.text, s) >= 0.5);

  if (roles.place === undefined && textCols.length > 0) {
    const byPoi = [...textCols].sort((a, b) => rate(b.s.poi, b.s) - rate(a.s.poi, a.s))[0];
    if (rate(byPoi.s.poi, byPoi.s) >= 0.3 && textCols.length >= 2) take('place', byPoi.c);
    else if (roles.content !== undefined) take('place', textCols[0].c);
  }
  if (roles.content === undefined) {
    const rest = textCols.filter(({ c }) => !taken.has(c));
    if (rest.length > 0) {
      // 가장 많이, 가장 길게 적힌 칸이 내용
      const best = rest.sort((a, b) => b.s.text * b.s.avgLen - a.s.text * a.s.avgLen)[0];
      take('content', best.c);
    }
  }
  // 장소 칸이 없는데 글자 칸이 둘 남았다 — 짧은 쪽이 장소명
  if (roles.place === undefined) {
    const rest = textCols.filter(({ c }) => !taken.has(c));
    const content = roles.content !== undefined ? stats[roles.content] : null;
    const shortest = rest.sort((a, b) => a.s.avgLen - b.s.avgLen)[0];
    if (shortest && content && shortest.s.avgLen <= 16 && content.avgLen >= shortest.s.avgLen * 1.5) take('place', shortest.c);
  }
  // 시간 칸에 내용까지 들어 있으면 그 칸이 내용도 맡는다
  if (roles.content === undefined && roles.place === undefined && roles.time !== undefined) {
    const s = stats[roles.time];
    if (s.mixed > 0) roles.content = roles.time;
  }

  const notes = [
    ...headerNotes,
    ...textCols.map(({ c }) => c).filter((c) => !taken.has(c)),
  ];

  // 5) 첫 데이터 행: 머리글 아래, 없으면 시간이 처음 나오는 줄 (그 위는 제목 줄)
  let dataRow = from;
  if (headerRow < 0 && roles.time !== undefined) {
    const t = roles.time;
    const first = rows.findIndex((row) => {
      const cell = (row?.[t] ?? '').trim();
      return !!cell && (isTimeCell(cell) || isMixedTimeCell(cell));
    });
    if (first > 0) {
      // 시간 바로 위 줄이 글자뿐이면 이름을 모르는 머리글이다 — 건너뛴다
      dataRow = first;
      // 단, 그 위에 날짜 머리글("1일차") 줄이 있으면 그 줄부터 읽는다
      for (let r = first - 1; r >= 0; r -= 1) {
        const row = rows[r] ?? [];
        const filled = row.map((c) => (c ?? '').trim()).filter(Boolean);
        if (filled.length === 1 && readDayCell(filled[0])) { dataRow = r; break; }
        if (filled.length > 0) break;
      }
    }
  }

  return {
    kind: 'list',
    headerRow,
    dataRow: Math.max(0, dataRow),
    roles,
    notes: [...new Set(notes)],
    source: headerRow >= 0 && Object.keys(headerRoles).length >= 2 ? 'header' : 'content',
  };
}

function detectGrid(rows: string[][], width: number): GridLayout | null {
  for (let r = 0; r < Math.min(15, rows.length); r += 1) {
    const row = rows[r] ?? [];
    const dayCols: Array<{ col: number; label: string }> = [];
    row.forEach((cell, c) => {
      const t = (cell ?? '').trim();
      if (t && t.length <= 20 && readDayCell(t)) dayCols.push({ col: c, label: t });
    });
    if (dayCols.length < 2) continue;

    // 날짜 머리글보다 왼쪽에서, 아래로 시간이 가장 많이 적힌 칸
    let timeCol = -1;
    let bestTimes = 1;
    for (let c = 0; c < Math.min(width, dayCols[0].col); c += 1) {
      const s = columnStats(rows, c, r + 1);
      if (s.time > bestTimes) { bestTimes = s.time; timeCol = c; }
    }
    if (timeCol < 0) continue;
    return { kind: 'grid', headerRow: r, timeCol, dayCols };
  }
  return null;
}

/** 여러 시트 중 일정이 든 시트 — 시간이 가장 많이 적힌 곳 */
export function sheetScore(rows: string[][]): number {
  let score = 0;
  for (const row of rows.slice(0, 300)) {
    for (const cell of row ?? []) {
      const t = (cell ?? '').trim();
      if (!t) continue;
      if (isTimeCell(t)) score += 2;
      else if (isMixedTimeCell(t)) score += 1;
    }
  }
  return score;
}

export function columnName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** 사람이 읽을 설명 — "A열 시간 · C열 장소명 · D열 주소" */
export function describeLayout(layout: SheetLayout): string {
  if (layout.kind === 'grid') {
    return `시간표 모양 · ${columnName(layout.timeCol)}열 시간 · ${layout.dayCols.map((d) => `${columnName(d.col)}열 ${d.label}`).join(' · ')}`;
  }
  const parts = (Object.entries(layout.roles) as Array<[Role, number]>)
    .filter(([role, c]) => !(role === 'content' && c === layout.roles.time))
    .sort((a, b) => a[1] - b[1])
    .map(([role, c]) => `${columnName(c)}열 ${ROLE_LABEL[role]}`);
  if (layout.roles.content !== undefined && layout.roles.content === layout.roles.time) {
    parts.push('시간 칸에 내용도 함께');
  }
  for (const c of layout.notes) parts.push(`${columnName(c)}열 메모`);
  return parts.join(' · ');
}
