import type { AuthUser, ApiResult } from '../api/types';
import { ApiError, AuthExpiredError } from '../api/errors';
import { SvelteURLSearchParams } from 'svelte/reactivity';

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  'https://ccc-backend.pongsinbas.workers.dev';

const ACCESS_KEY = 'ccc_access_token';
const REFRESH_KEY = 'ccc_refresh_token';
const USER_KEY = 'ccc_user';

interface RequestOptions {
  auth?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Fetch with one retry on network failure or transient 5xx (Worker cold start / brief outage). */
async function resilientFetch(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.status >= 500 && attempt < 1) {
      await new Promise((r) => setTimeout(r, 800));
      return resilientFetch(url, init, attempt + 1);
    }
    return res;
  } catch {
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 800));
      return resilientFetch(url, init, attempt + 1);
    }
    throw new ApiError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง');
  }
}

class AuthStore {
  user = $state<AuthUser | null>(null);
  accessToken = $state('');
  mustChangePassword = $state(false);
  initialized = $state(false);

  constructor() {
    this.accessToken = localStorage.getItem(ACCESS_KEY) || '';
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      try {
        this.user = JSON.parse(raw);
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    this.initialized = true;
  }

  get isAuthenticated(): boolean {
    return !!this.user && !!this.accessToken;
  }

  get displayName(): string {
    return this.user?.displayName || this.user?.username || '';
  }

  async login(username: string, password: string): Promise<AuthUser> {
    const data = await postAction('login', { username, password }, { auth: false });
    if (typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') {
      throw new ApiError('การตอบสนองจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    this.persist(data.accessToken, data.refreshToken, data.user as AuthUser);
    this.mustChangePassword = !!data.mustChangePassword;
    return this.user!;
  }

  async changePassword(username: string, oldPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    const data = await postAction(
      'changePassword',
      { username, oldPassword, newPassword, confirmPassword },
      { auth: false }
    );
    if (data.status !== 'ok') throw new ApiError(String(data.message ?? 'เกิดข้อผิดพลาด'));
  }

  logout(): void {
    this.accessToken = '';
    this.user = null;
    this.mustChangePassword = false;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  }

  private persist(accessToken: string, refreshToken: string, user: AuthUser): void {
    this.accessToken = accessToken;
    this.user = user;
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

export const auth = new AuthStore();

async function postAction(action: string, body: Record<string, unknown> = {}, opts: RequestOptions = {}): Promise<ApiResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth && auth.accessToken) headers['Authorization'] = `Bearer ${auth.accessToken}`;

  const res = await resilientFetch(`${API_BASE}/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...body }),
  });

  const data = (await res.json().catch(() => ({}))) as ApiResult;
  if (typeof data !== 'object' || data === null || !('status' in data)) {
    if (!res.ok) throw new ApiError(`เซิร์ฟเวอร์ขัดข้องชั่วคราว (HTTP ${res.status}) กรุณาลองใหม่อีกครั้ง`);
    throw new ApiError('การตอบสนองจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }

  if (data.status === 'error') {
    if (opts.auth && String(data.message ?? '').toLowerCase().includes('unauthorized')) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return postAction(action, body, opts);
      auth.logout();
      throw new AuthExpiredError();
    }
    throw new ApiError(String(data.message ?? 'เกิดข้อผิดพลาด'));
  }

  return data;
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const rt = sessionStorage.getItem(REFRESH_KEY);
    if (!rt) return false;
    try {
      const res = await resilientFetch(`${API_BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', refreshToken: rt }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiResult;
      if (data.status === 'ok' && typeof data.accessToken === 'string') {
        auth.accessToken = data.accessToken;
        localStorage.setItem(ACCESS_KEY, data.accessToken);
        if (data.user && typeof data.user === 'object') {
          auth.user = data.user as AuthUser;
          localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Generic API call. Prefer the typed helpers in endpoints.ts. */
export function callAction<T extends object = ApiResult>(action: string, body: Record<string, unknown> = {}, opts: RequestOptions = {}): Promise<T> {
  return postAction(action, body, opts) as unknown as Promise<T>;
}

/** GET a REST alias endpoint (e.g. /api/prisoners) with Bearer auth + refresh fallback. */
async function getAction<T extends object = ApiResult>(path: string, query: Record<string, unknown> = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth.accessToken) headers['Authorization'] = `Bearer ${auth.accessToken}`;

  const qs = new SvelteURLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v));
  }
  const url = `${API_BASE}${path}${qs.toString() ? `?${qs.toString()}` : ''}`;

  const res = await resilientFetch(url, { method: 'GET', headers });

  const data = (await res.json().catch(() => ({}))) as ApiResult;
  if (typeof data !== 'object' || data === null || !('status' in data)) {
    if (!res.ok) throw new ApiError(`เซิร์ฟเวอร์ขัดข้องชั่วคราว (HTTP ${res.status}) กรุณาลองใหม่อีกครั้ง`);
    throw new ApiError('การตอบสนองจากเซิร์ฟเวอร์ไม่ถูกต้อง');
  }

  if (data.status === 'error') {
    if (String(data.message ?? '').toLowerCase().includes('unauthorized')) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return getAction<T>(path, query);
      auth.logout();
      throw new AuthExpiredError();
    }
    throw new ApiError(String(data.message ?? 'เกิดข้อผิดพลาด'));
  }

  return data as T;
}

export function callGet<T extends object = ApiResult>(path: string, query: Record<string, unknown> = {}): Promise<T> {
  return getAction<T>(path, query);
}
