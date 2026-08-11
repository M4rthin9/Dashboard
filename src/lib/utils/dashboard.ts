import type { Reservation } from '../api/types';
import { normalizeStatus } from './format';

export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function amountOf(r: Reservation): number {
  return Number(r.total) || 0;
}

function visitKeyOf(r: Reservation): string {
  return String(r.visitDateISO ?? '').trim();
}

export interface DashboardStats {
  total: number;
  wait: number;
  ok: number;
  reject: number;
  uniquePrisoners: number;
  thisWeek: number;
  thisMonth: number;
  uniqueVisitors: number;
}

export function computeStats(rows: Reservation[]): DashboardStats {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const weekStartISO = toLocalDateStr(weekStart);
  const monthStartISO = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEndISO = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const valid = rows.filter((r) => r.ref && String(r.ref).trim());
  const prisoners = new Set<string>();
  const visitors = new Set<string>();
  let wait = 0;
  let ok = 0;
  let reject = 0;
  let thisWeek = 0;
  let thisMonth = 0;

  for (const r of valid) {
    const s = normalizeStatus(r.status);
    if (s === 'ยกเลิก' || s === 'ไม่อนุมัติ') {
      if (s === 'ไม่อนุมัติ') reject++;
    }
    if (s === 'รอตรวจสอบวินัย') wait++;
    if (s === 'รอชำระเงิน' || s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') ok++;
    const key = visitKeyOf(r);
    if (key >= weekStartISO) thisWeek++;
    if (key >= monthStartISO && key <= monthEndISO) thisMonth++;
    if (r.prisonerId) prisoners.add(String(r.prisonerId));
    if (r.visitorName) visitors.add(String(r.visitorName));
  }

  return {
    total: valid.length,
    wait,
    ok,
    reject,
    uniquePrisoners: prisoners.size,
    thisWeek,
    thisMonth,
    uniqueVisitors: visitors.size,
  };
}

export interface RevenueKpis {
  mtdTotal: number;
  mtdCount: number;
  paidTotal: number;
  pendingTotal: number;
  grandTotal: number;
  bookingCount: number;
  todayCount: number;
  avgRevenue: number;
  utilRate: number;
  paidPct: number;
}

export function computeRevenueKpis(rows: Reservation[]): RevenueKpis {
  const now = new Date();
  const todayISO = toLocalDateStr(now);
  const monthStartISO = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));

  let mtdTotal = 0;
  let mtdCount = 0;
  let paidTotal = 0;
  let pendingTotal = 0;
  let grandTotal = 0;
  let bookingCount = 0;
  let todayCount = 0;

  for (const r of rows) {
    if (!r.ref || String(r.ref).trim() === '') continue;
    const s = normalizeStatus(r.status);
    if (s === 'ยกเลิก' || s === 'ไม่อนุมัติ') continue;
    const amt = amountOf(r);
    const key = visitKeyOf(r);
    const isThisMonth = key >= monthStartISO;
    if (key === todayISO) todayCount++;
    if (isThisMonth) {
      mtdTotal += amt;
      mtdCount++;
    }
    grandTotal += amt;
    bookingCount++;
    if (s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') paidTotal += amt;
    else if (s === 'รอชำระเงิน') pendingTotal += amt;
  }

  const avgRevenue = bookingCount > 0 ? Math.round(grandTotal / bookingCount) : 0;
  const utilRate = Math.min(Math.round((todayCount / 20) * 100), 100);
  const paidPct = grandTotal > 0 ? Math.round((paidTotal / grandTotal) * 100) : 0;

  return { mtdTotal, mtdCount, paidTotal, pendingTotal, grandTotal, bookingCount, todayCount, avgRevenue, utilRate, paidPct };
}

export interface TrendPoint {
  date: string;
  count: number;
}

