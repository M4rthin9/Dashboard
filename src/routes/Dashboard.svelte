<script lang="ts">
  import { onMount } from 'svelte';
  import type { EChartsOption } from 'echarts';
  import { AlertTriangle, ArrowRight, CreditCard, RefreshCw, Users } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import EChart from '../lib/components/charts/EChart.svelte';
  import FloorPlan from '../lib/components/dashboard/FloorPlan.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { navigate } from '../lib/router';
  import { hasPermission } from '../lib/utils/permissions';
  import { formatBaht, formatNumber, formatDateThai, normalizeStatus, STATUS_COLORS } from '../lib/utils/format';
  import {
    computeStats,
    computeRevenueKpis,
    computeTrend,
    computeRevenueSummary,
    computeStatusDistribution,
    computeWingCounts,
    computeMonthlyRevenue,
    computeFunnel,
    computeVisitorTypes,
    computeDailyRevenue,
    computeAlerts,
    computePaymentQueue,
    computeTodaysVisits,
  } from '../lib/utils/dashboard';

  const role = $derived(auth.user?.role ?? 'User');
  const isAdminOrSuper = $derived(role === 'Superadmin' || role === 'Admin');
  const canConfirmPayment = $derived(isAdminOrSuper || hasPermission(role, 'confirm_payment'));

  const rows = $derived(reservations.rows);
  const stats = $derived(computeStats(rows));
  const revenue = $derived(computeRevenueKpis(rows));
  const trend = $derived(computeTrend(rows));
  const revSum = $derived(computeRevenueSummary(rows));
  const statusDist = $derived(computeStatusDistribution(rows));
  const wings = $derived(computeWingCounts(rows));
  const monthly = $derived(computeMonthlyRevenue(rows));
  const funnel = $derived(computeFunnel(rows));
  const visitorTypes = $derived(computeVisitorTypes(rows));
  const dailyRevenue = $derived(computeDailyRevenue(rows));
  const alerts = $derived(computeAlerts(rows));
  const paymentQueue = $derived(computePaymentQueue(rows));
  const todaysVisits = $derived(computeTodaysVisits(rows));

  const statCards = $derived.by(() => {
    const base = [
      { id: 'statTotal', label: 'การจองทั้งหมด', value: formatNumber(stats.total) },
      { id: 'statWait', label: 'รอตรวจสอบวินัย', value: formatNumber(stats.wait) },
      { id: 'statOk', label: 'ผ่านการอนุมัติ/ชำระแล้ว', value: formatNumber(stats.ok) },
      { id: 'statReject', label: 'ไม่อนุมัติ', value: formatNumber(stats.reject) },
      { id: 'statUniquePrisoners', label: 'ผู้ต้องขังที่ถูกจอง', value: formatNumber(stats.uniquePrisoners) },
      { id: 'statThisWeek', label: 'การจอง 7 วันนี้', value: formatNumber(stats.thisWeek) },
      { id: 'statThisMonth', label: 'การจองเดือนนี้', value: formatNumber(stats.thisMonth) },
      { id: 'statUniqueVisitors', label: 'ผู้เยี่ยมทั้งหมด', value: formatNumber(stats.uniqueVisitors) },
    ];
    const visibleByRole: Record<string, string[]> = {
      Superadmin: base.map((c) => c.id),
      Admin: base.map((c) => c.id),
      Vinai: ['statWait', 'statThisWeek'],
      Tadtel: ['statOk', 'statThisWeek'],
      Finance: ['statOk', 'statThisWeek', 'statUniqueVisitors'],
      User: [],
    };
    const visible = visibleByRole[role] ?? [];
    return base.filter((c) => visible.includes(c.id));
  });

  const textColor = $derived(ui.darkMode ? '#cbd5e1' : '#475569');
  const axisLine = $derived(ui.darkMode ? '#334155' : '#e2e8f0');

  const trendOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    xAxis: {
      type: 'category',
      data: trend.map((p) => p.date.slice(5)),
      axisLine: { lineStyle: { color: axisLine } },
      axisLabel: { color: textColor },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: axisLine, type: 'dashed' } },
      axisLabel: { color: textColor },
    },
    series: [
      {
        name: 'การจอง',
        type: 'line',
        smooth: true,
        data: trend.map((p) => p.count),
        areaStyle: { opacity: 0.12 },
        itemStyle: { color: '#6366f1' },
        lineStyle: { color: '#6366f1' },
      },
    ],
  });

  const revenueOption = $derived<EChartsOption>({
    tooltip: { trigger: 'item', formatter: '{b}: {c} บาท ({d}%)' },
    legend: { bottom: 0, textStyle: { color: textColor } },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '42%'],
        label: { show: false },
        data: [
          { name: 'ชำระแล้ว', value: revSum.paid, itemStyle: { color: '#059669' } },
          { name: 'ค้างชำระ', value: revSum.unpaid, itemStyle: { color: '#f59e0b' } },
        ],
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: { text: formatBaht(revSum.totalBooked), fontSize: 14, fontWeight: 700, fill: textColor },
      },
    ],
  });

  const statusOption = $derived<EChartsOption>({
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: textColor } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '44%'],
        label: { show: false },
        data: Object.entries(statusDist).map(([name, value]) => ({
          name,
          value,
          itemStyle: { color: STATUS_COLORS[name] ?? '#94a3b8' },
        })),
      },
    ],
  });

  const wingOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: wings.map((w) => w.wing), axisLabel: { color: textColor, interval: 0 }, axisLine: { lineStyle: { color: axisLine } } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: axisLine, type: 'dashed' } }, axisLabel: { color: textColor } },
    series: [{ type: 'bar', data: wings.map((w) => w.count), itemStyle: { color: '#0ea5e9', borderRadius: [4, 4, 0, 0] } }],
  });

  const monthlyOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatBaht(v) },
    grid: { left: 56, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: monthly.map((m) => m.label), axisLine: { lineStyle: { color: axisLine } }, axisLabel: { color: textColor } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: axisLine, type: 'dashed' } }, axisLabel: { color: textColor } },
    series: [{ type: 'bar', data: monthly.map((m) => m.revenue), itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } }],
  });

  const funnelOption = $derived<EChartsOption>({
    tooltip: { trigger: 'item', formatter: '{b}: {c} รายการ' },
    series: [
      {
        type: 'funnel',
        left: 8,
        right: 8,
        top: 8,
        bottom: 8,
        label: { color: '#fff', formatter: '{b} {c}' },
        itemStyle: { borderColor: ui.darkMode ? '#0f172a' : '#fff', borderWidth: 2 },
        data: funnel.map((f, i) => ({ ...f, itemStyle: { color: Object.values(STATUS_COLORS)[i] ?? '#6366f1' } })),
      },
    ],
  });

  const visitorOption = $derived<EChartsOption>({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: textColor } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '42%'],
        label: { show: false },
        data: [
          { name: 'ผู้ใหญ่', value: visitorTypes.adult, itemStyle: { color: '#6366f1' } },
          { name: 'เด็ก 5-8 ขวบ', value: visitorTypes.child5to8, itemStyle: { color: '#0ea5e9' } },
          { name: 'เด็กต่ำกว่า 5 ขวบ', value: visitorTypes.childUnder5, itemStyle: { color: '#f59e0b' } },
        ],
      },
    ],
  });

  const dailyRevenueOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatBaht(v) },
    legend: { bottom: 0, textStyle: { color: textColor } },
    grid: { left: 56, right: 16, top: 24, bottom: 40 },
    xAxis: { type: 'category', data: dailyRevenue.map((d) => d.date.slice(5)), axisLine: { lineStyle: { color: axisLine } }, axisLabel: { color: textColor } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: axisLine, type: 'dashed' } }, axisLabel: { color: textColor } },
    series: [
      { name: 'ชำระแล้ว', type: 'bar', stack: 'rev', data: dailyRevenue.map((d) => d.paid), itemStyle: { color: '#059669' } },
      { name: 'รอชำระ', type: 'bar', stack: 'rev', data: dailyRevenue.map((d) => d.pending), itemStyle: { color: '#f59e0b' } },
    ],
  });

  const utilTone = $derived(revenue.utilRate >= 75 ? 'text-green-600' : revenue.utilRate >= 50 ? 'text-amber-600' : 'text-red-600');

  onMount(() => {
    reservations.load();
  });

  async function confirmQuick(ref: string): Promise<void> {
    try {
      await reservations.updateStatus(ref, 'ชำระแล้ว');
      ui.showToast('ยืนยันการชำระเงินสำเร็จ', 'success');
    } catch (err) {
      ui.showToast(err instanceof Error ? err.message : 'ไม่สามารถยืนยันได้', 'error');
    }
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">สวัสดี, {auth.displayName}</h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">วันนี้ {formatDateThai(new Date())}</p>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        onclick={() => reservations.refresh()}
      >
        <RefreshCw class="h-4 w-4" />
        รีเฟรช
      </button>
      <button
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        onclick={() => navigate('/reservations')}
      >
        เปิดตารางการจอง
        <ArrowRight class="h-4 w-4" />
      </button>
    </div>
  </div>

  {#if reservations.loading && reservations.rows.length === 0}
    <div class="flex items-center justify-center py-16">
      <Spinner />
    </div>
  {:else if reservations.error && reservations.rows.length === 0}
    <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {reservations.error}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="กองทุนวิชาชีพ (เดือนนี้)">
        <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatBaht(revenue.mtdTotal)}</p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatNumber(revenue.mtdCount)} รายการในเดือนนี้</p>
      </Card>
      <Card title="ชำระแล้ว / รอชำระ">
        <p class="text-2xl font-bold">
          <span class="text-green-600 dark:text-green-400">{formatBaht(revenue.paidTotal)}</span>
          <span class="mx-1 text-slate-300">/</span>
          <span class="text-amber-600 dark:text-amber-400">{formatBaht(revenue.pendingTotal)}</span>
        </p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{revenue.paidPct}% ชำระแล้ว</p>
      </Card>
      <Card title="เฉลี่ยต่อโต๊ะ">
        <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatBaht(revenue.avgRevenue)}</p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">จาก {formatNumber(revenue.bookingCount)} รายการ</p>
      </Card>
      <Card title="การใช้โต๊ะวันนี้">
        <p class="text-2xl font-bold {utilTone}">{revenue.utilRate}%</p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatNumber(revenue.todayCount)} / 20 โต๊ะ</p>
      </Card>
    </div>

    {#if statCards.length > 0}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {#each statCards as c (c.id)}
          <div class="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
            <p class="text-xl font-bold text-slate-900 dark:text-slate-100">{c.value}</p>
            <p class="mt-0.5 text-[11px] leading-tight text-slate-500 dark:text-slate-400">{c.label}</p>
          </div>
        {/each}
      </div>
    {/if}

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="แจ้งเตือน" subtitle="รอชำระเงินเกิน 2 วัน">
        {#if alerts.length === 0}
          <p class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">ไม่มีรายการค้างชำระเกินกำหนด</p>
        {:else}
          <div class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {#each alerts.slice(0, 5) as r (r.ref)}
              <div class="flex items-center gap-2 py-2 text-sm">
                <AlertTriangle class="h-4 w-4 shrink-0 text-amber-500" />
                <div class="min-w-0">
                  <div class="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.ref}</div>
                  <div class="truncate text-xs text-slate-500 dark:text-slate-400">{r.visitorName}</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <Card title="คิวชำระเงิน" subtitle="รายการที่รอชำระ">
        {#if paymentQueue.length === 0}
          <p class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">ไม่มีรายการรอชำระ</p>
        {:else}
          <div class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {#each paymentQueue.slice(0, 5) as r (r.ref)}
              <div class="flex items-center gap-2 py-2 text-sm">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base dark:bg-slate-800">
                  {r.slipImage ? '🧾' : '💳'}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium text-slate-700 dark:text-slate-200">{r.visitorName}</div>
                  <div class="truncate text-xs text-slate-400">{r.ref} · {r.prisonerName}</div>
                </div>
                <div class="whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">{formatBaht(r.total)}</div>
                {#if canConfirmPayment}
                  <button
                    class="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    onclick={() => confirmQuick(r.ref)}
                  >
                    ยืนยัน
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <Card title="การจองวันนี้" subtitle="{formatNumber(todaysVisits.length)} รายการ">
        {#if todaysVisits.length === 0}
          <p class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">ไม่มีการจองวันนี้</p>
        {:else}
          <div class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {#each todaysVisits.slice(0, 6) as r (r.ref)}
              <div class="flex items-center justify-between gap-2 py-2 text-sm">
                <div class="min-w-0">
                  <div class="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{r.ref}</div>
                  <div class="truncate text-xs text-slate-500 dark:text-slate-400">{r.visitorName} · {r.prisonerName}</div>
                </div>
                <span class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium {(() => {
                  switch (normalizeStatus(r.status)) {
                    case 'รอตรวจสอบผู้เข้าร่วม': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                    case 'รอตรวจสอบวินัย': return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
                    case 'รอชำระเงิน': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
                    case 'ชำระแล้ว': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300';
                    case 'เสร็จสิ้น': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
                    case 'ไม่อนุมัติ': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
                    case 'ยกเลิก': return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                  }
                })()}">
                  {normalizeStatus(r.status)}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="แนวโน้มการจอง 14 วัน">
        <EChart option={trendOption} />
      </Card>
      <Card title="สรุปรายได้">
        <EChart option={revenueOption} />
      </Card>
      <Card title="สัดส่วนสถานะ">
        <EChart option={statusOption} />
      </Card>
      <Card title="จำนวนการจองแยกตามปีก">
        <EChart option={wingOption} />
      </Card>
      <Card title="รายได้รายเดือน (6 เดือน)">
        <EChart option={monthlyOption} />
      </Card>
      <Card title="สายงานสถานะ (Pipeline)">
        <EChart option={funnelOption} />
      </Card>
      <Card title="ประเภทผู้เยี่ยม">
        <EChart option={visitorOption} />
      </Card>
      <Card title="รายได้รายวัน (14 วัน)">
        <EChart option={dailyRevenueOption} />
      </Card>
    </div>

    <FloorPlan />
  {/if}
</div>
