<script lang="ts">
  import { onMount } from 'svelte';
  import type { EChartsOption } from 'echarts';
  import type { Reservation } from '../lib/api/types';
  import {
    ArrowRight,
    Check,
    CheckCircle2,
    Coins,
    Crown,
    ReceiptText,
    RefreshCw,
    Sparkles,
    TrendingUp,
    Users,
    Wallet,
    X,
  } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import EChart from '../lib/components/charts/EChart.svelte';
  import FloorPlan from '../lib/components/dashboard/FloorPlan.svelte';
  import PaymentApprovalModal from '../lib/components/PaymentApprovalModal.svelte';
  import ReservationDetailModal from '../lib/components/ReservationDetailModal.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { navigate } from '../lib/router';
  import { hasPermission } from '../lib/utils/permissions';
  import { formatBaht, formatNumber, formatDateThai, normalizeStatus, STATUS_COLORS } from '../lib/utils/format';
  import {
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
  const canRejectPayment = $derived(isAdminOrSuper || hasPermission(role, 'reject_payment'));
  const canViewSlip = $derived(hasPermission(role, 'view_slip'));

  const rows = $derived(reservations.rows);
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

  const statusFilterCards = $derived.by(() => {
    const defs = [
      { status: 'รอตรวจสอบผู้เข้าร่วม', label: 'รอตรวจสอบผู้เข้าร่วม', icon: Users, color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', bar: 'from-violet-500 to-purple-600' },
      { status: 'รอตรวจสอบวินัย', label: 'รอตรวจสอบวินัย', icon: Crown, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', bar: 'from-amber-500 to-amber-600' },
      { status: 'รอชำระเงิน', label: 'รอชำระเงิน', icon: ReceiptText, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', bar: 'from-blue-600 to-blue-700' },
      { status: 'ชำระแล้ว', label: 'ชำระแล้ว', icon: Wallet, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', bar: 'from-emerald-600 to-teal-700' },
    ];
    return defs.map((d) => ({ ...d, count: statusDist[d.status] ?? 0 }));
  });

  function goToStatus(status: string): void {
    navigate(`/reservations?status=${encodeURIComponent(status)}`);
  }

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
        itemStyle: { color: '#1e3a5f' },
        lineStyle: { color: '#1e3a5f' },
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
          { name: 'ค้างชำระ', value: revSum.unpaid, itemStyle: { color: '#c9a227' } },
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
    series: [{ type: 'bar', data: wings.map((w) => w.count), itemStyle: { color: '#1e3a5f', borderRadius: [4, 4, 0, 0] } }],
  });

  const monthlyOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', valueFormatter: (v) => formatBaht(v) },
    grid: { left: 56, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: monthly.map((m) => m.label), axisLine: { lineStyle: { color: axisLine } }, axisLabel: { color: textColor } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: axisLine, type: 'dashed' } }, axisLabel: { color: textColor } },
    series: [{ type: 'bar', data: monthly.map((m) => m.revenue), itemStyle: { color: '#1e3a5f', borderRadius: [4, 4, 0, 0] } }],
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
        data: funnel.map((f, i) => ({ ...f, itemStyle: { color: Object.values(STATUS_COLORS)[i] ?? '#1e3a5f' } })),
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
          { name: 'ผู้ใหญ่', value: visitorTypes.adult, itemStyle: { color: '#1e3a5f' } },
          { name: 'เด็ก 5-8 ขวบ', value: visitorTypes.child5to8, itemStyle: { color: '#2563eb' } },
          { name: 'เด็กต่ำกว่า 5 ขวบ', value: visitorTypes.childUnder5, itemStyle: { color: '#c9a227' } },
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
      { name: 'รอชำระ', type: 'bar', stack: 'rev', data: dailyRevenue.map((d) => d.pending), itemStyle: { color: '#c9a227' } },
    ],
  });

  const kpiCards = $derived.by(() => {
    const base = [
      {
        id: 'fund',
        label: 'ยอดรายได้ (เดือนนี้)',
        value: formatBaht(revenue.mtdTotal),
        sub: `${formatNumber(revenue.mtdCount)} รายการในเดือนนี้`,
        icon: Coins,
        grad: 'from-amber-500 to-amber-600',
        chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
      },
      {
        id: 'paid',
        label: 'ชำระแล้ว / รอชำระ',
        value: `${formatBaht(revenue.paidTotal)} / ${formatBaht(revenue.pendingTotal)}`,
        sub: `${revenue.paidPct}% ชำระแล้ว`,
        icon: Wallet,
        grad: 'from-emerald-600 to-teal-700',
        chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
        valueCls: 'text-green-700 dark:text-green-400',
      },
      {
        id: 'bookings',
        label: 'จำนวนการจองทั้งหมด',
        value: formatNumber(revenue.bookingCount),
        sub: `${formatBaht(revenue.grandTotal)} รายได้รวม`,
        icon: TrendingUp,
        grad: 'from-blue-800 to-blue-950',
        chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      },
      {
        id: 'today',
        label: 'การจองวันนี้',
        value: formatNumber(revenue.todayCount),
        sub: `จาก ${formatNumber(todaysVisits.length)} รายการ`,
        icon: Users,
        grad: 'from-purple-600 to-indigo-700',
        chip: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
      },
    ];
    return base;
  });

  onMount(() => {
    reservations.load();
  });

  let paymentRow = $state<Reservation | null>(null);
  let paymentMode = $state<'ชำระแล้ว' | 'เสร็จสิ้น'>('ชำระแล้ว');
  let showPaymentApproval = $state(false);
  let paymentSaving = $state(false);

  function openPaymentApproval(row: Reservation, mode: 'ชำระแล้ว' | 'เสร็จสิ้น'): void {
    paymentRow = row;
    paymentMode = mode;
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
      await reservations.updateStatus(row.ref, paymentMode);
      ui.showAlert({
        title: paymentMode === 'เสร็จสิ้น' ? 'ยืนยันการเสร็จสิ้นสำเร็จ' : 'ยืนยันการชำระเงินสำเร็จ',
        message: `${row.visitorName ?? ''} · ${row.ref} สถานะเป็น "${paymentMode}"`,
        type: 'success',
      });
      closePaymentApproval();
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถยืนยันได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
      closePaymentApproval();
    } finally {
      paymentSaving = false;
    }
  }

  async function rejectPaid(row: Reservation): Promise<void> {
    const name = String(row.visitorName ?? row.ref ?? '');
    if (!window.confirm(`ยืนยันปฏิเสธรายการ "${name}" (${row.ref}) ? สถานะจะเปลี่ยนเป็น "ไม่อนุมัติ"`)) return;
    try {
      await reservations.updateStatus(row.ref, 'ไม่อนุมัติ');
      ui.showAlert({ title: 'ปฏิเสธรายการสำเร็จ', message: `${name} · ${row.ref}`, type: 'success' });
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถปฏิเสธได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    }
  }

  let detailRow = $state<Reservation | null>(null);
  let showDetail = $state(false);

  function openDetail(row: Reservation): void {
    detailRow = row;
    showDetail = true;
  }

  function closeDetail(): void {
    showDetail = false;
    detailRow = null;
  }
