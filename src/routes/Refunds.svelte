<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { Printer, RefreshCw, Wallet, X } from '@lucide/svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Pagination from '../lib/components/ui/Pagination.svelte';
  import RefundEvidencePanel from '../lib/components/RefundEvidencePanel.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { hasPermission } from '../lib/utils/permissions';
  import { bookingPool } from '../lib/utils/management';
  import { formatBaht, normalizeStatus, statusColor, visitDateLabel } from '../lib/utils/format';
  import { openPrintWindow } from '../lib/utils/print';
  import { buildRefundReport, refundCandidates, refundReportTotals, type RefundReportEntry } from '../lib/utils/refundReport';

  let search = $state('');
  let status = $state('ยกเลิก');
  let pool = $state('');
  let archive = $state('');
  let date = $state('');
  let page = $state(1);
  let selectedRefs = $state<string[]>([]);
  let entries = $state<Record<string, RefundReportEntry | null>>({});
  let error = $state('');
  const allowed = $derived(hasPermission(auth.user?.role, 'confirm_payment') && hasPermission(auth.user?.role, 'view_slip'));
  const candidates = $derived(refundCandidates(reservations.rows));
  const filtered = $derived(candidates.filter(row => {
    const text = `${row.ref} ${row.visitorName || ''} ${row.prisonerName || ''}`.toLowerCase();
    return (!search.trim() || text.includes(search.trim().toLowerCase())) && (!status || normalizeStatus(row.status) === status) && (!pool || bookingPool(row) === pool) && (!archive || !!row._archived === (archive === 'archived')) && (!date || row.visitDateISO === date);
  }));
  const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / 10)));
  const currentPage = $derived(Math.min(page, totalPages));
  const pageRows = $derived(filtered.slice((currentPage - 1) * 10, currentPage * 10));
  const selectedRows = $derived(selectedRefs.flatMap(ref => { const row = candidates.find(row => row.ref === ref); return row ? [row] : []; }));
  const reportEntries = $derived(selectedRows.flatMap(row => entries[row.ref] ? [entries[row.ref]!] : []));
  const ready = $derived(selectedRows.length > 0 && reportEntries.length === selectedRows.length && reportEntries.every(entry => entry.ready));
  const totals = $derived(refundReportTotals(reportEntries));
  const allPageSelected = $derived(pageRows.length > 0 && pageRows.every(row => selectedRefs.includes(row.ref)));

  onMount(() => { if (allowed) void load(); });
  $effect(() => { void search; void status; void pool; void archive; void date; page = 1; });
  $effect(() => {
    const refs = new Set(candidates.map(row => row.ref));
    untrack(() => {
      const kept = selectedRefs.filter(ref => refs.has(ref));
      if (kept.length !== selectedRefs.length) selectedRefs = kept;
    });
  });

  async function load(force = false): Promise<void> {
    error = '';
    try { await reservations.ensureArchive(force); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'โหลดรายการคืนเงินไม่สำเร็จ'; }
  }
  function toggle(ref: string): void {
    if (selectedRefs.includes(ref)) {
      selectedRefs = selectedRefs.filter(item => item !== ref);
      delete entries[ref];
    } else selectedRefs = [...selectedRefs, ref];
  }
  function togglePage(): void {
    if (allPageSelected) {
      const refs = new Set(pageRows.map(row => row.ref));
      selectedRefs = selectedRefs.filter(ref => !refs.has(ref));
      for (const ref of refs) delete entries[ref];
    } else selectedRefs = [...new Set([...selectedRefs, ...pageRows.map(row => row.ref)])];
  }
  function printReport(): void {
    if (!allowed || !ready) return;
    try {
      const content = buildRefundReport(reportEntries);
      if (!openPrintWindow(content, 'รายงานคืนเงิน', auth.displayName)) throw new Error('กรุณาอนุญาตหน้าต่างป๊อปอัปเพื่อเปิดรายงานก่อนพิมพ์');
      error = '';
    } catch (cause) { error = cause instanceof Error ? cause.message : 'จัดทำรายงานไม่สำเร็จ'; }
  }
</script>

