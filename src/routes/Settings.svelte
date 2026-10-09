<script lang="ts">
  import { onMount } from 'svelte';
  import { Moon, RefreshCw, Save } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { hasPermission } from '../lib/utils/permissions';
  import { archiveOldReservations, getSettings, saveSettings } from '../lib/api/endpoints';

  let serverSettings = $state<Record<string, unknown>>({});
  let settingsText = $state('');
  let savedBy = $state('');
  let savedAt = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let archiving = $state(false);

  const isManager = $derived(auth.user?.role === 'Superadmin' || auth.user?.role === 'Admin' || hasPermission(auth.user?.role ?? '', 'manage_users'));

  onMount(fetchSettings);
  async function fetchSettings(): Promise<void> {
    if (!isManager) return;
    loading = true;
    try {
      const res = await getSettings();
      serverSettings = res.settings ?? {};
      settingsText = JSON.stringify(serverSettings, null, 2);
      savedBy = String(serverSettings._savedBy ?? '');
      savedAt = String(serverSettings._savedAt ?? '');
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

  {#if isManager}
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

    <details class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <summary class="cursor-pointer text-sm font-semibold">ตั้งค่าขั้นสูง (JSON)</summary>
      <p class="my-3 text-xs text-slate-500">ใช้ Frontend Editor สำหรับข้อความและโปรโมชั่น ใช้เมนูการจองและการชำระเงินสำหรับการเปิด/ปิดบริการ</p>
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
    </details>
  {/if}
</div>
