import { getSettings, saveSettings } from '../api/endpoints';
import type { PromptPayConfig } from '../utils/promptpay';
import { PROMPTPAY_DEFAULTS, PROMPTPAY_STORAGE_KEY } from '../utils/promptpay';

function sanitize(raw: unknown): PromptPayConfig {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    billerId: typeof o.billerId === 'string' && o.billerId ? o.billerId : PROMPTPAY_DEFAULTS.billerId,
    ref1: typeof o.ref1 === 'string' ? o.ref1 : PROMPTPAY_DEFAULTS.ref1,
    ref2: typeof o.ref2 === 'string' ? o.ref2 : PROMPTPAY_DEFAULTS.ref2,
    ref3: typeof o.ref3 === 'string' ? o.ref3 : PROMPTPAY_DEFAULTS.ref3,
    pointOfInitiation: o.pointOfInitiation === '12' ? '12' : '11',
  };
}

class PromptPayStore {
  config = $state<PromptPayConfig>({ ...PROMPTPAY_DEFAULTS });

  private hydratedFromServer = false;

  constructor() {
    try {
      const raw = localStorage.getItem(PROMPTPAY_STORAGE_KEY);
      if (raw) this.config = sanitize(JSON.parse(raw));
    } catch {
      this.config = { ...PROMPTPAY_DEFAULTS };
    }
  }

  /** Persist config locally + to server admin_settings (best-effort). */
  async save(next: PromptPayConfig): Promise<boolean> {
    this.config = sanitize(next);
    localStorage.setItem(PROMPTPAY_STORAGE_KEY, JSON.stringify(this.config));
    try {
      const current = await getSettings();
      const merged = { ...(current.settings ?? {}), promptpay: { ...this.config } };
      const res = await saveSettings(merged);
      return res.status === 'ok';
    } catch {
      return false;
    }
  }

  /** Merge config saved on the server into the local store (once per session). */
  async hydrateFromServer(): Promise<void> {
    if (this.hydratedFromServer) return;
    this.hydratedFromServer = true;
    try {
      const res = await getSettings();
      const server = (res.settings ?? {}) as Record<string, unknown>;
      const pp = server.promptpay as Record<string, unknown> | undefined;
      if (pp && typeof pp === 'object') {
        this.config = sanitize({ ...this.config, ...pp });
        localStorage.setItem(PROMPTPAY_STORAGE_KEY, JSON.stringify(this.config));
      }
    } catch {
      // keep local config
    }
  }
}

export const promptpayStore = new PromptPayStore();
