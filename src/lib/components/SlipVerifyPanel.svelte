<script lang="ts">
  import { AlertTriangle, CheckCircle2, Info, RefreshCw, ScanLine, XCircle } from '@lucide/svelte';
  import Badge from './ui/Badge.svelte';
  import { verifySlip } from '../api/endpoints';
  import type { SlipVerifyResult } from '../api/types';

  let { ref, status, json }: {
    ref: string;
    status: string;
    json: string;
  } = $props();

  let checking = $state(false);
  let manual = $state<SlipVerifyResult | null>(null);
  let error = $state('');

  $effect(() => {
    manual = null;
    error = '';
  });

  const parsed = $derived.by<SlipVerifyResult | null>(() => {
    if (!json) return null;
    try {
      const v = JSON.parse(json);
      return v && typeof v === 'object' ? (v as SlipVerifyResult) : null;
    } catch {
      return null;
    }
  });

  const result = $derived(manual ?? parsed);
  const st = $derived(result?.status ?? (status || ''));
  const at = $derived(result?.at ?? '');

  const mismatchLabels: Record<string, string> = {
    amount: 'ยอดเงิน',
    refs: 'รหัสอ้างอิง',
    biller: 'รหัสผู้รับเงิน',
  };
  const mismatchText = $derived((result?.mismatch ?? []).map((f) => mismatchLabels[f] || f).join(', '));

  const tone = $derived(
    st === 'ok'
      ? 'success'
      : st === 'slip_verify'
        ? 'warning'
        : st === 'mismatch' || st === 'unreadable' || st === 'duplicate'
          ? 'danger'
          : 'default'
  );

  const badge = $derived.by(() => {
    switch (st) {
      case 'ok':
        return 'ตรวจสอบผ่าน · QR ตรงกับข้อมูลการจอง';
      case 'slip_verify':
        return 'พบเฉพาะ QR สลิปอ้างอิง — รอตรวจสอบยอดเงิน';
      case 'mismatch':
        return `QR ไม่ตรงกับข้อมูลการจอง (${mismatchText})`;
      case 'unreadable':
        return 'อ่าน QR ในสลิปไม่ได้';
      case 'duplicate':
        return `สลิปซ้ำ — ใช้ยืนยันการจอง ${result?.duplicateOfRef ?? '-'} ไปแล้ว`;
      default:
        return 'ยังไม่ได้ตรวจสอบสลิปอัตโนมัติ';
    }
  });

  const detailRows = $derived.by<Array<[string, string]>>(() => {
    const d = result?.detail;
    if (!d) return [];
    const rows: Array<[string, string]> = [];
    if (result?.kind === 'slipVerify') {
      rows.push(['ธนาคารผู้ส่ง', `${d.sendingBank ?? ''}${d.sendingBankName ? ` · ${String(d.sendingBankName)}` : ''}`]);
      rows.push(['เลขอ้างอิง (TransRef)', String(d.transRef ?? '')]);
    } else if (result?.kind === 'trueMoneySlipVerify') {
      rows.push(['ชนิดรายการ', String(d.eventType ?? '')]);
      rows.push(['รหัสธุรกรรม', String(d.transactionId ?? '')]);
      rows.push(['วันที่', String(d.date ?? '')]);
    } else if (result?.kind === 'paymentQr') {
      rows.push(['Biller ID', String(d.billerId ?? '')]);
      rows.push(['Ref 1', String(d.reference1 ?? '')]);
      rows.push(['Ref 2', String(d.reference2 ?? '')]);
      rows.push(['Ref 3', String(d.reference3 ?? '')]);
      const amountFound = typeof d.amount === 'number' ? d.amount.toLocaleString('th-TH') : '—';
      const expected = result.match && typeof result.match.amountExpected === 'number' ? result.match.amountExpected.toLocaleString('th-TH') : '—';
      rows.push(['ยอดเงินในสลิป', amountFound]);
      rows.push(['ยอดที่คาดหวัง', expected]);
    }
    return rows;
  });

  async function reverify(): Promise<void> {
    if (!ref || checking) return;
    checking = true;
    error = '';
    try {
      const res = await verifySlip(ref);
      if (res.status === 'ok' && res.result) {
        manual = res.result;
      } else {
        error = String(res.message ?? 'ไม่สามารถตรวจสอบสลิปได้');
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'ไม่สามารถตรวจสอบสลิปได้';
    } finally {
      checking = false;
    }
  }
</script>

<div class="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex items-center gap-1.5">
      {#if st === 'ok'}
        <CheckCircle2 class="h-4 w-4 text-emerald-500" />
      {:else if st === 'slip_verify'}
        <Info class="h-4 w-4 text-amber-500" />
      {:else if st === 'mismatch' || st === 'unreadable' || st === 'duplicate'}
        <XCircle class="h-4 w-4 text-red-500" />
      {:else}
        <ScanLine class="h-4 w-4 text-slate-400" />
      {/if}
      <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-100">การตรวจสอบสลิปอัตโนมัติ</h4>
    </div>
    <Badge label={badge} {tone} />
    <button
      class="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      onclick={reverify}
      disabled={checking || !ref}
    >
      {#if checking}
        <RefreshCw class="h-3.5 w-3.5 animate-spin" />
        กำลังตรวจสอบ...
      {:else}
        <RefreshCw class="h-3.5 w-3.5" />
        ตรวจสอบอีกครั้ง
      {/if}
    </button>
  </div>

  {#if detailRows.length > 0}
    <div class="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
      {#each detailRows as [label, value] (label)}
        <div class="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
          <span class="text-slate-500 dark:text-slate-400">{label}</span>
          <span class="max-w-[70%] truncate font-mono font-semibold text-slate-800 dark:text-slate-100" title={value}>{value || '—'}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if result?.kind === 'slipVerify' || result?.kind === 'trueMoneySlipVerify'}
    <p class="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
      <AlertTriangle class="h-3.5 w-3.5" />
      สลิปนี้มีเฉพาะ QR อ้างอิง (Mini-QR) ซึ่งไม่มีข้อมูลยอดเงิน — กรุณาตรวจสอบยอดด้วยสายตาก่อนยืนยัน
    </p>
  {/if}

  {#if st !== '' && at}
    <p class="text-[11px] text-slate-400">ตรวจสอบเมื่อ {at}</p>
  {/if}

  {#if error}
    <p class="text-xs text-red-600 dark:text-red-400">{error}</p>
  {/if}
</div>
