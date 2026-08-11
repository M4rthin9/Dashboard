<script lang="ts">
  import { onMount } from 'svelte';
  import { Printer, RefreshCw, Wallet } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import { getReservationsWithArchive } from '../lib/api/endpoints';
  import type { Reservation } from '../lib/api/types';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { formatBaht, formatNumber } from '../lib/utils/format';
  import {
    buildDailyFinancialReport,
    buildMonthlyFinancialReport,
    computeFinancialSummary,
    currentMonthISO,
    financialDateOf,
    lastDayISO,
    monthLabel,
    shiftMonthISO,
  } from '../lib/utils/dashboard';
  import { buildFinancialReport, openPrintWindow } from '../lib/utils/print';

  let rows = $state<Reservation[]>([]);
  let loading = $state(false);
  let error = $state('');
  let fromMonth = $state(currentMonthISO());
  let toMonth = $state(currentMonthISO());

  const fromISO = $derived(`${fromMonth}-01`);
  const toISO = $derived(lastDayISO(toMonth));

  const inPeriod = $derived.by(() => {
    const from = fromMonth;
    const to = toMonth;
    return rows.filter((r) => {
      if (!r.ref || String(r.ref).trim() === '') return false;
      const key = financialDateOf(r).slice(0, 7);
      return key >= from && key <= to;
    });
  });

  const summary = $derived(computeFinancialSummary(inPeriod));
  const daily = $derived(buildDailyFinancialReport(inPeriod, fromISO, toISO));
  const monthly = $derived(buildMonthlyFinancialReport(inPeriod, fromMonth, toMonth));
  const periodLabel = $derived(`${monthLabel(fromMonth)} – ${monthLabel(toMonth)}`);
  const printerName = $derived(auth.user?.displayName || auth.user?.username || 'ไม่ระบุ');

  async function load(): Promise<void> {
    loading = true;
    error = '';
    try {
      const data = await getReservationsWithArchive(true);
      rows = data.rows ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
  });

  function setRange(from: string, to: string): void {
    fromMonth = from;
    toMonth = to;
  }

  function presetCurrent(): void {
    const m = currentMonthISO();
    setRange(m, m);
  }

  function presetLast(): void {
    const m = shiftMonthISO(currentMonthISO(), -1);
    setRange(m, m);
  }

  function preset3(): void {
    const cur = currentMonthISO();
    setRange(shiftMonthISO(cur, -2), cur);
  }

  function preset6(): void {
    const cur = currentMonthISO();
    setRange(shiftMonthISO(cur, -5), cur);
  }

  function presetAll(): void {
    const months = rows.map((r) => financialDateOf(r).slice(0, 7)).filter(Boolean);
    if (months.length === 0) {
      presetCurrent();
      return;
    }
    months.sort();
    setRange(months[0], months[months.length - 1]);
  }

  function doPrint(): void {
    if (inPeriod.length === 0) {
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีข้อมูลในช่วงเดือนที่เลือก', type: 'warning' });
      return;
    }
    const content = buildFinancialReport(summary, daily, monthly, periodLabel);
    const ok = openPrintWindow(content, 'รายงานสรุปการเงินภาพรวม', printerName);
    if (!ok) ui.showAlert({ title: 'กรุณาอนุญาต Popup', message: 'กรุณาอนุญาต Popup เพื่อเปิดหน้าพิมพ์', type: 'warning' });
  }

  const inputCls =
    'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">รายงานการเงินภาพรวม</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">รวมข้อมูลจากตาราง reservation และ archive_reservation</p>
    </div>
    <div class="flex items-center gap-2">
      <Button variant="outline" onclick={() => load()}>
        <RefreshCw class="h-4 w-4" />
        โหลดใหม่
      </Button>
      <Button variant="success" onclick={doPrint}>
        <Printer class="h-4 w-4" />
        พิมพ์รายงานการเงิน
      </Button>
    </div>
  </div>

  <Card>
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="fin-from" class="text-xs font-medium text-slate-500 dark:text-slate-400">จากเดือน</label>
        <input id="fin-from" type="month" bind:value={fromMonth} class={inputCls} />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="fin-to" class="text-xs font-medium text-slate-500 dark:text-slate-400">ถึงเดือน</label>
        <input id="fin-to" type="month" bind:value={toMonth} class={inputCls} />
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={presetCurrent}>เดือนนี้</button>
        <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={presetLast}>เดือนที่แล้ว</button>
        <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={preset3}>3 เดือนล่าสุด</button>
        <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={preset6}>6 เดือนล่าสุด</button>
        <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={presetAll}>ทั้งหมด</button>
      </div>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
        <Wallet class="h-3.5 w-3.5" />
        {periodLabel}
      </span>
    </div>
  </Card>

  {#if loading && rows.length === 0}
    <div class="flex items-center justify-center py-16">
      <Spinner />
    </div>
  {:else if error}
    <Card>
      <div class="flex flex-col items-center gap-3 py-6 text-center">
        <p class="text-sm font-semibold text-red-600 dark:text-red-400">โหลดข้อมูลไม่สำเร็จ</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">{error}</p>
        <Button variant="primary" onclick={() => load()}>ลองใหม่</Button>
      </div>
    </Card>
  {:else}
    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">การจองทั้งหมด</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(summary.bookings)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ยอดชำระแล้ว</p>
        <p class="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatBaht(summary.paid)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ยอดค้างชำระ</p>
        <p class="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{formatBaht(summary.pending)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ยอดรวม</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatBaht(summary.total)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ผู้เข้าร่วมทั้งหมด</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(summary.visitors + summary.prisoners)} <span class="text-sm font-medium text-slate-400">คน</span></p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ผู้เยี่ยมที่เข้าร่วม</p>
        <p class="mt-2 text-2xl font-bold text-teal-600 dark:text-teal-400">{formatNumber(summary.visitors)} <span class="text-sm font-medium text-slate-400">คน</span></p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ผู้ต้องขังเข้าร่วม</p>
        <p class="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(summary.prisoners)} <span class="text-sm font-medium text-slate-400">คน</span></p>
      </Card>
      <Card>
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ผู้ต้องขัง (ไม่ซ้ำ)</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(summary.distinctPrisoners)} <span class="text-sm font-medium text-slate-400">คน</span></p>
      </Card>
    </div>

    <Card title="สรุปรายวัน" subtitle={`${periodLabel} · นับเฉพาะสถานะ ชำระแล้ว / เสร็จสิ้น เป็นผู้เข้าร่วม`}>
      <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="bg-slate-50 dark:bg-slate-800/50">
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">วันที่</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">การจอง</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">เข้าร่วม</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ผู้เยี่ยม</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ผู้ต้องขัง</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ชำระแล้ว</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ค้างชำระ</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {#each daily as d (d.date)}
              <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                <td class="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">{monthLabel(d.date.slice(0, 7))} {Number(d.date.slice(8, 10))}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatNumber(d.bookings)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatNumber(d.attended)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatNumber(d.visitors)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatNumber(d.prisoners)}</td>
                <td class="px-3 py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatBaht(d.paid)}</td>
                <td class="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{formatBaht(d.pending)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatBaht(d.total)}</td>
              </tr>
            {/each}
            {#if daily.length === 0}
              <tr>
                <td colspan="8" class="px-3 py-8 text-center text-sm text-slate-400">ไม่มีข้อมูลในช่วงเดือนที่เลือก</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </Card>

    <Card title="สรุปรายเดือน">
      <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="bg-slate-50 dark:bg-slate-800/50">
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">เดือน</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">การจอง</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">เข้าร่วม</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ผู้เยี่ยม</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ผู้ต้องขัง</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ชำระแล้ว</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ค้างชำระ</th>
              <th class="px-3 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {#each monthly as m (m.month)}
              <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                <td class="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">{monthLabel(m.month)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatNumber(m.bookings)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatNumber(m.attended)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatNumber(m.visitors)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatNumber(m.prisoners)}</td>
                <td class="px-3 py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatBaht(m.paid)}</td>
                <td class="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{formatBaht(m.pending)}</td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{formatBaht(m.total)}</td>
              </tr>
            {/each}
            {#if monthly.length === 0}
              <tr>
                <td colspan="8" class="px-3 py-8 text-center text-sm text-slate-400">ไม่มีข้อมูลในช่วงเดือนที่เลือก</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-xs text-slate-400 dark:text-slate-500">
        ยอดชำระแล้วคิดจากสถานะ ชำระแล้ว / เสร็จสิ้น · ค้างชำระคิดจากสถานะ รอชำระเงิน · ยกเลิกและไม่อนุมัติไม่นำมาคิด
      </p>
    </Card>
  {/if}
</div>
