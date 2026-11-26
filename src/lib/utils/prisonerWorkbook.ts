import { read, SSF, utils, type WorkSheet } from 'xlsx';

export type WorkbookKind = 'roster' | 'discipline';

export interface WorkbookRow {
  row: number;
  prisonerId: string;
  prisonerName: string;
  value: string;
}

export interface ParsedWorkbook {
  sheet: string;
  rows: WorkbookRow[];
  ignored: number;
  issues: { row: number; reason: string }[];
}

const text = (value: unknown) => String(value ?? '').trim();
const digits = (value: string) => value.replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0xe50));
const normalizeId = (value: unknown) => digits(text(value)).replace(/\s*\/\s*/g, '/');

function normalizeDisciplineDate(value: unknown, date1904: boolean): string {
  let year: number;
  let month: number;
  let day: number;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    const date = SSF.parse_date_code(value, { date1904 });
    if (!date) return '';
    ({ y: year, m: month, d: day } = date);
  } else {
    const date = digits(text(value));
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const thai = /^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2}|\d{4})$/.exec(date);
    if (iso) [year, month, day] = iso.slice(1).map(Number) as [number, number, number];
    else if (thai) [day, month, year] = thai.slice(1).map(Number) as [number, number, number];
    else return '';
  }
  if (year >= 2400) year -= 543;
  else if (year < 100) year += 1957;
  else if (year === 1968 || year === 1969) year += 57;
  if (year < 2000 || year > 2200) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return date.toISOString().slice(0, 10);
}

function values(sheet: WorkSheet): unknown[][] {
  const range = utils.decode_range(sheet['!ref'] ?? 'A1');
  if (range.e.r >= 110_000) throw new Error('จำนวนแถวในชีตเกินขนาดที่รองรับ');
  return utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    blankrows: true,
    range: { s: { r: 0, c: 0 }, e: { r: range.e.r, c: 6 } },
  });
}

export function parsePrisonerWorkbook(data: ArrayBuffer, kind: WorkbookKind): ParsedWorkbook {
  const sheetNames = kind === 'roster' ? ['Database'] : ['ใหม่', 'ต้นฉบับ'];
  const workbook = read(data, {
    type: 'array',
    sheets: sheetNames,
    dense: true,
    cellFormula: false,
    cellText: false,
    sheetRows: 110_000,
  });
  const sheet = sheetNames.find((name) => workbook.Sheets[name]?.['!ref']);
  if (!sheet) throw new Error(`ไม่พบชีต ${sheetNames.join(' หรือ ')} ในไฟล์นี้`);
  const source = values(workbook.Sheets[sheet]!);
  const parsed: ParsedWorkbook = { sheet, rows: [], ignored: 0, issues: [] };
  const header = source.findIndex(
    (row) => text(row[1]).replace(/\s/g, '') === 'ชื่อ-สกุล' && text(row[2]) === 'เลขหมาย' &&
      text(row[6]) === 'วันที่เกิดเหตุ',
  );
  if (kind === 'discipline' && (header < 0 || header > 15)) {
    throw new Error('ไม่พบหัวตารางชื่อ-สกุล เลขหมาย และวันที่เกิดเหตุในคอลัมน์ B, C และ G');
  }
  for (let index = kind === 'discipline' ? header + 1 : 0; index < source.length; index++) {
    const cells = source[index]!;
    const row = index + 1;
    if (kind === 'roster') {
      const prisonerId = normalizeId(cells[0]);
      const prisonerName = [text(cells[1]), text(cells[2])].filter(Boolean).join(' ');
      const ward = /^แดน\s*([1-9]\d?)$/.exec(digits(text(cells[3])));
      if (!ward) {
        if (prisonerId || prisonerName) parsed.ignored++;
        continue;
      }
      if (!prisonerId || !prisonerName) {
        parsed.issues.push({ row, reason: 'ขาดเลขบุ๊คหรือชื่อผู้ต้องขัง' });
        continue;
      }
      parsed.rows.push({ row, prisonerId, prisonerName, value: `แดน ${ward[1]}` });
    } else {
      const prisonerId = normalizeId(cells[2]);
      const prisonerName = text(cells[1]);
      if (!prisonerId && !prisonerName) continue;
      const value = normalizeDisciplineDate(cells[6], workbook.Workbook?.WBProps?.date1904 === true);
      if (!prisonerId || !prisonerName || !value) {
        parsed.issues.push({ row, reason: 'ขาดชื่อ เลขหมาย หรือวันที่เริ่มวินัยที่ถูกต้อง' });
        continue;
      }
      parsed.rows.push({ row, prisonerId, prisonerName, value });
    }
  }
  return parsed;
}
