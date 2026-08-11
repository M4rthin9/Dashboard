<script lang="ts">
  import Card from '../ui/Card.svelte';
  import { reservations } from '../../store/reservations.svelte';
  import { normalizeStatus, todayISO, formatBaht, visitDateLabel } from '../../utils/format';

  const wingColors: Record<string, string> = {
    'แดน 1': '#1e40af', 'แดน 2': '#7c3aed', 'แดน 3': '#b91c1c',
    'แดน 4': '#c2410c', 'แดน 5': '#15803d', 'แดน 6': '#0e7490',
  };

  let selectedDate = $state(todayISO());

  const dates = $derived(
    Array.from(
      new Set(
        reservations.rows
          .filter((r) => r.ref && String(r.ref).trim())
          .map((r) => String(r.visitDateISO ?? '').trim())
          .filter(Boolean)
      )
    ).sort()
  );

  $effect(() => {
    if (dates.length > 0 && !dates.includes(selectedDate)) {
      selectedDate = dates.includes(todayISO()) ? todayISO() : dates[dates.length - 1];
    }
  });

  const dayBookings = $derived(
    reservations.rows
      .filter((r) => {
        if (!r.ref || String(r.ref).trim() === '') return false;
        if (String(r.visitDateISO ?? '').trim() !== selectedDate) return false;
        const s = normalizeStatus(r.status);
        return s === 'เสร็จสิ้น' || s === 'รอชำระเงิน';
      })
      .sort((a, b) => String(a.ref ?? '').localeCompare(String(b.ref ?? '')))
  );
</script>

<Card title="แผนผังโต๊ะ" subtitle="เฉพาะรายการสถานะ เสร็จสิ้น / รอชำระเงิน">
  <div class="mb-4 flex items-center gap-2.5">
    <label for="floor-plan-date" class="text-sm font-medium text-slate-700 dark:text-slate-300">เลือกวันที่</label>
    <select
      id="floor-plan-date"
      bind:value={selectedDate}
      class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {#each dates as d (d)}
        <option value={d}>{visitDateLabel(d)}</option>
      {/each}
    </select>
  </div>

  {#if dayBookings.length === 0}
    <p class="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
      🪑 ไม่มีโต๊ะที่มีสถานะ "เสร็จสิ้น" หรือ "รอชำระเงิน" ในวัน {visitDateLabel(selectedDate)}
    </p>
  {:else}
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {#each dayBookings as r, i (r.ref)}
        <div class="rounded-xl border p-3 {normalizeStatus(r.status) === 'รอชำระเงิน' ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40' : 'border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40'}">
          <div class="mb-1.5 flex items-center justify-between">
            <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">โต๊ะ {i + 1}</span>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-medium {normalizeStatus(r.status) === 'รอชำระเงิน' ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300' : 'bg-green-400/20 text-green-700 dark:text-green-300'}">
              {normalizeStatus(r.status) === 'รอชำระเงิน' ? 'รอชำระ' : 'เสร็จสิ้น'}
            </span>
          </div>
          <div class="truncate font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{r.ref}</div>
          <div class="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">🔒 {r.prisonerName ?? '—'}</div>
          <div class="mt-1 text-[11px] font-semibold" style="color:{wingColors[String(r.wing ?? '')] ?? '#475569'}">{r.wing ?? '—'}</div>
          <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            👥 {r.visitorCount ?? 1} คน · {formatBaht(r.total)}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Card>
