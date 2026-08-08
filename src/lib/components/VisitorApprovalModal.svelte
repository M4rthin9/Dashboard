<script lang="ts">
  import { Check, Info, ShieldCheck, User, UsersRound, X } from '@lucide/svelte';
  import Modal from './ui/Modal.svelte';
  import Badge from './ui/Badge.svelte';
  import { reservations } from '../store/reservations.svelte';
  import { ui } from '../store/ui.svelte';
  import type { Reservation } from '../api/types';

  let { open, row, onclose }: {
    open: boolean;
    row: Reservation | null;
    onclose: () => void;
  } = $props();

  let busy = $state(false);

  interface ExtraVisitor {
    name: string;
    relation: string;
    approved: string;
  }

  const extras = $derived.by<ExtraVisitor[]>(() => {
    if (!row || !String(row.extraVisitorNames ?? '').trim()) return [];
    const str = String(row.extraVisitorNames);
    const isNew = str.includes(';;') || str.includes('|');
    let items: Array<{ name: string; relation: string }>;
    if (isNew) {
      items = str.split(';;').map((e) => {
        const p = e.split('|');
        return { name: (p[0] ?? '').trim(), relation: (p[2] ?? '').trim() };
      });
    } else {
      items = str.split(/,(?![^(]*\))/).map((e) => {
        const m = e.trim().match(/^(.+?)\s*\(/);
        return { name: m ? m[1].trim() : e.trim(), relation: m ? e.trim().slice(m[0].length, -1) : '' };
      });
    }
    const appr = String(row.extraVisitorApproved ?? '').split(';;');
    return items
      .filter((v) => v.name)
      .map((v, i) => ({ ...v, approved: (appr[i] ?? '').trim() }));
  });

  const mainApproved = $derived(String(row?.visitorApproved ?? '').trim());
  const approvedCount = $derived(
    extras.reduce((n, e) => n + (e.approved === 'yes' ? 1 : 0), 0) + (mainApproved === 'yes' ? 1 : 0)
  );
  const totalPeople = $derived(extras.length + 1);

  function approvalLabel(v: string): string {
    if (v === 'yes') return 'เข้าได้';
    if (v === 'no') return 'เข้าไม่ได้';
    return 'รอตัดสิน';
  }

  function initials(name: string | undefined): string {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  }

  async function setMainApproval(val: string): Promise<void> {
    if (!row || busy) return;
    if (val === 'no') {
      const ok = window.confirm(
        `ยืนยันปฏิเสธผู้เยี่ยมหลัก "${row.visitorName}"?\nการจองนี้จะถูกปฏิเสธโดยอัตโนมัติ (สถานะ ไม่อนุมัติ)`
      );
      if (!ok) return;
    }
    busy = true;
    try {
      await reservations.updateVisitorApproval(row.ref, val);
      ui.showToast(val === 'yes' ? 'อนุมัติผู้เยี่ยมหลักแล้ว' : 'ปฏิเสธผู้เยี่ยมหลัก · ยกเลิกการจองแล้ว', val === 'yes' ? 'success' : 'warning');
    } catch (err) {
      ui.showToast(err instanceof Error ? err.message : 'ไม่สามารถอัปเดตการอนุมัติได้', 'error');
    } finally {
      busy = false;
    }
  }

  async function setExtraApproval(i: number, val: string): Promise<void> {
    if (!row || busy) return;
    const current = extras.map((e) => e.approved);
    current[i] = val;
    busy = true;
    try {
      await reservations.updateVisitorApproval(row.ref, 'yes', current.join(';;'));
      ui.showToast('อัปเดตการอนุมัติผู้เยี่ยมร่วมแล้ว', 'success');
    } catch (err) {
      ui.showToast(err instanceof Error ? err.message : 'ไม่สามารถอัปเดตการอนุมัติได้', 'error');
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  {open}
  title={row ? `ตรวจสอบผู้เข้าร่วม · ${row.ref}` : 'ตรวจสอบผู้เข้าร่วม'}
  onclose={onclose}
  width="max-w-xl"
  accent="violet"
  icon={ShieldCheck}
  subtitle={row ? `${row.prisonerName ?? '—'} · ปีก ${row.wing ?? '—'}` : ''}
>
  {#if row}
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-violet-50 px-4 py-3 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:ring-violet-900/60">
        <Badge label={`${String(row.visitorCount ?? '')} คน`} tone="info" />
        <div class="flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
          <span class="rounded-full bg-white px-2.5 py-1 text-xs ring-1 ring-violet-200 dark:bg-slate-900 dark:ring-violet-900">
            อนุมัติแล้ว {approvedCount}/{totalPeople}
          </span>
        </div>
      </div>

      <section class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <User class="h-4 w-4" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้เยี่ยมหลัก</h3>
          <Badge
            label={approvalLabel(mainApproved)}
            tone={mainApproved === 'yes' ? 'success' : mainApproved === 'no' ? 'danger' : 'warning'}
          />
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
              {initials(row.visitorName)}
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{row.visitorName ?? '—'}</div>
              <div class="text-xs text-slate-400">ผู้เยี่ยมหลัก {row.relation ? `· ${row.relation}` : ''}</div>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              class="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              onclick={() => setMainApproval('yes')}
              disabled={busy || mainApproved === 'yes'}
            >
              <Check class="h-3.5 w-3.5" /> อนุมัติ
            </button>
            <button
              class="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              onclick={() => setMainApproval('no')}
              disabled={busy || mainApproved === 'no'}
            >
              <X class="h-3.5 w-3.5" /> ปฏิเสธ
            </button>
          </div>
        </div>
      </section>

      {#if extras.length > 0}
        <section class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
              <UsersRound class="h-4 w-4" />
            </div>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้เยี่ยมร่วม ({extras.length} คน)</h3>
          </div>
          <div class="flex flex-col gap-2">
            {#each extras as ex, i (i)}
              <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div class="flex min-w-0 items-center gap-3">
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-xs font-bold text-white">
                    {initials(ex.name)}
                  </div>
                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{ex.name}</div>
                    <div class="text-xs text-slate-400">{ex.relation ? `(${ex.relation})` : ''}</div>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <Badge
                    label={approvalLabel(ex.approved)}
                    tone={ex.approved === 'yes' ? 'success' : ex.approved === 'no' ? 'danger' : 'warning'}
                  />
                  <button
                    class="rounded-lg border border-emerald-200 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:hover:bg-emerald-950"
                    title="อนุมัติ"
                    onclick={() => setExtraApproval(i, 'yes')}
                    disabled={busy || ex.approved === 'yes'}
                  >
                    <Check class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-lg border border-red-200 p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
                    title="ปฏิเสธ"
                    onclick={() => setExtraApproval(i, 'no')}
                    disabled={busy || ex.approved === 'no'}
                  >
                    <X class="h-4 w-4" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <div class="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        <Info class="mt-0.5 h-4 w-4 shrink-0" />
        <span>การปฏิเสธผู้เยี่ยมหลักจะทำให้การจองถูกปฏิเสธโดยอัตโนมัติ</span>
      </div>

      <div class="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
        <button
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onclick={onclose}
        >
          ปิด
        </button>
      </div>
    </div>
  {/if}
</Modal>
