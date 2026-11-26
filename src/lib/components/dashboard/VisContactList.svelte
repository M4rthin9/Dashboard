<script lang="ts">
  import { onMount } from 'svelte';
  import { callAction } from '../../api/client';
  import { auth } from '../../store/auth.svelte';
  import { hasPermission } from '../../utils/permissions';
  type FollowUp = { ref: string; visitorName: string; visitorPhone: string; visitDateISO: string; holdExpiresAt: string };
  type Day = { date: string; waiting: number; held: number; paid: number };
  let rows = $state<FollowUp[]>([]);
  let days = $state<Day[]>([]);
  let busy = $state(false);
  const allowed = $derived(['Admin', 'Superadmin'].includes(auth.user?.role ?? '') || hasPermission(auth.user?.role ?? 'User', 'approve_participant'));
  const deadlineFormat = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
  async function load(ref?: string) {
    if (!allowed || busy) return;
    busy = true;
    try {
      const result = await callAction<{status: string; rows?: FollowUp[]; days?: Day[]}>('getVisContactQueue', ref ? { operation: 'contacted', ref } : {}, { auth: true });
      if (result.status === 'ok') {
        rows = result.rows ?? [];
        days = result.days ?? [];
      }
    } finally { busy = false; }
  }
  onMount(() => {
    void load().catch(() => {});
    const timer = setInterval(() => void load().catch(() => {}), 60_000);
    return () => clearInterval(timer);
  });
</script>

{#if allowed && rows.length}
  <section class="rounded-lg border border-amber-500/50 p-4" aria-label="ติดตามผู้จอง VIS">
    <h2 class="mb-2 font-semibold">VIS ที่ต้องโทรแจ้งเมื่อถึงคิว</h2>
    <ul class="grid gap-2">
      {#each rows as row (row.ref)}
        <li class="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 py-2">
          <span>{row.ref} · {row.visitorName} · {row.visitorPhone || 'ไม่มีเบอร์ติดต่อ'} · ชำระภายใน {deadlineFormat.format(new Date(row.holdExpiresAt))}</span>
          <button type="button" class="rounded border px-2 py-1 text-sm" disabled={busy} onclick={() => void load(row.ref).catch(() => {})}>ติดต่อแล้ว</button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if allowed && days.length}
  <section class="rounded-lg border border-current/15 p-4" aria-label="ยอด VIS ตามวันเยี่ยม">
    <h2 class="mb-2 font-semibold">คิวและยอดชำระ VIS ตามวันเยี่ยม</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr><th class="py-1 text-left">วันเยี่ยม</th><th>รอตรวจหรือรอคิว</th><th>กันโต๊ะแล้ว</th><th>ชำระแล้ว</th></tr></thead>
        <tbody>{#each days as day (day.date)}
          <tr class="border-b border-current/10"><th class="py-2 text-left font-normal">{day.date}</th><td class="text-center">{day.waiting}</td><td class="text-center">{day.held}</td><td class="text-center">{day.paid}</td></tr>
        {/each}</tbody>
      </table>
    </div>
  </section>
{/if}
