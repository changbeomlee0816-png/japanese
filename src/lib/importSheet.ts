import type { Day, Item } from '../types';
import { uid } from './id';
import { fillMissingTimes, findTransportWord, parseDateCell, parsePlanLine, readClockCell, readDayCell } from './parsePlan';
import { addDaysISO, fromMinutes, todayISO, toMinutes } from './time';
import {
  describeLayout, detectLayout, isTimeCell, readDurationCell, splitDateTime,
  type GridLayout, type ListLayout,
} from './sheetDetect';

/**
 * 엑셀 표를 일정으로 바꾼다.
 *
 * 양식은 다섯 칸이다.
 *   날짜 | 시간대 | 내용 | 장소명 | 주소
 *
 * 날짜를 비우면 위 행과 같은 날로 본다. 시간대는 "07:10~09:05" 처럼 범위로 적으면
 * 그 사이가 머무는 시간(이동 줄이면 이동 시간)이 된다.
 * 내용이나 장소명에 화살표(→)를 쓰면 이동으로 읽어 두 곳을 방문지로 세운다.
 */

export const SHEET_HEADERS = ['날짜', '시간대', '내용', '장소명', '주소'] as const;

/** 양식 파일에 채워 넣을 예시 — 어떻게 쓰는지 보여주는 게 목적이다 */
export const SHEET_SAMPLE_ROWS: string[][] = [
  ['9/12', '07:10~09:05', '인천에서 오사카로', '인천국제공항 → 간사이 국제공항 비행기', ''],
  ['', '11:00-12:30', '점심 먹고 간판 구경', '도톤보리', '오사카시 주오구 도톤보리'],
  ['', '오후 2시~3시반', '천수각 관람 600엔', '오사카성', '오사카시 주오구 오사카조 1-1'],
  ['', '19:00', '저녁', '구로몬 시장', ''],
  ['9/13', '09:00~10:00', '', '신오사카 → 교토역 신칸센', ''],
  ['', '10:30~12:30', '청수사 산책', '기요미즈데라', '교토시 히가시야마구 기요미즈 1-294'],
  ['', '13:00', '길거리 음식', '니시키 시장', ''],
];

export interface SheetImportResult {
  days: Day[];
  itemCount: number;
  warnings: string[];
  /** 어떻게 읽었는지 — "A열 시간 · C열 장소명" */
  layout: string;
}

const ARROW = /→|->|=>|➔|➡|▶|>>/;
/** 시간이 이만큼 거꾸로 가면 다음 날로 본다 (날짜 칸이 없을 때) */
const NEXT_DAY_GAP = 180;

export function importSheetRows(rows: string[][], startDate = todayISO()): SheetImportResult {
  const layout = detectLayout(rows);
  const result = layout.kind === 'grid' ? importGrid(rows, layout, startDate) : importList(rows, layout, startDate);
  return { ...result, layout: describeLayout(layout) };
}

/* ─────────────────────────── 목록형 ─────────────────────────── */

