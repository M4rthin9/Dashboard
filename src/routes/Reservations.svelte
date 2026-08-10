<script lang="ts">
  import { onMount } from 'svelte';
  import { Archive, Ban, Check, Download, Eye, Pencil, Plus, Printer, RefreshCw, Search, Users, X } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import Modal from '../lib/components/ui/Modal.svelte';
  import Pagination from '../lib/components/ui/Pagination.svelte';
  import StatusSteps from '../lib/components/ui/StatusSteps.svelte';
  import ReservationDetailModal from '../lib/components/ReservationDetailModal.svelte';
  import ReservationFormModal from '../lib/components/ReservationFormModal.svelte';
  import PaymentApprovalModal from '../lib/components/PaymentApprovalModal.svelte';
  import VisitorApprovalModal from '../lib/components/VisitorApprovalModal.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { reservations } from '../lib/store/reservations.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { hasPermission } from '../lib/utils/permissions';
  import { formatBaht, formatNumber, normalizeStatus, STATUS_COLORS, todayISO } from '../lib/utils/format';
  import { exportReservationsCSV } from '../lib/utils/csv';
  import { openPrintWindow, buildSeatingReport } from '../lib/utils/print';
  import { getPrisoners } from '../lib/api/endpoints';
  import type { Prisoner, Reservation } from '../lib/api/types';

  let search = $state('');
  let statusFilter = $state('');
  let dateFilter = $state('');
  let wingFilter = $state('');
  let page = $state(1);
  let pageSize = $state(10);
  let sortKey = $state('timestamp');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let selectedRefs = $state<string[]>([]);
  let cancelMode = $state<'single' | 'bulk' | null>(null);
  let cancelRef = $state('');
  let cancelReason = $state('');
  let batchRunning = $state('');
  let detailRow = $state<Reservation | null>(null);
  let showDetail = $state(false);
  let approvalRow = $state<Reservation | null>(null);
  let showApproval = $state(false);
  let paymentRow = $state<Reservation | null>(null);
  let showPaymentApproval = $state(false);
  let paymentMode = $state<'ชำระแล้ว' | 'เสร็จสิ้น'>('ชำระแล้ว');
  let paymentSaving = $state(false);
  let formMode = $state<'edit' | 'create' | null>(null);
  let formSaving = $state(false);
  let prisoners = $state<Prisoner[]>([]);

  const role = $derived(auth.user?.role ?? 'User');
  const isAdminOrSuper = $derived(role === 'Superadmin' || role === 'Admin');
  const canApproveParticipant = $derived(isAdminOrSuper || hasPermission(role, 'approve_participant'));
  const canApproveDiscipline = $derived(isAdminOrSuper || hasPermission(role, 'approve_discipline'));
  const canConfirmPayment = $derived(isAdminOrSuper || hasPermission(role, 'confirm_payment'));
  const canCancel = $derived(isAdminOrSuper || role === 'Vinai' || hasPermission(role, 'cancel'));
  const canReject = $derived(isAdminOrSuper || role === 'Vinai' || hasPermission(role, 'reject') || hasPermission(role, 'reject_discipline'));
  const canEdit = $derived(role === 'Superadmin');
  const canViewSlip = $derived(hasPermission(role, 'view_slip'));
  const canVisitorApproval = $derived(isAdminOrSuper || hasPermission(role, 'visitor_approval'));
  const canPrint = $derived(isAdminOrSuper || hasPermission(role, 'print'));

  const roleStatusFilter: Record<string, string[] | null> = {
    Superadmin: null,
    Admin: null,
    Finance: ['รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'],
    Tadtel: ['รอตรวจสอบผู้เข้าร่วม', 'รอตรวจสอบ'],
    Vinai: null,
    User: null,
  };

  const statuses = $derived(
    Array.from(new Set(reservations.rows.map((r) => normalizeStatus(r.status)).filter(Boolean))).sort()
  );
  const dates = $derived(
    Array.from(new Set(reservations.rows.map((r) => String(r.visitDateISO ?? '').trim()).filter(Boolean))).sort().reverse()
  );
  const wings = $derived(
    Array.from(new Set(reservations.rows.map((r) => String(r.wing ?? '').trim()).filter(Boolean))).sort()
  );

  function isExpired(row: Reservation): boolean {
    const iso = String(row.visitDateISO ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    return iso < todayISO();
  }

  const filtered = $derived.by(() => {
    const allowed = roleStatusFilter[role] ?? null;
    const q = search.trim().toLowerCase();
    return reservations.rows.filter((r) => {
      if (!r.ref || String(r.ref).trim() === '') return false;
      if (r._archived && !reservations.includeArchive) return false;
      if (role === 'Vinai' && isExpired(r)) return false;
      if (allowed) {
        const s = normalizeStatus(r.status);
        if (!allowed.includes(s)) return false;
      }
      if (statusFilter && normalizeStatus(r.status) !== statusFilter) return false;
      if (dateFilter && String(r.visitDateISO ?? '').trim() !== dateFilter) return false;
      if (wingFilter && String(r.wing ?? '').trim() !== wingFilter) return false;
      if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
      return true;
    });
  });

  function sortValue(row: Reservation, key: string): unknown {
    if (key === 'timestamp') return row.timestamp ?? row.createdAt ?? row.updatedAt ?? '';
    return row[key];
  }

  const sorted = $derived.by(() => {
    const rows = filtered.slice();
    rows.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp =
        typeof av === 'number' || typeof bv === 'number'
          ? (Number(av) || 0) - (Number(bv) || 0)
          : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  });

  const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / pageSize)));
  const pagedRows = $derived(sorted.slice((page - 1) * pageSize, page * pageSize));

  const daySummary = $derived(dateFilter ? reservations.daySummary(dateFilter) : null);

  $effect(() => {
    if (page > totalPages) page = totalPages;
  });

  $effect(() => {
    if (dateFilter && dates.length > 0 && !dates.includes(dateFilter)) {
      dateFilter = '';
    }
  });

  onMount(() => {
    reservations.load();
    getPrisoners()
      .then((res) => {
        prisoners = res.prisoners ?? [];
      })
      .catch(() => {
        prisoners = [];
      });
  });

  function toggleSort(key: string): void {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'desc';
    }
  }

  function sortIcon(key: string): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function toggleSelect(ref: string): void {
    if (selectedRefs.includes(ref)) {
      selectedRefs = selectedRefs.filter((r) => r !== ref);
    } else {
      selectedRefs = [...selectedRefs, ref];
    }
  }

  function clearSelection(): void {
    selectedRefs = [];
  }

  async function doUpdateStatus(row: Reservation, newStatus: string): Promise<void> {
    const name = String(row.visitorName ?? row.ref ?? '');
    if (!window.confirm(`ยืนยันเปลี่ยนสถานะของ "${name}" เป็น "${newStatus}" ?`)) return;
    try {
      await reservations.updateStatus(row.ref, newStatus);
      ui.showAlert({ title: 'เปลี่ยนสถานะการจองสำเร็จ', message: `${name} · ${row.ref} → ${newStatus}`, type: 'success' });
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถเปลี่ยนสถานะได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    }
  }

  function openCancelSingle(row: Reservation): void {
    cancelMode = 'single';
    cancelRef = row.ref;
    cancelReason = '';
  }

  function openCancelBulk(): void {
    if (selectedRefs.length === 0) return;
    cancelMode = 'bulk';
    cancelRef = '';
    cancelReason = '';
  }

  function closeCancel(): void {
    cancelMode = null;
    cancelReason = '';
  }

  async function submitCancel(): Promise<void> {
    const reason = cancelReason.trim();
    if (!reason) {
      ui.showAlert({ title: 'กรุณาระบุเหตุผลในการยกเลิก', message: 'ต้องระบุเหตุผลก่อนยืนยันการยกเลิก', type: 'error' });
      return;
    }
    let refs = cancelMode === 'bulk' ? selectedRefs : [cancelRef];
    const allRows = reservations.rows.filter((r) => refs.includes(r.ref));
    const expired = allRows.filter((r) => isExpired(r));
    refs = refs.filter((ref) => !expired.some((r) => r.ref === ref));
    if (expired.length > 0 && refs.length === 0) {
      closeCancel();
      if (cancelMode === 'bulk') clearSelection();
      ui.showAlert({ title: 'ไม่สามารถยกเลิกได้', message: 'หมดวันเข้างานแล้ว ไม่สามารถยกเลิกได้', type: 'error' });
      return;
    }
    let success = 0;
    for (const ref of refs) {
      try {
        await reservations.cancelBooking(ref, reason);
        success++;
      } catch {
        // keep going; report failures at the end
      }
    }
    closeCancel();
    if (cancelMode === 'bulk') clearSelection();
    if (success > 0) {
      const skipNote = expired.length > 0 ? ` (ข้าม ${expired.length} รายการที่หมดวัน)` : '';
      ui.showAlert({
        title: 'ยกเลิกการจองสำเร็จ',
        message: `ยกเลิกสำเร็จ ${success}/${refs.length + expired.length} รายการ${skipNote}`,
        type: success === refs.length ? 'success' : 'warning',
      });
    } else {
      ui.showAlert({ title: 'ไม่สามารถยกเลิกการจองได้', message: 'กรุณาลองใหม่อีกครั้ง', type: 'error' });
    }
  }

  async function runBatch(nextStatus: string): Promise<void> {
    if (!dateFilter) return;
    const target = normalizeStatus(nextStatus);
    const batch = filtered.filter((r) => !r._archived && normalizeStatus(r.status) === (target === 'รอตรวจสอบวินัย' ? 'รอตรวจสอบผู้เข้าร่วม' : 'รอตรวจสอบวินัย'));
    if (batch.length === 0) return;
    const label = target === 'รอตรวจสอบวินัย' ? 'อนุมัติผู้เข้าร่วม' : 'อนุมัติวินัย';
    if (!window.confirm(`${label}ทั้งหมด ${batch.length} รายการสำหรับวันนี้?`)) return;
    batchRunning = label;
    let success = 0;
    for (const row of batch) {
      try {
        await reservations.updateStatus(row.ref, target);
        success++;
      } catch {
        // continue
      }
    }
    batchRunning = '';
    ui.showAlert({
      title: `${label}เสร็จสิ้น`,
      message: `${label}สำเร็จ ${success}/${batch.length} รายการ`,
      type: success > 0 ? 'success' : 'error',
    });
  }

  function doExport(): void {
    if (sorted.length === 0) {
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีข้อมูลตาม filter ที่เลือก', type: 'warning' });
      return;
    }
    exportReservationsCSV(sorted);
    ui.showAlert({ title: 'ส่งออกไฟล์ CSV สำเร็จ', message: `ส่งออก ${sorted.length} รายการเรียบร้อย`, type: 'success' });
  }

  function doPrint(): void {
    if (sorted.length === 0) {
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีข้อมูลตาม filter ที่เลือก', type: 'warning' });
      return;
    }
    const rows = sorted.slice().sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
    const printerName = auth.user?.displayName || auth.user?.username || 'ไม่ระบุ';
    const ok = openPrintWindow(buildSeatingReport(rows), 'รายงานการจัดโต๊ะ', printerName);
    if (!ok) ui.showAlert({ title: 'กรุณาอนุญาต Popup', message: 'กรุณาอนุญาต Popup เพื่อเปิดหน้าพิมพ์', type: 'warning' });
  }

  function openDetail(row: Reservation): void {
    detailRow = row;
    showDetail = true;
  }

  function closeDetail(): void {
    showDetail = false;
    detailRow = null;
  }

  function openApproval(row: Reservation): void {
    approvalRow = row;
    showApproval = true;
  }

  function closeApproval(): void {
    showApproval = false;
    approvalRow = null;
  }

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
        message: `${row.visitorName} · ${row.ref} สถานะเป็น "${paymentMode}"`,
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

  function openEdit(row: Reservation): void {
    detailRow = row;
    formMode = 'edit';
    formSaving = false;
  }

  function openCreate(): void {
    detailRow = null;
    formMode = 'create';
    formSaving = false;
  }

  function closeForm(): void {
    if (formSaving) return;
    formMode = null;
    detailRow = null;
  }

  async function submitForm(fields: Record<string, unknown>): Promise<void> {
    formSaving = true;
    try {
      if (formMode === 'edit' && detailRow) {
        await reservations.updateBooking(detailRow.ref, fields);
        ui.showAlert({
          title: 'บันทึกการแก้ไขสำเร็จ',
          message: `${detailRow.ref} · ${String(fields.prisonerName ?? '')} / ${String(fields.visitorName ?? '')}`,
          type: 'success',
        });
      } else if (formMode === 'create') {
        const ref = await reservations.createBooking(fields);
        ui.showAlert({
          title: 'สร้างการจองสำเร็จ',
          message: [
            `เลขที่การจอง: ${ref}`,
            `ผู้เยี่ยม: ${String(fields.visitorName ?? '')}`,
            `ผู้ต้องขัง: ${String(fields.prisonerName ?? '')}`,
            `ปีก: ${String(fields.wing ?? '')}`,
            `วันเข้างาน: ${String(fields.visitDate ?? fields.visitDateISO ?? '')}`,
            `จำนวน: ${formatNumber(Number(fields.visitorCount) || 0)} คน · ${formatBaht(Number(fields.total) || 0)}`,
          ].join('\n'),
          type: 'success',
        });
      }
      formSaving = false;
      closeForm();
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถบันทึกได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      formSaving = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="ระบบจอง" subtitle="ตารางการจองทั้งหมด" interactive>
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            bind:value={search}
            placeholder="ค้นหาชื่อผู้เยี่ยม, ผู้ต้องขัง, REF, ปีก, เบอร์โทร"
            class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <select
          bind:value={statusFilter}
          class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามสถานะ"
        >
          <option value="">ทุกสถานะ</option>
          {#each statuses as s (s)}
            <option value={s}>{s}</option>
          {/each}
        </select>

        <select
          bind:value={dateFilter}
          class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามวันที่"
        >
          <option value="">ทุกวัน</option>
          {#each dates as d (d)}
            <option value={d}>{d}</option>
          {/each}
        </select>

        <select
          bind:value={wingFilter}
          class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามปีก"
        >
          <option value="">ทุกปีก</option>
          {#each wings as w (w)}
            <option value={w}>{w}</option>
          {/each}
        </select>

        <button
          class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onclick={() => reservations.toggleArchive()}
          title={reservations.includeArchive ? 'ซ่อนข้อมูลย้อนหลัง' : 'แสดงข้อมูลย้อนหลัง'}
        >
          <Archive class="h-4 w-4" />
          {reservations.includeArchive ? 'รวมย้อนหลัง' : 'ปัจจุบัน'}
        </button>

        <button
          class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onclick={() => reservations.refresh()}
          disabled={reservations.loading}
          aria-label="โหลดข้อมูลใหม่"
        >
          <RefreshCw class="h-4 w-4 {reservations.loading ? 'animate-spin' : ''}" />
          รีเฟรช
        </button>

        <button
          class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
          onclick={doExport}
          disabled={sorted.length === 0}
        >
          <Download class="h-4 w-4" />
          ส่งออก CSV
        </button>

        {#if canPrint}
          <button
            class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            onclick={doPrint}
            disabled={sorted.length === 0}
            title="พิมพ์รายงานการจัดโต๊ะตามตัวกรองปัจจุบัน"
          >
            <Printer class="h-4 w-4" />
            พิมพ์รายงาน
          </button>
        {/if}

        {#if isAdminOrSuper}
          <button
            class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2"
            onclick={openCreate}
          >
            <Plus class="h-4 w-4" />
            สร้างการจอง
          </button>
        {/if}
      </div>

      {#if daySummary && Object.keys(daySummary.counts).length > 0}
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          {#each Object.entries(daySummary.counts) as [s, c] (s)}
            <div class="flex items-center gap-1.5 text-sm">
              <span class="h-2.5 w-2.5 rounded-full" style="background:{STATUS_COLORS[s] ?? '#94a3b8'}"></span>
              <span class="font-semibold text-slate-700 dark:text-slate-200">{c}</span>
              <span class="text-slate-500 dark:text-slate-400">{s}</span>
            </div>
          {/each}
          <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">
            รวม {formatBaht(daySummary.totalAmount)}
          </div>
          {#if daySummary.pendingParticipant > 0 && canApproveParticipant}
            <button
              class="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-600 focus-visible:outline-offset-2"
              onclick={() => runBatch('รอตรวจสอบวินัย')}
              disabled={batchRunning !== ''}
            >
              <Check class="h-3.5 w-3.5" />
              อนุมัติผู้เข้าร่วมทั้งหมด ({daySummary.pendingParticipant})
            </button>
          {/if}
          {#if daySummary.pendingDiscipline > 0 && canApproveDiscipline}
            <button
              class="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
              onclick={() => runBatch('รอชำระเงิน')}
              disabled={batchRunning !== ''}
            >
              <Check class="h-3.5 w-3.5" />
              อนุมัติวินัยทั้งหมด ({daySummary.pendingDiscipline})
            </button>
          {/if}
          {#if batchRunning}
            <span class="text-xs text-slate-500 dark:text-slate-400">{batchRunning}...</span>
          {/if}
        </div>
      {/if}

      {#if selectedRefs.length > 0}
        <div class="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/40">
          <span class="text-sm font-medium text-indigo-700 dark:text-indigo-300">เลือก {selectedRefs.length} รายการ</span>
          <div class="flex items-center gap-2">
            {#if canCancel}
              <button
                class="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-2"
                onclick={openCancelBulk}
              >
                <Ban class="h-3.5 w-3.5" />
                ยกเลิกทั้งหมด
              </button>
            {/if}
            <button class="text-xs font-medium text-slate-500 underline hover:text-slate-700 dark:text-slate-400" onclick={clearSelection}>
              ล้างการเลือก
            </button>
          </div>
        </div>
      {/if}

      {#if reservations.loading && reservations.rows.length === 0}
        <div class="flex items-center justify-center py-16">
          <Spinner />
        </div>
      {:else if reservations.error && reservations.rows.length === 0}
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {reservations.error}
          <button class="ml-2 font-medium underline" onclick={() => reservations.refresh()}>ลองใหม่</button>
        </div>
      {:else}
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table class="w-full min-w-[860px] table-fixed text-left text-sm">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/50">
                <th class="w-8 px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    aria-label="เลือกทั้งหมด"
                    checked={selectedRefs.length > 0 && selectedRefs.length === pagedRows.filter((r) => !r._archived).length}
                    onchange={() => {
                      const selectable = pagedRows.filter((r) => !r._archived).map((r) => r.ref);
                      const allSelected = selectable.length > 0 && selectable.every((ref) => selectedRefs.includes(ref));
                      selectedRefs = allSelected ? selectedRefs.filter((r) => !selectable.includes(r)) : [...new Set([...selectedRefs, ...selectable])];
                    }}
                  />
                </th>
                <th class="cursor-pointer px-3 py-2.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('ref')}>REF{sortIcon('ref')}</th>
                <th class="cursor-pointer px-3 py-2.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('prisonerName')}>ผู้ต้องขัง / ผู้เยี่ยม{sortIcon('prisonerName')}</th>
                <th class="cursor-pointer px-3 py-2.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('wing')}>ปีก{sortIcon('wing')}</th>
                <th class="cursor-pointer px-3 py-2.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('visitDateISO')}>วันที่{sortIcon('visitDateISO')}</th>
                <th class="cursor-pointer px-3 py-2.5 text-right font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('total')}>ยอด{sortIcon('total')}</th>
                <th class="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">สถานะ</th>
                <th class="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">ความคืบหน้า</th>
                <th class="px-3 py-2.5 text-right font-medium text-slate-700 dark:text-slate-300">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {#each pagedRows as row (row.ref)}
                {@const s = normalizeStatus(row.status)}
                {@const archived = !!row._archived}
                {@const terminal = s === 'เสร็จสิ้น' || s === 'ไม่อนุมัติ' || s === 'ยกเลิก'}
                {@const expired = isExpired(row)}
                <tr class="border-b border-slate-200 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30 {archived ? 'opacity-60' : ''}">
                  <td class="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      aria-label="เลือกแถว"
                      checked={selectedRefs.includes(row.ref)}
                      disabled={archived}
                      onchange={() => toggleSelect(row.ref)}
                      class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                    />
                  </td>
                  <td class="px-3 py-2.5">
                    <button
                      class="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                      onclick={() => openDetail(row)}
                      title="ดูรายละเอียด"
                    >
                      {row.ref}
                    </button>
                    {#if archived}
                      <span class="ml-1 text-[10px] text-slate-400">🗄️</span>
                    {/if}
                  </td>
                  <td class="px-3 py-2.5">
                    <div class="font-semibold text-slate-800 dark:text-slate-100">{row.prisonerName ?? '—'}</div>
                    <div class="text-[11px] text-slate-400">#{row.prisonerId ?? ''}</div>
                    <div class="mt-0.5 border-t border-dashed border-slate-200 pt-0.5 text-[13px] dark:border-slate-700">
                      {row.visitorName ?? ''}
                      {#if row.visitorPhone}<span class="ml-1 text-[11px] text-slate-400">{row.visitorPhone}</span>{/if}
                    </div>
                  </td>
                  <td class="px-3 py-2.5 font-medium">{row.wing ?? '—'}</td>
                  <td class="px-3 py-2.5 whitespace-nowrap">{row.visitDateISO ?? row.visitDate ?? '—'}</td>
                  <td class="px-3 py-2.5 text-right whitespace-nowrap">
                    <div>{formatNumber(row.visitorCount)} คน</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">{formatBaht(row.total)}</div>
                  </td>
                  <td class="px-3 py-2.5 whitespace-nowrap">
                    <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium {(() => {
                      switch (s) {
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
                      {s}
                    </span>
                  </td>
                  <td class="px-3 py-2.5">
                    <StatusSteps status={row.status} />
                  </td>
                  <td class="px-3 py-2.5">
                    {#if !archived}
                      <div class="flex items-center justify-end gap-1.5">
                        {#if s === 'รอตรวจสอบผู้เข้าร่วม' && canApproveParticipant}
                          <button class="rounded-xl border border-green-200 bg-white p-1.5 text-green-600 hover:bg-green-50 dark:border-green-900 dark:bg-slate-800 dark:hover:bg-green-950/30" title="อนุมัติผู้เข้าร่วม" onclick={() => doUpdateStatus(row, 'รอตรวจสอบวินัย')}>
                            <Check class="h-4 w-4" />
                          </button>
                          {#if canReject && !expired}
                            <button class="rounded-xl border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:hover:bg-red-950/30" title="ปฏิเสธ" onclick={() => doUpdateStatus(row, 'ไม่อนุมัติ')}>
                              <X class="h-4 w-4" />
                            </button>
                          {/if}
                        {/if}
                        {#if s === 'รอตรวจสอบวินัย' && canApproveDiscipline}
                          <button class="rounded-xl border border-green-200 bg-white p-1.5 text-green-600 hover:bg-green-50 dark:border-green-900 dark:bg-slate-800 dark:hover:bg-green-950/30" title="อนุมัติวินัย" onclick={() => doUpdateStatus(row, 'รอชำระเงิน')}>
                            <Check class="h-4 w-4" />
                          </button>
                          {#if canReject && !expired}
                            <button class="rounded-xl border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:hover:bg-red-950/30" title="ปฏิเสธวินัย" onclick={() => doUpdateStatus(row, 'ไม่อนุมัติ')}>
                              <X class="h-4 w-4" />
                            </button>
                          {/if}
                        {/if}
                        {#if s === 'รอชำระเงิน' && canConfirmPayment}
                          <button class="rounded-xl bg-indigo-600 p-1.5 text-white hover:bg-indigo-700" title="ยืนยันชำระเงิน" onclick={() => openPaymentApproval(row, 'ชำระแล้ว')}>
                            <Check class="h-4 w-4" />
                          </button>
                        {/if}
                        {#if s === 'ชำระแล้ว' && canConfirmPayment}
                          <button class="rounded-xl bg-green-600 p-1.5 text-white hover:bg-green-700" title="เสร็จสิ้น" onclick={() => openPaymentApproval(row, 'เสร็จสิ้น')}>
                            <Check class="h-4 w-4" />
                          </button>
                        {/if}
                        {#if !terminal && canCancel && s !== 'ยกเลิก' && !expired}
                          <button class="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700" title="ยกเลิก" onclick={() => openCancelSingle(row)}>
                            <Ban class="h-4 w-4" />
                          </button>
                        {/if}
                        {#if canReject && role === 'Vinai' && !terminal && s !== 'ยกเลิก' && !expired}
                          <button class="rounded-xl border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:hover:bg-red-950/30" title="ปฏิเสธ" onclick={() => doUpdateStatus(row, 'ไม่อนุมัติ')}>
                            <X class="h-4 w-4" />
                          </button>
                        {/if}
                        {#if canEdit && !archived && !terminal}
                          <button class="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700" title="แก้ไข" onclick={() => openEdit(row)}>
                            <Pencil class="h-4 w-4" />
                          </button>
                        {/if}
                        {#if canVisitorApproval && !archived && !terminal}
                          <button class="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700" title="ตรวจสอบผู้เข้าร่วม" onclick={() => openApproval(row)}>
                            <Users class="h-4 w-4" />
                          </button>
                        {/if}
                        <button
                          class="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                          title="ดูรายละเอียด"
                          onclick={() => openDetail(row)}
                        >
                          <Eye class="h-4 w-4" />
                        </button>
                      </div>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          {#if sorted.length === 0}
            <div class="py-12 text-center text-sm text-slate-400 dark:text-slate-500">ไม่พบข้อมูล</div>
          {/if}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            แสดง {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, sorted.length)} จาก {sorted.length} รายการ
          </p>
          <div class="flex items-center gap-2">
            <select
              bind:value={pageSize}
              class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              aria-label="จำนวนรายการต่อหน้า"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <Pagination {page} {totalPages} onchange={(p) => (page = p)} />
          </div>
        </div>
      {/if}
    </div>
  </Card>
</div>

<Modal open={cancelMode !== null} title="ยกเลิกการจอง" onclose={closeCancel}>
  <div class="flex flex-col gap-4">
    <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {#if cancelMode === 'bulk'}
        กำลังยกเลิก {selectedRefs.length} รายการที่เลือก
      {:else}
        Ref: <span class="font-mono font-semibold">{cancelRef}</span>
      {/if}
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="cancel-reason" class="text-sm font-medium text-slate-700 dark:text-slate-300">
        เหตุผลที่ยกเลิก <span class="text-red-500">*</span>
      </label>
      <textarea
        id="cancel-reason"
        bind:value={cancelReason}
        rows="3"
        placeholder="ระบุเหตุผล..."
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      ></textarea>
    </div>
    <div class="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-slate-700">
      <button class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={closeCancel}>
        กลับ
      </button>
      <button class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-2" onclick={submitCancel}>
        ยืนยันยกเลิก
      </button>
    </div>
  </div>
</Modal>

<ReservationDetailModal open={showDetail} row={detailRow} onclose={closeDetail} {canViewSlip} />

<PaymentApprovalModal
  open={showPaymentApproval}
  row={paymentRow}
  mode={paymentMode}
  onclose={closePaymentApproval}
  onapprove={approvePayment}
/>

<VisitorApprovalModal open={showApproval} row={approvalRow} onclose={closeApproval} />

<ReservationFormModal
  open={formMode !== null}
  mode={formMode ?? 'create'}
  row={formMode === 'edit' ? detailRow : null}
  {prisoners}
  onclose={closeForm}
  onsubmit={submitForm}
  saving={formSaving}
  width="max-w-3xl"
/>
