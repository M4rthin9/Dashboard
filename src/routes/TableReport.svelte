<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, Printer, RefreshCw, Utensils, Users } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { formatBaht, formatNumber, todayISO, normalizeStatus, visitDateLabel } from '../lib/utils/format';
  import { exportReservationsCSV } from '../lib/utils/csv';
  import { openPrintWindow, buildTableRegistrationReport } from '../lib/utils/print';
  import type { Reservation } from '../lib/api/types';

  let from = $state(todayISO());
  let to = $state(todayISO());

  function isTable(r: Reservation): boolean {
    return String(r.bookingType ?? '').trim() === 'table' || String(r.ref ?? '').toUpperCase().startsWith('TBL-');
  }

  const tableRows = $derived(reservations.rows.filter(isTable));

  const inRange = $derived.by(() => {
    return tableRows.filter((r) => {
      if (!r.ref || String(r.ref).trim() === '') return false;
      if (r._archived && !reservations.includeArchive) return false;
      const d = String(r.visitDateISO ?? '').trim();
      return d >= from && d <= to;
    });
  });

  const summary = $derived.by(() => {
    let tables = 0;
    let people = 0;
    let paid = 0;
    let total = 0;
    for (const r of inRange) {
      tables += 1;
      people += Number(r.visitorCount) || 1;
      total += Number(r.total) || 0;
      const s = normalizeStatus(r.status);
      if (s === 'ชำระแล้ว' || s === 'เสร็จสิ้น') paid += Number(r.total) || 0;
    }
    return { tables, people, paid, total, pending: total - paid };
  });

  let printDate = $state(todayISO());
  const printerName = $derived(auth.user?.displayName || auth.user?.username || 'ไม่ระบุ');

  const dayRows = $derived.by(() =>
    tableRows.filter((r) => {
      if (!r.ref || String(r.ref).trim() === '') return false;
      if (r._archived && !reservations.includeArchive) return false;
      if (normalizeStatus(r.status) !== 'เสร็จสิ้น') return false;
      return String(r.visitDateISO ?? '').trim() === printDate;
    })
  );

  onMount(() => {
    reservations.load();
  });

  function exportCSV(): void {
    if (inRange.length === 0) {
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีการจองโต๊ะในช่วงวันที่เลือก', type: 'warning' });
      return;
    }
    exportReservationsCSV(inRange, `TBL_${from}_${to}.csv`);
    ui.showAlert({ title: 'ส่งออกไฟล์ CSV สำเร็จ', message: `ส่งออก ${inRange.length} รายการเรียบร้อย`, type: 'success' });
  }

  function doPrint(): void {
    const rows = dayRows.slice().sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
    if (rows.length === 0) {
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีการจองโต๊ะในวันที่เลือก', type: 'warning' });
      return;
    }
    const content = buildTableRegistrationReport(rows, printDate);
    const ok = openPrintWindow(content, 'ทะเบียนจัดการโต๊ะ (ลงทะเบียนหน้าประตู)', printerName);
    if (!ok) ui.showAlert({ title: 'กรุณาอนุญาต Popup', message: 'กรุณาอนุญาต Popup เพื่อเปิดหน้าพิมพ์', type: 'warning' });
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">รายงานจัดการโต๊ะ (TBL)</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        เฉพาะการจองโต๊ะ (ลงทะเบียนหน้าประตู) แยกจากรายงานผู้ต้องขัง
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button class="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => reservations.refresh()} aria-label="โหลดใหม่">
        <RefreshCw class="h-4 w-4" />
      </button>
      <button class="rounded-xl bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800" onclick={exportCSV}>
        <span class="flex items-center gap-1.5"><Download class="h-4 w-4" /> ส่งออก CSV</span>
      </button>
    </div>
  </div>

  <Card>
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="tbl-from" class="text-xs font-medium text-slate-500 dark:text-slate-400">จากวันที่</label>
        <input id="tbl-from" type="date" bind:value={from}
          class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="tbl-to" class="text-xs font-medium text-slate-500 dark:text-slate-400">ถึงวันที่</label>
        <input id="tbl-to" type="date" bind:value={to}
          class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
      </div>
      <button class="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => { from = todayISO(); to = todayISO(); }}>
        วันนี้
      </button>
    </div>
  </Card>

  {#if reservations.loading && reservations.rows.length === 0}
    <div class="flex items-center justify-center py-16"><Spinner /></div>
  {:else}
    <Card title="พิมพ์ทะเบียนจัดการโต๊ะ" subtitle="พิมพ์รายชื่อผู้ร่วมโต๊ะ สำหรับตรวจสอบ/ลงชื่อที่หน้าประตู">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="tbl-print-date" class="text-xs font-medium text-slate-500 dark:text-slate-400">วันที่พิมพ์</label>
          <input id="tbl-print-date" type="date" bind:value={printDate}
            class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Utensils class="h-3.5 w-3.5 text-slate-400" /> โต๊ะ {formatNumber(dayRows.length)}
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Users class="h-3.5 w-3.5" /> ผู้ร่วมโต๊ะ {formatNumber(dayRows.reduce((n, r) => n + (Number(r.visitorCount) || 1), 0))}
          </span>
        </div>
        <button class="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700" onclick={doPrint}>
          <Printer class="h-4 w-4" /> พิมพ์ทะเบียนโต๊ะ
        </button>
      </div>
      <p class="mt-3 text-xs text-slate-400 dark:text-slate-500">
        พิมพ์ทะเบียนโต๊ะจากรายการสถานะ <strong>เสร็จสิ้น</strong> ในวันที่เลือกเท่านั้น (Ref ขึ้นต้น TBL-) · เหมาะสำหรับจัดการผู้ลงทะเบียนที่หน้าประตูโดยแยกจากการจองผู้ต้องขัง
      </p>
    </Card>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">การจองโต๊ะ</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(summary.tables)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ผู้ร่วมโต๊ะ</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(summary.people)} <span class="text-sm font-medium text-slate-400">คน</span></p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ชำระแล้ว</p>
        <p class="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">{formatBaht(summary.paid)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ยอดรวม</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatBaht(summary.total)}</p>
      </Card>
    </div>

    <Card title={`รายการจองโต๊ะ ({inRange.length} รายการ)`}>
      <div class="overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="sticky top-0 bg-slate-50 dark:bg-slate-800/50">
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="min-w-[90px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">REF</th>
              <th class="min-w-[160px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">ผู้ร่วมโต๊ะ</th>
              <th class="min-w-[120px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">วันที่</th>
              <th class="min-w-[110px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">สถานะ</th>
              <th class="w-[100px] px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ยอดชำระ</th>
            </tr>
          </thead>
          <tbody>
            {#each inRange.slice().sort((a, b) => String(a.ref).localeCompare(String(b.ref))) as r (r.ref)}
              <tr class="border-b border-slate-200 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                <td class="px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">{r.ref}</td>
                <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{r.visitorName}</td>
                <td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{visitDateLabel(r.visitDate, r.visitDateISO)}</td>
                <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{r.status}</td>
                <td class="px-3 py-2 text-right text-xs text-slate-700 dark:text-slate-200">{formatBaht(r.total)}</td>
              </tr>
            {/each}
            {#if inRange.length === 0}
              <tr>
                <td colspan="5" class="px-3 py-8 text-center text-sm text-slate-400">ไม่มีการจองโต๊ะในช่วงวันที่เลือก</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</div>
