<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import { testConnection, getBackendUrl } from '../lib/api/endpoints';
  import { API_BASE } from '../lib/api/client';
  import { ui } from '../lib/store/ui.svelte';

  let testing = $state(false);
  let result = $state('');
  let backendUrl = $state('');

  onMount(async () => {
    try {
      const data = await getBackendUrl();
      backendUrl = typeof data.url === 'string' ? data.url : API_BASE;
    } catch {
      backendUrl = API_BASE;
    }
  });

  async function handleTest(): Promise<void> {
    testing = true;
    result = '';
    try {
      const data = await testConnection();
      result = data.status === 'ok' ? 'เชื่อมต่อสำเร็จ' : String(data.message ?? 'เชื่อมต่อไม่สำเร็จ');
      ui.showToast(result, data.status === 'ok' ? 'success' : 'error');
    } catch (err) {
      result = err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ';
      ui.showToast(result, 'error');
    } finally {
      testing = false;
    }
  }

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(backendUrl);
      ui.showToast('คัดลอก URL แล้ว', 'success');
    } catch {
      ui.showToast('คัดลอกไม่สำเร็จ', 'error');
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="การเชื่อมต่อ" subtitle="ตรวจสอบการเชื่อมต่อกับเซิร์ฟเวอร์ backend">
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <code class="rounded bg-slate-100 px-2 py-1 text-sm font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {backendUrl}
        </code>
        <Button variant="outline" size="sm" onclick={handleCopy}>คัดลอก</Button>
        <Button onclick={handleTest} loading={testing}>
          {testing ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}
        </Button>
      </div>
      {#if result}
        <p class="text-sm text-slate-600 dark:text-slate-300">{result}</p>
      {/if}
    </div>
  </Card>
</div>
