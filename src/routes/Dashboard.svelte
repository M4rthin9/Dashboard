<script lang="ts">
  import { onMount } from 'svelte';
  import type { EChartsOption } from 'echarts';
  import type { Reservation } from '../lib/api/types';
  import {
    AlertTriangle,
    ArrowRight,
    CalendarDays,
    Coins,
    CreditCard,
    Crown,
    LayoutDashboard,
    PartyPopper,
    RefreshCw,
    Sparkles,
    TrendingUp,
    Users,
    Wallet,
  } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import EChart from '../lib/components/charts/EChart.svelte';
  import FloorPlan from '../lib/components/dashboard/FloorPlan.svelte';
  import PaymentApprovalModal from '../lib/components/PaymentApprovalModal.svelte';
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
      { id: 'statTotal', label: 'การจองทั้งหมด', value: formatNumber(stats.total), icon: LayoutDashboard, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' },
      { id: 'statWait', label: 'รอตรวจสอบวินัย', value: formatNumber(stats.wait), icon: Crown, color: 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400' },
      { id: 'statOk', label: 'ผ่านการอนุมัติ/ชำระแล้ว', value: formatNumber(stats.ok), icon: PartyPopper, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' },
      { id: 'statReject', label: 'ไม่อนุมัติ', value: formatNumber(stats.reject), icon: AlertTriangle, color: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' },
      { id: 'statUniquePrisoners', label: 'ผู้ต้องขังที่ถูกจอง', value: formatNumber(stats.uniquePrisoners), icon: Users, color: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400' },
      { id: 'statThisWeek', label: 'การจอง 7 วันนี้', value: formatNumber(stats.thisWeek), icon: CalendarDays, color: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400' },
      { id: 'statThisMonth', label: 'การจองเดือนนี้', value: formatNumber(stats.thisMonth), icon: TrendingUp, color: 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400' },
      { id: 'statUniqueVisitors', label: 'ผู้เยี่ยมทั้งหมด', value: formatNumber(stats.uniqueVisitors), icon: Sparkles, color: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
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

  const utilTone = $derived(revenue.utilRate >= 75 ? 'text-green-600 dark:text-green-400' : revenue.utilRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400');

  const kpiCards = $derived.by(() => {
    const base = [
      {
        id: 'fund',
        label: 'กองทุนวิชาชีพ (เดือนนี้)',
        value: formatBaht(revenue.mtdTotal),
        sub: `${formatNumber(revenue.mtdCount)} รายการในเดือนนี้`,
        icon: Coins,
        grad: 'from-indigo-500 to-violet-600',
        chip: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
      },
      {
        id: 'paid',
        label: 'ชำระแล้ว / รอชำระ',
        value: `${formatBaht(revenue.paidTotal)} / ${formatBaht(revenue.pendingTotal)}`,
        sub: `${revenue.paidPct}% ชำระแล้ว`,
        icon: Wallet,
        grad: 'from-emerald-500 to-teal-600',
        chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
        valueCls: 'text-green-600 dark:text-green-400',
      },
      {
        id: 'avg',
        label: 'เฉลี่ยต่อโต๊ะ',
        value: formatBaht(revenue.avgRevenue),
        sub: `จาก ${formatNumber(revenue.bookingCount)} รายการ`,
        icon: CreditCard,
        grad: 'from-sky-500 to-blue-600',
        chip: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
      },
      {
        id: 'util',
        label: 'การใช้โต๊ะวันนี้',
        value: `${revenue.utilRate}%`,
        sub: `${formatNumber(revenue.todayCount)} / 20 โต๊ะ`,
        icon: TrendingUp,
        grad: 'from-amber-500 to-orange-600',
        chip: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
        valueCls: utilTone,
      },
    ];
    return base;
  });

  onMount(() => {
    reservations.load();
  });

  let paymentRow = $state<Reservation | null>(null);
  let showPaymentApproval = $state(false);
  let paymentSaving = $state(false);

  function openPaymentApproval(row: Reservation): void {
    paymentRow = row;
    showPaymentApproval = true;
  }

  function closePaymentApproval(): void {
    if (paymentSaving) return;
    showPaymentApproval = false;
    paymentRow = null;
  }

  async function approvePayment(row: Reservation): Promise<void> {
    paymentSaving = true;
    try {
      await reservations.updateStatus(row.ref, 'ชำระแล้ว');
      ui.showAlert({ title: 'ยืนยันการชำระเงินสำเร็จ', message: `${row.visitorName ?? ''} · ${row.ref}`, type: 'success' });
      closePaymentApproval();
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถยืนยันได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
      closePaymentApproval();
    } finally {
      paymentSaving = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg shadow-indigo-500/20">
    <div class="pointer-events-none absolute -right-8 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true"></div>
    <div class="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5 blur-xl" aria-hidden="true"></div>
    <div class="relative flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 text-xs font-medium text-white/80">
          <Sparkles class="h-3.5 w-3.5" />
          {formatDateThai(new Date())}
        </div>
        <h2 class="mt-1 text-2xl font-bold tracking-tight">สวัสดี, {auth.displayName}</h2>
        <p class="mt-1 text-sm text-white/80">
          ยินดีต้อนรับสู่ระบบจอง C&amp;C Café · การจองวันนี้ {formatNumber(todaysVisits.length)} รายการ
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
          onclick={() => reservations.refresh()}
        >
          <RefreshCw class="h-4 w-4" />
          รีเฟรช
        </button>
        <button
          class="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-indigo-700 shadow transition-colors hover:bg-indigo-50"
          onclick={() => navigate('/reservations')}
        >
          เปิดตารางการจอง
          <ArrowRight class="h-4 w-4" />
        </button>
      </div>
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
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {#each kpiCards as k (k.id)}
        {@const KIcon = k.icon}
        <div class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
          <div class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r {k.grad}" aria-hidden="true"></div>
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{k.label}</p>
            <div class="flex h-8 w-8 items-center justify-center rounded-lg {k.chip}">
              <KIcon class="h-4 w-4" />
            </div>
          </div>
          <p class="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white {k.valueCls ?? ''}">{k.value}</p>
          <p class="mt-0.5 text-xs text-slate-400">{k.sub}</p>
        </div>
      {/each}
    </div>

    {#if statCards.length > 0}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {#each statCards as c (c.id)}
          {@const CIcon = c.icon}
          <div class="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl {c.color}">
              <CIcon class="h-4 w-4" />
            </div>
            <div>
              <p class="text-lg font-bold text-slate-900 dark:text-white">{c.value}</p>
              <p class="mt-0.5 text-[11px] leading-tight text-slate-500 dark:text-slate-400">{c.label}</p>
            </div>
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
              <div class="flex items-center gap-3 py-2 text-sm">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <AlertTriangle class="h-4 w-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.ref}</div>
                  <div class="truncate text-xs text-slate-500 dark:text-slate-400">{r.visitorName}</div>
                </div>
                <span class="text-xs font-semibold text-amber-600 dark:text-amber-400">{formatBaht(r.total)}</span>
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
              <div class="flex items-center gap-3 py-2 text-sm">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-base dark:bg-indigo-950">
                  {r.slipImage || r.status === 'ชำระแล้ว' || r.status === 'เสร็จสิ้น' ? '🧾' : '💳'}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium text-slate-700 dark:text-slate-200">{r.visitorName}</div>
                  <div class="truncate text-xs text-slate-400">{r.ref} · {r.prisonerName}</div>
                </div>
                <div class="whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">{formatBaht(r.total)}</div>
                {#if canConfirmPayment}
                  <button
                    class="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                    onclick={() => openPaymentApproval(r)}
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
                <div class="flex min-w-0 items-center gap-2">
                  <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                    <Users class="h-3.5 w-3.5" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{r.ref}</div>
                    <div class="truncate text-xs text-slate-500 dark:text-slate-400">{r.visitorName} · {r.prisonerName}</div>
                  </div>
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

  <PaymentApprovalModal
    open={showPaymentApproval}
    row={paymentRow}
    mode="ชำระแล้ว"
    onclose={closePaymentApproval}
    onapprove={approvePayment}
  />
</div>
