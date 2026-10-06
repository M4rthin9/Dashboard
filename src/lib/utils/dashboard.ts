import type { Reservation } from '../api/types';
import { normalizeStatus, computeDeptReportData, prisonersOf } from './format';
import { activeBooking, amount, bookingPool, visitorCount, businessDate, validDate } from './management';

export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function amountOf(r: Reservation): number {
  return amount(r);
}

function visitKeyOf(r: Reservation): string {
  return String(r.visitDateISO ?? '').trim();
}

export interface RevenueSummary {
  totalBooked: number;
  paid: number;
  unpaid: number;
}

export function computeRevenueSummary(rows: Reservation[]): RevenueSummary {
  let totalBooked = 0;
  let paid = 0;
  let unpaid = 0;
  for (const r of rows) {
    const s = normalizeStatus(r.status);
    if (!activeBooking(r)) continue;
    const amt = amountOf(r);
    totalBooked += amt;
    if (s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') paid += amt;
    else if (s === 'รอชำระเงิน') unpaid += amt;
  }
  return { totalBooked, paid, unpaid };
}

export function computeStatusDistribution(rows: Reservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const s = normalizeStatus(r.status);
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

export function computeWingCounts(rows: Reservation[]): Array<{ wing: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const w = String(r.wing ?? '').trim();
    if (!w) continue;
    counts[w] = (counts[w] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([wing, count]) => ({ wing, count }))
    .sort((a, b) => b.count - a.count);
}

export interface MonthPoint {
  key: string;
  label: string;
  revenue: number;
  count: number;
}

export function computeMonthlyRevenue(rows: Reservation[], months = 6): MonthPoint[] {
  const now = new Date(`${businessDate()}T12:00:00`);
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      revenue: 0,
      count: 0,
    });
  }
  const index = new Map(out.map((p, i) => [p.key, i]));
  for (const r of rows) {
    if (!activeBooking(r)) continue;
    if (!validDate(visitKeyOf(r))) continue;
    const key = visitKeyOf(r).slice(0, 7);
    if (key && index.has(key)) {
      const p = out[index.get(key)!];
      p.revenue += amountOf(r);
      p.count++;
    }
  }
  return out;
}

export interface VisitorType {
  adult: number;
  child5to8: number;
  childUnder5: number;
}

export function computeVisitorTypes(rows: Reservation[]): VisitorType {
  let adult = 0;
  let child5to8 = 0;
  let childUnder5 = 0;
  for (const r of rows) {
    if (!activeBooking(r)) continue;
    adult += Math.max(0, Number(r.adultCount) || 0);
    child5to8 += Math.max(0, Number(r.child5to8Count) || 0);
    childUnder5 += Math.max(0, Number(r.childUnder5Count) || 0);
  }
  return { adult, child5to8, childUnder5 };
}

export interface FinancialAgg {
  bookings: number;
  attended: number;
  adults: number;
  visitors: number;
  prisoners: number;
  kidsUnder5: number;
  kids5_8: number;
  people: number;
  paid: number;
  pending: number;
  total: number;
}

export interface FinancialSummary extends FinancialAgg {
  distinctPrisoners: number;
  paidPct: number;
}

export interface FinancialDayRow extends FinancialAgg {
  date: string;
}

export interface FinancialMonthRow extends FinancialAgg {
  month: string;
}

export function financialDateOf(r: Reservation): string {
  return String(r.visitDateISO ?? '').trim() || String(r.visitDate ?? '').trim();
}

export function isFinancialAttended(r: Reservation): boolean {
  const s = normalizeStatus(r.status);
  return s === 'ชำระแล้ว' || s === 'เสร็จสิ้น';
}

function isFinancialExcluded(r: Reservation): boolean {
  return !activeBooking(r);
}

function aggregateFinancial(rows: Reservation[]): FinancialAgg {
  const agg: FinancialAgg = {
    bookings: 0, attended: 0, adults: 0, visitors: 0, prisoners: 0,
    kidsUnder5: 0, kids5_8: 0, people: 0, paid: 0, pending: 0, total: 0,
  };
  for (const r of rows) {
    if (isFinancialExcluded(r)) continue;
    const amt = amount(r);
    agg.bookings++;
    agg.total += amt;
    if (isFinancialAttended(r)) {
      agg.attended++;
      agg.prisoners += bookingPool(r) === 'table' ? 0 : prisonersOf(r).length;
      agg.paid += amt;
      const d = computeDeptReportData(r);
      agg.adults += d.adults;
      agg.kidsUnder5 += d.kidsUnder5;
      agg.kids5_8 += d.kids5_8;
      agg.visitors += visitorCount(r);
    } else if (normalizeStatus(r.status) === 'รอชำระเงิน') {
      agg.pending += amt;
    }
  }
  agg.people = agg.visitors + agg.prisoners;
  return agg;
}

export function computeFinancialSummary(rows: Reservation[]): FinancialSummary {
  const agg = aggregateFinancial(rows);
  const prisoners = new Set<string>();
  for (const r of rows) {
    if (!activeBooking(r) || !isFinancialAttended(r) || bookingPool(r) === 'table') continue;
    for (const p of prisonersOf(r)) if (p.id) prisoners.add(p.id);
  }
  const paidPct = agg.total > 0 ? Math.round((agg.paid / agg.total) * 100) : 0;
  return { ...agg, distinctPrisoners: prisoners.size, paidPct };
}

export function buildDailyFinancialReport(rows: Reservation[], fromISO: string, toISO: string): FinancialDayRow[] {
  const byDate = new Map<string, Reservation[]>();
  for (const r of rows) {
    const d = financialDateOf(r);
    if (!d) continue;
    const list = byDate.get(d);
    if (list) list.push(r);
    else byDate.set(d, [r]);
  }
  const out: FinancialDayRow[] = [];
  const cur = new Date(`${fromISO}T00:00:00`);
  const end = new Date(`${toISO}T00:00:00`);
  while (cur <= end) {
    const key = toLocalDateStr(cur);
    const agg = aggregateFinancial(byDate.get(key) ?? []);
    out.push({ date: key, ...agg });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function buildMonthlyFinancialReport(rows: Reservation[], fromMonth: string, toMonth: string): FinancialMonthRow[] {
  const byMonth = new Map<string, Reservation[]>();
  for (const r of rows) {
    const key = financialDateOf(r).slice(0, 7);
    if (!key) continue;
    const list = byMonth.get(key);
    if (list) list.push(r);
    else byMonth.set(key, [r]);
  }
  const out: FinancialMonthRow[] = [];
  let y = Number(fromMonth.slice(0, 4));
  let m = Number(fromMonth.slice(5, 7));
  const ty = Number(toMonth.slice(0, 4));
  const tm = Number(toMonth.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const agg = aggregateFinancial(byMonth.get(key) ?? []);
    out.push({ month: key, ...agg });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function monthLabel(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

export function currentMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthISO(ym: string, delta: number): string {
  let y = Number(ym.slice(0, 4));
  let m = Number(ym.slice(5, 7)) + delta;
  while (m > 12) {
    m -= 12;
    y++;
  }
  while (m < 1) {
    m += 12;
    y--;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function lastDayISO(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  const last = new Date(y, m, 0).getDate();
  return `${ym}-${String(last).padStart(2, '0')}`;
}