{#if allowed}
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div><h1 class="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-white"><Wallet class="h-6 w-6 text-violet-600" />คืนเงิน</h1><p class="mt-2 text-sm text-slate-500 dark:text-slate-400">เลือกการจอง กรอกยอดและเหตุผลคืนเงิน แล้วพิมพ์รายงานส่งฝ่ายการเงิน</p></div>
      <Button variant="outline" onclick={() => void load(true)} disabled={reservations.loading}><RefreshCw class="h-4 w-4" />รีเฟรช</Button>
    </header>
    {#if error}<p class="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">{error}</p>{/if}
    <section class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="เลือกการจองคืนเงิน">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div><label for="refund-search" class="mb-1 block text-sm">ค้นหาการจอง</label><input id="refund-search" class="management-input w-full" bind:value={search} placeholder="เลขอ้างอิง / ชื่อผู้จอง / ผู้ต้องขัง" /></div>
        <div><label for="refund-status" class="mb-1 block text-sm">สถานะการจอง</label><select id="refund-status" class="management-input w-full" bind:value={status}><option value="">ทั้งหมด</option><option value="ยกเลิก">ยกเลิก</option><option value="ชำระแล้ว">ชำระแล้ว</option><option value="เสร็จสิ้น">เสร็จสิ้น</option><option value="คืนเงินแล้ว">คืนเงินแล้ว</option></select></div>
        <div><label for="refund-pool" class="mb-1 block text-sm">ประเภทการจอง</label><select id="refund-pool" class="management-input w-full" bind:value={pool}><option value="">VIS และ TBL</option><option value="prisoner">เยี่ยมญาติ (VIS)</option><option value="table">จองโต๊ะ (TBL)</option></select></div>
        <div><label for="refund-archive" class="mb-1 block text-sm">รายการปัจจุบัน / ย้อนหลัง</label><select id="refund-archive" class="management-input w-full" bind:value={archive}><option value="">ทั้งหมด</option><option value="live">รายการปัจจุบัน</option><option value="archived">รายการย้อนหลัง</option></select></div>
        <div><label for="refund-date" class="mb-1 block text-sm">วันที่เข้าร่วม</label><input id="refund-date" type="date" class="management-input w-full" bind:value={date} /></div>
      </div>
      <div class="my-4 flex flex-wrap items-center justify-between gap-2 text-sm"><label class="flex items-center gap-2"><input type="checkbox" checked={allPageSelected} disabled={!pageRows.length} onchange={togglePage} />เลือกทั้งหมดในหน้านี้</label><span class="text-slate-500">พบ {filtered.length} รายการ · เลือก {selectedRows.length} รายการ</span></div>
      {#if reservations.loading}<p class="py-4 text-sm text-slate-500" role="status">กำลังโหลดรายการการจอง...</p>{/if}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {#each pageRows as row (row.ref)}
          <label class="flex cursor-pointer gap-3 rounded-xl border p-4 {selectedRefs.includes(row.ref) ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700'}">
            <input type="checkbox" aria-label={`เลือกคืนเงิน ${row.ref}`} checked={selectedRefs.includes(row.ref)} onchange={() => toggle(row.ref)} class="mt-1 shrink-0" />
            <span class="min-w-0 flex-1"><strong class="font-mono text-sm">{row.ref}</strong><span class="ml-2 text-xs text-slate-500">{bookingPool(row) === 'table' ? 'TBL' : 'VIS'}{row._archived ? ' · ย้อนหลัง' : ''}</span><span class="mt-2 block break-words text-sm">{row.visitorName || 'ไม่ระบุผู้จอง'}</span><span class="mt-1 block text-xs text-slate-500">{visitDateLabel(row.visitDate, row.visitDateISO)}</span><span class="mt-2 flex flex-wrap items-center justify-between gap-2"><span class="rounded-full px-2 py-1 text-xs {statusColor(row.status)}">{normalizeStatus(row.status)}</span><strong class="text-sm">{formatBaht(row.total)}</strong></span></span>
          </label>
        {:else}<p class="py-6 text-sm text-slate-500">ไม่พบการจองตามตัวกรองที่เลือก</p>{/each}
      </div>
      <div class="mt-4"><Pagination page={currentPage} {totalPages} onchange={(value) => page = value} /></div>
    </section>
    <section class="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/30" aria-label="สรุปรายงานคืนเงิน">
      <div class="flex flex-wrap items-center justify-between gap-4"><div><h2 class="text-lg font-semibold">รายการที่เลือกสำหรับรายงาน ({selectedRows.length})</h2><p class="mt-1 text-sm">ยอดขอคืนเงิน {formatBaht(totals.requested)} · บันทึกคืนเงินแล้ว {formatBaht(totals.refunded)}</p></div><div class="flex flex-wrap gap-2"><Button variant="outline" disabled={!selectedRefs.length} onclick={() => { selectedRefs = []; entries = {}; }}>ล้างรายการที่เลือก</Button><Button onclick={printReport} disabled={!ready}><Printer class="h-4 w-4" />พิมพ์รายงานคืนเงิน</Button></div></div>
      {#if selectedRows.length && !ready}<p class="mt-3 text-sm text-amber-800 dark:text-amber-300" role="status">กรอกยอดและเหตุผลให้ครบทุกการจอง และรอให้หลักฐานกับสลิปโหลดสำเร็จก่อนพิมพ์รายงาน</p>{/if}
      <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">ตัวกรองใช้ค้นหาการจอง รายงานจะรวมเฉพาะรายการที่เลือกด้านล่าง พิมพ์เอกสารพร้อมสลิปของแต่ละรายการเพื่อแนบส่งฝ่ายการเงิน</p>
    </section>
    {#each selectedRows as row (row.ref)}
      <article data-ref={row.ref} class="space-y-3" aria-label={`ข้อมูลคืนเงิน ${row.ref}`}>
        <div class="flex items-center justify-between gap-3"><h2 class="break-words font-semibold">{row.ref} · {row.visitorName}</h2><Button variant="ghost" size="sm" onclick={() => toggle(row.ref)}><X class="h-4 w-4" />นำออก</Button></div>
        <RefundEvidencePanel {row} initiallyExpanded onchange={(entry) => { entries[row.ref] = entry; }} />
      </article>
    {/each}
  </div>
{:else}<p role="alert" class="text-red-600">ไม่มีสิทธิ์จัดทำรายงานคืนเงิน</p>{/if}
