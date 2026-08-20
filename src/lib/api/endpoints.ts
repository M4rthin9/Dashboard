import { callAction, callGet } from './client';
import type {
  ApiResult,
  EventLog,
  Paginated,
  Prisoner,
  PublicUser,
  Reservation,
  RolePermission,
  SlipVerifyResult,
} from './types';

export interface ReservationFilters {
  search?: string;
  status?: string;
  date?: string;
  wing?: string;
}

export function login(username: string, password: string): Promise<ApiResult> {
  return callAction('login', { username, password });
}

export function getReservations(): Promise<ApiResult & { rows?: Reservation[] }> {
  return callAction('getAll', {}, { auth: true });
}

export function getReservationsWithArchive(withArchive = true): Promise<ApiResult & { rows?: Reservation[] }> {
  return callAction('getAllWithArchive', { includeArchive: withArchive }, { auth: true });
}

export function getArchivedReservations(): Promise<ApiResult & { rows?: Reservation[] }> {
  return callAction('getArchivedReservations', {}, { auth: true });
}

export function getReservationsPaginated(page = 1, pageSize = 10, filters: ReservationFilters = {}): Promise<Paginated<Reservation>> {
  return callAction<Paginated<Reservation>>('getAllPaginated', { page, pageSize, filters }, { auth: true });
}

export function getCountsByDate(): Promise<ApiResult & { counts?: Record<string, number> }> {
  return callAction('getCountsByDate');
}

export function getDataVersion(): Promise<ApiResult & { version?: number }> {
  return callAction('getDataVersion', {}, { auth: true });
}

export function lookupByRef(ref: string): Promise<ApiResult & { rows?: Reservation[] }> {
  return callAction('lookupByRef', { ref });
}

export function getSlipByRef(ref: string): Promise<ApiResult & { slipImage?: string }> {
  return callAction('getSlipByRef', { ref }, { auth: true });
}

/** Re-scan + re-parse the stored slip QR against the booking config. */
export function verifySlip(ref: string): Promise<ApiResult & { result?: SlipVerifyResult }> {
  return callAction('verifySlip', { ref }, { auth: true });
}

export async function getPrisoners(): Promise<ApiResult & { prisoners?: Prisoner[] }> {
  const data = await callGet<ApiResult & { prisoners?: unknown[] }>('/api/prisoners');
  if (data.status !== 'ok' || !Array.isArray(data.prisoners)) return { status: 'ok', prisoners: [] };
  const prisoners: Prisoner[] = [];
  for (const r of data.prisoners) {
    if (Array.isArray(r)) {
      prisoners.push({
        prisonerName: String(r[0] ?? ''),
        prisonerId: String(r[1] ?? ''),
        wing: String(r[2] ?? ''),
        status: String(r[3] ?? ''),
        vinaiDate: String(r[4] ?? ''),
        note: String(r[5] ?? ''),
      });
    } else if (r && typeof r === 'object') {
      const p = r as Record<string, unknown>;
      prisoners.push({
        prisonerId: String(p.prisonerId ?? ''),
        prisonerName: String(p.prisonerName ?? ''),
        wing: String(p.wing ?? ''),
        status: String(p.status ?? ''),
        vinaiDate: String(p.vinaiDate ?? ''),
        note: String(p.note ?? ''),
      });
    }
  }
  return { status: 'ok', prisoners };
}

export function getRoles(): Promise<ApiResult & { roles?: RolePermission[] }> {
  return callAction('getRoles', {}, { auth: true });
}

export function getUsers(): Promise<ApiResult & { users?: PublicUser[] }> {
  return callAction('getUsers', {}, { auth: true });
}

export function getEventLogs(): Promise<ApiResult & { logs?: EventLog[] }> {
  return callAction('getEventLogs', {}, { auth: true });
}

export function getEventLogsPaginated(page = 1, pageSize = 20): Promise<Paginated<EventLog>> {
  return callAction<Paginated<EventLog>>('getEventLogsPaginated', { page, pageSize }, { auth: true });
}

