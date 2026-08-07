import type { Reservation } from '../api/types';

export const CSV_HEADERS = [
  'ref', 'timestamp', 'visitorName', 'visitorPhone', 'visitorId', 'relation', 'prisonerName',
  'prisonerId', 'wing', 'visitDate', 'visitDateISO', 'visitorCount', 'totalPersons', 'total',
  'status', 'extraVisitorNames', 'visitorApproved', 'extraVisitorApproved', 'cancelReason',
];

function csvVal(v: unknown): string {
  const s = v != null ? String(v) : '';
  return '"' + s.replace(/"/g, '""') + '"';
}

export function exportReservationsCSV(rows: Reservation[], filename?: string): void {
  const csvContent = CSV_HEADERS.map(csvVal).join(',') + '\r\n' + rows.map((r) => CSV_HEADERS.map((h) => csvVal(r[h])).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename ?? `CC_Cafe_Reservations_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