function importList(rows: string[][], layout: ListLayout, startDate: string): Omit<SheetImportResult, 'layout'> {
  const { roles } = layout;
  const warnings: string[] = [];
  const byDate = new Map<string, Item[]>();

  let currentDate: string | null = null;
  let prevStart: number | null = null;

  const cell = (row: string[], index: number | undefined) =>
    index !== undefined && index >= 0 ? (row[index] ?? '').trim() : '';

  const goToDate = (date: string) => {
    currentDate = date;
    prevStart = null;
  };

  for (let r = layout.dataRow; r < rows.length; r += 1) {
    if (r === layout.headerRow) continue;
    const row = rows[r];
    if (!row || row.every((c) => !c?.trim())) continue;

    let timeText = cell(row, roles.time);
    let dateText = cell(row, roles.date);
    const endText = roles.end !== undefined ? cell(row, roles.end) : '';

    // "2026-09-20 07:10" 처럼 날짜와 시각이 한 칸에
    const dt = splitDateTime(timeText);
    if (dt.date) { if (!dateText) dateText = dt.date; timeText = dt.time; }

    // 날짜만 덩그러니 있는 줄 ("2일차", "9/13 (토)") — 날을 바꾼다
    const filled = row.map((c) => (c ?? '').trim()).filter(Boolean);
    if (filled.length === 1 && !isTimeCell(filled[0]) && readDayCell(filled[0])) {
      const hit = readDayCell(filled[0])!;
      goToDate(hit.kind === 'date' ? hit.date : addDaysISO(startDate, hit.index - 1));
      continue;
    }

    let dateSet = false;
    if (dateText) {
      const hit = readDayCell(dateText) ?? (parseDateCell(dateText) ? { kind: 'date' as const, date: parseDateCell(dateText)! } : null);
      if (hit) {
        goToDate(hit.kind === 'date' ? hit.date : addDaysISO(startDate, hit.index - 1));
        dateSet = true;
      } else {
        warnings.push(`${r + 1}행: 날짜 "${dateText}" 를 읽지 못해 앞 날짜에 이어 붙였습니다`);
      }
    }
    if (!currentDate) goToDate(startDate);

    // 시간이 크게 거꾸로 가면 다음 날이다 — 날짜 없이 시간만 적은 표
    const clock = timeText ? readClockCell(timeText).time : undefined;
    if (clock) {
      const minutes = toMinutes(clock);
      if (!dateSet && prevStart !== null && minutes < prevStart - NEXT_DAY_GAP) {
        goToDate(addDaysISO(currentDate!, 1));
      }
      prevStart = minutes;
    }

    const content = roles.content === roles.time ? readClockCell(timeText).rest : cell(row, roles.content);
    const timePart = roles.content === roles.time ? (readClockCell(timeText).time ?? '') : timeText;
    const placeName = cell(row, roles.place);
    const address = cell(row, roles.address);
    const durationText = cell(row, roles.duration);
    const costText = cell(row, roles.cost);
    const extra = layout.notes.map((c) => cell(row, c)).filter(Boolean);

    // 시작·종료를 두 칸에 나눠 적은 표
    const timeSpec = timePart && endText && isTimeCell(endText) ? `${timePart}~${splitDateTime(endText).time}` : timePart;

    // 장소명에 화살표가 있으면 그게 이동이다. 없으면 내용에서 찾는다
    const movementSource = ARROW.test(placeName) ? placeName : ARROW.test(content) ? content : '';
    const body = movementSource || content || placeName;
    if (!body) {
      if (timeSpec || extra.length) warnings.push(`${r + 1}행: 내용과 장소명이 모두 비어 건너뛰었습니다`);
      continue;
    }

    const minutes = readDurationCell(durationText);
    // 이동 줄인데 수단을 다른 칸(내용·메모)에 적었다 — "비행기 KE723"
    const modeWord = movementSource && !findTransportWord(movementSource)
      ? findTransportWord([content, ...extra].join(' '))
      : null;
    const line = `${timeSpec} ${body}${modeWord ? ` ${modeWord}` : ''}${minutes && !/~|-|–/.test(timeSpec) ? ` (${minutes}분)` : ''}`.trim();

    const parsed = parsePlanLine(line);
    if (parsed.length === 0) {
      warnings.push(`${r + 1}행: "${line}" 를 해석하지 못했습니다`);
      continue;
    }

    if (parsed.length === 1 && !movementSource) {
      // 목록에서는 장소가 먼저 읽혀야 한다. 내용은 메모로 넣는다.
      // 비용·체류시간은 이미 내용에서 뽑아낸 뒤라 남은 글자만 메모가 된다.
      const item = parsed[0];
      const leftover = item.title.trim();
      const name = placeName || leftover;
      const noteParts = [placeName && leftover && leftover !== placeName ? leftover : '', ...extra].filter(Boolean);
      parsed[0] = {
        ...item,
        title: name,
        notes: noteParts.length ? noteParts.join(' · ') : undefined,
        place: { name, address: address || undefined },
      };
    } else if (movementSource) {
      // 이동 줄의 내용은 출발 쪽에 메모로 남긴다
      const noteParts = [content && !ARROW.test(content) ? content : '', ...extra].filter(Boolean);
      if (noteParts.length) parsed[0] = { ...parsed[0], notes: noteParts.join(' · ') };
      if (address) warnings.push(`${r + 1}행: 이동 줄에는 주소를 쓰지 않습니다 (무시했습니다)`);
    }

    // 비용 칸에 숫자만 적은 경우 — 통화 표시가 없어도 비용이다
    const cost = readCost(costText);
    if (cost !== null && parsed[0].cost === 0) parsed[0] = { ...parsed[0], cost };

    const list = byDate.get(currentDate!) ?? [];
    list.push(...parsed.map((i) => ({ ...i, id: uid('item') })));
    byDate.set(currentDate!, list);
  }

  return finish(byDate, warnings);
}

