<script lang="ts">
  import { untrack } from 'svelte';
  import { FileText, Printer } from '@lucide/svelte';
  import Button from './ui/Button.svelte';
  import { completeRefund, getRefundEvidence } from '../api/endpoints';
  import type { RefundEvidence, Reservation } from '../api/types';
  import { reservations } from '../store/reservations.svelte';
  import { auth } from '../store/auth.svelte';
  import { formatBaht } from '../utils/format';
  import { buildRefundEvidence, refundRequestError } from '../utils/refundEvidence';
  import { openPrintWindow } from '../utils/print';
  import type { RefundReportEntry } from '../utils/refundReport';

  let { row, initiallyExpanded = false, onchange }: { row: Reservation; initiallyExpanded?: boolean; onchange?: (entry: RefundReportEntry | null) => void } = $props();
  let expanded = $state(untrack(() => initiallyExpanded));
  let loading = $state(false);
  let saving = $state(false);
  let revision = $state(0);
  let error = $state('');
  let evidence = $state<RefundEvidence | null>(null);
  let imageReady = $state(false);
  let imageFailed = $state(false);
  let amount = $state<number | undefined>(undefined);
  let reason = $state('');
  let recipient = $state('');
  let account = $state('');
  const request = $derived({ amount: Number(amount), reason, recipient, account });
  const validation = $derived(evidence ? refundRequestError(request, evidence.booking.total) : '');

  $effect(() => {
    const entry: RefundReportEntry | null = evidence ? {
      evidence, request,
      ready: !loading && !saving && !error && !validation && imageReady && !imageFailed && (!!evidence.refund || !!evidence.canCompleteRefund),
      error: error || validation || (!evidence.refund && !evidence.canCompleteRefund ? 'ต้องมีหลักฐานสถานะชำระเงินและสลิปก่อนจัดทำรายงาน' : ''),
    } : null;
    untrack(() => onchange?.(entry));
  });

  $effect(() => {
    if (!expanded) return;
    const ref = row.ref;
    void row.status;
    void row.version;
    void revision;
    let cancelled = false;
    loading = true;
    error = '';
    evidence = null;
    imageReady = false;
    imageFailed = false;
    getRefundEvidence(ref).then(result => {
      if (cancelled) return;
      if (result.status !== 'ok' || !result.evidence) throw new Error(String(result.message || 'ไม่สามารถโหลดหลักฐานการจองได้'));
      evidence = result.evidence;
      amount = result.evidence.refund?.amount ?? Number(result.evidence.booking.total);
      reason = result.evidence.refund?.reason ?? '';
      account = result.evidence.refund?.account ?? '';
      recipient = result.evidence.refund?.recipient ?? String(result.evidence.booking.visitorName || '');
    }).catch(cause => {
      if (!cancelled) error = cause instanceof Error ? cause.message : 'ไม่สามารถโหลดหลักฐานการจองได้';
    }).finally(() => { if (!cancelled) loading = false; });
    return () => { cancelled = true; };
  });

  async function recordRefund(): Promise<void> {
    if (!evidence?.canCompleteRefund || evidence.refund || saving || validation || !recipient.trim()) return;
    if (!window.confirm('ยืนยันว่าได้คืนเงิน ' + formatBaht(request.amount) + ' ให้ลูกค้าแล้ว? ระบบจะเปลี่ยนสถานะเป็นคืนเงินแล้ว และบันทึกยอดนี้')) return;
    saving = true;
    error = '';
    try {
      const result = await completeRefund(row.ref, request);
      if (result.status !== 'ok') throw new Error(String(result.message || 'บันทึกคืนเงินไม่สำเร็จ'));
      revision++;
      await reservations.refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'บันทึกคืนเงินไม่สำเร็จ';
    } finally { saving = false; }
  }

  function printEvidence(): void {
    if (!evidence?.slipImage || !imageReady || imageFailed || validation) return;
    try {
      const content = buildRefundEvidence(evidence, request);
      if (!openPrintWindow(content, `เอกสารขอคืนเงิน ${evidence.booking.ref}`, auth.user?.displayName || auth.user?.username || 'ไม่ระบุ')) error = 'กรุณาอนุญาตหน้าต่างป๊อปอัปเพื่อเปิดเอกสารก่อนพิมพ์';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'ไม่สามารถจัดทำเอกสารได้';
    }
  }
</script>

