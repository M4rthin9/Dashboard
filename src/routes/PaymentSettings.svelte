<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { getSettings, saveSettings } from '../lib/api/endpoints';
  let loading = $state(true);
  onMount(fetchSettings);
  let paymentEnabled = $state(true);
  let paymentClosedMessage = $state('');
  let paymentSaving = $state(false);
  async function fetchSettings(): Promise<void> {
    loading = true;
    try {
      const result = await getSettings();
      if (result.status !== 'ok') throw new Error(String(result.message ?? 'โหลดตั้งค่าไม่สำเร็จ'));
      const settings = result.settings ?? {};
      const payment = (settings.payment ?? {}) as Record<string, unknown>;
      // Absent or malformed key means payment is OPEN — never strand payers.
      paymentEnabled = payment.enabled !== false;
      paymentClosedMessage = typeof payment.closedMessage === 'string' ? payment.closedMessage : '';

    } catch (error) { ui.showAlert({ title: 'โหลดตั้งค่าไม่สำเร็จ', message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด', type: 'error' }); }
    finally { loading = false; }
  }
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

</script>
<div class="flex flex-col gap-4">
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

</div>