export function ping(): Promise<ApiResult> {
  return callAction('ping');
}

export function testConnection(): Promise<ApiResult & { message?: string }> {
  return callAction('testConnection');
}

export function getBackendUrl(): Promise<ApiResult & { url?: string }> {
  return callAction('getBackendUrl');
}

export function updateStatus(ref: string, status: string, reason?: string): Promise<ApiResult> {
  return callAction('updateStatus', { ref, status, ...(reason ? { reason } : {}) }, { auth: true });
}

export function cancelBooking(ref: string, reason?: string): Promise<ApiResult> {
  return callAction('cancelBooking', { ref, ...(reason ? { reason } : {}) }, { auth: true });
}

export function deleteBooking(ref: string): Promise<ApiResult> {
  return callAction('deleteBooking', { ref }, { auth: true });
}

// `visitorApproved` is omitted, not blanked, when only the extra visitors are
// being decided: the backend reads *any* present-but-not-'yes' value as a
// rejection of the main visitor and flips the booking to ไม่อนุมัติ.
export function updateVisitorApproval(
  ref: string,
  visitorApproved?: string,
  extraVisitorApproved?: string
): Promise<ApiResult & { visitorCount?: number; total?: number }> {
  return callAction(
    'updateVisitorApproval',
    {
      ref,
      ...(visitorApproved !== undefined ? { visitorApproved } : {}),
      ...(extraVisitorApproved !== undefined ? { extraVisitorApproved } : {}),
    },
    { auth: true }
  );
}

export function updateBooking(ref: string, fields: Record<string, unknown>): Promise<ApiResult> {
  return callAction('updateBooking', { ref, ...fields }, { auth: true });
}

export function createBooking(fields: Record<string, unknown>): Promise<ApiResult & { ref?: string }> {
  return callAction('createBooking', fields, { auth: true });
}

export function createUser(username: string, password: string, role: string, displayName?: string): Promise<ApiResult> {
  return callAction('createUser', { username, password, role, displayName }, { auth: true });
}

export function updateUser(targetUser: string, fields: { role?: string; displayName?: string; newPassword?: string }): Promise<ApiResult> {
  return callAction('updateUser', { targetUser, ...fields }, { auth: true });
}

export function deleteUser(targetUser: string): Promise<ApiResult> {
  return callAction('deleteUser', { targetUser }, { auth: true });
}

export function createRole(roleName: string, permissions: string[]): Promise<ApiResult> {
  return callAction('createRole', { roleName, permissions }, { auth: true });
}

export function importPrisoners(prisoners: Record<string, unknown>[]): Promise<ApiResult & { added?: number; updated?: number; removed?: number; wingChanged?: number; errors?: string[] }> {
  return callAction('importPrisoners', { prisoners }, { auth: true });
}

export function syncPrisonerWings(): Promise<ApiResult & { updated?: number }> {
  return callAction('syncPrisonerWings', {}, { auth: true });
}

export interface PromptPayQrParams {
  ref?: string;
  billerId?: string;
  ref1?: string;
  ref2?: string;
  ref3?: string;
  amount?: string | number;
  pointOfInitiation?: '11' | '12';
}

export interface PromptPayQrResponse {
  status: string;
  payload?: string;
  qrDataUrl?: string;
  /** Branded PromptPay card rendered server-side (SVG markup). */
  qrCardSvg?: string;
  amount?: number;
  billerId?: string;
  ref1?: string;
  ref2?: string;
  ref3?: string;
  message?: string;
}

export function generatePromptPayQr(params: Partial<PromptPayQrParams> = {}): Promise<PromptPayQrResponse> {
  return callGet<PromptPayQrResponse>('/api/promptpay/qr', params);
}

export function getSettings(): Promise<ApiResult & { settings?: Record<string, unknown> }> {
  return callAction('getSettings', {}, { auth: true });
}

export function saveSettings(settings: Record<string, unknown>): Promise<ApiResult> {
  return callAction('saveSettings', { settings }, { auth: true });
}
