<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, Printer, RefreshCw } from '@lucide/svelte';
  import type { EChartsOption } from 'echarts';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import EChart from '../lib/components/charts/EChart.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { formatBaht, formatNumber, todayISO, STATUS_COLORS, normalizeStatus } from '../lib/utils/format';
  import { exportReservationsCSV } from '../lib/utils/csv';
  import {
    computeRevenueSummary, computeStatusDistribution, computeWingCounts,
    computeDailyRevenue, computeMonthlyRevenue, computeVisitorTypes,
  } from '../lib/utils/dashboard';
  import { openPrintWindow, buildDisciplinaryReport, buildGateRegistrationReport, buildKitchenReport } from '../lib/utils/print';
  import type { Reservation } from '../lib/api/types';

  let from = $state(todayISO());
  let to = $state(todayISO());
  let reportDate = $state(todayISO());

  const inRange = $derived.by(() => {
    const rows = reservations.rows.filter((r) => {
      if (!r.ref || String(r.ref).trim() === '') return false;
      if (r._archived && !reservations.includeArchive) return false;
      const d = String(r.visitDateISO ?? '').trim();
      return d >= from && d <= to;
    });
    return rows;
  });

  const summary = $derived(computeRevenueSummary(inRange));
  const statusDist = $derived(computeStatusDistribution(inRange));
  const wingCounts = $derived(computeWingCounts(inRange));
  const daily = $derived(computeDailyRevenue(inRange, Math.max(1, Math.min(60, diffDays(from, to)))));
  const monthly = $derived(computeMonthlyRevenue(reservations.rows, 6));
  const visitorTypes = $derived(computeVisitorTypes(inRange));

  const statusOption = $derived<EChartsOption>({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['40%', '68%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      data: Object.entries(statusDist).map(([name, value]) => ({ name, value, itemStyle: { color: STATUS_COLORS[name] ?? '#94a3b8' } })),
      label: { formatter: '{b}: {c}' },
    }],
  });

  const wingOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 24, bottom: 40 },
    xAxis: { type: 'category', data: wingCounts.map((w) => w.wing), axisLabel: { interval: 0 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{ type: 'bar', data: wingCounts.map((w) => w.count), itemStyle: { color: '#6366f1' }, barMaxWidth: 32 }],
  });

  const dailyOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatBaht(v) },
    legend: { top: 0 },
    grid: { left: 70, right: 16, top: 32, bottom: 40 },
    xAxis: { type: 'category', data: daily.map((p) => p.date.slice(5)) },
    yAxis: { type: 'value' },
    series: [
      { name: 'ชำระแล้ว', type: 'bar', stack: 'rev', data: daily.map((p) => p.paid), itemStyle: { color: '#059669' }, barMaxWidth: 24 },
      { name: 'รอชำระเงิน', type: 'bar', stack: 'rev', data: daily.map((p) => p.pending), itemStyle: { color: '#f59e0b' }, barMaxWidth: 24 },
    ],
  });

  const monthlyOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatBaht(v) },
    grid: { left: 70, right: 16, top: 24, bottom: 32 },
    xAxis: { type: 'category', data: monthly.map((m) => m.label) },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: true, data: monthly.map((m) => m.revenue), itemStyle: { color: '#4f46e5' }, areaStyle: { opacity: 0.15 } }],
  });

  function diffDays(a: string, b: string): number {
    const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
    return Math.max(1, Math.round(d) + 1);
  }

  onMount(() => {
    reservations.load();
  });

  function exportCSV(): void {
    if (inRange.length === 0) {
      ui.showToast('ไม่มีข้อมูลในช่วงวันที่เลือก', 'warning');
      return;
    }
    exportReservationsCSV(inRange);
    ui.showToast('ส่งออกไฟล์ CSV สำเร็จ', 'success');
  }

  const dayRows = $derived.by(() => {
    return reservations.rows.filter((r) => {
      if (!r.ref || String(r.ref).trim() === '') return false;
      if (r._archived && !reservations.includeArchive) return false;
      if (normalizeStatus(r.status) !== 'เสร็จสิ้น') return false;
      return String(r.visitDateISO ?? '').trim() === reportDate;
    });
  });

  const printerName = $derived(auth.user?.displayName || auth.user?.username || 'ไม่ระบุ');

  function doPrint(build: (rows: Reservation[], date: string) => string, title: string): void {
    const rows = dayRows.slice().sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
    if (rows.length === 0) {
      ui.showToast('ไม่มีรายการสถานะ เสร็จสิ้น ในวันที่เลือก', 'warning');
      return;
    }
    const ok = openPrintWindow(build(rows, reportDate), title, printerName);
    if (!ok) ui.showToast('กรุณาอนุญาต Popup เพื่อเปิดหน้าพิมพ์', 'warning');
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="rep-from" class="text-xs font-medium text-slate-500 dark:text-slate-400">จากวันที่</label>
        <input id="rep-from" type="date" bind:value={from}
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="rep-to" class="text-xs font-medium text-slate-500 dark:text-slate-400">ถึงวันที่</label>
        <input id="rep-to" type="date" bind:value={to}
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
      </div>
      <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => { from = todayISO(); to = todayISO(); }}>
        วันนี้
      </button>
    </div>
    <div class="flex gap-2">
      <button class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => reservations.refresh()} aria-label="โหลดใหม่">
        <RefreshCw class="h-4 w-4" />
      </button>
      <button class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700" onclick={exportCSV}>
        <span class="flex items-center gap-1.5"><Download class="h-4 w-4" /> ส่งออก CSV</span>
      </button>
    </div>
  </div>

  {#if reservations.loading && reservations.rows.length === 0}
    <div class="flex items-center justify-center py-16"><Spinner /></div>
  {:else}
    <Card title="พิมพ์รายงานประจำวัน">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1.5">
          <label for="rep-print-date" class="text-xs font-medium text-slate-500 dark:text-slate-400">วันที่พิมพ์</label>
          <input id="rep-print-date" type="date" bind:value={reportDate}
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
        </div>
        <button
          class="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
          onclick={() => doPrint(buildDisciplinaryReport, 'รายงานส่วนทัณฑ์ (ปกครองกลาง)')}
        >
          <Printer class="h-4 w-4" /> ปกครองกลาง / ส่วนทัณฑ์
        </button>
        <button
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onclick={() => doPrint(buildGateRegistrationReport, 'ทะเบียนผู้เข้าเยี่ยม')}
        >
          <Printer class="h-4 w-4" /> ทะเบียนผู้เข้าเยี่ยม (ลงชื่อ)
        </button>
        <button
          class="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800"
          onclick={() => doPrint(buildKitchenReport, 'ครัว + เบเกอรี่')}
        >
          <Printer class="h-4 w-4" /> ครัว + เบเกอรี่
        </button>
        <span class="text-xs text-slate-400 dark:text-slate-500">
          {reportDate}: {formatNumber(dayRows.length)} โต๊ะ
        </span>
        <span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          พิมพ์เฉพาะสถานะ เสร็จสิ้น
        </span>
      </div>
    </Card>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">การจองทั้งหมด</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(inRange.length)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">มูลค่ารวม</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatBaht(summary.totalBooked)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ชำระแล้ว</p>
        <p class="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">{formatBaht(summary.paid)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">รอชำระเงิน</p>
        <p class="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{formatBaht(summary.unpaid)}</p>
      </Card>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="รายได้ต่อวัน">
        <EChart option={dailyOption} height="300px" />
      </Card>
      <Card title="รายได้ต่อเดือน (6 เดือนล่าสุด)">
        <EChart option={monthlyOption} height="300px" />
      </Card>
      <Card title="สถานะการจอง">
        <EChart option={statusOption} height="300px" />
      </Card>
      <Card title="การจองตามแดน">
        <EChart option={wingOption} height="300px" />
      </Card>
    </div>

    <Card title="สรุปผู้เข้าพบ">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p class="text-sm text-slate-500 dark:text-slate-400">ผู้ใหญ่</p>
          <p class="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(visitorTypes.adult)}</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p class="text-sm text-slate-500 dark:text-slate-400">เด็ก 5-8 ปี</p>
          <p class="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(visitorTypes.child5to8)}</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p class="text-sm text-slate-500 dark:text-slate-400">เด็กต่ำกว่า 5 ปี</p>
          <p class="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(visitorTypes.childUnder5)}</p>
        </div>
      </div>
    </Card>

    <Card title={`รายการจอง ({inRange.length} รายการ)`}>
      <div class="max-h-[420px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full min-w-[700px] text-left text-sm">
          <thead class="sticky top-0 bg-white dark:bg-slate-900">
            <tr class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th class="px-3 py-2 font-medium">REF</th>
              <th class="px-3 py-2 font-medium">ผู้ต้องขัง</th>
              <th class="px-3 py-2 font-medium">วันที่เข้าเยี่ยม</th>
              <th class="px-3 py-2 font-medium">สถานะ</th>
              <th class="px-3 py-2 text-right font-medium">ยอดชำระ</th>
            </tr>
          </thead>
          <tbody>
            {#each inRange.slice(0, 200) as r (r.ref)}
              <tr class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td class="px-3 py-2 font-mono text-xs">{r.ref}</td>
                <td class="px-3 py-2">{r.prisonerName}</td>
                <td class="px-3 py-2 text-xs">{r.visitDate}</td>
                <td class="px-3 py-2 text-xs">{r.status}</td>
                <td class="px-3 py-2 text-right">{formatBaht(r.total)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">แสดงสูงสุด 200 รายการแรก</p>
    </Card>
  {/if}
</div>