<section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="เอกสารประกอบการคืนเงิน">
  <Button variant="outline" onclick={() => (expanded = !expanded)}><FileText class="h-4 w-4" />{expanded ? 'ปิดแบบฟอร์มเอกสารคืนเงิน' : 'จัดทำเอกสารคืนเงิน'}</Button>
  {#if expanded}
    <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">จัดทำหลักฐานหนึ่งหน้า A4 เพื่อแนบส่งฝ่ายการเงิน สามารถขอคืนเต็มจำนวนหรือบางส่วนได้</p>
    {#if loading}<p class="mt-3 text-sm" role="status">กำลังโหลดข้อมูลการจองและสลิป...</p>{/if}
    {#if error}<p class="mt-3 text-sm text-red-600" role="alert">{error}</p>{/if}
    {#if evidence}
      <div class="my-4 grid gap-2 text-xs sm:grid-cols-2">
        {#each evidence.stages as stage (stage.label)}
          <div class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"><strong>{stage.label}</strong><p class="mt-1">{stage.state}</p><p class="mt-1 text-slate-500">{stage.timestamp || 'ไม่พบบันทึกวัน'} · {stage.actor || 'ไม่พบบันทึกผู้ดำเนินการ'}</p></div>
        {/each}
      </div>
      {#if evidence.refund}<p class="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" role="status">คืนเงินแล้ว {formatBaht(evidence.refund.amount)} · {evidence.refund.timestamp} · ผู้บันทึก: {evidence.refund.actor}</p>{/if}
      <form onsubmit={(event) => { event.preventDefault(); printEvidence(); }} class="grid gap-4">
        <div><label for={`refund-amount-${row.ref}`} class="mb-1 block text-sm font-medium">จำนวนเงินที่ขอคืน (บาท)</label><input id={`refund-amount-${row.ref}`} type="number" min="0.01" max={Number(evidence.booking.total)} step="0.01" bind:value={amount} disabled={!!evidence.refund || saving} required class="management-input w-full" /><p class="mt-1 text-xs text-slate-500">ยอดตามข้อมูลการจอง {formatBaht(evidence.booking.total)}</p></div>
        <div><label for={`refund-reason-${row.ref}`} class="mb-1 block text-sm font-medium">เหตุผลขอคืนเงิน</label><textarea id={`refund-reason-${row.ref}`} bind:value={reason} disabled={!!evidence.refund || saving} maxlength="250" required rows="2" class="management-input w-full"></textarea></div>
        <div class="grid gap-4 sm:grid-cols-2"><div><label for={`refund-recipient-${row.ref}`} class="mb-1 block text-sm font-medium">ชื่อผู้รับเงินคืน</label><input id={`refund-recipient-${row.ref}`} bind:value={recipient} disabled={!!evidence.refund || saving} maxlength="200" class="management-input w-full" /></div><div><label for={`refund-account-${row.ref}`} class="mb-1 block text-sm font-medium">ธนาคาร / เลขบัญชี (กรอกภายหลังได้)</label><input id={`refund-account-${row.ref}`} bind:value={account} disabled={!!evidence.refund || saving} maxlength="150" class="management-input w-full" /></div></div>
        {#if evidence.slipImage}
          <img src={evidence.slipImage} alt={`สลิปแนบเอกสารคืนเงิน ${evidence.booking.ref}`} class="mx-auto max-h-48 max-w-full rounded-lg object-contain" onload={() => { imageReady = true; imageFailed = false; }} onerror={() => { imageReady = false; imageFailed = true; }} />
          {#if imageFailed}<p class="text-sm text-red-600" role="alert">โหลดภาพสลิปไม่สำเร็จ ไม่สามารถพิมพ์เอกสารหลักฐานที่ครบถ้วนได้</p>{/if}
        {:else}<p class="text-sm text-red-600" role="alert">ไม่พบสลิปชำระเงินแนบ ไม่สามารถพิมพ์เอกสารหลักฐานที่ครบถ้วนได้</p>{/if}
        {#if validation}<p class="text-xs text-amber-700" role="status">{validation}</p>{/if}
        <p class="text-xs text-slate-500">การพิมพ์เอกสารไม่เปลี่ยนสถานะการจองและไม่โอนเงินคืน ฝ่ายการเงินตรวจสอบและดำเนินการคืนเงินตามขั้นตอน</p>
        <Button type="submit" disabled={!evidence.slipImage || !imageReady || imageFailed || !!validation}><Printer class="h-4 w-4" />เปิดเอกสารคืนเงินก่อนพิมพ์</Button>
        {#if !evidence.refund}
          <p class="text-xs text-slate-500">เมื่อฝ่ายการเงินคืนเงินให้ลูกค้าเรียบร้อยแล้ว ให้กดบันทึกด้านล่าง ระบบจะบันทึกยอดคืนเงินและเปลี่ยนสถานะเป็น “คืนเงินแล้ว”</p>
          <Button type="button" variant="outline" onclick={recordRefund} disabled={saving || !!validation || !recipient.trim() || !evidence.canCompleteRefund}>{saving ? 'กำลังบันทึก...' : 'บันทึกว่าคืนเงินแล้ว'}</Button>
          {#if !evidence.canCompleteRefund}<p class="text-xs text-amber-700">ต้องมีหลักฐานสถานะชำระเงินและสลิปก่อนบันทึกคืนเงิน</p>{/if}
        {/if}
      </form>
    {/if}
  {/if}
</section>
