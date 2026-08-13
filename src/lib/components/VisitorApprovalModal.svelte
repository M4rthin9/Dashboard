<script lang="ts">
  import { Check, Info, ShieldCheck, User, UsersRound, X } from '@lucide/svelte';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';
  import Badge from './ui/Badge.svelte';
  import { reservations } from '../store/reservations.svelte';
  import { ui } from '../store/ui.svelte';
  import { formatBaht, parseExtraVisitors } from '../utils/format';
  import type { Reservation } from '../api/types';

  let { open, row, onclose }: {
    open: boolean;
    row: Reservation | null;
    onclose: () => void;
  } = $props();

  let busy = $state(false);

  const CHILD_RELATIONS = ['บุตร / ธิดา', 'Child', '子女', 'Son/Daughter'];
  const PRISONER_FEE = 1000;
  const VISITOR_FULL_FEE = 1000;

  // Age ladder: <5 free, 5-8 half (500), 9+ full — mirrors the server's
  // childFee() in the backend pricing service (discount needs a child
  // relation, matching the booking form).
  function visitorFee(relation: string, age: string): number {
    if (CHILD_RELATIONS.includes(String(relation || '').trim())) {
      const a = parseInt(String(age), 10);
      if (!isNaN(a)) {
        if (a < 5) return 0;
        if (a <= 8) return 500;
      }
    }
    return VISITOR_FULL_FEE;
  }

  function feeLabel(fee: number): string {
    if (fee === 0) return 'ฟรี';
    return '฿' + fee.toLocaleString('th-TH');
  }

  function feeTone(fee: number): 'default' | 'success' | 'warning' {
    if (fee === 0) return 'success';
    if (fee < VISITOR_FULL_FEE) return 'warning';
    return 'default';
  }

  const extras = $derived.by(() => (row ? parseExtraVisitors(row) : []));

  const mainApproved = $derived(String(row?.visitorApproved ?? '').trim());
  const approvedCount = $derived(
    extras.reduce((n, e) => n + (e.approved === 'yes' ? 1 : 0), 0) + (mainApproved === 'yes' ? 1 : 0)
  );
  const totalPeople = $derived(extras.length + 1);

  const mainFee = $derived(visitorFee(String(row?.relation ?? ''), String(row?.visitorAge ?? '')));

  // Live recalc of the booking fee from the currently-approved visitors only —
  // mirrors computeApprovalTotals() on the backend (approved visitors keep
  // their age-based discount; rejected/pending ones are excluded).
  const charged = $derived.by(() => {
    let total = PRISONER_FEE;
    let adults = 0;
    let kids5_8 = 0;
    let kidsUnder5 = 0;
    if (mainApproved === 'yes') {
      total += mainFee;
      if (mainFee === 0) kidsUnder5 += 1;
      else if (mainFee < VISITOR_FULL_FEE) kids5_8 += 1;
      else adults += 1;
    }
    extras.forEach((e) => {
      if (e.approved !== 'yes') return;
      const fee = visitorFee(e.relation, e.age);
      total += fee;
      if (fee === 0) kidsUnder5 += 1;
      else if (fee < VISITOR_FULL_FEE) kids5_8 += 1;
      else adults += 1;
    });
    return { total, adults, kids5_8, kidsUnder5 };
  });

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
      ui.showAlert({
        title: val === 'yes' ? 'อนุมัติผู้เยี่ยมหลักแล้ว' : 'ปฏิเสธผู้เยี่ยมหลัก · ยกเลิกการจองแล้ว',
        message: val === 'yes' ? `${row.visitorName} ได้รับอนุมัติแล้ว` : `${row.visitorName} ถูกปฏิเสธ และการจองถูกยกเลิกแล้ว`,
        type: val === 'yes' ? 'success' : 'warning',
      });
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถอัปเดตการอนุมัติได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
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
      ui.showAlert({ title: 'อัปเดตการอนุมัติผู้เยี่ยมร่วมแล้ว', message: 'บันทึกการอนุมัติผู้เข้าร่วมเรียบร้อย', type: 'success' });
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถอัปเดตการอนุมัติได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
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
  accent="blue"
  icon={ShieldCheck}
  subtitle={row ? `${row.prisonerName ?? '—'} · ปีก ${row.wing ?? '—'}` : ''}
>
  {#if row}
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900/60">
        <Badge label={`${String(row.visitorCount ?? '')} คน`} tone="info" />
        <div class="flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <span class="rounded-full bg-white px-2.5 py-1 text-xs ring-1 ring-blue-200 dark:bg-slate-900 dark:ring-blue-900">
            อนุมัติแล้ว {approvedCount}/{totalPeople}
          </span>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/60">
        <div class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">ค่าบริการ (ผู้อนุมัติแล้ว)</div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-700 dark:text-emerald-300">
          <span class="text-sm font-bold">{formatBaht(charged.total)}</span>
          <span>ผู้ใหญ่ {charged.adults}</span>
          <span>5-8 ปี {charged.kids5_8}</span>
          <span>&lt;5 ปี {charged.kidsUnder5}</span>
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
          <Badge label={feeLabel(mainFee)} tone={feeTone(mainFee)} />
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
              {initials(row.visitorName)}
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{row.visitorName ?? '—'}</div>
              <div class="text-xs text-slate-400">
                ผู้เยี่ยมหลัก {row.relation ? `· ${row.relation}` : ''}
                {row.visitorAge ? `· อายุ ${row.visitorAge} ปี` : ''}
              </div>
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
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <UsersRound class="h-4 w-4" />
            </div>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้เยี่ยมร่วม ({extras.length} คน)</h3>
          </div>
          <div class="flex flex-col gap-2">
            {#each extras as ex, i (i)}
              <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div class="flex min-w-0 items-center gap-3">
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-500 text-xs font-bold text-white">
                    {initials(ex.name)}
                  </div>
                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{ex.name}</div>
                    <div class="text-xs text-slate-400">
                      {ex.relation ? `(${ex.relation})` : ''}{ex.age ? ` อายุ ${ex.age} ปี` : ''}
                    </div>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <Badge label={feeLabel(visitorFee(ex.relation, ex.age))} tone={feeTone(visitorFee(ex.relation, ex.age))} />
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

    </div>
  {/if}
  {#snippet footer()}
    <Button variant="outline" onclick={onclose}>ปิด</Button>
  {/snippet}
</Modal>
