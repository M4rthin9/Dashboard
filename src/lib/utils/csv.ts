import type { Prisoner, Reservation } from '../api/types';

export const PRISONER_CSV_HEADERS = [
  'เลขผู้ต้องขัง',
  'ชื่อ-นามสกุล',
  'แดน',
  'สถานะ',
  'วันกระทำความผิด/ไถ่ถอน',
  'หมายเหตุ',
];

export const CSV_HEADERS = [
  'ref', 'timestamp', 'visitorName', 'visitorPhone', 'visitorId', 'relation', 'prisonerName',
  'prisonerId', 'wing', 'visitDate', 'visitDateISO', 'visitorCount', 'totalPersons', 'total',
  'status', 'extraVisitorNames', 'visitorApproved', 'extraVisitorApproved', 'cancelReason',
];

function csvVal(v: unknown): string {
  const s = v != null ? String(v) : '';
  return '"' + s.replace(/"/g, '""') + '"';
}

function downloadBlob(content: string, filename: string, mime = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function prisonerRow(p: Prisoner): string {
  return [p.prisonerId, p.prisonerName, p.wing, p.status, p.vinaiDate, p.note].map(csvVal).join(',');
}

export function exportPrisonersCSV(prisoners: Prisoner[], filename?: string): void {
  const csvContent =
    PRISONER_CSV_HEADERS.map(csvVal).join(',') + '\r\n' + prisoners.map(prisonerRow).join('\r\n');
  downloadBlob(csvContent, filename ?? `ผู้ต้องขัง_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function downloadPrisonerTemplate(): void {
  downloadBlob(PRISONER_CSV_HEADERS.map(csvVal).join(',') + '\r\n', `ผู้ต้องขัง_แบบฟอร์ม_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportReservationsCSV(rows: Reservation[], filename?: string): void {
  const csvContent = CSV_HEADERS.map(csvVal).join(',') + '\r\n' + rows.map((r) => CSV_HEADERS.map((h) => csvVal(r[h])).join(',')).join('\r\n');
  downloadBlob(csvContent, filename ?? `CC_Cafe_Reservations_${new Date().toISOString().slice(0, 10)}.csv`);
}