</script>

<div class="flex flex-col gap-6">
  <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-5 text-white shadow-lg shadow-black/25 sm:p-6">
    <div class="pointer-events-none absolute -right-12 -top-14 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true"></div>
    <div class="pointer-events-none absolute -bottom-20 right-12 h-48 w-48 rounded-full bg-amber-400/5 blur-2xl" aria-hidden="true"></div>
    <div class="pointer-events-none absolute left-8 top-4 h-px w-24 bg-gradient-to-r from-transparent to-amber-400/60" aria-hidden="true"></div>
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
      <div class="flex items-center gap-2.5">
        <button
          class="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/25"
          onclick={() => reservations.refresh()}
        >
          <RefreshCw class="h-4 w-4" />
          รีเฟรช
        </button>
        <button
          class="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 shadow transition-colors duration-150 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-2"
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
        <div class="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-200 ease-out hover:shadow-lg dark:border-slate-700/60 dark:bg-slate-900 dark:hover:shadow-xl">
          <div class="pointer-events-none absolute inset-x-0 top-0 z-0 h-1 bg-gradient-to-r {k.grad}" aria-hidden="true"></div>
          <div class="relative flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{k.label}</p>
              <p class="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white {k.valueCls ?? ''}">{k.value}</p>
              <p class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{k.sub}</p>
            </div>
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
              <KIcon class="h-5 w-5" />
            </div>
          </div>
        </div>
      {/each}
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {#each statusFilterCards as s (s.status)}
        {@const SIcon = s.icon}
        <div class="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-200 ease-out hover:shadow-lg dark:border-slate-700/60 dark:bg-slate-900 dark:hover:shadow-xl">
          <div class="pointer-events-none absolute inset-x-0 top-0 z-0 h-1 bg-gradient-to-r {s.bar}" aria-hidden="true"></div>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.label}</p>
              <p class="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{formatNumber(s.count)}</p>
              <p class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">รายการ</p>
            </div>
            <div class="flex h-10 w-10 items-center justify-center rounded-xl {s.color}">
              <SIcon class="h-5 w-5" />
            </div>
          </div>
          <button
            class="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onclick={() => goToStatus(s.status)}
          >
            ดูรายการ
            <ArrowRight class="h-3.5 w-3.5" />
          </button>
        </div>
      {/each}
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="ชำระแล้ว" subtitle="รายการที่ชำระเงินแล้ว" interactive>
        {#if alerts.length === 0}
          <p class="py-8 text-center text-sm text-slate-400 dark:text-slate-500">ไม่มีการจองที่ชำระเงินแล้ว</p>
        {:else}
          <div class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {#each alerts.slice(0, 5) as r (r.ref)}
              {@const s = normalizeStatus(r.status)}
              <div class="flex items-center gap-3 py-2.5 text-sm">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2 class="h-4 w-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <button
                    class="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                    onclick={() => openDetail(r)}
                    title="ดูรายละเอียด"
                  >
                    {r.ref}
                  </button>
                  <div class="truncate text-xs text-slate-500 dark:text-slate-400">{r.visitorName}</div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="whitespace-nowrap text-xs font-semibold text-emerald-700 dark:text-emerald-400">{formatBaht(r.total)}</span>
                  {#if s === 'ชำระแล้ว' && canConfirmPayment}
                    <button
                      class="shrink-0 rounded-lg border border-emerald-200 bg-white p-1 text-emerald-600 transition-colors duration-150 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-slate-800 dark:hover:bg-emerald-950/30"
                      title="ยืนยันเสร็จสิ้น"
                      onclick={() => openPaymentApproval(r, 'เสร็จสิ้น')}
                    >
                      <Check class="h-3.5 w-3.5" />
                    </button>
                  {/if}
                  {#if s === 'ชำระแล้ว' && canRejectPayment}
                    <button
                      class="shrink-0 rounded-lg border border-red-200 bg-white p-1 text-red-600 transition-colors duration-150 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:hover:bg-red-950/30"
                      title="ปฏิเสธรายการ"
                      onclick={() => rejectPaid(r)}
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <Card title="คิวชำระเงิน" subtitle="รายการที่รอชำระ" interactive>
        {#if paymentQueue.length === 0}
          <p class="py-8 text-center text-sm text-slate-400 dark:text-slate-500">ไม่มีรายการรอชำระ</p>
        {:else}
          <div class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {#each paymentQueue.slice(0, 5) as r (r.ref)}
              <div class="flex items-center justify-between gap-2 py-2.5 text-sm">
                <div class="flex min-w-0 items-center gap-3">
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-lg dark:bg-blue-950">
                    {r.slipImage || r.status === 'ชำระแล้ว' || r.status === 'เสร็จสิ้น' ? '🧾' : '💳'}
                  </div>
                  <div class="min-w-0">
                    <div class="truncate font-medium text-slate-700 dark:text-slate-200">{r.visitorName}</div>
                    <div class="truncate text-xs text-slate-400">{r.ref} · {r.prisonerName}</div>
                  </div>
                </div>
                <div class="whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">{formatBaht(r.total)}</div>
                {#if canConfirmPayment}
                  <button
                    class="shrink-0 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-2"
                    onclick={() => openPaymentApproval(r, 'ชำระแล้ว')}
                  >
                    ยืนยัน
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <Card title="การจองวันนี้" subtitle="{formatNumber(todaysVisits.length)} รายการ" interactive>
        {#if todaysVisits.length === 0}
          <p class="py-8 text-center text-sm text-slate-400 dark:text-slate-500">ไม่มีการจองวันนี้</p>
        {:else}
          <div class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {#each todaysVisits.slice(0, 6) as r (r.ref)}
              <div class="flex items-center justify-between gap-2 py-2 text-sm">
                <div class="flex min-w-0 items-center gap-2">
                  <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <Users class="h-3.5 w-3.5" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">{r.ref}</div>
                    <div class="truncate text-xs text-slate-500 dark:text-slate-400">{r.visitorName} · {r.prisonerName}</div>
                  </div>
                </div>
                <span class="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium {(() => {
                  switch (normalizeStatus(r.status)) {
                    case 'รอตรวจสอบผู้เข้าร่วม': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                    case 'รอตรวจสอบวินัย': return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
                    case 'รอชำระเงิน': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
                    case 'ชำระแล้ว': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
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

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card title="แนวโน้มการจอง 14 วัน" interactive>
        <EChart option={trendOption} />
      </Card>
      <Card title="สรุปรายได้" interactive>
        <EChart option={revenueOption} />
      </Card>
      <Card title="สัดส่วนสถานะ" interactive>
        <EChart option={statusOption} />
      </Card>
      <Card title="จำนวนการจองแยกตามปีก" interactive>
        <EChart option={wingOption} />
      </Card>
      <Card title="รายได้รายเดือน (6 เดือน)" interactive>
        <EChart option={monthlyOption} />
      </Card>
      <Card title="สายงานสถานะ (Pipeline)" interactive>
        <EChart option={funnelOption} />
      </Card>
      <Card title="ประเภทผู้เยี่ยม" interactive>
        <EChart option={visitorOption} />
      </Card>
      <Card title="รายได้รายวัน (14 วัน)" interactive>
        <EChart option={dailyRevenueOption} />
      </Card>
    </div>

    <FloorPlan />
  {/if}

  <PaymentApprovalModal
    open={showPaymentApproval}
    row={paymentRow}
    mode={paymentMode}
    onclose={closePaymentApproval}
    onapprove={approvePayment}
  />

  <ReservationDetailModal
    open={showDetail}
    row={detailRow}
    canViewSlip={canViewSlip}
    onclose={closeDetail}
  />
</div>