export function computeTrend(rows: Reservation[], days = 14): TrendPoint[] {
  const now = new Date();
  const out: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push({ date: toLocalDateStr(d), count: 0 });
  }
  const index = new Map(out.map((p, i) => [p.date, i]));
  for (const r of rows) {
    const key = visitKeyOf(r);
    if (key && index.has(key)) out[index.get(key)!].count++;
  }
  return out;
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
    if (s === 'ยกเลิก' || s === 'ไม่อนุมัติ') continue;
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
  const now = new Date();
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
    const s = normalizeStatus(r.status);
    if (s === 'ยกเลิก' || s === 'ไม่อนุมัติ') continue;
    const key = visitKeyOf(r).slice(0, 7);
    if (key && index.has(key)) {
      const p = out[index.get(key)!];
      p.revenue += amountOf(r);
      p.count++;
    }
  }
  return out;
}

export function computeFunnel(rows: Reservation[]): Array<{ name: string; value: number }> {
  const stages = ['รอตรวจสอบผู้เข้าร่วม', 'รอตรวจสอบวินัย', 'รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'];
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const s = normalizeStatus(r.status);
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return stages.map((s) => ({ name: s, value: counts[s] ?? 0 }));
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
    const s = normalizeStatus(r.status);
    if (s === 'ยกเลิก' || s === 'ไม่อนุมัติ') continue;
    adult += Number(r.adultCount) || 0;
    child5to8 += Number(r.child5to8Count) || 0;
    childUnder5 += Number(r.childUnder5Count) || 0;
  }
  return { adult, child5to8, childUnder5 };
}

export interface DailyRevenuePoint {
  date: string;
  paid: number;
  pending: number;
}

export function computeDailyRevenue(rows: Reservation[], days = 14): DailyRevenuePoint[] {
  const now = new Date();
  const out: DailyRevenuePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push({ date: toLocalDateStr(d), paid: 0, pending: 0 });
  }
  const index = new Map(out.map((p, i) => [p.date, i]));
  for (const r of rows) {
    const s = normalizeStatus(r.status);
    if (s === 'ยกเลิก' || s === 'ไม่อนุมัติ') continue;
    const key = visitKeyOf(r);
    if (!key || !index.has(key)) continue;
    const p = out[index.get(key)!];
    const amt = amountOf(r);
    if (s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') p.paid += amt;
    else if (s === 'รอชำระเงิน') p.pending += amt;
  }
  return out;
}

export function computeAlerts(rows: Reservation[]): Reservation[] {
  return rows
    .filter((r) => {
      const s = normalizeStatus(r.status);
      return s === 'ชำระแล้ว' || s === 'เสร็จสิ้น';
    })
    .sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? '')));
}

export function computePaymentQueue(rows: Reservation[]): Reservation[] {
  return rows
    .filter((r) => normalizeStatus(r.status) === 'รอชำระเงิน')
    .sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? '')));
}

export function computeTodaysVisits(rows: Reservation[]): Reservation[] {
  const today = toLocalDateStr(new Date());
  return rows.filter((r) => visitKeyOf(r) === today);
}

export interface FinancialAgg {
  bookings: number;
  attended: number;
  visitors: number;
  prisoners: number;
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
  const s = normalizeStatus(r.status);
  return s === 'ยกเลิก' || s === 'ไม่อนุมัติ';
}

function aggregateFinancial(rows: Reservation[]): FinancialAgg {
  const agg: FinancialAgg = { bookings: 0, attended: 0, visitors: 0, prisoners: 0, paid: 0, pending: 0, total: 0 };
  for (const r of rows) {
    if (isFinancialExcluded(r)) continue;
    const amt = Number(r.total) || 0;
    agg.bookings++;
    agg.total += amt;
    if (isFinancialAttended(r)) {
      agg.attended++;
      agg.visitors += Number(r.visitorCount) || 0;
      agg.prisoners += 1;
      agg.paid += amt;
    } else if (normalizeStatus(r.status) === 'รอชำระเงิน') {
      agg.pending += amt;
    }
  }
  return agg;
}

export function computeFinancialSummary(rows: Reservation[]): FinancialSummary {
  const agg = aggregateFinancial(rows);
  const prisoners = new Set<string>();
  for (const r of rows) {
    if (!isFinancialAttended(r)) continue;
    const id = String(r.prisonerId ?? '').trim();
    if (id) prisoners.add(id);
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
