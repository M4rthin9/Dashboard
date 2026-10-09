<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { getSettings, setTableBookingStatus } from '../lib/api/endpoints';
  let loading = $state(true);
  onMount(fetchSettings);
  import BookingWindowCard from '../lib/components/settings/BookingWindowCard.svelte';
  let tableBookingEnabled = $state(false);
  let tableBookingSaving = $state(false);
  let tableBookingOpensAt = $state('');
  let now = $state(Date.now());
  const tableBookingScheduled = $derived(tableBookingEnabled && Date.parse(tableBookingOpensAt) > now);
  const tableCountdown = $derived(Math.max(0, Math.ceil((Date.parse(tableBookingOpensAt) - now) / 1000)));
  const tableCountdownText = $derived([Math.floor(tableCountdown / 3600), Math.floor(tableCountdown / 60) % 60, tableCountdown % 60].map(n => String(n).padStart(2, '0')).join(':'));
  const tableOpeningLabel = $derived(tableBookingOpensAt ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(tableBookingOpensAt)) : '');
  async function fetchSettings(): Promise<void> {
    loading = true;
    try {
      const result = await getSettings();
      if (result.status !== 'ok') throw new Error(String(result.message ?? 'โหลดตั้งค่าไม่สำเร็จ'));
      const settings = result.settings ?? {};
      const tableBooking = (settings.tableBooking ?? {}) as Record<string, unknown>;
      // Legacy maintenance also closes bookings; the button updates both flags.
      tableBookingEnabled = tableBooking.enabled !== false && tableBooking.maintenance === false;
      const opening = Date.parse(String(tableBooking.opensAt ?? ''));
      tableBookingOpensAt = Number.isFinite(opening) ? new Date(opening).toISOString() : '';
      now = Date.now();
      if (tableBooking.opensAt && !Number.isFinite(opening)) tableBookingEnabled = false;

    } catch (error) { ui.showAlert({ title: 'โหลดตั้งค่าไม่สำเร็จ', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด', type: 'error' }); }
    finally { loading = false; }
  }
  async function saveTableBookingSwitch(next: boolean): Promise<void> {
    tableBookingSaving = true;
    try {
      const res = await setTableBookingStatus(next);
      if (res.status !== 'ok') {
        ui.showAlert({ title: 'บันทึกไม่สำเร็จ', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
        return;
      }
      tableBookingEnabled = next;
      ui.showToast(next ? 'เริ่มนับถอยหลัง 2 ชั่วโมงก่อนเปิดรับจองโต๊ะ (TBL)' : 'ปิดรับจองโต๊ะ (TBL) และยกเลิกเวลาเปิดแล้ว', 'success');
      await fetchSettings();
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      tableBookingSaving = false;
    }
  }

  onMount(() => { const timer = window.setInterval(() => now = Date.now(), 1000); return () => window.clearInterval(timer); });
</script>
<div class="flex flex-col gap-4">
    <Card title="การจองโต๊ะ (TBL)" subtitle="เปิด/ปิดรับการจองโต๊ะสำหรับบุคคลภายนอก">
      {#if loading}
        <div class="flex items-center justify-center py-10"><Spinner /></div>
      {:else}
        <div class="flex items-center justify-between gap-4 rounded-xl border p-4 {tableBookingEnabled ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}">
          <div>
            <p class="text-sm font-semibold {tableBookingEnabled ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}">
              {tableBookingScheduled ? 'กำลังนับถอยหลังก่อนเปิดรับจองโต๊ะ (TBL)' : tableBookingEnabled ? 'เปิดรับจองโต๊ะ (TBL)' : 'ปิดรับจองโต๊ะ (TBL)'}
            </p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tableBookingScheduled ? 'ลูกค้าเห็นแบนเนอร์และเวลานับถอยหลัง ระบบเปิดรับจองอัตโนมัติเมื่อครบ 2 ชั่วโมง'
                : tableBookingEnabled
                ? 'ลูกค้าจองโต๊ะได้ตามช่วงเวลาเปิดรับจอง โดยต้องยอมรับข้อตกลงก่อนยืนยันการจอง'
                : 'ปิดแบบฟอร์มและปฏิเสธการจองใหม่บนเซิร์ฟเวอร์ ลูกค้าที่จองแล้วตรวจสอบสถานะและชำระเงินได้ตามปกติ'}
            </p>
            {#if tableBookingScheduled}
              <p class="mt-3 font-mono text-3xl font-bold tabular-nums" role="timer" aria-label="เวลาที่เหลือก่อนเปิดรับจอง">{tableCountdownText}</p>
              <p class="mt-2 text-xs text-slate-600 dark:text-slate-300">เปิดรับจอง {tableOpeningLabel} (เวลาประเทศไทย)</p>
            {/if}
          </div>
          <button
            class="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 disabled:opacity-50 {tableBookingEnabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}"
            onclick={() => void saveTableBookingSwitch(!tableBookingEnabled)}
            disabled={tableBookingSaving}
          >
            {tableBookingSaving ? 'กำลังบันทึก...' : tableBookingScheduled ? 'ยกเลิกการเปิดรับจอง' : tableBookingEnabled ? 'ปิดรับจองโต๊ะ' : 'เริ่มนับถอยหลัง 2 ชั่วโมง'}
          </button>
        </div>
      {/if}
    </Card>

  <BookingWindowCard />
</div>
