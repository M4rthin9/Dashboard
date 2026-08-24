import { getReservationsWithArchive, updateStatus as apiUpdateStatus, cancelBooking as apiCancelBooking, deleteBooking as apiDeleteBooking, revertBookingPayment as apiRevertBookingPayment, updateVisitorApproval as apiUpdateVisitorApproval, updateBooking as apiUpdateBooking, createBooking as apiCreateBooking } from '../api/endpoints';
import { ApiError } from '../api/errors';
import type { Reservation } from '../api/types';
import { normalizeStatus, STATUS_LABELS } from '../utils/format';
import { liveSync } from './liveSync.svelte';

const CACHE_KEY = 'ccc_reservations_cache';
const CACHE_TTL = 5 * 60 * 1000;

export interface DaySummary {
  counts: Record<string, number>;
  totalAmount: number;
  pendingDiscipline: number;
  pendingParticipant: number;
}

class ReservationsStore {
  rows = $state<Reservation[]>([]);
  loading = $state(false);
  error = $state('');
  loadedAt = $state<number | null>(null);
  includeArchive = $state(false);

  private inFlight: Promise<void> | null = null;

  async load(force = false): Promise<void> {
    if (!force && this.rows.length > 0 && this.loadedAt && Date.now() - this.loadedAt < CACHE_TTL) return;
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      this.loading = true;
      this.error = '';
      try {
        const cached = this.readCache();
        if (!force && cached && Date.now() - cached.t < CACHE_TTL) {
          this.applyRows(cached.rows);
          this.loadedAt = cached.t;
          return;
        }
        const data = await getReservationsWithArchive(this.includeArchive);
        this.applyRows(data.rows ?? []);
        this.loadedAt = Date.now();
        this.writeCache();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
        throw err;
      } finally {
        this.loading = false;
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }

  async refresh(): Promise<void> {
    await this.load(true);
  }

  async toggleArchive(): Promise<void> {
    this.includeArchive = !this.includeArchive;
    await this.load(true);
  }

  /**
   * Replace the list *without* replacing the row objects themselves.
   *
   * An open modal (approval, payment, detail) holds the row it was given. When
   * a refresh handed back freshly-parsed objects, that held row became an
   * orphan: the store updated, the modal kept rendering its detached copy, and
   * approving a second visitor looked like it did nothing until the modal was
   * closed and reopened. Since liveSync refetches within ~3s of *your own*
   * write, that orphaning happened on almost every approval. Merging field-wise
   * into the existing object keeps every held reference live.
   */
  private applyRows(next: Reservation[]): void {
    const byRef = new Map(this.rows.map((r) => [String(r.ref), r]));
    this.rows = next.map((incoming) => {
      const current = byRef.get(String(incoming.ref));
      if (!current) return incoming;
      for (const key of Object.keys(current)) {
        if (!(key in incoming)) delete (current as Record<string, unknown>)[key];
      }
      Object.assign(current, incoming);
      return current;
    });
  }

  private readCache(): { rows: Reservation[]; t: number } | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.rows)) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  private writeCache(): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rows: this.rows, t: Date.now() }));
    } catch {
      // storage full or unavailable — ignore
    }
  }

  async updateStatus(ref: string, status: string, reason?: string): Promise<void> {
    const row = this.rows.find((r) => r.ref === ref);
    const old = row ? row.status : undefined;
    if (row) row.status = status;
    try {
      const res = await apiUpdateStatus(ref, status, reason);
      if (res.status !== 'ok') throw new ApiError(String(res.message ?? 'เกิดข้อผิดพลาด'));
      this.markDirty();
    } catch (err) {
      if (row) row.status = old;
      throw err;
    }
  }

  async cancelBooking(ref: string, reason: string): Promise<void> {
    const row = this.rows.find((r) => r.ref === ref);
    const old = row ? row.status : undefined;
    if (row) row.status = 'ยกเลิก';
    try {
      const res = await apiCancelBooking(ref, reason);
      if (res.status !== 'ok') throw new ApiError(String(res.message ?? 'เกิดข้อผิดพลาด'));
      this.markDirty();
    } catch (err) {
      if (row) row.status = old;
      throw err;
    }
  }

  /** Hard-delete a booking. Refetches rather than splicing locally: `rows` is
   *  mirrored into localStorage only inside load(), so a local splice would
   *  leave the deleted booking in the cached copy. */
  async deleteBooking(ref: string): Promise<void> {
    const res = await apiDeleteBooking(ref);
    if (res.status !== 'ok') throw new ApiError(String(res.message ?? 'เกิดข้อผิดพลาด'));
    await this.refresh();
  }

  /** Undo a mistaken slip upload (Superadmin only): status back to รอชำระเงิน,
   *  stored slip + verification data cleared server-side. Refetches so the row
   *  no longer shows the old slip. */
  async revertBookingPayment(ref: string): Promise<void> {
    const res = await apiRevertBookingPayment(ref);
    if (res.status !== 'ok') throw new ApiError(String(res.message ?? 'เกิดข้อผิดพลาด'));
    await this.refresh();
  }

  async updateVisitorApproval(ref: string, visitorApproved?: string, extraVisitorApproved?: string): Promise<void> {
    const row = this.rows.find((r) => r.ref === ref);
    const oldApproved = row ? row.visitorApproved : undefined;
    const oldExtra = row ? row.extraVisitorApproved : undefined;
    const oldCount = row ? row.visitorCount : undefined;
    const oldTotal = row ? row.total : undefined;
    const oldStatus = row ? row.status : undefined;
    if (row && visitorApproved !== undefined) row.visitorApproved = visitorApproved;
    if (row && extraVisitorApproved !== undefined) row.extraVisitorApproved = extraVisitorApproved;
    try {
      const res = await apiUpdateVisitorApproval(ref, visitorApproved, extraVisitorApproved);
      if (res.status !== 'ok') throw new ApiError(String(res.message ?? 'เกิดข้อผิดพลาด'));
      if (row && res.visitorCount !== undefined) row.visitorCount = res.visitorCount;
      if (row && res.total !== undefined) row.total = res.total;
      if (visitorApproved?.toLowerCase() === 'no') {
        if (row) row.status = 'ไม่อนุมัติ';
        await this.refresh();
      } else {
        this.markDirty();
      }
    } catch (err) {
      if (row && visitorApproved !== undefined) row.visitorApproved = oldApproved;
      if (row && extraVisitorApproved !== undefined) row.extraVisitorApproved = oldExtra;
      if (row) {
        row.visitorCount = oldCount;
        row.total = oldTotal;
        row.status = oldStatus;
      }
      throw err;
    }
  }

  async updateBooking(ref: string, fields: Record<string, unknown>): Promise<void> {
    const row = this.rows.find((r) => r.ref === ref);
    const snapshot = row ? { ...row } : null;
    if (row) Object.assign(row, fields);
    try {
      const res = await apiUpdateBooking(ref, fields);
      if (res.status !== 'ok') throw new ApiError(String(res.message ?? 'เกิดข้อผิดพลาด'));
      await this.refresh();
    } catch (err) {
      if (row && snapshot) Object.assign(row, snapshot);
      throw err;
    }
  }

  async createBooking(fields: Record<string, unknown>): Promise<string> {
    const res = await apiCreateBooking(fields);
    if (res.status !== 'ok') throw new ApiError(String(res.message ?? 'เกิดข้อผิดพลาด'));
    const ref = String(res.ref ?? '');
    await this.refresh();
    return ref;
  }

  daySummary(dateISO: string): DaySummary {
    const dayRows = this.rows.filter((r) => String(r.visitDateISO ?? '').trim() === dateISO && r.ref && String(r.ref).trim());
    const counts: Record<string, number> = {};
    let totalAmount = 0;
    let pendingDiscipline = 0;
    let pendingParticipant = 0;
    for (const r of dayRows) {
      const s = normalizeStatus(r.status);
      counts[s] = (counts[s] ?? 0) + 1;
      totalAmount += Number(r.total) || 0;
      if (s === 'รอตรวจสอบวินัย') pendingDiscipline++;
      if (s === 'รอตรวจสอบผู้เข้าร่วม') pendingParticipant++;
    }
    return { counts, totalAmount, pendingDiscipline, pendingParticipant };
  }

  /**
   * Mark the server as ahead of us after an optimistic write.
   *
   * Shifting `loadedAt` alone was not enough: the localStorage copy carries its
   * own timestamp, so the next non-forced load() (a route remount, a tab
   * revisit) restored the pre-write snapshot and the approval visibly reverted.
   * Drop that copy too, and poke liveSync so the authoritative rows arrive in
   * a few hundred milliseconds instead of on the next 3s poll.
   */
  private markDirty(): void {
    this.loadedAt = null;
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // storage unavailable — the forced refetch below still corrects us
    }
    liveSync.poke();
  }
}

export const reservations = new ReservationsStore();
export { STATUS_LABELS };
