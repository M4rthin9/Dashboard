<script lang="ts">
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';
  import { ClipboardCheck, Coins, Download, Info, Printer, RefreshCw, ShieldCheck, Users, Utensils } from '@lucide/svelte';
  import type { EChartsOption } from 'echarts';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import EChart from '../lib/components/charts/EChart.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { formatBaht, formatNumber, todayISO, STATUS_COLORS, normalizeStatus, visitDateLabel } from '../lib/utils/format';
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
    series: [{ type: 'bar', data: wingCounts.map((w) => w.count), itemStyle: { color: '#1e3a5f' }, barMaxWidth: 32 }],
  });

  const dailyOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatBaht(v) },
    legend: { top: 0 },
    grid: { left: 70, right: 16, top: 32, bottom: 40 },
    xAxis: { type: 'category', data: daily.map((p) => p.date.slice(5)) },
    yAxis: { type: 'value' },
    series: [
      { name: 'ชำระแล้ว', type: 'bar', stack: 'rev', data: daily.map((p) => p.paid), itemStyle: { color: '#059669' }, barMaxWidth: 24 },
      { name: 'รอชำระเงิน', type: 'bar', stack: 'rev', data: daily.map((p) => p.pending), itemStyle: { color: '#c9a227' }, barMaxWidth: 24 },
    ],
  });

  const monthlyOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatBaht(v) },
    grid: { left: 70, right: 16, top: 24, bottom: 32 },
    xAxis: { type: 'category', data: monthly.map((m) => m.label) },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: true, data: monthly.map((m) => m.revenue), itemStyle: { color: '#1e3a5f' }, areaStyle: { opacity: 0.15 } }],
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
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีข้อมูลในช่วงวันที่เลือก', type: 'warning' });
      return;
    }
    exportReservationsCSV(inRange);
    ui.showAlert({ title: 'ส่งออกไฟล์ CSV สำเร็จ', message: `ส่งออก ${inRange.length} รายการเรียบร้อย`, type: 'success' });
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

  interface PrintReportDef {
    id: string;
    title: string;
    desc: string;
    note: string;
    copies: string;
    accent: string;
    btn: string;
    icon: Component;
    build: (rows: Reservation[], date: string) => string;
  }

  const printReports: PrintReportDef[] = [
    {
      id: 'discipline',
      title: 'ปกครองกลาง / ส่วนทัณฑ์',
      desc: 'หนังสือขออนุมัติเบิกตัวผู้ต้องขังเข้าร่วมกิจกรรม',
      note: 'เรียงผู้ต้องขังไม่ซ้ำกัน พร้อมช่องลงนาม 3 ฝ่าย',
      copies: 'พิมพ์ 1 ชุด',
      accent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
      btn: 'bg-red-700 hover:bg-red-800',
      icon: ShieldCheck,
      build: buildDisciplinaryReport,
    },
    {
      id: 'gate',
      title: 'ทะเบียนผู้เข้าเยี่ยม (ลงชื่อ)',
      desc: 'รายชื่อผู้เยี่ยมและผู้ต้องขัง พร้อมช่องลงชื่อ',
      note: 'มีช่องลงชื่อผู้เยี่ยมและเจ้าหน้าที่ประจำจุด',
      copies: 'พิมพ์ 1 ชุด',
      accent: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      btn: 'bg-blue-700 hover:bg-blue-800',
      icon: ClipboardCheck,
      build: buildGateRegistrationReport,
    },
    {
      id: 'kitchen',
      title: 'ครัว + เบเกอรี่',
      desc: 'สรุปจำนวนอาหารสำหรับครัวและเบเกอรี่',
      note: 'ตัดแบ่งเอกสาร 2 ชุด (ครัว / เบเกอรี่)',
      copies: 'พิมพ์ 2 ชุด (ตัดกลาง)',
      accent: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
      btn: 'bg-green-700 hover:bg-green-800',
      icon: Utensils,
      build: buildKitchenReport,
    },
  ];

  const printDaySummary = $derived.by(() => {
    let visitors = 0;
    let revenue = 0;
    for (const r of dayRows) {
      visitors += Number(r.visitorCount) || 0;
      revenue += Number(r.total) || 0;
    }
    return { tables: dayRows.length, visitors, prisoners: dayRows.length, revenue };
  });

  function doPrint(report: PrintReportDef): void {
    const rows = dayRows.slice().sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
    if (rows.length === 0) {
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีรายการสถานะ เสร็จสิ้น ในวันที่เลือก', type: 'warning' });
      return;
    }
    const content = report.build(rows, reportDate);
    const ok = openPrintWindow(content, report.title, printerName);
    if (!ok) ui.showAlert({ title: 'กรุณาอนุญาต Popup', message: 'กรุณาอนุญาต Popup เพื่อเปิดหน้าพิมพ์', type: 'warning' });
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="rep-from" class="text-xs font-medium text-slate-500 dark:text-slate-400">จากวันที่</label>
        <input id="rep-from" type="date" bind:value={from}
          class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="rep-to" class="text-xs font-medium text-slate-500 dark:text-slate-400">ถึงวันที่</label>
        <input id="rep-to" type="date" bind:value={to}
          class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
      </div>
      <button class="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => { from = todayISO(); to = todayISO(); }}>
        วันนี้
      </button>
    </div>
    <div class="flex gap-2">
      <button class="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => reservations.refresh()} aria-label="โหลดใหม่">
        <RefreshCw class="h-4 w-4" />
      </button>
      <button class="rounded-xl bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800" onclick={exportCSV}>
        <span class="flex items-center gap-1.5"><Download class="h-4 w-4" /> ส่งออก CSV</span>
      </button>
    </div>
  </div>

  {#if reservations.loading && reservations.rows.length === 0}
    <div class="flex items-center justify-center py-16"><Spinner /></div>
  {:else}
    <Card title="พิมพ์รายงานประจำวัน" subtitle="เลือกวันที่ และเลือกรายงานที่ต้องการพิมพ์">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="rep-print-date" class="text-xs font-medium text-slate-500 dark:text-slate-400">วันที่พิมพ์</label>
          <input id="rep-print-date" type="date" bind:value={reportDate}
            class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Users class="h-3.5 w-3.5 text-slate-400" /> โต๊ะ {formatNumber(printDaySummary.tables)}
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Users class="h-3.5 w-3.5" /> ผู้เยี่ยม {formatNumber(printDaySummary.visitors)}
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
            <ShieldCheck class="h-3.5 w-3.5" /> ผู้ต้องขัง {formatNumber(printDaySummary.prisoners)}
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Coins class="h-3.5 w-3.5" /> {formatBaht(printDaySummary.revenue)}
          </span>
        </div>
      </div>

      <div class="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
        <Info class="mt-0.5 h-4 w-4 shrink-0" />
        <span>รายงานทั้งหมดพิมพ์จากรายการสถานะ <strong>เสร็จสิ้น</strong> ในวันที่เลือกเท่านั้น</span>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {#each printReports as r (r.id)}
          <div class="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/40 p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-700/60 dark:bg-slate-800/30 dark:hover:border-slate-600">
            <div class="flex items-start gap-3">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl {r.accent}">
                <r.icon class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.title}</p>
                <p class="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{r.desc}</p>
              </div>
            </div>
            <p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{r.note}</p>
            <div class="mt-auto flex items-center justify-between gap-2 pt-4">
              <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{r.copies}</span>
              <button
                class="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:brightness-110 {r.btn}"
                onclick={() => doPrint(r)}
              >
                <Printer class="h-4 w-4" />
                พิมพ์
              </button>
            </div>
          </div>
        {/each}
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
      <div class="overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full min-w-[700px] text-left text-sm">
          <thead class="sticky top-0 bg-slate-50 dark:bg-slate-800/50">
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="min-w-[90px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">REF</th>
              <th class="min-w-[160px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">ผู้ต้องขัง</th>
              <th class="min-w-[120px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">วันที่เข้าเยี่ยม</th>
              <th class="min-w-[110px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">สถานะ</th>
              <th class="w-[100px] px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ยอดชำระ</th>
            </tr>
          </thead>
          <tbody>
            {#each inRange.slice(0, 200) as r (r.ref)}
              <tr class="border-b border-slate-200 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                <td class="px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">{r.ref}</td>
                <td class="px-3 py-2 text-slate-700 dark:text-slate-200">{r.prisonerName}</td>
                <td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{visitDateLabel(r.visitDate, r.visitDateISO)}</td>
                <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{r.status}</td>
                <td class="px-3 py-2 text-right text-xs text-slate-700 dark:text-slate-200">{formatBaht(r.total)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">แสดงสูงสุด 200 รายการแรก</p>
    </Card>
  {/if}
</div>
