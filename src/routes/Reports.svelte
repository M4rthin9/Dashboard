<script lang="ts">
  import BakeryReport from '../lib/components/BakeryReport.svelte';
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';
  import { BarChart3, CalendarDays, ClipboardCheck, Download, Info, Printer, RefreshCw, ShieldCheck, Table2 } from '@lucide/svelte';
  import type { EChartsOption } from 'echarts';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import EChart from '../lib/components/charts/EChart.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { formatBaht, formatNumber, todayISO, STATUS_COLORS, normalizeStatus, visitDateLabel, prisonersOf } from '../lib/utils/format';
  import { exportReservationsCSV } from '../lib/utils/csv';
  import {
    computeRevenueSummary, computeStatusDistribution, computeWingCounts,
    computeMonthlyRevenue, computeVisitorTypes,
  } from '../lib/utils/dashboard';
  import { openPrintWindow, buildDisciplinaryReport, buildGateRegistrationReport, buildTableRegistrationReport } from '../lib/utils/print';
  import { dailySeries, bookingPool, rangeDays } from '../lib/utils/management';
  import type { Reservation } from '../lib/api/types';

  function isTable(r: Reservation): boolean {
    return bookingPool(r) === 'table';
  }

  let from = $state(todayISO());
  let to = $state(todayISO());
  let reportDate = $state(todayISO());
  let view = $state<'documents' | 'summary'>('documents');
  const validRange = $derived(rangeDays({ from, to }) > 0);

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
  const daily = $derived(dailySeries(inRange, { from, to }));
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


  onMount(() => {
    void reservations.load().catch(() => {});
  });

  async function refreshReports(): Promise<void> {
    try { await reservations.refresh(); } catch { /* The store exposes the error below. */ }
  }

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
      if (isTable(r)) return false;
      return String(r.visitDateISO ?? '').trim() === reportDate;
    });
  });

  const tableDayRows = $derived.by(() => {
    return reservations.rows.filter((r) => {
      if (!r.ref || String(r.ref).trim() === '') return false;
      if (r._archived && !reservations.includeArchive) return false;
      if (normalizeStatus(r.status) !== 'เสร็จสิ้น') return false;
      if (!isTable(r)) return false;
      return String(r.visitDateISO ?? '').trim() === reportDate;
    });
  });

  const printerName = $derived(auth.user?.displayName || auth.user?.username || 'ไม่ระบุ');

  interface PrintReportDef {
    id: string;
    title: string;
    desc: string;
    note: string;
    accent: string;
    icon: Component;
    build: (rows: Reservation[], date: string) => string;
  }

  const printReports: PrintReportDef[] = [
    {
      id: 'discipline',
      title: 'ปกครองกลาง / ส่วนทัณฑ์',
      desc: 'หนังสือขออนุมัติเบิกตัวผู้ต้องขังเข้าร่วมกิจกรรม',
      note: 'เรียงผู้ต้องขังไม่ซ้ำกัน พร้อมช่องลงนาม 3 ฝ่าย',
      accent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
      icon: ShieldCheck,
      build: buildDisciplinaryReport,
    },
    {
      id: 'gate',
      title: 'ทะเบียนผู้เข้าเยี่ยม (ลงชื่อ)',
      desc: 'รายชื่อผู้เยี่ยมและผู้ต้องขัง พร้อมช่องลงชื่อ',
      note: 'มีช่องลงชื่อผู้เยี่ยมและเจ้าหน้าที่ประจำจุด',
      accent: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      icon: ClipboardCheck,
      build: buildGateRegistrationReport,
    },
    {
      id: 'table',
      title: 'ทะเบียนจัดการโต๊ะ (TBL)',
      desc: 'รายชื่อผู้จองโต๊ะและผู้ร่วมโต๊ะสำหรับลงทะเบียน',
      note: 'เฉพาะการจองโต๊ะ TBL พร้อมช่องลงชื่อ ไม่มีรายชื่อผู้ต้องขัง',
      accent: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
      icon: Table2,
      build: buildTableRegistrationReport,
    },
  ];

  const printDaySummary = $derived.by(() => {
    let visitors = 0;
    let revenue = 0;
    for (const r of dayRows) {
      visitors += Number(r.visitorCount) || 0;
      revenue += Number(r.total) || 0;
    }
    for (const r of tableDayRows) {
      visitors += Number(r.visitorCount) || 0;
      revenue += Number(r.total) || 0;
    }
    const prisoners = dayRows.reduce((n, r) => n + prisonersOf(r).length, 0);
    return { tables: dayRows.length + tableDayRows.length, visitors, prisoners, revenue };
  });

  function doPrint(report: PrintReportDef): void {
    const source = report.id === 'table' ? tableDayRows : dayRows;
    const rows = source.slice().sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
    if (rows.length === 0) {
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีรายการสถานะ เสร็จสิ้น ในวันที่เลือก', type: 'warning' });
      return;
    }
    const content = report.build(rows, reportDate);
    const ok = openPrintWindow(content, report.title, printerName);
    if (!ok) ui.showAlert({ title: 'กรุณาอนุญาต Popup', message: 'กรุณาอนุญาต Popup เพื่อเปิดหน้าพิมพ์', type: 'warning' });
  }
