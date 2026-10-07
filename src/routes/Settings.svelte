<script lang="ts">
  import { onMount } from 'svelte';
  import { Copy, Moon, RefreshCw, Save } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { API_BASE, auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { hasPermission } from '../lib/utils/permissions';
  import { archiveOldReservations, getSettings, saveSettings, setTableBookingStatus } from '../lib/api/endpoints';
  import BookingWindowCard from '../lib/components/settings/BookingWindowCard.svelte';
  import PromoCard from '../lib/components/settings/PromoCard.svelte';
  import PdpaCard from '../lib/components/settings/PdpaCard.svelte';
  import PushSubscribersCard from '../lib/components/settings/PushSubscribersCard.svelte';

  let serverSettings = $state<Record<string, unknown>>({});
  let settingsText = $state('');
  let savedBy = $state('');
  let savedAt = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let paymentEnabled = $state(true);
  let paymentClosedMessage = $state('');
  let paymentSaving = $state(false);
  let tableBookingEnabled = $state(false);
  let tableBookingSaving = $state(false);
  let tableBookingOpensAt = $state('');
  let now = $state(Date.now());
  const tableBookingScheduled = $derived(tableBookingEnabled && Date.parse(tableBookingOpensAt) > now);
  const tableCountdown = $derived(Math.max(0, Math.ceil((Date.parse(tableBookingOpensAt) - now) / 1000)));
  const tableCountdownText = $derived([Math.floor(tableCountdown / 3600), Math.floor(tableCountdown / 60) % 60, tableCountdown % 60].map(n => String(n).padStart(2, '0')).join(':'));
  const tableOpeningLabel = $derived(tableBookingOpensAt ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(tableBookingOpensAt)) : '');
  let archiving = $state(false);

  const isManager = $derived(auth.user?.role === 'Superadmin' || auth.user?.role === 'Admin' || hasPermission(auth.user?.role ?? '', 'manage_users'));

  onMount(fetchSettings);
  onMount(() => {
    const timer = window.setInterval(() => now = Date.now(), 1000);
    return () => window.clearInterval(timer);
  });

  async function fetchSettings(): Promise<void> {
    if (!isManager) return;
    loading = true;
    try {
      const res = await getSettings();
      serverSettings = res.settings ?? {};
      settingsText = JSON.stringify(serverSettings, null, 2);
      savedBy = String(serverSettings._savedBy ?? '');
      savedAt = String(serverSettings._savedAt ?? '');
      const payment = (serverSettings.payment ?? {}) as Record<string, unknown>;
      // Absent or malformed key means payment is OPEN — never strand payers.
      paymentEnabled = payment.enabled !== false;
      paymentClosedMessage = typeof payment.closedMessage === 'string' ? payment.closedMessage : '';
      const tableBooking = (serverSettings.tableBooking ?? {}) as Record<string, unknown>;
      // Legacy maintenance also closes bookings; the button updates both flags.
      tableBookingEnabled = tableBooking.enabled !== false && tableBooking.maintenance === false;
      const opening = Date.parse(String(tableBooking.opensAt ?? ''));
      tableBookingOpensAt = Number.isFinite(opening) ? new Date(opening).toISOString() : '';
      now = Date.now();
      if (tableBooking.opensAt && !Number.isFinite(opening)) tableBookingEnabled = false;
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถโหลดตั้งค่าได้', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      loading = false;
    }
  }

  async function save(): Promise<void> {
    saving = true;
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(settingsText);
      } catch {
        ui.showAlert({ title: 'JSON ไม่ถูกต้อง', message: 'กรุณาตรวจสอบรูปแบบ JSON', type: 'error' });
        return;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        ui.showAlert({ title: 'รูปแบบไม่ถูกต้อง', message: 'ค่าตั้งค่าต้องเป็น JSON object', type: 'error' });
        return;
      }
      const res = await saveSettings(parsed as Record<string, unknown>);
      if (res.status !== 'ok') {
        ui.showAlert({ title: 'บันทึกไม่สำเร็จ', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
        return;
      }
      ui.showAlert({ title: 'บันทึกตั้งค่าสำเร็จ', message: 'บันทึกข้อมูลการตั้งค่าเรียบร้อย', type: 'success' });
      await fetchSettings();
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      saving = false;
    }
  }

  /** Read-merge-write so the toggle can never clobber sibling keys such as
   *  `promptpay` that live in the same admin_settings blob. */
  async function savePaymentSwitch(nextEnabled: boolean): Promise<void> {
    paymentSaving = true;
    try {
      const current = await getSettings();
      const merged = {
        ...(current.settings ?? {}),
        payment: { enabled: nextEnabled, closedMessage: paymentClosedMessage.trim().slice(0, 500) },
      };
      const res = await saveSettings(merged as Record<string, unknown>);
      if (res.status !== 'ok') {
        ui.showAlert({ title: 'บันทึกไม่สำเร็จ', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
        return;
      }
      paymentEnabled = nextEnabled;
      ui.showToast(nextEnabled ? 'เปิดรับชำระเงินแล้ว' : 'ปิดรับชำระเงินชั่วคราวแล้ว', 'success');
      await fetchSettings();
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      paymentSaving = false;
    }
  }

  /** The server saves the opening two hours ahead and preserves other settings. */
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

  async function runArchive(): Promise<void> {
    if (!confirm('ย้ายการจองที่วันเข้าเยี่ยมเก่ากว่ากำหนดเข้าคลังข้อมูลตอนนี้? (ดูย้อนหลังได้จากปุ่ม "รวมย้อนหลัง" ในหน้าระบบจอง)')) return;
    archiving = true;
    try {
      const res = await archiveOldReservations();
      ui.showAlert({ title: 'ย้ายเข้าคลังข้อมูลแล้ว', message: String(res.message ?? `ย้ายแล้ว ${res.archived ?? 0} รายการ`), type: 'success' });
    } catch (err) {
      ui.showAlert({ title: 'ย้ายเข้าคลังไม่สำเร็จ', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      archiving = false;
    }
  }

  async function copyUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(API_BASE);
      ui.showToast('คัดลอก URL แล้ว', 'success');
    } catch {
      ui.showToast('คัดลอกไม่สำเร็จ', 'error');
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="ลักษณะที่ปรากฏ">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Moon class="h-4 w-4" /> โหมดมืด
        </p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">สลับธีมสว่าง/มืดทั้งระบบ</p>
      </div>
      <button
        class="relative h-7 w-12 rounded-full transition-colors {ui.darkMode ? 'bg-blue-700' : 'bg-slate-300 dark:bg-slate-600'}"
        onclick={() => ui.toggleDarkMode()}
        role="switch"
        aria-checked={ui.darkMode}
        aria-label="สลับโหมดมืด"
      >
        <span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all {ui.darkMode ? 'left-[22px]' : 'left-0.5'}"></span>
      </button>
    </div>
  </Card>

  <Card title="การเชื่อมต่อ">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">API Endpoint</p>
        <p class="mt-1 truncate font-mono text-sm text-slate-700 dark:text-slate-200">{API_BASE}</p>
      </div>
      <button class="rounded-xl border border-slate-300 p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800" onclick={copyUrl} aria-label="คัดลอก URL">
        <Copy class="h-4 w-4" />
      </button>
    </div>
  </Card>

  {#if isManager}
    <Card title="การรับชำระเงิน" subtitle="เปิด/ปิดการชำระเงินของผู้เข้าร่วมกิจกรรมบนหน้าเว็บจอง">
      {#if loading}
        <div class="flex items-center justify-center py-10"><Spinner /></div>
      {:else}
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-4 rounded-xl border p-4 {paymentEnabled ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}">
            <div>
              <p class="text-sm font-semibold {paymentEnabled ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}">
                {paymentEnabled ? 'เปิดรับชำระเงิน' : 'ปิดรับชำระเงินชั่วคราว'}
              </p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {paymentEnabled
                  ? 'ผู้เข้าร่วมที่ได้รับอนุมัติสามารถชำระเงินผ่านหน้าเว็บได้ตามปกติ'
                  : 'ผู้เข้าร่วมจะเห็นข้อความให้กลับมาชำระเงินภายหลัง · เจ้าหน้าที่ยังยืนยันการชำระเงินและพิมพ์ QR ได้ตามปกติ'}
              </p>
            </div>
            <button
              class="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 disabled:opacity-50 {paymentEnabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}"
              onclick={() => void savePaymentSwitch(!paymentEnabled)}
              disabled={paymentSaving}
            >
              {paymentSaving ? 'กำลังบันทึก...' : paymentEnabled ? 'ปิดรับชำระเงิน' : 'เปิดรับชำระเงิน'}
            </button>
          </div>
          <div class="flex flex-col gap-2">
            <label for="payment-closed-message" class="text-sm font-medium text-slate-700 dark:text-slate-200">
              ข้อความที่แสดงเมื่อปิดรับชำระเงิน
            </label>
            <textarea
              id="payment-closed-message"
              bind:value={paymentClosedMessage}
              rows="2"
              maxlength="500"
              placeholder="เว้นว่างเพื่อใช้ข้อความมาตรฐาน เช่น ขณะนี้ปิดรับชำระเงินชั่วคราว กรุณากลับมาชำระเงินอีกครั้งภายหลัง"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            ></textarea>
            <div class="flex justify-end">
              <button
                class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                onclick={() => void savePaymentSwitch(paymentEnabled)}
                disabled={paymentSaving}
              >
                บันทึกข้อความ
              </button>
            </div>
          </div>
        </div>
      {/if}
    </Card>

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

    <!-- Both cards write admin_settings, so the raw JSON below must reload after
         them or a later raw save would put the stale copy back. -->
    <BookingWindowCard onSaved={() => void fetchSettings()} />

    <PromoCard onSaved={() => void fetchSettings()} />

    <PdpaCard onSaved={() => void fetchSettings()} />

    <PushSubscribersCard />

    {#if auth.user?.role === 'Superadmin'}
      <Card title="คลังข้อมูลการจอง" subtitle="ระบบย้ายการจองเก่าเข้าคลังอัตโนมัติทุกเที่ยงคืน — กดเพื่อย้ายทันที">
        <div class="flex items-center justify-between gap-4">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            หน้าระบบจองแสดงเฉพาะการจองตั้งแต่ 1 ต.ค. 2569 เป็นต้นไป · การจองที่ย้ายแล้วยังดูได้จากปุ่ม "รวมย้อนหลัง" และรายงานการเงิน
          </p>
          <button
            type="button"
            class="shrink-0 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onclick={() => void runArchive()}
            disabled={archiving}
          >
            {archiving ? 'กำลังย้าย...' : 'ย้ายเข้าคลังตอนนี้'}
          </button>
        </div>
      </Card>
    {/if}

    <Card title="ตั้งค่าผู้ดูแลระบบ" subtitle="ข้อมูล JSON ที่บันทึกบนเซิร์ฟเวอร์ (admin_settings)">
      {#if loading}
        <div class="flex items-center justify-center py-16"><Spinner /></div>
      {:else}
        <div class="flex flex-col gap-3">
          <textarea
            bind:value={settingsText}
            rows="14"
            spellcheck="false"
            class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          ></textarea>
          {#if savedBy}
            <p class="text-xs text-slate-400 dark:text-slate-500">แก้ไขล่าสุดโดย {savedBy} เมื่อ {savedAt}</p>
          {/if}
          <div class="flex justify-end gap-2">
            <button class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={fetchSettings}>
              <span class="flex items-center gap-1.5"><RefreshCw class="h-4 w-4" /> โหลดใหม่</span>
            </button>
            <button class="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-2" onclick={save} disabled={saving}>
              <span class="flex items-center gap-1.5"><Save class="h-4 w-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
            </button>
          </div>
        </div>
      {/if}
    </Card>
  {/if}
</div>
