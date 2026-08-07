<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { getCountsByDate } from '../lib/api/endpoints';
  import { formatNumber, todayISO, formatDateThai } from '../lib/utils/format';

  let loading = $state(true);
  let todayCount = $state(0);
  let totalCount = $state(0);
  let error = $state('');

  onMount(async () => {
    try {
      const data = await getCountsByDate();
      const counts = data.counts ?? {};
      totalCount = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
      todayCount = Number(counts[todayISO()] ?? 0);
    } catch (err) {
      error = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
    } finally {
      loading = false;
    }
  });
</script>

<div class="flex flex-col gap-6">
  <div>
    <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
      สวัสดี, {auth.displayName}
    </h2>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      วันนี้ {formatDateThai(new Date())}
    </p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <Spinner />
    </div>
  {:else if error}
    <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {error}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="การจองวันนี้">
        <p class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(todayCount)}</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">รายการ</p>
      </Card>
      <Card title="การจองทั้งหมด">
        <p class="text-3xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(totalCount)}</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">รายการ</p>
      </Card>
    </div>

    <Card title="เริ่มต้นใช้งาน">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Dashboard เต็มรูปแบบ (กราฟ, แผนผังโต๊ะ, แจ้งเตือน) จะมาในเฟสถัดไป ส่วนระบบจองเปิดใช้งานได้แล้ว
      </p>
    </Card>
  {/if}
</div>