</script>

<div class="report-page flex min-w-0 flex-col gap-5">
  <header class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="text-xl font-medium text-slate-900 dark:text-slate-100">รายงานและเอกสาร</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">พิมพ์เอกสารประจำวัน หรือตรวจสอบสรุปการจองตามช่วงวันที่</p>
    </div>
    <button class="report-secondary" onclick={() => void refreshReports()} disabled={reservations.loading} aria-label="โหลดรายงานใหม่">
      <RefreshCw class={`h-4 w-4 ${reservations.loading ? 'animate-spin' : ''}`} /> โหลดใหม่
    </button>
  </header>

  <nav class="report-views" aria-label="มุมมองรายงาน">
    <button class:active={view === 'documents'} aria-pressed={view === 'documents'} onclick={() => view = 'documents'}>
      <Printer class="h-4 w-4" /> เอกสารประจำวัน
    </button>
    <button class:active={view === 'summary'} aria-pressed={view === 'summary'} onclick={() => view = 'summary'}>
      <BarChart3 class="h-4 w-4" /> สรุปการจอง
    </button>
  </nav>

  {#if reservations.error}
    <p role="alert" class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{reservations.error} · กดโหลดใหม่เพื่อลองอีกครั้ง</p>
  {/if}
  {#if reservations.loading && reservations.rows.length === 0}
    <div class="flex items-center justify-center py-16"><Spinner /></div>
  {:else if view === 'documents'}
    <Card>
      <div class="flex flex-wrap items-center justify-between gap-5">
        <div class="flex items-start gap-3">
          <CalendarDays class="mt-1 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
          <div>
            <h3 class="text-base font-medium text-slate-900 dark:text-slate-100">เอกสารสำหรับวันใช้บริการ</h3>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{visitDateLabel(undefined, reportDate)}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex flex-col gap-1.5">
            <label for="rep-print-date" class="text-xs font-medium text-slate-500 dark:text-slate-400">วันใช้บริการ</label>
            <input id="rep-print-date" class="report-input" type="date" bind:value={reportDate} />
          </div>
          <button class="report-secondary" onclick={() => reportDate = todayISO()}>วันนี้</button>
        </div>
      </div>
      <p class="mt-4 flex items-start gap-2 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <Info class="mt-0.5 h-4 w-4 shrink-0" /> เอกสารทั้ง 3 ประเภทใช้เฉพาะรายการสถานะเสร็จสิ้นที่ยืนยันการเงินแล้วในวันใช้บริการที่เลือก
      </p>
    </Card>

    <div class="report-metrics" aria-label="สรุปรายการพร้อมพิมพ์">
      <div><p>การจองที่พร้อมพิมพ์</p><strong>{formatNumber(printDaySummary.tables)}</strong><span>โต๊ะ</span></div>
      <div><p>ผู้เยี่ยม / ผู้ร่วมโต๊ะ</p><strong>{formatNumber(printDaySummary.visitors)}</strong><span>คน</span></div>
      <div><p>ผู้ต้องขัง</p><strong>{formatNumber(printDaySummary.prisoners)}</strong><span>คน</span></div>
      <div><p>ยอดรวมที่ยืนยันแล้ว</p><strong>{formatNumber(printDaySummary.revenue)}</strong><span>บาท</span></div>
    </div>

    <BakeryReport rows={[...dayRows, ...tableDayRows]} date={reportDate} {printerName} />

    <section aria-label="เลือกเอกสารที่ต้องการพิมพ์" class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {#each printReports as report (report.id)}
        {@const count = report.id === 'table' ? tableDayRows.length : dayRows.length}
        <article class="report-document" data-report-card={report.id}>
          <div class="flex items-center justify-between gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl {report.accent}"><report.icon class="h-5 w-5" /></div>
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{report.id === 'table' ? 'จองโต๊ะ · TBL' : 'เยี่ยมผู้ต้องขัง · VIS'}</span>
          </div>
          <h3 class="mt-5 text-base font-medium text-slate-900 dark:text-slate-100">{report.title}</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{report.desc}</p>
          <p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{report.note}</p>
          <div class="mt-auto pt-6">
            <p class="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{formatNumber(count)} การจอง</span><span>เอกสาร 1 ชุด</span></p>
            <button class="report-primary w-full" aria-label={`พิมพ์${report.title}`} onclick={() => doPrint(report)} disabled={count === 0 || !reportDate}>
              <Printer class="h-4 w-4" /> {count === 0 ? 'ไม่มีรายการในวันที่เลือก' : 'พิมพ์เอกสาร'}
            </button>
          </div>
        </article>
      {/each}
    </section>
  {:else}
    <Card title="ช่วงวันที่ใช้บริการ" subtitle="ตัวกรองนี้ใช้กับสถิติ รายการจอง และไฟล์ CSV ในหน้านี้">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1.5"><label for="rep-from" class="text-xs font-medium text-slate-500 dark:text-slate-400">จากวันที่</label><input id="rep-from" class="report-input" type="date" bind:value={from} max={to || undefined} aria-invalid={!validRange} /></div>
          <div class="flex flex-col gap-1.5"><label for="rep-to" class="text-xs font-medium text-slate-500 dark:text-slate-400">ถึงวันที่</label><input id="rep-to" class="report-input" type="date" bind:value={to} min={from || undefined} aria-invalid={!validRange} /></div>
          <button class="report-secondary" onclick={() => { from = todayISO(); to = todayISO(); }}>วันนี้</button>
        </div>
        <button class="report-primary" onclick={exportCSV} disabled={!validRange || inRange.length === 0}><Download class="h-4 w-4" /> ส่งออก CSV</button>
      </div>
      {#if !validRange}<p role="alert" class="mt-3 text-sm text-amber-700 dark:text-amber-300">กรุณาเลือกช่วงวันที่ให้ถูกต้อง โดยวันที่เริ่มต้นไม่เกินวันที่สิ้นสุด</p>{/if}
    </Card>

    <div class="report-metrics" aria-label="สรุปการจองตามช่วงวันที่">
      <div><p>การจองทั้งหมด</p><strong>{formatNumber(inRange.length)}</strong><span>รายการ</span></div>
      <div><p>มูลค่ารวม</p><strong>{formatNumber(summary.totalBooked)}</strong><span>บาท</span></div>
      <div><p>ชำระแล้ว</p><strong class="text-green-600 dark:text-green-400">{formatNumber(summary.paid)}</strong><span>บาท</span></div>
      <div><p>รอชำระเงิน</p><strong class="text-amber-600 dark:text-amber-400">{formatNumber(summary.unpaid)}</strong><span>บาท</span></div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="มูลค่าการจองตามวันใช้บริการ" subtitle="ชำระแล้ว / รอชำระ แยกตามวันที่ใช้บริการ">
        {#if validRange && rangeDays({ from, to }) <= 366}<EChart option={dailyOption} height="280px" label="มูลค่าการจองตามวันใช้บริการในช่วงที่เลือก" />{:else}<p role="alert" class="py-8 text-sm text-amber-700 dark:text-amber-300">เลือกช่วงวันที่ที่ถูกต้อง ไม่เกิน 366 วัน</p>{/if}
      </Card>
      <Card title="มูลค่าการจอง 6 เดือนล่าสุด" subtitle="ช่วงคงที่รวมเดือนปัจจุบัน · ไม่ใช่รายได้ตามวันที่โอน"><EChart option={monthlyOption} height="280px" label="มูลค่าการจอง 6 เดือนล่าสุดตามวันใช้บริการ" /></Card>
      <Card title="สถานะการจอง"><EChart option={statusOption} height="280px" label="สัดส่วนสถานะการจองในช่วงที่เลือก" /></Card>
      <Card title="การจองตามแดน"><EChart option={wingOption} height="280px" label="จำนวนการจองตามแดนในช่วงที่เลือก" /></Card>
    </div>

    <Card title="สรุปผู้เข้าพบ">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {#each [{ label: 'ผู้ใหญ่', value: visitorTypes.adult }, { label: 'เด็ก 5–8 ปี', value: visitorTypes.child5to8 }, { label: 'เด็กต่ำกว่า 5 ปี', value: visitorTypes.childUnder5 }] as category (category.label)}
          <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p class="text-sm text-slate-500 dark:text-slate-400">{category.label}</p><p class="mt-2 text-2xl font-medium text-slate-900 dark:text-slate-100">{formatNumber(category.value)}</p></div>
        {/each}
      </div>
    </Card>

    <Card title={`รายการจอง (${formatNumber(inRange.length)} รายการ)`}>
      <div class="max-h-[440px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full min-w-[700px] text-left text-sm">
          <caption class="sr-only">รายการจองตามช่วงวันที่ใช้บริการที่เลือก</caption>
          <thead class="sticky top-0 bg-slate-50 dark:bg-slate-800"><tr class="border-b border-slate-200 dark:border-slate-700">
            {#each ['REF', 'ผู้ต้องขัง', 'วันที่เข้าเยี่ยม', 'สถานะ', 'ยอดชำระ'] as heading, index (heading)}<th scope="col" class="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400" class:text-right={index === 4}>{heading}</th>{/each}
          </tr></thead>
          <tbody>
            {#each inRange.slice(0, 200) as row (row.ref)}
              <tr class="border-b border-slate-200 last:border-0 dark:border-slate-700">
                <td class="px-3 py-3 font-mono text-xs text-slate-800 dark:text-slate-200">{row.ref}</td><td class="px-3 py-3 text-slate-700 dark:text-slate-200">{prisonersOf(row).map(prisoner => prisoner.name).join(', ') || '—'}</td><td class="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{visitDateLabel(row.visitDate, row.visitDateISO)}</td><td class="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{row.status}</td><td class="px-3 py-3 text-right text-xs text-slate-700 dark:text-slate-200">{formatBaht(row.total)}</td>
              </tr>
            {:else}<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">ไม่มีรายการจองในช่วงวันที่เลือก</td></tr>{/each}
          </tbody>
        </table>
      </div>
      {#if inRange.length > 200}<p class="mt-3 text-xs text-slate-500 dark:text-slate-400">แสดง 200 รายการแรก · ส่งออก CSV เพื่อดูรายการทั้งหมด</p>{/if}
    </Card>
  {/if}
</div>

<style>
  .report-views { display: flex; gap: 4px; padding: 5px; width: fit-content; max-width: 100%; border: 1px solid var(--workspace-border); border-radius: 10px; background: var(--workspace-panel); }
  .report-views button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border-radius: 6px; font-size: 14px; color: var(--workspace-muted); }
  .report-views button.active { background: var(--workspace-action); color: var(--workspace-action-text); }
  .report-input { min-height: 44px; max-width: 100%; border: 1px solid var(--workspace-border); border-radius: 8px; padding: 9px 12px; background: var(--workspace-panel); color: var(--workspace-ink); font-size: 14px; }
  .report-primary, .report-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 15px; border-radius: 8px; font-size: 13px; font-weight: 500; }
  .report-primary { background: var(--workspace-action); color: var(--workspace-action-text); }
  .report-secondary { border: 1px solid var(--workspace-border); background: var(--workspace-panel); color: var(--workspace-ink); }
  .report-primary:hover:not(:disabled), .report-secondary:hover:not(:disabled) { filter: brightness(1.08); }
  .report-primary:disabled, .report-secondary:disabled { opacity: .5; cursor: not-allowed; }
  .report-document { display: flex; min-width: 0; flex-direction: column; padding: 24px; border: 1px solid var(--workspace-border); border-radius: 10px; background: var(--workspace-panel); }
  .report-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--workspace-border); border-radius: 10px; background: var(--workspace-panel); color: var(--workspace-ink); }
  .report-metrics > div { min-width: 0; padding: 22px; }
  .report-metrics > div + div { border-left: 1px solid var(--workspace-border); }
  .report-metrics p { margin-bottom: 10px; font-size: 12px; color: var(--workspace-muted); }
  .report-metrics strong { font-size: clamp(22px, 2.2vw, 30px); font-weight: 500; line-height: 1.3; font-variant-numeric: tabular-nums; }
  .report-metrics span { margin-left: 7px; font-size: 12px; color: var(--workspace-muted); }
  @media (max-width: 767px) {
    .report-views { width: 100%; }
    .report-views button { flex: 1; padding-inline: 9px; font-size: 13px; }
    .report-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .report-metrics > div { padding: 17px; }
    .report-metrics > div:nth-child(3) { border-left: 0; }
    .report-metrics > div:nth-child(n + 3) { border-top: 1px solid var(--workspace-border); }
  }
</style>
