<script lang="ts">
  import { onMount } from 'svelte';
  import { RefreshCw, Save } from '@lucide/svelte';
  import Card from '../ui/Card.svelte';
  import Spinner from '../ui/Spinner.svelte';
  import { ui } from '../../store/ui.svelte';
  import { getCookieConsentStats, getSettings, saveSettings, type CookieConsentEntry } from '../../api/endpoints';

  /** Lets the page refresh views of the same admin_settings blob (the raw JSON editor). */
  let { onSaved }: { onSaved?: () => void } = $props();

  const CHOICE_LABEL: Record<string, string> = {
    accept_all: 'ยอมรับทั้งหมด',
    reject_all: 'ปฏิเสธที่ไม่จำเป็น',
    custom: 'เลือกเอง',
  };

  let loading = $state(true);
  let saving = $state(false);
  let policyVersion = $state('1');
  let contact = $state('');
  let last30 = $state<Record<string, number>>({});
  let allTime = $state<Record<string, number>>({});
  let recent = $state<CookieConsentEntry[]>([]);

  const total30 = $derived(Object.values(last30).reduce((a, b) => a + b, 0));
  const totalAll = $derived(Object.values(allTime).reduce((a, b) => a + b, 0));

  onMount(load);

  function errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  async function load(): Promise<void> {
    loading = true;
    try {
      const [settings, stats] = await Promise.all([getSettings(), getCookieConsentStats()]);
      const pdpa = (settings.settings?.pdpa ?? {}) as Record<string, unknown>;
      policyVersion = String(pdpa.policyVersion || '1');
      contact = String(pdpa.contact ?? '');
      last30 = stats.last30Days ?? {};
      allTime = stats.allTime ?? {};
      recent = stats.recent ?? [];
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถโหลดข้อมูล PDPA ได้', message: errMsg(err), type: 'error' });
    } finally {
      loading = false;
    }
  }

  /** Read-merge-write so sibling keys in admin_settings survive. */
  async function persist(nextVersion: string, toast: string): Promise<void> {
    saving = true;
    try {
      const current = await getSettings();
      const res = await saveSettings({
        ...(current.settings ?? {}),
        pdpa: { policyVersion: nextVersion, contact: contact.trim().slice(0, 500) },
      });
      if (res.status !== 'ok') return;
      policyVersion = nextVersion;
      onSaved?.();
      ui.showToast(toast, 'success');
    } catch (err) {
      ui.showAlert({ title: 'บันทึกไม่สำเร็จ', message: errMsg(err), type: 'error' });
    } finally {
      saving = false;
    }
  }

  function bumpVersion(): void {
    const next = String((parseInt(policyVersion, 10) || 1) + 1);
    if (!confirm(`ประกาศนโยบายฉบับที่ ${next}? ผู้เข้าชมทุกคนจะต้องให้ความยินยอมคุกกี้ใหม่อีกครั้ง`)) return;
    void persist(next, `ประกาศนโยบายฉบับที่ ${next} แล้ว`);
  }

  function fmt(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
</script>

<Card title="PDPA และความยินยอมคุกกี้" subtitle="บันทึกการให้ความยินยอมคุกกี้ของผู้เข้าชมเว็บจอง (เก็บ 2 ปี) และข้อมูลติดต่อเรื่องข้อมูลส่วนบุคคล">
  {#if loading}
    <div class="flex items-center justify-center py-10"><Spinner /></div>
  {:else}
    <div class="flex flex-col gap-6">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {#each [['accept_all', 'text-green-700 dark:text-green-300'], ['reject_all', 'text-amber-700 dark:text-amber-300'], ['custom', 'text-blue-700 dark:text-blue-300']] as [key, cls] (key)}
          <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p class="text-xs text-slate-500 dark:text-slate-400">{CHOICE_LABEL[key]} · 30 วัน</p>
            <p class="mt-1 text-2xl font-semibold {cls}">{last30[key] ?? 0}</p>
          </div>
        {/each}
        <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p class="text-xs text-slate-500 dark:text-slate-400">ทั้งหมด (30 วัน / สะสม)</p>
          <p class="mt-1 text-2xl font-semibold text-slate-700 dark:text-slate-200">{total30} <span class="text-sm font-normal text-slate-400">/ {totalAll}</span></p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">การให้ความยินยอมล่าสุด</p>
          <button type="button" class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={load}>
            <RefreshCw class="h-3.5 w-3.5" /> โหลดใหม่
          </button>
        </div>
        {#if recent.length === 0}
          <p class="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-600">ยังไม่มีการบันทึกความยินยอม</p>
        {:else}
          <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th class="px-3 py-2 font-medium">เวลา</th>
                  <th class="px-3 py-2 font-medium">ตัวเลือก</th>
                  <th class="px-3 py-2 font-medium">ใช้งาน</th>
                  <th class="px-3 py-2 font-medium">วิเคราะห์</th>
                  <th class="px-3 py-2 font-medium">ฉบับ</th>
                  <th class="px-3 py-2 font-medium">รหัสความยินยอม</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                {#each recent as r, i (`${r.consentId}-${r.createdAt}-${i}`)}
                  <tr>
                    <td class="whitespace-nowrap px-3 py-2">{fmt(r.createdAt)}</td>
                    <td class="whitespace-nowrap px-3 py-2">{CHOICE_LABEL[r.choice] ?? r.choice}</td>
                    <td class="px-3 py-2">{r.preferences ? '✓' : '–'}</td>
                    <td class="px-3 py-2">{r.analytics ? '✓' : '–'}</td>
                    <td class="px-3 py-2">{r.policyVersion}</td>
                    <td class="px-3 py-2 font-mono text-[11px] text-slate-400" title={r.userAgent}>{r.consentId.slice(0, 8)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <label for="pdpa-contact" class="text-sm font-medium text-slate-700 dark:text-slate-200">ช่องทางติดต่อเรื่องข้อมูลส่วนบุคคล (DPO)</label>
        <textarea
          id="pdpa-contact"
          bind:value={contact}
          rows="2"
          maxlength="500"
          placeholder="เช่น อีเมล / โทรศัพท์ของเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล — แสดงในนโยบายคุกกี้บนเว็บจอง"
          class={inputCls}
        ></textarea>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-600 dark:text-slate-300">นโยบายฉบับที่ <span class="font-semibold">{policyVersion}</span></span>
          <button
            type="button"
            class="rounded-xl border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
            onclick={bumpVersion}
            disabled={saving}
          >
            ประกาศนโยบายฉบับใหม่ (ขอความยินยอมใหม่)
          </button>
        </div>
        <button
          type="button"
          class="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:opacity-50"
          onclick={() => void persist(policyVersion, 'บันทึกข้อมูลติดต่อแล้ว')}
          disabled={saving}
        >
          <span class="flex items-center gap-1.5"><Save class="h-4 w-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
        </button>
      </div>
    </div>
  {/if}
</Card>
