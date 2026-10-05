<script lang="ts">
  import { onMount } from 'svelte';
  import { RefreshCw } from '@lucide/svelte';
  import Card from '../ui/Card.svelte';
  import Spinner from '../ui/Spinner.svelte';
  import { ui } from '../../store/ui.svelte';
  import { getPushSubscribers, type PushSubscriber } from '../../api/endpoints';

  // Who receives Web Push from the booking site: browsers following a booking
  // (time to pay, payment confirmed) and those that opted in to the
  // "booking opens" alerts (10 minutes before, and at the opening).

  let loading = $state(true);
  let summary = $state({ total: 0, openingAlerts: 0, bookings: 0 });
  let rows = $state<PushSubscriber[]>([]);

  onMount(load);

  async function load(): Promise<void> {
    loading = true;
    try {
      const res = await getPushSubscribers(100);
      summary = res.summary ?? { total: 0, openingAlerts: 0, bookings: 0 };
      rows = res.rows ?? [];
    } catch (err) {
      ui.showAlert({
        title: 'ไม่สามารถโหลดผู้รับการแจ้งเตือนได้',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
        type: 'error',
      });
    } finally {
      loading = false;
    }
  }

  function fmt(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  }

  function fmtDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  }
</script>

<Card title="ผู้รับการแจ้งเตือน" subtitle="เบราว์เซอร์ที่สมัครรับ Web Push จากเว็บจอง — แจ้งถึงคิวชำระเงิน/ชำระสำเร็จ และแจ้งเตือนเปิดจอง">
  {#if loading}
    <div class="flex items-center justify-center py-10"><Spinner /></div>
  {:else}
    <div class="flex flex-col gap-6">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p class="text-xs text-slate-500 dark:text-slate-400">ผู้สมัครทั้งหมด</p>
          <p class="mt-1 text-2xl font-semibold text-slate-700 dark:text-slate-200">{summary.total}</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p class="text-xs text-slate-500 dark:text-slate-400">รับแจ้งเตือนเปิดจอง</p>
          <p class="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{summary.openingAlerts}</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p class="text-xs text-slate-500 dark:text-slate-400">ติดตามการจอง</p>
          <p class="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">{summary.bookings}</p>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">
            ใช้งานล่าสุด {rows.length < summary.total ? `(${rows.length} จาก ${summary.total})` : ''}
          </p>
          <button
            type="button"
            class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onclick={load}
          >
            <RefreshCw class="h-3.5 w-3.5" /> โหลดใหม่
          </button>
        </div>
        {#if rows.length === 0}
          <p class="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-600">
            ยังไม่มีผู้สมัครรับการแจ้งเตือน
          </p>
        {:else}
          <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th class="px-3 py-2 font-medium">ใช้งานล่าสุด</th>
                  <th class="px-3 py-2 font-medium">เบราว์เซอร์</th>
                  <th class="px-3 py-2 font-medium">แจ้งเปิดจอง</th>
                  <th class="px-3 py-2 font-medium">การจองที่ติดตาม</th>
                  <th class="px-3 py-2 font-medium">ผู้จอง</th>
                  <th class="px-3 py-2 font-medium">วันเข้าเยี่ยม</th>
                  <th class="px-3 py-2 font-medium">สถานะ</th>
                  <th class="px-3 py-2 font-medium">สมัครเมื่อ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                {#each rows as r, i (`${r.createdAt}-${r.ref}-${i}`)}
                  <tr>
                    <td class="whitespace-nowrap px-3 py-2">{fmt(r.lastActiveAt)}</td>
                    <td class="whitespace-nowrap px-3 py-2">{r.service}</td>
                    <td class="px-3 py-2">{r.openingAlerts ? '✓' : '–'}</td>
                    <td class="whitespace-nowrap px-3 py-2 font-mono">{r.ref || '–'}</td>
                    <td class="whitespace-nowrap px-3 py-2">{r.visitorName || '–'}</td>
                    <td class="whitespace-nowrap px-3 py-2">{r.visitDateISO ? fmtDate(r.visitDateISO) : '–'}</td>
                    <td class="whitespace-nowrap px-3 py-2">{r.bookingStatus || '–'}</td>
                    <td class="whitespace-nowrap px-3 py-2 text-slate-400">{fmt(r.createdAt)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p class="text-[11px] text-slate-400">
            ระบบไม่แสดงที่อยู่สำหรับส่ง (endpoint) เพราะผู้ที่ได้ไปสามารถส่งแจ้งเตือนถึงเครื่องนั้นได้ — การจองที่ย้ายเข้าคลังแล้วจะไม่แสดงชื่อผู้จอง
          </p>
        {/if}
      </div>
    </div>
  {/if}
</Card>
