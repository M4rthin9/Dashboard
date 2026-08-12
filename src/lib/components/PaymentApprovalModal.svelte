<script lang="ts">
  import { Banknote, CalendarDays, Check, CreditCard, ImageOff, Info, ShieldCheck, User } from '@lucide/svelte';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';
  import Badge from './ui/Badge.svelte';
  import SlipViewerModal from './SlipViewerModal.svelte';
  import { formatBaht, formatDateTimeThai, visitDateLabel } from '../utils/format';
  import type { Reservation } from '../api/types';
  import { getSlipByRef } from '../api/endpoints';
  import { decodeBase64Image } from '../utils/base64';

  let { open, row, mode, onclose, onapprove }: {
    open: boolean;
    row: Reservation | null;
    mode: 'ชำระแล้ว' | 'เสร็จสิ้น';
    onclose: () => void;
    onapprove: (row: Reservation) => void;
  } = $props();

  let busy = $state(false);
  let slipLoading = $state(false);
  let fetchedSlip = $state('');
  let slipViewerOpen = $state(false);

  $effect(() => {
    if (!open) {
      fetchedSlip = '';
      slipLoading = false;
      return;
    }
    const base = String(row?.slipImage ?? '').trim();
    if (base && !base.startsWith('SLIP_UPLOADED:')) return;
    const ref = row?.ref;
    if (!ref) return;
    let cancelled = false;
    fetchedSlip = '';
    slipLoading = true;
    getSlipByRef(ref)
      .then((d) => {
        if (cancelled) return;
        if (d.status === 'ok' && d.slipImage) fetchedSlip = String(d.slipImage);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) slipLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  const isDone = $derived(mode === 'เสร็จสิ้น');
  const title = $derived(isDone ? 'ยืนยันการเสร็จสิ้น' : 'ยืนยันการชำระเงิน');
  const totalPersons = $derived(Number(row?.totalPersons) || (Number(row?.visitorCount) || 0) + 1);
  const slipUrl = $derived(decodeBase64Image(String(row?.slipImage ?? '').trim() || fetchedSlip));
  const hasSlip = $derived(!!slipUrl && !slipUrl.startsWith('SLIP_UPLOADED:'));

  function initials(name: string | undefined): string {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  }

  async function confirm(): Promise<void> {
    if (!row || busy) return;
    busy = true;
    try {
      await onapprove(row);
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  {open}
  title={title}
  onclose={onclose}
  width="max-w-xl"
  accent={isDone ? 'emerald' : 'blue'}
  icon={isDone ? ShieldCheck : CreditCard}
  subtitle={row ? `Ref: ${row.ref} · ${row.prisonerName ?? '—'}` : ''}
>
  {#if row}
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900/60">
        <Badge label={isDone ? 'ตรวจสอบสลิปก่อนเสร็จสิ้น' : 'ตรวจสอบสลิปก่อนยืนยันชำระเงิน'} tone="warning" />
        <div class="flex items-center gap-1.5 text-sm font-bold text-blue-800 dark:text-blue-300">
          <Banknote class="h-4 w-4" />
          {formatBaht(row.total)}
        </div>
      </div>

      <section class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <User class="h-4 w-4" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้เยี่ยม</h3>
          <span class="ml-auto text-xs text-slate-400">สร้างเมื่อ {formatDateTimeThai(row.createdAt)}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
            {initials(row.visitorName)}
          </div>
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{row.visitorName ?? '—'}</div>
            <div class="text-xs text-slate-400">{row.visitorPhone ? `โทร ${row.visitorPhone}` : ''}</div>
          </div>
          <div class="ml-auto text-right">
            <div class="text-xs text-slate-400">ผู้ต้องขัง</div>
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">น.ช. {row.prisonerName ?? '—'} (#{row.prisonerId ?? ''})</div>
            <div class="text-xs text-slate-400">ปีก {row.wing ?? '—'}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          <span class="inline-flex items-center gap-1">
            <CalendarDays class="h-3.5 w-3.5 text-slate-400" /> {visitDateLabel(row.visitDate, row.visitDateISO)}
          </span>
          <span class="inline-flex items-center gap-1">
            <User class="h-3.5 w-3.5 text-slate-400" /> {totalPersons} ท่าน
          </span>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <CreditCard class="h-4 w-4" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">สลิปชำระเงินที่อัปโหลด</h3>
        </div>
        {#if hasSlip}
          <div class="flex flex-col items-center gap-3">
            <button
              onclick={() => (slipViewerOpen = true)}
              class="group max-w-full rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm transition hover:shadow-xl dark:border-slate-700"
              aria-label="ขยายสลิปชำระเงิน"
            >
              <img
                src={slipUrl}
                alt="สลิปชำระเงิน"
                class="max-h-72 w-auto cursor-zoom-in rounded-xl object-contain"
              />
            </button>
            <p class="text-center text-[11px] text-slate-400">คลิกเพื่อขยายสลิปขนาดเต็ม</p>
          </div>
        {:else if slipLoading}
          <div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <span class="h-8 w-8 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600"></span>
            <div class="text-sm font-medium text-slate-500 dark:text-slate-400">กำลังโหลดสลิปชำระเงิน...</div>
          </div>
        {:else}
          <div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-center dark:border-amber-700 dark:bg-amber-950/40">
            <ImageOff class="h-8 w-8 text-amber-500" />
            <div class="text-sm font-semibold text-amber-700 dark:text-amber-300">ยังไม่พบสลิปชำระเงิน</div>
            <div class="text-xs text-amber-600 dark:text-amber-400">ผู้เข้าชมยังไม่ได้อัปโหลดสลิป โปรดตรวจสอบกับผู้เข้าชมก่อนยืนยัน</div>
          </div>
        {/if}
      </section>

      <div class="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        <Info class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{isDone ? 'ยืนยันแล้วสถานะจะเปลี่ยนเป็น "เสร็จสิ้น" และไม่สามารถแก้ไขได้อีก' : 'ยืนยันแล้วสถานะจะเปลี่ยนเป็น "ชำระแล้ว" และคุณจะต้องยืนยันเสร็จสิ้นอีกครั้ง'}</span>
      </div>

    </div>
  {/if}
  {#snippet footer()}
    <Button variant="outline" onclick={onclose} disabled={busy}>กลับ</Button>
      <Button variant={isDone ? 'success' : 'primary'} onclick={confirm} loading={busy}>
        {#if busy}
          กำลังบันทึก...
        {:else}
          <Check class="h-4 w-4" />
          {isDone ? 'ยืนยันเสร็จสิ้น' : 'ยืนยันชำระเงิน'}
        {/if}
      </Button>
    {/snippet}
</Modal>

<SlipViewerModal open={slipViewerOpen} slipUrl={slipUrl} ref={row?.ref} onclose={() => (slipViewerOpen = false)} />
