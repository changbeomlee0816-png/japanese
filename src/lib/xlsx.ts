/**
 * 엑셀(.xlsx) 읽기·쓰기.
 *
 * 라이브러리를 붙이면 번들이 두 배가 되어서 직접 만들었다.
 *  - 쓰기: xlsx 는 XML 몇 개를 담은 ZIP 이다. 압축 없이(store) 담아도 엑셀이 연다
 *  - 읽기: 브라우저의 DecompressionStream('deflate-raw') 으로 푼다
 *
 * CSV 도 함께 지원한다. 엑셀에서 "CSV로 저장"을 골라도 그대로 들어온다.
 */

/* ------------------------------------------------------------------ *
 * ZIP
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array<ArrayBuffer>): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

/** 압축 없이 담는 최소 ZIP. 엑셀·탐색기 모두 정상으로 읽는다 */
function makeZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const locals: Uint8Array<ArrayBuffer>[] = [];
  const centrals: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // 필요 버전
    local.setUint16(6, 0x0800, true); // UTF-8 이름
    local.setUint16(8, 0, true); // 압축 없음
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);

    const localBytes = new Uint8Array(30 + nameBytes.length + size);
    localBytes.set(new Uint8Array(local.buffer), 0);
    localBytes.set(nameBytes, 30);
    localBytes.set(entry.bytes, 30 + nameBytes.length);
    locals.push(localBytes);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint32(42, offset, true);

    const centralBytes = new Uint8Array(46 + nameBytes.length);
    centralBytes.set(new Uint8Array(central.buffer), 0);
    centralBytes.set(nameBytes, 46);
    centrals.push(centralBytes);

    offset += localBytes.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** ZIP 안의 파일들을 이름 → 문자열로 푼다 */
async function readZip(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();

  // 끝에서부터 EOCD(중앙 디렉터리 끝 표식)를 찾는다
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= 0 && i > buffer.byteLength - 65558; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP 형식이 아닙니다');

  const count = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const files = new Map<string, string>();

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLen = view.getUint16(pointer + 28, true);
    const extraLen = view.getUint16(pointer + 30, true);
    const commentLen = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLen));

    // 로컬 헤더에서 실제 데이터 시작 위치를 구한다
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) {
      files.set(name, decoder.decode(data));
    } else if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      files.set(name, await new Response(stream).text());
    }

    pointer += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

/* ------------------------------------------------------------------ *
 * 쓰기
 * ------------------------------------------------------------------ */

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

/** 0 → A, 25 → Z, 26 → AA */
function columnName(index: number): string {
  let name = '';
  let n = index;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

/** 표 하나를 담은 .xlsx 파일을 만든다 */
export function buildXlsx(rows: string[][], sheetName = 'Sheet1'): Blob {
  const encoder = new TextEncoder();

  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) =>
          value === ''
            ? ''
            : `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`,
        )
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');

  // 열 너비를 미리 잡아 두면 열자마자 읽을 만하다
  const widths = [14, 18, 34, 26, 40]
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const files: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `</Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
          `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
          `</workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      bytes: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
          `<cols>${widths}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
      ),
    },
  ];

  return makeZip(files);
}

/* ------------------------------------------------------------------ *
 * 읽기
 * ------------------------------------------------------------------ */

/** 셀 서식이 날짜·시각인지 — 엑셀은 07:10 을 0.2986… 으로, 9/20 을 46285 로 저장한다 */
type CellKind = 'date' | 'time' | 'datetime' | null;

const BUILTIN_FORMATS: Record<number, CellKind> = {
  14: 'date', 15: 'date', 16: 'date', 17: 'date', 22: 'datetime',
  18: 'time', 19: 'time', 20: 'time', 21: 'time', 45: 'time', 46: 'time', 47: 'time',
  // 동아시아 로캘 기본 서식 (한국어·일본어 엑셀)
  27: 'date', 28: 'date', 29: 'date', 30: 'date', 31: 'date', 32: 'time', 33: 'time',
  34: 'time', 35: 'time', 36: 'date', 50: 'date', 51: 'date', 52: 'date', 53: 'date',
  54: 'date', 55: 'time', 56: 'time', 57: 'date', 58: 'date',
};

