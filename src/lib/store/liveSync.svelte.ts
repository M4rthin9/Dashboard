import { callGet } from '../api/client';

// Near-live updates without a socket.
//
// The backend bumps a global counter plus a per-scope counter on every write
// and exposes them at GET /api/version — one small D1 read, served no-store.
// Polling that and refetching only when a scope actually moves costs a fraction
// of refetching the reservation list on a timer, and means a colleague's
// approval shows up here within a few seconds instead of on the next manual
// reload.

type Scope = 'reservations' | 'prisoners' | 'users' | 'roles' | 'settings';

interface VersionResponse {
  status: string;
  version: number;
  scopes: Record<Scope, number>;
}

const POLL_MS = 3000;
const BACKOFF_MAX_MS = 30000;

class LiveSyncStore {
  /** False once polling has failed twice — surface this as a "reconnecting" hint. */
  connected = $state(true);
  lastSyncAt = $state<Date | null>(null);
  enabled = $state(true);

  private seen: Record<string, number> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private failures = 0;
  private handlers = new Set<(scopes: Scope[]) => void | Promise<void>>();

  /** Register a refetch callback. Returns an unsubscribe function. */
  subscribe(fn: (scopes: Scope[]) => void | Promise<void>): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    document.addEventListener('visibilitychange', this.onVisible);
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  /** Poll immediately — call after your own write so you see it without waiting. */
  poke(): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    void this.tick();
  }

  private onVisible = (): void => {
    if (!document.hidden) this.poke();
  };

  private schedule(ms: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), ms);
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    // A hidden tab does not need to poll; onVisible forces a catch-up.
    if (document.hidden || !this.enabled) return this.schedule(POLL_MS);

    try {
      const data = await callGet<VersionResponse>('/api/version');
      if (data.status !== 'ok' || !data.scopes) throw new Error('bad payload');

      this.failures = 0;
      this.connected = true;
      this.lastSyncAt = new Date();

      if (this.seen === null) {
        // First poll establishes the baseline — do not refetch on load.
        this.seen = { ...data.scopes };
      } else {
        const changed = (Object.keys(data.scopes) as Scope[]).filter((s) => data.scopes[s] !== this.seen![s]);
        if (changed.length > 0) {
          this.seen = { ...data.scopes };
          for (const fn of this.handlers) {
            try {
              await fn(changed);
            } catch {
              // One failing subscriber must not stop the others or the loop.
            }
          }
        }
      }
      this.schedule(POLL_MS);
    } catch {
      // A blip or a redeploy — back off rather than hammer, and let the UI show
      // that what is on screen may no longer be current.
      this.failures++;
      if (this.failures >= 2) this.connected = false;
      this.schedule(Math.min(POLL_MS * 2 ** this.failures, BACKOFF_MAX_MS));
    }
  }
}

export const liveSync = new LiveSyncStore();
