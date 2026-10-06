<script lang="ts">
  import { onMount } from 'svelte';
  import type { EChartsOption } from 'echarts';
  import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, ClipboardList, Coins, RefreshCw, Users, Wallet } from '@lucide/svelte';
  import type { Reservation } from '../lib/api/types';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import ChartPanel from '../lib/components/dashboard/ChartPanel.svelte';
  import FloorPlan from '../lib/components/dashboard/FloorPlan.svelte';
  import PaymentApprovalModal from '../lib/components/PaymentApprovalModal.svelte';
  import VisitorApprovalModal from '../lib/components/VisitorApprovalModal.svelte';
  import ReservationDetailModal from '../lib/components/ReservationDetailModal.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { liveSync } from '../lib/store/liveSync.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { navigate } from '../lib/router';
  import { hasPermission, visibleMenu, roleLabel } from '../lib/utils/permissions';
  import { formatBaht, formatNumber, normalizeStatus, visitDateLabel, STATUS_COLORS } from '../lib/utils/format';
  import { computeMonthlyRevenue, computeStatusDistribution, computeVisitorTypes, computeWingCounts } from '../lib/utils/dashboard';
  import { businessDate, shiftDate, rangeDays, previousRange, bookingPool, activeBooking, peopleCount, scopedReservations, periodRows, periodSummary, comparison, dailySeries, workQueues, visitOrder, expiredHold, validDate, type BookingPool } from '../lib/utils/management';

  let now = $state(new Date());
  const today = $derived(businessDate(now));
  let from = $state(shiftDate(businessDate(), -13));
  let to = $state(businessDate());
  let pool = $state<BookingPool>('all');
  let view = $state<'overview' | 'analytics' | 'schedule'>('overview');
  let queueStatus = $state('');
  const role = $derived(auth.user?.role ?? 'User');
  const canViewDetail = $derived(hasPermission(role, 'view_detail'));
  const canViewSlip = $derived(hasPermission(role, 'view_slip'));
  const allowedMenus = $derived(visibleMenu(role));
  const range = $derived({ from, to });
  const days = $derived(rangeDays(range));
  const validRange = $derived(days > 0 && days <= 366);
  const scope = $derived(scopedReservations(reservations.rows, role, today));
  const current = $derived(validRange ? periodRows(scope, range, pool) : []);
  const previous = $derived(previousRange(range));
  const summary = $derived(periodSummary(current));
  const baseline = $derived(periodSummary(validRange ? periodRows(scope, previous, pool) : []));
  const daily = $derived(validRange ? dailySeries(current, range) : []);
  const live = $derived(scope.filter(row => !row._archived && activeBooking(row) && !expiredHold(row, now)));
  const todaysVisits = $derived(live.filter(row => row.visitDateISO?.trim() === today).sort(visitOrder));
  const upcoming = $derived(live.filter(row => String(row.visitDateISO ?? '').trim() > today && String(row.visitDateISO).trim() <= shiftDate(today, 7)));
  const queues = $derived(workQueues(reservations.rows, role, now));
  const selectedQueue = $derived(queues.find(queue => queue.status === queueStatus) ?? queues[0]);
  const outstanding = $derived(queues.reduce((total, queue) => total + queue.rows.length, 0));
  const missingDates = $derived(scope.filter(row => !validDate(String(row.visitDateISO ?? '').trim())).length);
  const missingAmounts = $derived(current.filter(row => activeBooking(row) && (row.total == null || String(row.total).trim() === '' || !Number.isFinite(Number(row.total)) || Number(row.total) < 0)).length);
  const heldExpired = $derived(scope.filter(row => !row._archived && expiredHold(row, now)).length);
  const oldestVisit = $derived(selectedQueue?.rows[0]?.visitDateISO);

  const metrics = $derived([
    { key: 'bookings', label: 'การจองที่ยังมีผล', value: summary.bookings, previous: baseline.bookings, money: false, note: `${formatNumber(summary.visitors)} ผู้เยี่ยมที่ลงทะเบียน`, icon: CalendarDays, tone: 'crimson' },
    { key: 'paid', label: 'มูลค่าการจองที่ชำระแล้ว', value: summary.paid, previous: baseline.paid, money: true, note: 'สถานะ ชำระแล้ว / เสร็จสิ้น', icon: Coins, tone: 'emerald' },
    { key: 'pending', label: 'มูลค่าการจองรอชำระ', value: summary.pending, previous: baseline.pending, money: true, note: 'เฉพาะสถานะ รอชำระเงิน', icon: Wallet, tone: 'gold' },
    { key: 'completed', label: 'ดำเนินการเสร็จสิ้น', value: summary.completed, previous: baseline.completed, money: false, note: 'ยืนยันเสร็จสิ้นในระบบ', icon: CheckCircle2, tone: 'slate' },
  ]);
  const textColor = $derived(ui.darkMode ? '#cbd5e1' : '#64748b');
  const gridColor = $derived(ui.darkMode ? '#293446' : '#ece9e4');
  const barBase = $derived<EChartsOption>({
    animationDuration: 250,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: textColor, fontSize: 11 } },
    grid: { left: 12, right: 12, top: 20, bottom: 42, containLabel: true },
    xAxis: { type: 'category', data: daily.map(point => point.date.slice(5)), axisLabel: { color: textColor, fontSize: 10 }, axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: textColor, fontSize: 10 }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } },
  });
  const bookingOption = $derived<EChartsOption>({ ...barBase, series: [
    { name: 'เยี่ยมผู้ต้องขัง', type: 'bar', stack: 'bookings', barMaxWidth: 22, data: daily.map(point => point.prisoner), itemStyle: { color: ui.darkMode ? '#df8984' : '#a92928' } },
    { name: 'จองโต๊ะ (TBL)', type: 'bar', stack: 'bookings', barMaxWidth: 22, data: daily.map(point => point.table), itemStyle: { color: '#d3ac60', borderRadius: [3, 3, 0, 0] } },
  ] });
  const moneyOption = $derived<EChartsOption>({ ...barBase, tooltip: { trigger: 'axis', valueFormatter: value => formatBaht(value) }, series: [
    { name: 'ชำระแล้ว', type: 'bar', stack: 'money', barMaxWidth: 22, data: daily.map(point => point.paid), itemStyle: { color: '#238a75' } },
    { name: 'รอชำระ', type: 'bar', stack: 'money', barMaxWidth: 22, data: daily.map(point => point.pending), itemStyle: { color: '#d3ac60', borderRadius: [3, 3, 0, 0] } },
  ] });
  const states = $derived(Object.entries(computeStatusDistribution(current)));
  const wings = $derived(computeWingCounts(current.filter(row => activeBooking(row) && bookingPool(row) === 'prisoner')));
  const visitorTypes = $derived(computeVisitorTypes(current));
  const ageRows = $derived([{ label: 'ผู้ใหญ่', value: visitorTypes.adult }, { label: 'เด็ก 5–8 ปี', value: visitorTypes.child5to8 }, { label: 'เด็กต่ำกว่า 5 ปี', value: visitorTypes.childUnder5 }]);
  const monthly = $derived(computeMonthlyRevenue(scope.filter(row => pool === 'all' || bookingPool(row) === pool), 6));
  function horizontal(labels: string[], values: number[], colors: string[] = ['#a92928']): EChartsOption {
    return { tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 8, right: 30, top: 10, bottom: 10, containLabel: true }, xAxis: { type: 'value', minInterval: 1, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: gridColor, type: 'dashed' } } }, yAxis: { type: 'category', inverse: true, data: labels, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: textColor, fontSize: 11, width: 140, overflow: 'truncate' } }, series: [{ type: 'bar', barMaxWidth: 18, label: { show: true, position: 'right', color: textColor }, data: values.map((value, i) => ({ value, itemStyle: { color: colors[i % colors.length], borderRadius: [0, 4, 4, 0] } })) }] };
  }
  const statusOption = $derived(horizontal(states.map(([label]) => label), states.map(([, value]) => value), states.map(([label]) => STATUS_COLORS[label] ?? '#94a3b8')));
  const wingOption = $derived(horizontal(wings.map(point => point.wing), wings.map(point => point.count), ['#b97872']));
  const ageOption = $derived(horizontal(ageRows.map(point => point.label), ageRows.map(point => point.value), ['#238a75', '#d3ac60', '#8094a9']));
  const monthlyOption = $derived<EChartsOption>({ ...barBase, legend: { show: false }, xAxis: { type: 'category', data: monthly.map(point => point.label), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: textColor } }, tooltip: { trigger: 'axis', valueFormatter: value => formatBaht(value) }, series: [{ name: 'มูลค่าการจอง', type: 'bar', barMaxWidth: 30, data: monthly.map(point => point.revenue), itemStyle: { color: '#b97872', borderRadius: [4, 4, 0, 0] } }] });

  onMount(() => {
    void reservations.load().catch(() => {});
    const timer = setInterval(() => now = new Date(), 60_000);
    return () => clearInterval(timer);
  });
  function preset(length: number): void { from = shiftDate(today, 1 - length); to = today; }
  function openList(status = '', extra: Record<string, string> = {}): void {
    const query = new URLSearchParams({ ...(status ? { status } : {}), ...extra });
    navigate(`/reservations${query.size ? `?${query}` : ''}`);
  }
  async function refresh(): Promise<void> { try { await reservations.refresh(); } catch { /* Visible store error. */ } }
  let detailRow = $state<Reservation | null>(null);
  let paymentRow = $state<Reservation | null>(null);
  let visitorRow = $state<Reservation | null>(null);
  let paymentMode = $state<'ชำระแล้ว' | 'เสร็จสิ้น'>('ชำระแล้ว');
  let saving = $state(false);
  function review(row: Reservation): void {
    const s = normalizeStatus(row.status);
    if (s === 'รอตรวจสอบผู้เข้าร่วม' && hasPermission(role, 'visitor_approval')) { visitorRow = row; return; }
    if (['รอชำระเงิน', 'ชำระแล้ว'].includes(s) && hasPermission(role, 'confirm_payment')) { paymentMode = s === 'ชำระแล้ว' ? 'เสร็จสิ้น' : 'ชำระแล้ว'; paymentRow = row; return; }
    openList(s, { search: row.ref });
  }
  async function approvePayment(row: Reservation): Promise<void> {
    if (saving || !hasPermission(role, 'confirm_payment')) return;
    saving = true;
    try { await reservations.updateStatus(row.ref, paymentMode); ui.showToast(`${row.ref} · ${paymentMode}`, 'success'); paymentRow = null; }
    catch (err) { ui.showAlert({ title: 'ไม่สามารถยืนยันได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' }); }
    finally { saving = false; }
  }