function classifyFormat(code: string): CellKind {
  const lower = code.toLowerCase();
  // [h]:mm 같은 경과 시간은 대괄호째 지워지기 전에 본다
  const elapsed = /\[(h+|m+|s+)\]/.test(lower);
  // 따옴표 안 글자("년"), 대괄호([$-ko-KR], [Red]), 이스케이프(\-)는 서식 기호가 아니다
  const bare = lower.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
  const ampm = /am\/pm|a\/p/.test(bare);
  const tokens = bare.replace(/am\/pm|a\/p/g, '');

  let date = /[yd]/.test(tokens);
  let time = elapsed || ampm || /[hs]/.test(tokens);
  // m 은 h 뒤나 s 앞에 오면 '분', 아니면 '월'이다
  // (":mm" 처럼 콜론 뒤에 오는 m 도 분 — [h]:mm)
  const monthsOnly = tokens.replace(/h+[^a-z0-9]*m+/g, 'h').replace(/:m+/g, ':').replace(/m+(?=[^a-z0-9]*s)/g, '');
  if (/m/.test(monthsOnly)) date = true;
  if (!/[ymdhs]/.test(tokens) && !elapsed && !ampm) { date = false; time = false; }

  if (date && time) return 'datetime';
  if (date) return 'date';
  if (time) return 'time';
  return null;
}

/** styles.xml 을 읽어 셀 서식 번호(s="3") → 날짜/시각 여부 표를 만든다 */
function readStyleKinds(stylesXml: string | undefined): CellKind[] {
  if (!stylesXml) return [];
  const doc = new DOMParser().parseFromString(stylesXml, 'application/xml');
  const custom = new Map<number, CellKind>();
  for (const el of Array.from(doc.getElementsByTagName('numFmt'))) {
    custom.set(Number(el.getAttribute('numFmtId')), classifyFormat(el.getAttribute('formatCode') ?? ''));
  }
  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (!cellXfs) return [];
  return Array.from(cellXfs.getElementsByTagName('xf')).map((xf) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    return custom.get(id) ?? BUILTIN_FORMATS[id] ?? null;
  });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 엑셀 일련번호를 화면에 보이던 모양으로 되돌린다 */
function formatSerial(serial: number, kind: Exclude<CellKind, null>, date1904: boolean): string {
  const whole = Math.floor(serial);
  // 초 단위 반올림 — 0.29861111 이 07:09:59 가 되지 않게
  const seconds = Math.round((serial - whole) * 86400);
  const hh = Math.floor(seconds / 3600) % 24;
  const mm = Math.floor((seconds % 3600) / 60);
  const time = `${pad2(hh)}:${pad2(mm)}`;
  if (kind === 'time') return time;

  // 1900 체계의 기준일은 1899-12-30 (엑셀의 1900-02-29 버그를 반영한 값)
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const d = new Date(epoch + whole * 86400000);
  const date = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  if (kind === 'date' || (kind === 'datetime' && seconds === 0)) return date;
  return `${date} ${time}`;
}

/** 공유 문자열 한 칸의 글자. 일본어 엑셀의 후리가나(<rPh>)는 빼야 한다 */
function stringItemText(si: Element): string {
  let out = '';
  for (const t of Array.from(si.getElementsByTagName('t'))) {
    let parent = t.parentElement;
    let phonetic = false;
    while (parent && parent !== si) {
      if (parent.localName === 'rPh') { phonetic = true; break; }
      parent = parent.parentElement;
    }
    if (!phonetic) out += t.textContent ?? '';
  }
  return out;
}

