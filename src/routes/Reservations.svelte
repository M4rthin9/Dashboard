<script lang="ts">
  import { onMount } from 'svelte';
  import { Archive, Ban, Check, Download, Eye, Pencil, Plus, Printer, QrCode, RotateCcw, RefreshCw, Search, Trash2, Users, X } from '@lucide/svelte';
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
  import { currentQuery } from '../lib/router';
  import { formatBaht, formatNumber, normalizeStatus, STATUS_COLORS, todayISO, visitDateLabel } from '../lib/utils/format';
  import { exportReservationsCSV } from '../lib/utils/csv';
  import { openPrintWindow, buildSeatingReport, buildPromptPayQrCard } from '../lib/utils/print';
  import { getPrisoners, generatePromptPayQr } from '../lib/api/endpoints';
  import type { Prisoner, Reservation } from '../lib/api/types';

  let search = $state('');
  let statusFilter = $state('');
  let dateFilter = $state('');
  let wingFilter = $state('');
  /** '' = both pools, 'prisoner' = visit bookings, 'table' = no-prisoner tables. */
  let typeFilter = $state('');
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
  let deleteTarget = $state<Reservation | null>(null);
  let deleting = $state(false);
  let revertTarget = $state<Reservation | null>(null);
  let reverting = $state(false);
  let qrPrinting = $state('');

  const role = $derived(auth.user?.role ?? 'User');
  const isSuper = $derived(role === 'Superadmin');
  const isAdminOrSuper = $derived(role === 'Superadmin' || role === 'Admin');
  const canApproveParticipant = $derived(isAdminOrSuper || hasPermission(role, 'approve_participant'));
  const canApproveDiscipline = $derived(isAdminOrSuper || hasPermission(role, 'approve_discipline'));
  const canConfirmPayment = $derived(isAdminOrSuper || hasPermission(role, 'confirm_payment'));
  const canCancel = $derived(isAdminOrSuper || role === 'Vinai' || hasPermission(role, 'cancel'));
  const canReject = $derived(isAdminOrSuper || role === 'Vinai' || hasPermission(role, 'reject') || hasPermission(role, 'reject_discipline'));
  const canEdit = $derived(role === 'Superadmin');
  const canDelete = $derived(role === 'Superadmin');
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

  /** Legacy rows predate the column and are always prisoner visits. */
  function bookingTypeOf(row: Reservation): string {
    return String(row.bookingType ?? '').trim() || 'prisoner';
  }
  const isTableBooking = (row: Reservation) => bookingTypeOf(row) === 'table';

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
      if (typeFilter && bookingTypeOf(r) !== typeFilter) return false;
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
    const qStatus = currentQuery().get('status');
    if (qStatus) statusFilter = qStatus;
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

  function statusBadgeClass(s: string): string {
    switch (s) {
      case 'รอตรวจสอบผู้เข้าร่วม': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      case 'รอตรวจสอบวินัย': return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
      case 'รอชำระเงิน': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      case 'ชำระแล้ว': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      case 'เสร็จสิ้น': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
      case 'ไม่อนุมัติ': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
      case 'ยกเลิก': return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
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

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    const ref = deleteTarget.ref;
    deleting = true;
    try {
      await reservations.deleteBooking(ref);
      ui.showAlert({ title: 'ลบการจองสำเร็จ', message: `ลบการจอง ${ref} ออกจากระบบเรียบร้อย`, type: 'success' });
      deleteTarget = null;
      selectedRefs = selectedRefs.filter((r) => r !== ref);
    } catch (err) {
      ui.showAlert({
        title: 'ไม่สามารถลบการจองได้',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        type: 'error',
      });
    } finally {
      deleting = false;
    }
  }

  /** Rewind a mistaken slip upload back to awaiting-payment (Superadmin). The
   *  server clears the stored slip and its verification data, so the visitor
   *  can upload the correct one through the normal payment flow. */
  async function confirmRevert(): Promise<void> {
    if (!revertTarget) return;
    const ref = revertTarget.ref;
    const name = String(revertTarget.visitorName ?? '');
    reverting = true;
    try {
      await reservations.revertBookingPayment(ref);
      ui.showAlert({
        title: 'ย้อนสถานะสำเร็จ',
        message: `${name} · ${ref} กลับไปเป็น "รอชำระเงิน" แล้ว ผู้เยี่ยมสามารถอัปโหลดสลิปใหม่ได้`,
        type: 'success',
      });
      revertTarget = null;
    } catch (err) {
      ui.showAlert({
        title: 'ไม่สามารถย้อนสถานะได้',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        type: 'error',
      });
    } finally {
      reverting = false;
    }
  }

  /** Print the booking's PromptPay card for offline payment. The QR is minted by
   *  the worker from the booking's own total, so it stays correct even while the
   *  online payment window is closed. */
  async function printPaymentQr(row: Reservation): Promise<void> {
    if (qrPrinting) return;
    qrPrinting = row.ref;
    try {
      const res = await generatePromptPayQr({ ref: row.ref });
      if (res.status !== 'ok' || !res.qrCardSvg) {
        ui.showAlert({
          title: 'ไม่สามารถสร้าง QR ได้',
          message: String(res.message ?? 'เกิดข้อผิดพลาดในการสร้าง QR ชำระเงิน'),
          type: 'error',
        });
        return;
      }
      const amount = Number(res.amount ?? row.total ?? 0);
      const content = buildPromptPayQrCard(row, res.qrCardSvg, amount);
      if (!openPrintWindow(content, `QR ชำระเงิน ${row.ref}`, auth.user?.displayName ?? '')) {
        ui.showAlert({ title: 'เปิดหน้าต่างพิมพ์ไม่ได้', message: 'กรุณาอนุญาต pop-up ของเบราว์เซอร์', type: 'error' });
      }
    } catch (err) {
      ui.showAlert({
        title: 'ไม่สามารถสร้าง QR ได้',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        type: 'error',
      });
    } finally {
      qrPrinting = '';
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
    // Superadmin cancels through the forced updateStatus path, which the
    // backend allows on expired/archived/any-status bookings — no skip list.
    const expired = isSuper ? [] : allRows.filter((r) => isExpired(r));
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
        if (isSuper) await reservations.updateStatus(ref, 'ยกเลิก', reason);
        else await reservations.cancelBooking(ref, reason);
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
    const printRows = filtered.filter((r) => normalizeStatus(r.status) === 'เสร็จสิ้น');
    if (printRows.length === 0) {
      ui.showAlert({ title: 'ไม่มีข้อมูล', message: 'ไม่มีรายการสถานะ เสร็จสิ้น ตาม filter ที่เลือก', type: 'warning' });
      return;
    }
    const rows = printRows.slice().sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
    const printerName = auth.user?.displayName || auth.user?.username || 'ไม่ระบุ';
    const filterParts: string[] = [];
    if (dateFilter) filterParts.push(`วันที่ ${visitDateLabel(dateFilter)}`);
    else filterParts.push('ทุกวัน');
    if (wingFilter) filterParts.push(`แดน ${wingFilter}`);
    if (typeFilter) filterParts.push(`ประเภท ${typeFilter === 'table' ? 'จองโต๊ะ' : 'เยี่ยมผู้ต้องขัง'}`);
    if (search.trim()) filterParts.push(`ค้นหา "${search.trim()}"`);
    filterParts.push('สถานะ เสร็จสิ้น');
    const filterLabel = filterParts.length > 0 ? `ตัวกรอง: ${filterParts.join(' · ')}` : undefined;
    const ok = openPrintWindow(buildSeatingReport(rows, filterLabel), 'รายงานการจัดโต๊ะ (เสร็จสิ้น)', printerName);
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
        const fieldsForBooking: Record<string, unknown> = { ...fields };
        const newStatus = typeof fieldsForBooking.status === 'string' ? fieldsForBooking.status : '';
        delete fieldsForBooking.status;
        const statusChanged = newStatus && normalizeStatus(detailRow.status) !== newStatus;
        await reservations.updateBooking(detailRow.ref, fieldsForBooking);
        if (statusChanged) await reservations.updateStatus(detailRow.ref, newStatus);
        ui.showAlert({
          title: 'บันทึกการแก้ไขสำเร็จ',
          message: `${detailRow.ref} · ${String(fieldsForBooking.prisonerName ?? '')} / ${String(fieldsForBooking.visitorName ?? '')}${statusChanged ? ` · สถานะ → ${newStatus}` : ''}`,
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
            `วันเข้างาน: ${visitDateLabel(String(fields.visitDate ?? ''), String(fields.visitDateISO ?? ''))}`,
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

{#snippet rowActions(row: Reservation, s: string, terminal: boolean, expired: boolean)}
  {#if s === 'รอตรวจสอบผู้เข้าร่วม' && canApproveParticipant}
    <button class="shrink-0 rounded-xl border border-green-200 bg-white p-1.5 text-green-600 hover:bg-green-50 dark:border-green-900 dark:bg-slate-800 dark:hover:bg-green-950/30" title="อนุมัติผู้เข้าร่วม" onclick={() => doUpdateStatus(row, 'รอตรวจสอบวินัย')}>
      <Check class="h-4 w-4" />
    </button>
    {#if canReject && (!expired || isSuper)}
      <button class="shrink-0 rounded-xl border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:hover:bg-red-950/30" title="ปฏิเสธ" onclick={() => doUpdateStatus(row, 'ไม่อนุมัติ')}>
        <X class="h-4 w-4" />
      </button>
    {/if}
  {/if}
  {#if s === 'รอตรวจสอบวินัย' && canApproveDiscipline}
    <button class="shrink-0 rounded-xl border border-green-200 bg-white p-1.5 text-green-600 hover:bg-green-50 dark:border-green-900 dark:bg-slate-800 dark:hover:bg-green-950/30" title="อนุมัติวินัย" onclick={() => doUpdateStatus(row, 'รอชำระเงิน')}>
      <Check class="h-4 w-4" />
    </button>
    {#if canReject && (!expired || isSuper)}
      <button class="shrink-0 rounded-xl border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:hover:bg-red-950/30" title="ปฏิเสธวินัย" onclick={() => doUpdateStatus(row, 'ไม่อนุมัติ')}>
        <X class="h-4 w-4" />
      </button>
    {/if}
  {/if}
  {#if s === 'รอชำระเงิน' && canConfirmPayment}
    <button class="shrink-0 rounded-xl bg-blue-700 p-1.5 text-white hover:bg-blue-800" title="ยืนยันชำระเงิน" onclick={() => openPaymentApproval(row, 'ชำระแล้ว')}>
      <Check class="h-4 w-4" />
    </button>
  {/if}
  {#if s === 'ชำระแล้ว' && canConfirmPayment}
    <button class="shrink-0 rounded-xl bg-green-600 p-1.5 text-white hover:bg-green-700" title="เสร็จสิ้น" onclick={() => openPaymentApproval(row, 'เสร็จสิ้น')}>
      <Check class="h-4 w-4" />
    </button>
  {/if}
  {#if canCancel && s !== 'ยกเลิก' && (isSuper || (!terminal && !expired && !row._archived))}
    <button class="shrink-0 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700" title="ยกเลิก" onclick={() => openCancelSingle(row)}>
      <Ban class="h-4 w-4" />
    </button>
  {/if}
  {#if canReject && role === 'Vinai' && !terminal && s !== 'ยกเลิก' && !expired}
    <button class="shrink-0 rounded-xl border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:hover:bg-red-950/30" title="ปฏิเสธ" onclick={() => doUpdateStatus(row, 'ไม่อนุมัติ')}>
      <X class="h-4 w-4" />
    </button>
  {/if}
  {#if canEdit}
    <button class="shrink-0 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700" title={row._archived ? 'แก้ไข (ย้อนหลัง)' : 'แก้ไข'} onclick={() => openEdit(row)}>
      <Pencil class="h-4 w-4" />
    </button>
  {/if}
  {#if canVisitorApproval && !row._archived && !terminal}
    <button class="shrink-0 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700" title="ตรวจสอบผู้เข้าร่วม" onclick={() => openApproval(row)}>
      <Users class="h-4 w-4" />
    </button>
  {/if}
  {#if (canPrint || canConfirmPayment) && !row._archived}
    <button class="shrink-0 rounded-xl border border-blue-200 bg-white p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:bg-slate-800 dark:hover:bg-blue-950/30" title="พิมพ์ QR ชำระเงิน" disabled={qrPrinting === row.ref} onclick={() => void printPaymentQr(row)}>
      <QrCode class="h-4 w-4" />
    </button>
  {/if}
  {#if canDelete && !row._archived && (s === 'รอชำระเงิน' || s === 'ชำระแล้ว') && !expired}
    <button class="shrink-0 rounded-xl border border-amber-200 bg-white p-1.5 text-amber-600 hover:bg-amber-50 dark:border-amber-900 dark:bg-slate-800 dark:hover:bg-amber-950/30" title="ย้อนสถานะเป็นรอชำระเงิน (สลิปไม่ถูกต้อง)" onclick={() => (revertTarget = row)}>
      <RotateCcw class="h-4 w-4" />
    </button>
  {/if}
  {#if canDelete}
    <button class="shrink-0 rounded-xl border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:hover:bg-red-950/30" title={row._archived ? 'ลบการจองถาวร (ย้อนหลัง)' : 'ลบการจองถาวร'} onclick={() => (deleteTarget = row)}>
      <Trash2 class="h-4 w-4" />
    </button>
  {/if}
  <button
    class="shrink-0 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
    title="ดูรายละเอียด"
    onclick={() => openDetail(row)}
  >
    <Eye class="h-4 w-4" />
  </button>
{/snippet}

<div class="flex flex-col gap-4">
  <Card title="ระบบจอง" subtitle="ตารางการจองทั้งหมด" interactive>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            bind:value={search}
            placeholder="ค้นหาชื่อผู้เยี่ยม, ผู้ต้องขัง, REF, ปีก, เบอร์โทร"
            class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

      <div class="flex flex-wrap items-center gap-3">
        <select
          bind:value={statusFilter}
          class="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:flex-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามสถานะ"
        >
          <option value="">ทุกสถานะ</option>
          {#each statuses as s (s)}
            <option value={s}>{s}</option>
          {/each}
        </select>

        <select
          bind:value={dateFilter}
          class="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:flex-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามวันที่"
        >
          <option value="">ทุกวัน</option>
          {#each dates as d (d)}
            <option value={d}>{visitDateLabel(d)}</option>
          {/each}
        </select>

        <select
          bind:value={wingFilter}
          class="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:flex-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามแดน"
        >
          <option value="">ทุกแดน</option>
          {#each wings as w (w)}
            <option value={w}>{w}</option>
          {/each}
        </select>

        <select
          bind:value={typeFilter}
          class="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:flex-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามประเภทการจอง"
        >
          <option value="">ทุกประเภท</option>
          <option value="prisoner">เยี่ยมผู้ต้องขัง</option>
          <option value="table">จองโต๊ะ (ไม่มีผู้ต้องขัง)</option>
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
          class="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-2"
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
            disabled={!filtered.some((r) => normalizeStatus(r.status) === 'เสร็จสิ้น')}
            title="พิมพ์รายงานการจัดโต๊ะเฉพาะสถานะ เสร็จสิ้น ตามวันที่ที่กรอง"
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
              class="inline-flex items-center gap-1 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-2"
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
        <div class="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
          <span class="text-sm font-medium text-blue-800 dark:text-blue-300">เลือก {selectedRefs.length} รายการ</span>
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
        <div class="hidden overflow-x-auto rounded-xl border border-slate-200 md:block dark:border-slate-700">
          <table class="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/50">
                <th class="w-8 shrink-0 px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
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
                <th class="min-w-[90px] cursor-pointer px-3 py-2.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('ref')}>REF{sortIcon('ref')}</th>
                <th class="min-w-[200px] cursor-pointer px-3 py-2.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('prisonerName')}>ผู้ต้องขัง / ผู้เยี่ยม{sortIcon('prisonerName')}</th>
                <th class="min-w-[80px] cursor-pointer px-3 py-2.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('wing')}>ปีก{sortIcon('wing')}</th>
                <th class="min-w-[100px] cursor-pointer px-3 py-2.5 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('visitDateISO')}>วันที่{sortIcon('visitDateISO')}</th>
                <th class="min-w-[90px] cursor-pointer px-3 py-2.5 text-right font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100" onclick={() => toggleSort('total')}>ยอด{sortIcon('total')}</th>
                <th class="min-w-[110px] px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">สถานะ</th>
                <th class="w-36 px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">ความคืบหน้า</th>
                <th class="w-[110px] px-3 py-2.5 text-right font-medium text-slate-700 dark:text-slate-300">จัดการ</th>
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
                      class="rounded border-slate-300 text-blue-700 focus:ring-blue-600 dark:border-slate-600"
                    />
                  </td>
                  <td class="px-3 py-2.5">
                    <button
                      class="font-mono text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
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
                    <div class="max-w-[200px]">
                      {#if isTableBooking(row)}
                        <span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">จองโต๊ะ</span>
                      {:else}
                        <div class="font-semibold text-slate-800 dark:text-slate-100 truncate">{row.prisonerName ?? '—'}</div>
                        <div class="text-[11px] text-slate-400">#{row.prisonerId ?? ''}</div>
                      {/if}
                      <div class="mt-0.5 border-t border-dashed border-slate-200 pt-0.5 text-[13px] dark:border-slate-700">
                        <span class="block truncate">{row.visitorName ?? ''}</span>
                        {#if row.visitorPhone}<span class="text-[11px] text-slate-400">{row.visitorPhone}</span>{/if}
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 font-medium">{isTableBooking(row) ? '—' : (row.wing ?? '—')}</td>
                  <td class="px-3 py-2.5 whitespace-nowrap">{visitDateLabel(row.visitDate, row.visitDateISO)}</td>
                  <td class="px-3 py-2.5 text-right whitespace-nowrap">
                    <div>{formatNumber(row.visitorCount)} คน</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">{formatBaht(row.total)}</div>
                  </td>
                  <td class="px-3 py-2.5">
                    <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium {statusBadgeClass(s)}">
                      {s}
                    </span>
                  </td>
                  <td class="px-3 py-2.5">
                    <StatusSteps status={row.status} />
                  </td>
                   <td class="px-3 py-2.5">
                    {#if !archived || isSuper}
                      <div class="flex items-center justify-end gap-1.5 whitespace-normal">
                        {@render rowActions(row, s, terminal, expired)}
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

        <!-- Mobile card list -->
        <div class="flex flex-col gap-3 md:hidden">
          {#each pagedRows as row (row.ref)}
            {@const s = normalizeStatus(row.status)}
            {@const archived = !!row._archived}
            {@const terminal = s === 'เสร็จสิ้น' || s === 'ไม่อนุมัติ' || s === 'ยกเลิก'}
            {@const expired = isExpired(row)}
            <div class="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900 {archived ? 'opacity-60' : ''}">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    aria-label="เลือกแถว"
                    checked={selectedRefs.includes(row.ref)}
                    disabled={archived}
                    onchange={() => toggleSelect(row.ref)}
                    class="mt-1 rounded border-slate-300 text-blue-700 focus:ring-blue-600 dark:border-slate-600"
                  />
                  <div>
                    <button
                      class="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                      onclick={() => openDetail(row)}
                    >
                      {row.ref}
                    </button>
                    {#if archived}<span class="ml-1 text-[10px] text-slate-400">🗄️</span>{/if}
                    {#if isTableBooking(row)}
                      <span class="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">จองโต๊ะ (ไม่มีผู้ต้องขัง)</span>
                    {:else}
                      <div class="mt-1 font-semibold text-slate-800 dark:text-slate-100">{row.prisonerName ?? '—'}</div>
                      <div class="text-[11px] text-slate-400">#{row.prisonerId ?? ''} · แดน {row.wing ?? '—'}</div>
                    {/if}
                  </div>
                </div>
                <span class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium {statusBadgeClass(s)}">
                  {s}
                </span>
              </div>

              <div class="mt-2.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                <div class="font-medium text-slate-800 dark:text-slate-100">{row.visitorName ?? '—'}</div>
                {#if row.visitorPhone}<div class="text-xs text-slate-500 dark:text-slate-400">📞 {row.visitorPhone}</div>{/if}
              </div>

              <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span class="text-slate-500 dark:text-slate-400">{visitDateLabel(row.visitDate, row.visitDateISO)}</span>
                <span class="font-semibold text-slate-800 dark:text-slate-100">{formatNumber(row.visitorCount)} คน · {formatBaht(row.total)}</span>
              </div>

              <div class="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                <StatusSteps status={row.status} />
                {#if !archived || isSuper}
                  <div class="flex flex-wrap items-center justify-end gap-1.5">
                    {@render rowActions(row, s, terminal, expired)}
                  </div>
                {/if}
              </div>
            </div>
          {/each}

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
              class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
    <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
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
        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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

<Modal open={deleteTarget !== null} title="ลบการจองถาวร" onclose={() => (deleteTarget = null)}>
  <div class="flex flex-col gap-4">
    <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      ยืนยันการลบการจอง <span class="font-semibold">{deleteTarget?.ref}</span> ออกจากฐานข้อมูล?
      การกระทำนี้ไม่สามารถย้อนกลับได้ และจะลบบันทึกช่วยจำกับข้อมูลการแจ้งเตือนของการจองนี้ทั้งหมด
    </div>
    {#if deleteTarget}
      <dl class="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
        <dt class="text-slate-500 dark:text-slate-400">ผู้เข้าร่วม</dt>
        <dd class="col-span-2 text-slate-800 dark:text-slate-100">{deleteTarget.visitorName || '-'}</dd>
        <dt class="text-slate-500 dark:text-slate-400">ผู้ต้องขัง</dt>
        <dd class="col-span-2 text-slate-800 dark:text-slate-100">{deleteTarget.prisonerName || '-'}</dd>
        <dt class="text-slate-500 dark:text-slate-400">วันที่เข้าร่วม</dt>
        <dd class="col-span-2 text-slate-800 dark:text-slate-100">
          {visitDateLabel(deleteTarget.visitDate, deleteTarget.visitDateISO)}
        </dd>
        <dt class="text-slate-500 dark:text-slate-400">สถานะ</dt>
        <dd class="col-span-2 text-slate-800 dark:text-slate-100">{normalizeStatus(deleteTarget.status)}</dd>
      </dl>
    {/if}
    <div class="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-slate-700">
      <button class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => (deleteTarget = null)}>
        กลับ
      </button>
      <button class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-700 disabled:opacity-50" onclick={confirmDelete} disabled={deleting}>
        {deleting ? 'กำลังลบ...' : 'ลบถาวร'}
      </button>
    </div>
  </div>
</Modal>

<Modal open={revertTarget !== null} title="ย้อนสถานะการชำระเงิน" onclose={() => (revertTarget = null)}>
  <div class="flex flex-col gap-4">
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
      ยืนยันการย้อนสถานะของ <span class="font-semibold">{revertTarget?.ref}</span> กลับไปเป็น "รอชำระเงิน"?
      สลิปที่อัปโหลดไว้และข้อมูลการตรวจสอบจะถูกลบทิ้ง ผู้เยี่ยมจะสามารถอัปโหลดสลิปใหม่ได้ตามปกติ
    </div>
    {#if revertTarget}
      <dl class="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
        <dt class="text-slate-500 dark:text-slate-400">ผู้เข้าร่วม</dt>
        <dd class="col-span-2 text-slate-800 dark:text-slate-100">{revertTarget.visitorName || '-'}</dd>
        <dt class="text-slate-500 dark:text-slate-400">ผู้ต้องขัง</dt>
        <dd class="col-span-2 text-slate-800 dark:text-slate-100">{revertTarget.prisonerName || '-'}</dd>
        <dt class="text-slate-500 dark:text-slate-400">สถานะปัจจุบัน</dt>
        <dd class="col-span-2 text-slate-800 dark:text-slate-100">{normalizeStatus(revertTarget.status)}</dd>
        <dt class="text-slate-500 dark:text-slate-400">ยอดชำระ</dt>
        <dd class="col-span-2 text-slate-800 dark:text-slate-100">{formatBaht(revertTarget.total)}</dd>
      </dl>
    {/if}
    <div class="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-slate-700">
      <button class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => (revertTarget = null)}>
        กลับ
      </button>
      <button class="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-amber-700 disabled:opacity-50" onclick={confirmRevert} disabled={reverting}>
        {reverting ? 'กำลังย้อนสถานะ...' : 'ยืนยันย้อนสถานะ'}
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