function readCost(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/^[¥￥₩$€]?(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ─────────────────────────── 시간표형 ─────────────────────────── */

/**
 * 시간 | 1일차 | 2일차 | 3일차
 * 09:00 | 오사카성 | 교토역 |
 * 10:00 |          | 기요미즈데라 |
 *
 * 병합한 칸은 파일에서 아래쪽이 비어 있다. 그래서 빈 칸은 "위 일정이 이어진다"로 읽고,
 * 다음 일정이 나오는 줄까지를 머무는 시간으로 잡는다.
 */
function importGrid(rows: string[][], layout: GridLayout, startDate: string): Omit<SheetImportResult, 'layout'> {
  const warnings: string[] = [];
  const byDate = new Map<string, Item[]>();

  // 시간 줄 목록
  const slots: Array<{ row: number; minutes: number }> = [];
  for (let r = layout.headerRow + 1; r < rows.length; r += 1) {
    const cellText = (rows[r]?.[layout.timeCol] ?? '').trim();
    const clock = cellText ? readClockCell(splitDateTime(cellText).time).time : undefined;
    if (clock) slots.push({ row: r, minutes: toMinutes(clock) });
  }
  const step = slots.length >= 2 ? Math.max(15, slots[1].minutes - slots[0].minutes) : 60;

  layout.dayCols.forEach(({ col, label }, i) => {
    const hit = readDayCell(label);
    const date = hit?.kind === 'date' ? hit.date : addDaysISO(startDate, hit?.kind === 'index' ? hit.index - 1 : i);
    const items: Item[] = [];

    for (let k = 0; k < slots.length; k += 1) {
      const text = (rows[slots[k].row]?.[col] ?? '').trim();
      if (!text) continue;
      // 다음 일정이 나오는 칸까지가 이 일정
      let end = k + 1;
      while (end < slots.length && !(rows[slots[end].row]?.[col] ?? '').trim()) end += 1;
      const until = end < slots.length ? slots[end].minutes : slots[slots.length - 1].minutes + step;
      const start = slots[k].minutes;
      const line = `${fromMinutes(start)}~${fromMinutes(Math.min(until, start + 12 * 60))} ${text}`;
      const parsed = parsePlanLine(line);
      if (parsed.length === 0) {
        warnings.push(`${slots[k].row + 1}행 ${label}: "${text}" 를 해석하지 못했습니다`);
        continue;
      }
      items.push(...parsed.map((it) => ({ ...it, id: uid('item') })));
    }
    if (items.length) byDate.set(date, [...(byDate.get(date) ?? []), ...items]);
  });

  return finish(byDate, warnings);
}

function finish(byDate: Map<string, Item[]>, warnings: string[]): Omit<SheetImportResult, 'layout'> {
  const days: Day[] = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => ({ id: uid('day'), date, items: fillMissingTimes(items) }));

  return {
    days,
    itemCount: days.reduce((n, d) => n + d.items.length, 0),
    warnings,
  };
}