function parseSheetXml(sheetXml: string, sharedStrings: string[], kinds: CellKind[], date1904: boolean): string[][] {
  const doc = new DOMParser().parseFromString(sheetXml, 'application/xml');
  const rows: string[][] = [];

  for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
    // 빈 행은 파일에 적히지 않는다. 행 번호를 지켜야 "5행" 같은 안내가 맞다
    const rowNumber = Number(rowEl.getAttribute('r'));
    if (rowNumber > 0) while (rows.length < rowNumber - 1) rows.push([]);

    const cells: string[] = [];
    for (const cellEl of Array.from(rowEl.getElementsByTagName('c'))) {
      const ref = cellEl.getAttribute('r') ?? '';
      const letters = ref.replace(/\d/g, '');
      let index = 0;
      for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
      index = letters ? index - 1 : cells.length;

      const type = cellEl.getAttribute('t');
      let text = '';
      if (type === 'inlineStr') {
        const is = cellEl.getElementsByTagName('is')[0];
        text = is ? stringItemText(is) : '';
      } else {
        const v = cellEl.getElementsByTagName('v')[0]?.textContent ?? '';
        if (type === 's') text = sharedStrings[Number(v)] ?? '';
        else if (type === 'str' || type === 'b' || type === 'e') text = v;
        else {
          const kind = kinds[Number(cellEl.getAttribute('s') ?? -1)] ?? null;
          const num = Number(v);
          text = kind && v !== '' && Number.isFinite(num) ? formatSerial(num, kind, date1904) : v;
        }
      }

      while (cells.length < index) cells.push('');
      cells[index] = text.trim();
    }
    rows.push(cells);
  }

  return rows;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const body = text.replace(/^﻿/, '');
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',' || ch === '\t') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

export interface SheetData {
  name: string;
  rows: string[][];
}

/** 엑셀(.xlsx)의 모든 시트, 또는 CSV 한 장을 읽는다 */
export async function readWorkbook(file: File): Promise<SheetData[]> {
  if (/\.csv$|\.tsv$|\.txt$/i.test(file.name)) {
    return [{ name: file.name, rows: parseCsv(await file.text()) }];
  }

  const buffer = await file.arrayBuffer();
  const files = await readZip(buffer);

  const sharedXml = files.get('xl/sharedStrings.xml');
  const sharedStrings: string[] = [];
  if (sharedXml) {
    const doc = new DOMParser().parseFromString(sharedXml, 'application/xml');
    for (const si of Array.from(doc.getElementsByTagName('si'))) sharedStrings.push(stringItemText(si));
  }
  const kinds = readStyleKinds(files.get('xl/styles.xml'));

  // 시트 이름과 순서는 workbook.xml 이 정한다. zip 안의 순서는 믿을 수 없다(sheet10 이 sheet2 보다 먼저 올 수 있다)
  const workbookXml = files.get('xl/workbook.xml') ?? '';
  const relsXml = files.get('xl/_rels/workbook.xml.rels') ?? '';
  const wb = new DOMParser().parseFromString(workbookXml || '<workbook/>', 'application/xml');
  const rels = new DOMParser().parseFromString(relsXml || '<Relationships/>', 'application/xml');
  const date1904 = /^(1|true)$/i.test(wb.getElementsByTagName('workbookPr')[0]?.getAttribute('date1904') ?? '');

  const targets = new Map<string, string>();
  for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
    const target = (rel.getAttribute('Target') ?? '').replace(/^\/?(xl\/)?/, '');
    targets.set(rel.getAttribute('Id') ?? '', `xl/${target}`);
  }

  const sheets: SheetData[] = [];
  for (const el of Array.from(wb.getElementsByTagName('sheet'))) {
    const rid = el.getAttribute('r:id') ?? el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
    const path = targets.get(rid);
    const xml = path ? files.get(path) : undefined;
    if (xml) sheets.push({ name: el.getAttribute('name') ?? `시트${sheets.length + 1}`, rows: parseSheetXml(xml, sharedStrings, kinds, date1904) });
  }

  // workbook.xml 이 없거나 깨진 파일 — 이름 순으로라도 읽는다
  if (sheets.length === 0) {
    const names = [...files.keys()]
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
    for (const n of names) sheets.push({ name: n.replace(/^.*\/|\.xml$/g, ''), rows: parseSheetXml(files.get(n)!, sharedStrings, kinds, date1904) });
  }
  if (sheets.length === 0) throw new Error('엑셀 시트를 찾지 못했습니다');
  return sheets;
}

/** 첫 시트만 필요할 때 */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  return (await readWorkbook(file))[0].rows;
}
