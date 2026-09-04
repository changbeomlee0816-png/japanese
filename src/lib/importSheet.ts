import type { Day, Item } from '../types';
import { uid } from './id';
import { fillMissingTimes, parseDateCell, parsePlanLine } from './parsePlan';
import { addDaysISO, todayISO } from './time';

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

const HEADER_ALIASES: Record<(typeof SHEET_HEADERS)[number], string[]> = {
  날짜: ['날짜', '일자', 'date', 'day'],
  시간대: ['시간대', '시간', '시각', 'time', '시간(범위)'],
  내용: ['내용', '일정', '메모', '활동', 'memo', 'note', 'content'],
  장소명: ['장소명', '장소', '방문지', 'place', 'location', 'spot'],
  주소: ['주소', 'address', '위치'],
};

interface ColumnMap {
  날짜: number;
  시간대: number;
  내용: number;
  장소명: number;
  주소: number;
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[\s()（）·・_-]/g, '');
}

/** 첫 행이 머리글이면 칸 위치를 찾아낸다. 못 찾으면 양식 순서를 그대로 쓴다 */
function detectColumns(rows: string[][]): { columns: ColumnMap; startRow: number } {
  const fallback: ColumnMap = { 날짜: 0, 시간대: 1, 내용: 2, 장소명: 3, 주소: 4 };
  const header = rows[0];
  if (!header) return { columns: fallback, startRow: 0 };

  const found: Partial<ColumnMap> = {};
  header.forEach((cell, i) => {
    const value = normalizeHeader(cell);
    for (const key of SHEET_HEADERS) {
      if (found[key] === undefined && HEADER_ALIASES[key].some((a) => normalizeHeader(a) === value)) {
        found[key] = i;
      }
    }
  });

  // 머리글을 두 개 이상 알아봤을 때만 머리글 행으로 인정한다
  const hits = Object.keys(found).length;
  if (hits < 2) return { columns: fallback, startRow: 0 };

  return {
    columns: {
      날짜: found.날짜 ?? -1,
      시간대: found.시간대 ?? -1,
      내용: found.내용 ?? -1,
      장소명: found.장소명 ?? -1,
      주소: found.주소 ?? -1,
    },
    startRow: 1,
  };
}

export interface SheetImportResult {
  days: Day[];
  itemCount: number;
  warnings: string[];
}

const ARROW = /→|->|=>|➔|➡|▶|>>/;

export function importSheetRows(rows: string[][], startDate = todayISO()): SheetImportResult {
  const { columns, startRow } = detectColumns(rows);
  const warnings: string[] = [];
  const byDate = new Map<string, Item[]>();

  let currentDate: string | null = null;
  let dayOffset = 0;

  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? '').trim() : '');

  for (let r = startRow; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row || row.every((c) => !c?.trim())) continue;

    const dateText = cell(row, columns.날짜);
    const timeText = cell(row, columns.시간대);
    const content = cell(row, columns.내용);
    const placeName = cell(row, columns.장소명);
    const address = cell(row, columns.주소);

    if (dateText) {
      const parsed = parseDateCell(dateText);
      if (parsed) {
        currentDate = parsed;
      } else {
        // "1일차" 처럼 순번으로 적었을 수도 있다
        const nth = dateText.match(/(\d+)\s*일\s*차|day\s*(\d+)/i);
        if (nth) {
          currentDate = addDaysISO(startDate, Number(nth[1] ?? nth[2]) - 1);
        } else {
          warnings.push(`${r + 1}행: 날짜 "${dateText}" 를 읽지 못해 앞 날짜에 이어 붙였습니다`);
        }
      }
    }
    if (!currentDate) {
      currentDate = addDaysISO(startDate, dayOffset);
      dayOffset += 1;
    }

    // 장소명에 화살표가 있으면 그게 이동이다. 없으면 내용에서 찾는다
    const movementSource = ARROW.test(placeName) ? placeName : ARROW.test(content) ? content : '';
    const line = movementSource
      ? `${timeText} ${movementSource}`.trim()
      : `${timeText} ${content || placeName}`.trim();

    if (!line) {
      warnings.push(`${r + 1}행: 내용과 장소명이 모두 비어 건너뛰었습니다`);
      continue;
    }

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
      parsed[0] = {
        ...item,
        title: name,
        notes: placeName && leftover && leftover !== placeName ? leftover : undefined,
        place: { name, address: address || undefined },
      };
    } else if (movementSource) {
      // 이동 줄의 내용은 출발 쪽에 메모로 남긴다
      if (content && !ARROW.test(content)) parsed[0] = { ...parsed[0], notes: content };
      if (address) {
        warnings.push(`${r + 1}행: 이동 줄에는 주소를 쓰지 않습니다 (무시했습니다)`);
      }
    }

    const list = byDate.get(currentDate) ?? [];
    list.push(...parsed.map((i) => ({ ...i, id: uid('item') })));
    byDate.set(currentDate, list);
  }

  const days: Day[] = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => ({ id: uid('day'), date, items: fillMissingTimes(items) }));

  return {
    days,
    itemCount: days.reduce((n, d) => n + d.items.length, 0),
    warnings,
  };
}
