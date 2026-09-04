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

function parseSheetXml(sheetXml: string, sharedStrings: string[]): string[][] {
  const doc = new DOMParser().parseFromString(sheetXml, 'application/xml');
  const rows: string[][] = [];

  for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
    const cells: string[] = [];
    for (const cellEl of Array.from(rowEl.getElementsByTagName('c'))) {
      const ref = cellEl.getAttribute('r') ?? '';
      const letters = ref.replace(/\d/g, '');
      let index = 0;
      for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
      index -= 1;

      const type = cellEl.getAttribute('t');
      let text = '';
      if (type === 'inlineStr') {
        text = Array.from(cellEl.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
      } else {
        const v = cellEl.getElementsByTagName('v')[0]?.textContent ?? '';
        text = type === 's' ? (sharedStrings[Number(v)] ?? '') : v;
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

/** 엑셀(.xlsx) 또는 CSV 파일에서 표를 읽는다 */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  if (/\.csv$|\.tsv$|\.txt$/i.test(file.name)) {
    return parseCsv(await file.text());
  }

  const buffer = await file.arrayBuffer();
  const files = await readZip(buffer);

  const sheetName = [...files.keys()].find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  if (!sheetName) throw new Error('엑셀 시트를 찾지 못했습니다');

  const sharedXml = files.get('xl/sharedStrings.xml');
  const sharedStrings: string[] = [];
  if (sharedXml) {
    const doc = new DOMParser().parseFromString(sharedXml, 'application/xml');
    for (const si of Array.from(doc.getElementsByTagName('si'))) {
      sharedStrings.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''));
    }
  }

  return parseSheetXml(files.get(sheetName)!, sharedStrings);
}
