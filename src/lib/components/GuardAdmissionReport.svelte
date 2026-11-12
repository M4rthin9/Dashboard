<script lang="ts">
  import { Printer } from '@lucide/svelte';
  import { getAttendance } from '../api/attendance';
  import { auth } from '../store/auth.svelte';
  import { canUseRegistrationDesk } from '../utils/permissions';
  import { buildGuardAdmissionReport } from '../utils/guardAdmissionReport';
  import { openPrintWindow } from '../utils/print';

  let { date }: { date: string } = $props();
  let busy = $state(false);
  let error = $state('');

  async function printReport() {
    if (busy || !date) return;
    error = '';
    const preview = window.open('', '_blank');
    if (!preview) { error = 'กรุณาอนุญาต Popup เพื่อเปิดเอกสารสำหรับพิมพ์'; return; }
    preview.document.body.textContent = 'กำลังจัดทำรายชื่อสำหรับส่วนรักษาการณ์…';
    busy = true;
    const requestedDate = date;
    try {
      const result = await getAttendance(requestedDate);
      const content = buildGuardAdmissionReport(result.rows, result.tables, requestedDate, result.asOf);
      if (!preview.closed) openPrintWindow(content, `ทะเบียนผู้เข้าเยี่ยม ส่วนรักษาการณ์ ${requestedDate}`, auth.user?.displayName || auth.user?.username || '', preview);
    } catch (e) {
      preview.close();
      error = e instanceof Error ? e.message : 'จัดทำรายงานไม่สำเร็จ กรุณาลองอีกครั้ง';
    } finally { busy = false; }
  }
</script>

{#if canUseRegistrationDesk(auth.user?.role)}
  <section class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="เอกสารสำหรับส่วนรักษาการณ์">
    <h2 class="font-semibold text-slate-900 dark:text-slate-100">ทะเบียนผู้เข้าเยี่ยม (ลงชื่อ) — ส่วนรักษาการณ์</h2>
    <p class="my-2 text-sm text-slate-600 dark:text-slate-300">เอกสารเรียนส่วนรักษาการณ์เพื่อขออนุญาตให้ผู้เข้าเยี่ยมเข้าภายในทัณฑสถาน เฉพาะผู้ที่ลงทะเบียนหน้าประตูแล้ว พร้อมช่องลงชื่อและตรวจสอบซ้ำ</p>
    <button class="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onclick={printReport} disabled={busy || !date} aria-busy={busy}><Printer size={16} /> {busy ? 'กำลังจัดทำเอกสาร…' : 'พิมพ์ / บันทึก PDF สำหรับรักษาการณ์'}</button>
    {#if error}<p role="alert" class="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>{/if}
  </section>
{/if}
