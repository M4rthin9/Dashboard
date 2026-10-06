import type { Reservation } from '../api/types';
import { normalizeStatus, prisonersOf, STATUS_STEPS } from './format';
import { hasPermission } from './permissions';

export type BookingPool = 'all' | 'prisoner' | 'table';
export interface DateRange { from: string; to: string }
const DAY = 86_400_000;
const terminal = ['ยกเลิก', 'ไม่อนุมัติ'];

export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
export function rangeDays(range: DateRange): number {
  if (!validDate(range.from) || !validDate(range.to) || range.from > range.to) return 0;
  return Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY) + 1;
}
export function previousRange(range: DateRange): DateRange {
  const days = rangeDays(range);
  return days ? { from: shiftDate(range.from, -days), to: shiftDate(range.from, -1) } : range;
}
export function bookingPool(row: Reservation): Exclude<BookingPool, 'all'> {
  const explicit = String(row.bookingType ?? '').trim();
  if (explicit === 'table' || explicit === 'prisoner') return explicit;
  return row.ref?.trim().toUpperCase().startsWith('TBL-') ? 'table' : 'prisoner';
}
export function activeBooking(row: Reservation): boolean {
  return !!String(row.ref ?? '').trim() && STATUS_STEPS.includes(normalizeStatus(row.status)) && !terminal.includes(normalizeStatus(row.status));
}
/** Partition by the server's archive marker, not visit date or booking status. */
export function reservationViewRows(rows: Reservation[], archived: boolean): Reservation[] {
  return rows.filter(row => !!String(row.ref ?? '').trim() && !!row._archived === archived);
}
export function amount(row: Reservation): number {
  const n = Number(row.total);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
export function visitorCount(row: Reservation): number {
  const n = Number(row.visitorCount);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
export function peopleCount(row: Reservation): number {
  return visitorCount(row) + (bookingPool(row) === 'table' ? 0 : prisonersOf(row).length);
}
export function scopedReservations(rows: Reservation[], role: string, today: string): Reservation[] {
  return rows.filter(row => {
    if (!String(row.ref ?? '').trim()) return false;
    const s = normalizeStatus(row.status);
    if (role === 'Finance') return ['รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'].includes(s);
    if (role === 'Tadtel') return s === 'รอตรวจสอบผู้เข้าร่วม';
    if (role === 'Vinai' && validDate(String(row.visitDateISO ?? '').trim())) return String(row.visitDateISO).trim() >= today;
    return true;
  });
}
export function periodRows(rows: Reservation[], range: DateRange, pool: BookingPool = 'all'): Reservation[] {
  if (!rangeDays(range)) return [];
  return rows.filter(row => {
    const d = String(row.visitDateISO ?? '').trim();
    return validDate(d) && d >= range.from && d <= range.to && (pool === 'all' || bookingPool(row) === pool);
  });
}
export function periodSummary(rows: Reservation[]) {
  let bookings = 0, paid = 0, pending = 0, booked = 0, completed = 0, visitors = 0;
  for (const row of rows) {
    if (!activeBooking(row)) continue;
    bookings++;
    visitors += visitorCount(row);
    booked += amount(row);
    const s = normalizeStatus(row.status);
    if (s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') paid += amount(row);
    if (s === 'รอชำระเงิน') pending += amount(row);
    if (s === 'เสร็จสิ้น') completed++;
  }
  return { bookings, paid, pending, booked, completed, visitors };
}
export function comparison(value: number, previous: number): { delta: number; percent: number | null } {
  return { delta: value - previous, percent: previous > 0 ? Math.round((value - previous) / previous * 100) : null };
}
export function dailySeries(rows: Reservation[], range: DateRange) {
  const days = rangeDays(range);
  if (!days || days > 366) return [];
  const out = Array.from({ length: days }, (_, i) => ({ date: shiftDate(range.from, i), prisoner: 0, table: 0, paid: 0, pending: 0 }));
  const index = new Map(out.map(point => [point.date, point]));
  for (const row of rows) {
    if (!activeBooking(row)) continue;
    const point = index.get(String(row.visitDateISO ?? '').trim());
    if (!point) continue;
    point[bookingPool(row)]++;
    const s = normalizeStatus(row.status);
    if (s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') point.paid += amount(row);
    if (s === 'รอชำระเงิน') point.pending += amount(row);
  }
  return out;
}
export function expiredHold(row: Reservation, now = new Date()): boolean {
  if (bookingPool(row) !== 'table' || normalizeStatus(row.status) !== 'รอชำระเงิน') return false;
  const expiry = Date.parse(String(row.holdExpiresAt ?? ''));
  return Number.isFinite(expiry) && expiry < now.getTime();
}
export function visitOrder(a: Reservation, b: Reservation): number {
  const ad = String(a.visitDateISO ?? '').trim();
  const bd = String(b.visitDateISO ?? '').trim();
  return (validDate(ad) ? ad : '9999-99-99').localeCompare(validDate(bd) ? bd : '9999-99-99') || String(a.createdAt ?? a.timestamp ?? '').localeCompare(String(b.createdAt ?? b.timestamp ?? '')) || a.ref.localeCompare(b.ref);
}
export interface WorkQueue { status: string; label: string; action: string; permission: string; rows: Reservation[] }
export function workQueues(rows: Reservation[], role: string, now = new Date()): WorkQueue[] {
  const defs = [
    { status: 'รอตรวจสอบผู้เข้าร่วม', label: 'ตรวจสอบผู้เข้าร่วม', action: 'ตรวจสอบรายชื่อ', permission: 'approve_participant' },
    { status: 'รอตรวจสอบวินัย', label: 'ตรวจสอบวินัย', action: 'เปิดรายการวินัย', permission: 'approve_discipline' },
    { status: 'รอชำระเงิน', label: 'รอชำระเงิน', action: 'ตรวจสอบการชำระ', permission: 'confirm_payment' },
    { status: 'ชำระแล้ว', label: 'รอยืนยันเสร็จสิ้น', action: 'ยืนยันเสร็จสิ้น', permission: 'confirm_payment' },
  ];
  const scoped = scopedReservations(rows, role, businessDate(now));
  return defs.filter(def => hasPermission(role, def.permission)).map(def => ({ ...def, rows: scoped.filter(row => !row._archived && normalizeStatus(row.status) === def.status && !expiredHold(row, now)).sort(visitOrder) }));
}