</script>

<div class="management-dashboard flex flex-col gap-6">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div><p class="mb-2 text-[10px] font-semibold tracking-[0.18em] text-blue-700 dark:text-blue-300">C&C CAFÉ / MANAGEMENT</p><h2 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">ภาพรวมการดำเนินงาน</h2><p class="mt-2 text-sm text-slate-500">ข้อมูลเพื่อวางแผน และงานที่พร้อมให้คุณดำเนินการ</p></div>
    <button class="quick-link" disabled={reservations.loading} onclick={() => void refresh()}><RefreshCw class="h-4 w-4 {reservations.loading ? 'animate-spin' : ''}" />อัปเดตข้อมูล</button>
  </div>

  <div class="dashboard-hero relative overflow-hidden rounded-2xl p-5 text-white sm:p-6">
    <div class="relative z-10 flex flex-wrap items-center justify-between gap-6">
      <div><p class="text-xs text-white/65">{visitDateLabel(today)} · {roleLabel(role)}</p><h3 class="mt-2 text-xl font-medium">สวัสดี, {auth.displayName}</h3><p class="mt-1 text-xs text-white/65">{role === 'Superadmin' || role === 'Admin' || role === 'User' ? 'ภาพรวมข้อมูลที่โหลดจากระบบ' : 'เฉพาะข้อมูลตามขอบเขตบทบาทของคุณ'}</p></div>
      <div class="flex flex-wrap gap-6 sm:gap-10"><div><p class="text-[11px] text-white/65">การจองที่ยังมีผลวันนี้</p><p class="mt-1 text-3xl font-semibold tabular-nums">{reservations.loadedAt == null && !scope.length ? '—' : formatNumber(todaysVisits.length)}</p></div><div><p class="text-[11px] text-white/65">งานในคิวของคุณ</p><p class="mt-1 text-3xl font-semibold tabular-nums text-amber-200">{reservations.loadedAt == null && !scope.length ? '—' : formatNumber(outstanding)}</p></div><div><p class="text-[11px] text-white/65">การจองใน 7 วันข้างหน้า</p><p class="mt-1 text-3xl font-semibold tabular-nums">{reservations.loadedAt == null && !scope.length ? '—' : formatNumber(upcoming.length)}</p></div></div>
    </div>
  </div>

  <div class="flex flex-wrap items-center justify-between gap-3">
    <nav class="dashboard-tabs flex max-w-full gap-1 overflow-x-auto rounded-xl p-1" aria-label="มุมมองแดชบอร์ด">
      {#each [{ key: 'overview' as const, label: 'ภาพรวมและคิวงาน' }, { key: 'analytics' as const, label: 'วิเคราะห์ข้อมูล' }, ...(canViewDetail ? [{ key: 'schedule' as const, label: 'การจองรายวัน' }] : [])] as tab (tab.key)}
        <button class="whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium {view === tab.key ? 'bg-white text-blue-800 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}" aria-pressed={view === tab.key} onclick={() => view = tab.key}>{tab.label}</button>
      {/each}
    </nav>
    <p class="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400" aria-live="polite"><span class="h-1.5 w-1.5 rounded-full {reservations.error || !liveSync.connected ? 'bg-amber-500' : reservations.loadedAt ? 'bg-emerald-500' : 'bg-slate-400'}"></span>{reservations.loading ? 'กำลังอัปเดต...' : !liveSync.connected ? 'กำลังเชื่อมต่อใหม่ · ข้อมูลอาจยังไม่อัปเดต' : reservations.loadedAt ? `ข้อมูลล่าสุด ${new Date(reservations.loadedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'รอโหลดข้อมูล'}</p>
  </div>

  {#if reservations.error}<div role="alert" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{reservations.error}{#if scope.length} · แสดงข้อมูลที่โหลดไว้ล่าสุด{/if}<button class="ml-3 underline" onclick={() => void refresh()}>ลองใหม่</button></div>{/if}
  {#if reservations.loading && !scope.length}<div class="flex justify-center py-20"><Spinner /></div>
  {:else if reservations.loadedAt || scope.length}
    {#if view === 'schedule' && canViewDetail}
      <FloorPlan rows={scope} ondetail={row => detailRow = row} />
    {:else}
      <section class="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="ตัวกรองสถิติ">
        <div class="flex flex-wrap items-end gap-3"><div><label for="dashboard-from" class="mb-1.5 block text-[11px] text-slate-500">วันเข้าเยี่ยม / ใช้บริการ ตั้งแต่</label><input id="dashboard-from" type="date" bind:value={from} class="management-input" /></div><div><label for="dashboard-to" class="mb-1.5 block text-[11px] text-slate-500">ถึงวันที่</label><input id="dashboard-to" type="date" bind:value={to} class="management-input" /></div><div><label for="dashboard-pool" class="mb-1.5 block text-[11px] text-slate-500">ประเภทการจอง</label><select id="dashboard-pool" bind:value={pool} class="management-input"><option value="all">ทุกประเภท</option><option value="prisoner">เยี่ยมผู้ต้องขัง (VIS)</option><option value="table">จองโต๊ะ (TBL)</option></select></div><div class="ml-auto flex gap-1">{#each [7, 14, 30, 90] as length (length)}<button class="rounded-lg border px-2.5 py-2 text-xs {days === length && to === today ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300' : 'border-slate-200 text-slate-500 dark:border-slate-700'}" onclick={() => preset(length)}>{length} วัน</button>{/each}</div></div>
        <p class="mt-3 text-[11px] leading-relaxed text-slate-400">สถิติอิงวันที่เข้าเยี่ยม / ใช้บริการ ไม่ใช่วันที่โอนเงิน · {reservations.includeArchive ? 'รวมข้อมูลย้อนหลังที่เก็บถาวร' : 'กำลังดูเฉพาะข้อมูลปัจจุบัน'}{#if !reservations.includeArchive}<button class="ml-2 text-blue-700 underline dark:text-blue-300" onclick={() => { void reservations.toggleArchive().catch(() => {}); }}>รวมข้อมูลย้อนหลัง</button>{/if}</p>
      </section>
      {#if !validRange}<div role="alert" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">เลือกวันที่เริ่มต้นก่อนวันที่สิ้นสุด และช่วงไม่เกิน 366 วัน</div>
      {:else}
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {#each metrics as metric (metric.key)}{@const Icon = metric.icon}{@const change = comparison(metric.value, metric.previous)}
            <article class="management-metric {metric.tone}"><div class="flex items-center justify-between gap-2"><p class="text-xs font-medium text-slate-500 dark:text-slate-400">{metric.label}</p><span class="metric-icon"><Icon class="h-4 w-4" /></span></div><p class="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">{metric.money ? formatBaht(metric.value) : formatNumber(metric.value)}</p><p class="mt-1 text-[11px] text-slate-400">{metric.note}</p><div class="mt-4 border-t border-slate-100 pt-3 text-[11px] tabular-nums text-slate-500 dark:border-slate-800 dark:text-slate-400">{change.percent === null ? metric.value > 0 ? 'ช่วงก่อนหน้าไม่มีข้อมูลเปรียบเทียบ' : 'ไม่มีรายการในทั้งสองช่วง' : `${change.delta > 0 ? '+' : ''}${change.percent}% · ${change.delta > 0 ? '+' : ''}${metric.money ? formatBaht(change.delta) : formatNumber(change.delta)}`}<span class="mt-1 block text-[10px] text-slate-400">เทียบ {visitDateLabel(previous.from)} – {visitDateLabel(previous.to)}</span></div></article>
          {/each}
        </div>
        {#if missingDates || missingAmounts || heldExpired}<p class="rounded-xl border border-slate-200 px-4 py-3 text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">{#if missingDates}ข้อมูลขาดวันที่ที่ใช้คำนวณ {formatNumber(missingDates)} รายการ · {/if}{#if missingAmounts}ยอดเงินไม่สมบูรณ์ในช่วงที่เลือก {formatNumber(missingAmounts)} รายการ · {/if}{#if heldExpired}การจองโต๊ะหมดเวลาชำระ {formatNumber(heldExpired)} รายการ ไม่รวมในคิวงาน{/if}</p>{/if}
        {#if !current.length}<p class="rounded-xl bg-white p-4 text-center text-sm text-slate-500 dark:bg-slate-900">ไม่พบการจองในช่วงวันที่และประเภทที่เลือก</p>{/if}
        <div class="grid gap-5 xl:grid-cols-2">
          <ChartPanel title="การจองตามวันใช้บริการ" description="จำนวนการจองที่ยังมีผล แยก VIS / TBL · ไม่รวมยกเลิกและไม่อนุมัติ" option={bookingOption} empty={!summary.bookings} columns={['วันที่', 'เยี่ยมผู้ต้องขัง', 'จองโต๊ะ']} rows={daily.map(point => ({ label: visitDateLabel(point.date), values: [point.prisoner, point.table] }))} />
          <ChartPanel title="มูลค่าการจองตามวันใช้บริการ" description="ชำระแล้วและรอชำระ · ไม่ใช่กระแสเงินสดตามวันที่โอน" option={moneyOption} empty={summary.paid + summary.pending === 0} columns={['วันที่', 'ชำระแล้ว', 'รอชำระ']} rows={daily.map(point => ({ label: visitDateLabel(point.date), values: [formatBaht(point.paid), formatBaht(point.pending)] }))} />
        </div>
        {#if view === 'analytics'}
          <div class="grid gap-5 xl:grid-cols-2">
            <ChartPanel title="สถานะการจองในช่วงที่เลือก" description="สถานะปัจจุบันของแต่ละรายการ รวมยกเลิกและไม่อนุมัติ" option={statusOption} empty={!states.length} columns={['สถานะ', 'รายการ']} rows={states.map(([label, value]) => ({ label, values: [value] }))} />
            <ChartPanel title="การจองเยี่ยมตามแดนหลัก" description="นับการจองที่ยังมีผลตามแดนของผู้ต้องขังหลัก ไม่ใช่จำนวนผู้ต้องขัง" option={wingOption} empty={!wings.length} columns={['แดนหลัก', 'การจอง']} rows={wings.map(point => ({ label: point.wing, values: [point.count] }))} />
            <ChartPanel title="ผู้เยี่ยมที่ลงทะเบียนแยกตามอายุ" description="จำนวนจากข้อมูลผู้เยี่ยมที่ระบบบันทึก ไม่ใช่การเช็กอินจริง" option={ageOption} empty={!ageRows.some(point => point.value > 0)} columns={['ประเภทผู้เยี่ยม', 'คน']} rows={ageRows.map(point => ({ label: point.label, values: [point.value] }))} />
            <ChartPanel title="มูลค่าการจอง 6 เดือนล่าสุด" description="ช่วงคงที่ 6 เดือนรวมเดือนปัจจุบัน · ตามประเภทที่เลือก · ไม่รวมยกเลิก/ไม่อนุมัติ" option={monthlyOption} empty={!monthly.some(point => point.count > 0)} columns={['เดือน', 'มูลค่าการจอง', 'รายการ']} rows={monthly.map(point => ({ label: point.label, values: [formatBaht(point.revenue), point.count] }))} />
          </div>
          <p class="text-xs text-slate-400">มูลค่าการจองที่ยังมีผลในช่วงที่เลือก {formatBaht(summary.booked)} รวมรายการที่กำลังตรวจสอบ · สถานะเสร็จสิ้นคือการดำเนินงานเสร็จในระบบ</p>
        {/if}
      {/if}

      {#if view === 'overview'}
        <div class="flex flex-wrap items-end justify-between gap-3"><div><p class="text-[10px] font-semibold tracking-widest text-blue-700 dark:text-blue-300">DAILY OPERATIONS</p><h3 class="mt-1 text-lg font-semibold text-slate-900 dark:text-white">คิวงานของคุณ</h3><p class="mt-1 text-xs text-slate-500">ข้อมูลปัจจุบันตามสิทธิ์ของคุณ · เรียงวันใช้บริการใกล้สุดก่อน · ไม่ใช้ตัวกรองสถิติด้านบน</p></div>{#if allowedMenus.includes('reservations')}<a href="#/reservations" class="quick-link">จัดการการจองทั้งหมด <ArrowUpRight class="h-3.5 w-3.5" /></a>{/if}</div>
        {#if queues.length}
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{#each queues as queue (queue.status)}<button class="work-queue-card {selectedQueue?.status === queue.status ? 'active' : ''}" aria-pressed={selectedQueue?.status === queue.status} onclick={() => queueStatus = queue.status}><span class="flex items-center justify-between gap-2 text-xs"><span>{queue.label}</span><ArrowRight class="h-3.5 w-3.5" /></span><span class="mt-3 block text-2xl font-semibold tabular-nums">{formatNumber(queue.rows.length)}</span><span class="mt-1 block text-[11px] opacity-65">{queue.action}</span></button>{/each}</div>
        {/if}
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <Card title={selectedQueue?.label ?? 'ข้อมูลสำหรับบทบาทของคุณ'} subtitle={selectedQueue ? `${formatNumber(selectedQueue.rows.length)} รายการ · ${oldestVisit ? `วันใช้บริการแรก ${visitDateLabel(oldestVisit)}` : 'ไม่มีรายการค้างในคิวนี้'}` : 'บทบาทนี้ไม่มีงานอนุมัติในแดชบอร์ด'} padding={false}>
            {#if selectedQueue?.rows.length}
              <div class="overflow-x-auto"><table class="w-full min-w-[540px] text-left text-xs"><caption class="sr-only">คิวงาน {selectedQueue.label}</caption><thead><tr class="border-b border-slate-100 text-slate-400 dark:border-slate-800"><th scope="col" class="px-5 py-3 font-normal">การจอง / ผู้เยี่ยม</th><th scope="col" class="px-3 py-3 font-normal">วันใช้บริการ</th><th scope="col" class="px-3 py-3 text-right font-normal">มูลค่า</th><th scope="col" class="px-5 py-3 text-right font-normal">ดำเนินการ</th></tr></thead><tbody>{#each selectedQueue.rows.slice(0, 6) as row (row.ref)}<tr class="border-b border-slate-100 last:border-0 dark:border-slate-800"><td class="px-5 py-3"><button class="font-mono font-semibold text-blue-700 hover:underline dark:text-blue-300" onclick={() => detailRow = row}>{row.ref}</button><p class="mt-1 max-w-44 truncate text-slate-600 dark:text-slate-300">{row.visitorName || '—'}</p><p class="mt-0.5 text-[10px] text-slate-400">{bookingPool(row) === 'table' ? 'จองโต๊ะ (TBL)' : 'เยี่ยมผู้ต้องขัง'}</p></td><td class="px-3 py-3 text-slate-600 dark:text-slate-300">{visitDateLabel(row.visitDate, row.visitDateISO)}{#if row.visitDateISO && row.visitDateISO < today}<span class="mt-1 block text-[10px] text-amber-700 dark:text-amber-300">ผ่านวันใช้บริการแล้ว</span>{/if}</td><td class="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatBaht(row.total)}</td><td class="px-5 py-3 text-right"><button class="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200" onclick={() => review(row)}>{selectedQueue.action}</button></td></tr>{/each}</tbody></table></div>
              <div class="border-t border-slate-100 px-5 py-3 dark:border-slate-800"><button class="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300" onclick={() => openList(selectedQueue?.status)}>ดูคิวทั้งหมด {formatNumber(selectedQueue.rows.length)} รายการ <ArrowRight class="h-3.5 w-3.5" /></button></div>
            {:else}<div class="flex min-h-48 flex-col items-center justify-center gap-3 px-5 py-8 text-center"><CheckCircle2 class="h-8 w-8 text-emerald-600" /><p class="text-sm text-slate-600 dark:text-slate-300">{selectedQueue ? 'ไม่มีงานค้างในคิวนี้' : 'ใช้ภาพรวมและสถิติในการติดตามข้อมูล'}</p><p class="text-xs text-slate-400">{selectedQueue ? 'รายการใหม่จะแสดงเมื่อระบบอัปเดตข้อมูล' : 'การอนุมัติเป็นหน้าที่ของเจ้าหน้าที่ตามสิทธิ์'}</p></div>{/if}
          </Card>
          <Card title="การจองที่ยังมีผลวันนี้" subtitle={`${formatNumber(todaysVisits.length)} การจอง · ${formatNumber(todaysVisits.reduce((total, row) => total + peopleCount(row), 0))} คนตามข้อมูลการจอง`}>
            {#if canViewDetail}{#each todaysVisits.slice(0, 5) as row (row.ref)}<button class="flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left last:border-0 dark:border-slate-800" onclick={() => detailRow = row}><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800"><Users class="h-4 w-4" /></span><span class="min-w-0 flex-1"><span class="block truncate text-xs font-medium text-slate-700 dark:text-slate-200">{row.visitorName || row.ref}</span><span class="mt-0.5 block text-[10px] text-slate-400">{row.ref} · {normalizeStatus(row.status)}</span></span><ArrowUpRight class="h-3.5 w-3.5 text-slate-400" /></button>{:else}<p class="py-10 text-center text-sm text-slate-400">ไม่มีการจองที่ยังมีผลในวันนี้</p>{/each}{:else}<div class="flex min-h-32 items-center justify-center gap-3"><CalendarDays class="h-6 w-6 text-slate-400" /><p class="text-sm text-slate-500">{formatNumber(todaysVisits.length)} การจองวันนี้</p></div>{/if}
            {#if allowedMenus.includes('reservations')}<button class="mt-4 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300" onclick={() => openList('', { date: today })}>เปิดการจองวันนี้ <ArrowRight class="h-3.5 w-3.5" /></button>{/if}
          </Card>
        </div>
      {/if}
      {#if allowedMenus.includes('reports')}<a href="#/reports" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900"><span class="flex items-center gap-3"><ClipboardList class="h-5 w-5 text-blue-700 dark:text-blue-300" /><span><span class="block text-sm font-medium text-slate-700 dark:text-slate-200">รายงานและเอกสารสำหรับเจ้าหน้าที่</span><span class="mt-1 block text-xs text-slate-400">ทะเบียนผู้เยี่ยม · ปกครองกลาง · ครัวและเบเกอรี่ · ส่งออกข้อมูล</span></span></span><ArrowUpRight class="h-4 w-4 text-slate-400" /></a>{/if}
    {/if}
  {/if}
</div>

<PaymentApprovalModal open={paymentRow !== null} row={paymentRow} mode={paymentMode} onclose={() => { if (!saving) paymentRow = null; }} onapprove={approvePayment} />
<VisitorApprovalModal open={visitorRow !== null} row={visitorRow} onclose={() => visitorRow = null} />
<ReservationDetailModal open={detailRow !== null && canViewDetail} row={detailRow} {canViewSlip} onclose={() => detailRow = null} />
