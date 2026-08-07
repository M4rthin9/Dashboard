import { callAction } from './client';
import type {
  ApiResult,
  EventLog,
  Paginated,
  Prisoner,
  PublicUser,
  Reservation,
  RolePermission,
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
  return callAction('getAllWithArchive', { withArchive }, { auth: true });
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

export function getPrisoners(): Promise<ApiResult & { prisoners?: Prisoner[] }> {
  return callAction('getPrisoners');
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
