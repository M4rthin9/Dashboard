<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronLeft, ChevronRight, Save, Trash2 } from '@lucide/svelte';
  import Card from '../ui/Card.svelte';
  import Spinner from '../ui/Spinner.svelte';
  import { ui } from '../../store/ui.svelte';
  import { getSettings, saveSettings } from '../../api/endpoints';

  /** Lets the page refresh views of the same admin_settings blob (the raw JSON editor). */
  let { onSaved }: { onSaved?: () => void } = $props();

  // Per-date state the admin can set. 'default' means the booking site's own
  // rules apply (weekdays open; weekends and its built-in holidays closed).
  type DayState = 'default' | 'closed' | 'open';

  let loading = $state(true);
  let saving = $state(false);
  let open = $state(true);
  let closedMessage = $state('');
  let closedDates = $state<Record<string, string>>({});
  let openDates = $state<string[]>([]);

  const now = new Date();
  let calYear = $state(now.getFullYear());
  let calMonth = $state(now.getMonth());

  function iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const todayIso = iso(now);

  function stateOf(date: string): DayState {
    if (date in closedDates) return 'closed';
    return openDates.includes(date) ? 'open' : 'default';
  }

  const cells = $derived.by(() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const days = new Date(calYear, calMonth + 1, 0).getDate();
    const out: Array<{ date: string; day: number; weekend: boolean } | null> = Array(first).fill(null);
    for (let d = 1; d <= days; d++) {
      const dow = new Date(calYear, calMonth, d).getDay();
      out.push({ date: iso(new Date(calYear, calMonth, d)), day: d, weekend: dow === 0 || dow === 6 });
    }
    return out;
  });

  const monthTitle = $derived(new Date(calYear, calMonth, 1).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' }));
  const closedList = $derived(Object.keys(closedDates).sort());
  const openList = $derived([...openDates].sort());

  onMount(load);

  function errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  async function load(): Promise<void> {
    loading = true;
    try {
      const res = await getSettings();
      const bw = (res.settings?.bookingWindow ?? {}) as Record<string, unknown>;
      // Absent key means OPEN — same default as the server.
      open = bw.open !== false;
      closedMessage = typeof bw.closedMessage === 'string' ? bw.closedMessage : '';
      const cd = bw.closedDates;
      closedDates = cd && typeof cd === 'object' && !Array.isArray(cd) ? { ...(cd as Record<string, string>) } : {};
      openDates = Array.isArray(bw.openDates) ? bw.openDates.map(String) : [];
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถโหลดการตั้งค่าการจองได้', message: errMsg(err), type: 'error' });
    } finally {
      loading = false;
    }
  }

  function changeMonth(d: number): void {
    const next = new Date(calYear, calMonth + d, 1);
    calYear = next.getFullYear();
    calMonth = next.getMonth();
  }

  function withoutClosed(date: string): Record<string, string> {
    return Object.fromEntries(Object.entries(closedDates).filter(([d]) => d !== date));
  }

  /** Click cycles a day: default → closed → open → default. */
  function cycle(date: string): void {
    const current = stateOf(date);
    if (current === 'default') {
      closedDates = { ...closedDates, [date]: '' };
    } else if (current === 'closed') {
      closedDates = withoutClosed(date);
      openDates = [...openDates, date];
    } else {
      openDates = openDates.filter((d) => d !== date);
    }
  }

  function clearDate(date: string): void {
    closedDates = withoutClosed(date);
    openDates = openDates.filter((d) => d !== date);
  }

  /** Read-merge-write so sibling keys in admin_settings survive. Past dates are pruned. */
  async function persist(nextOpen: boolean): Promise<void> {
    saving = true;
    try {
      const keptClosed = Object.fromEntries(
        Object.entries(closedDates)
          .filter(([d]) => d >= todayIso)
          .map(([d, note]) => [d, String(note ?? '').trim().slice(0, 60)])
      );
      const keptOpen = openDates.filter((d) => d >= todayIso);
      const current = await getSettings();
      const res = await saveSettings({
        ...(current.settings ?? {}),
        bookingWindow: {
          open: nextOpen,
          closedMessage: closedMessage.trim().slice(0, 500),
          closedDates: keptClosed,
          openDates: keptOpen,
        },
      });
      if (res.status !== 'ok') return;
      onSaved?.();
      open = nextOpen;
      closedDates = keptClosed;
      openDates = keptOpen;
      ui.showToast(nextOpen ? 'บันทึกการตั้งค่าการจองแล้ว' : 'ปิดรับจองทั้งหมดแล้ว', 'success');
    } catch (err) {
      ui.showAlert({ title: 'บันทึกไม่สำเร็จ', message: errMsg(err), type: 'error' });
    } finally {
      saving = false;
    }
  }

  function thaiDate(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y!, m! - 1, d!).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  const dayCls: Record<DayState, string> = {
    default: 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
    closed: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
    open: 'border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300',
  };
</script>

<Card title="เปิด/ปิดการจอง" subtitle="ปิดรับจองทั้งหมด หรือเลือกวันที่เปิด/ปิดให้จองบนเว็บจอง (ทั้งเยี่ยมญาติและจองโต๊ะ)">
  {#if loading}
    <div class="flex items-center justify-center py-10"><Spinner /></div>
  {:else}
    <div class="flex flex-col gap-6">
      <div class="flex items-center justify-between gap-4 rounded-xl border p-4 {open ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}">
        <div>
          <p class="text-sm font-semibold {open ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}">
            {open ? 'เปิดรับจอง' : 'ปิดรับจองทั้งหมด'}
          </p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {open
              ? 'ผู้เข้าร่วมจองได้ตามวันที่เปิดในปฏิทินด้านล่าง'
              : 'หน้าเว็บจะแสดงข้อความปิดรับจองแทนแบบฟอร์ม · เจ้าหน้าที่ยังสร้างการจองจากแดชบอร์ดได้ตามปกติ'}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 disabled:opacity-50 {open ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}"
          onclick={() => void persist(!open)}
          disabled={saving}
        >
          {saving ? 'กำลังบันทึก...' : open ? 'ปิดรับจองทั้งหมด' : 'เปิดรับจอง'}
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <label for="booking-closed-message" class="text-sm font-medium text-slate-700 dark:text-slate-200">ข้อความที่แสดงเมื่อปิดรับจอง</label>
        <textarea
          id="booking-closed-message"
          bind:value={closedMessage}
          rows="2"
          maxlength="500"
          placeholder="เว้นว่างเพื่อใช้ข้อความมาตรฐาน เช่น ขณะนี้ระบบปิดรับจองชั่วคราว กรุณากลับมาจองอีกครั้งภายหลัง"
          class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        ></textarea>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => changeMonth(-1)} aria-label="เดือนก่อนหน้า">
            <ChevronLeft class="h-5 w-5" />
          </button>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{monthTitle}</p>
          <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => changeMonth(1)} aria-label="เดือนถัดไป">
            <ChevronRight class="h-5 w-5" />
          </button>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
          {#each ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as d (d)}<div>{d}</div>{/each}
        </div>
        <div class="grid grid-cols-7 gap-1">
          {#each cells as cell, i (cell?.date ?? `pad-${i}`)}
            {#if !cell}
              <div></div>
            {:else}
              {@const st = stateOf(cell.date)}
              {@const past = cell.date < todayIso}
              <button
                type="button"
                class="flex h-11 flex-col items-center justify-center rounded-lg border text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 {dayCls[st]} {st === 'default' && cell.weekend ? 'bg-slate-50 text-slate-400 dark:bg-slate-800/50' : ''}"
                onclick={() => cycle(cell.date)}
                disabled={past}
                aria-label="{thaiDate(cell.date)}: {st === 'closed' ? 'ปิดจอง' : st === 'open' ? 'เปิดจอง' : 'ตามปกติ'}"
              >
                {cell.day}
                {#if st !== 'default'}
                  <span class="text-[9px] leading-none">{st === 'closed' ? 'ปิด' : 'เปิด'}</span>
                {/if}
              </button>
            {/if}
          {/each}
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          กดที่วันเพื่อสลับ: <span class="font-semibold">ตามปกติ</span> →
          <span class="font-semibold text-red-600">ปิดจอง</span> →
          <span class="font-semibold text-green-600">เปิดจอง</span> (เปิดวันหยุด/เสาร์-อาทิตย์ให้จองได้) · วันตามปกติ: จันทร์-ศุกร์เปิด, เสาร์-อาทิตย์และวันหยุดราชการปิด
        </p>
      </div>

      {#if closedList.length > 0 || openList.length > 0}
        <div class="flex flex-col gap-2">
          {#each closedList as date (date)}
            <div class="flex items-center gap-2 rounded-xl border border-red-200 p-2 dark:border-red-900">
              <span class="w-36 shrink-0 text-xs font-semibold text-red-700 dark:text-red-300">ปิด · {thaiDate(date)}</span>
              <input
                bind:value={closedDates[date]}
                maxlength="60"
                placeholder="เหตุผลที่แสดงบนปฏิทิน เช่น งดเยี่ยม (ไม่บังคับ)"
                class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                aria-label="เหตุผลปิดจอง {thaiDate(date)}"
              />
              <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => clearDate(date)} aria-label="ล้างวันที่ {thaiDate(date)}">
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          {/each}
          {#each openList as date (date)}
            <div class="flex items-center gap-2 rounded-xl border border-green-200 p-2 dark:border-green-900">
              <span class="flex-1 text-xs font-semibold text-green-700 dark:text-green-300">เปิด · {thaiDate(date)}</span>
              <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => clearDate(date)} aria-label="ล้างวันที่ {thaiDate(date)}">
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:opacity-50"
          onclick={() => void persist(open)}
          disabled={saving}
        >
          <span class="flex items-center gap-1.5"><Save class="h-4 w-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกวันที่และข้อความ'}</span>
        </button>
      </div>
    </div>
  {/if}
</Card>
