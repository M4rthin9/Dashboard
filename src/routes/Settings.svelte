<script lang="ts">
  import { onMount } from 'svelte';
  import { Copy, Moon, RefreshCw, Save } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { API_BASE, auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { hasPermission } from '../lib/utils/permissions';
  import { getSettings, saveSettings } from '../lib/api/endpoints';

  let serverSettings = $state<Record<string, unknown>>({});
  let settingsText = $state('');
  let savedBy = $state('');
  let savedAt = $state('');
  let loading = $state(true);
  let saving = $state(false);

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
      ui.showToast(err instanceof Error ? err.message : 'ไม่สามารถโหลดตั้งค่าได้', 'error');
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
        ui.showToast('JSON ไม่ถูกต้อง กรุณาตรวจสอบ', 'error');
        return;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        ui.showToast('ค่าตั้งค่าต้องเป็น JSON object', 'error');
        return;
      }
      const res = await saveSettings(parsed as Record<string, unknown>);
      if (res.status !== 'ok') {
        ui.showToast(String(res.message ?? 'บันทึกไม่สำเร็จ'), 'error');
        return;
      }
      ui.showToast('บันทึกตั้งค่าสำเร็จ', 'success');
      await fetchSettings();
    } catch (err) {
      ui.showToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
    } finally {
      saving = false;
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
        class="relative h-7 w-12 rounded-full transition-colors {ui.darkMode ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}"
        onclick={ui.toggleDarkMode}
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
      <button class="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800" onclick={copyUrl} aria-label="คัดลอก URL">
        <Copy class="h-4 w-4" />
      </button>
    </div>
  </Card>

  {#if isManager}
    <Card title="ตั้งค่าผู้ดูแลระบบ" subtitle="ข้อมูล JSON ที่บันทึกบนเซิร์ฟเวอร์ (admin_settings)">
      {#if loading}
        <div class="flex items-center justify-center py-16"><Spinner /></div>
      {:else}
        <div class="flex flex-col gap-3">
          <textarea
            bind:value={settingsText}
            rows="14"
            spellcheck="false"
            class="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          ></textarea>
          {#if savedBy}
            <p class="text-xs text-slate-400 dark:text-slate-500">แก้ไขล่าสุดโดย {savedBy} เมื่อ {savedAt}</p>
          {/if}
          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={fetchSettings}>
              <span class="flex items-center gap-1.5"><RefreshCw class="h-4 w-4" /> โหลดใหม่</span>
            </button>
            <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50" onclick={save} disabled={saving}>
              <span class="flex items-center gap-1.5"><Save class="h-4 w-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
            </button>
          </div>
        </div>
      {/if}
    </Card>
  {/if}
</div>
