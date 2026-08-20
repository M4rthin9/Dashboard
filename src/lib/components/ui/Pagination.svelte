<script lang="ts">
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';

  let { page, totalPages, onchange }: { page: number; totalPages: number; onchange: (page: number) => void } = $props();

  const pages = $derived.by(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const out: Array<number | '…'> = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) out.push('…');
    for (let p = start; p <= end; p++) out.push(p);
    if (end < totalPages - 1) out.push('…');
    out.push(totalPages);
    return out;
  });
</script>

{#if totalPages > 1}
  <nav class="flex items-center gap-1" aria-label="แบ่งหน้า">
    <button
      class="rounded-xl border border-slate-300 p-1.5 text-slate-500 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
      onclick={() => onchange(page - 1)}
      disabled={page <= 1}
      aria-label="ก่อนหน้า"
    >
      <ChevronLeft class="h-4 w-4" />
    </button>
    {#each pages as p, i (p === '…' ? `e-${i}` : p)}
      {#if p === '…'}
        <span class="px-1.5 text-sm text-slate-400 dark:text-slate-500">…</span>
      {:else}
        <button
          class="min-w-8 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 {p === page
            ? 'bg-blue-700 text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
          onclick={() => onchange(p)}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      {/if}
    {/each}
    <button
      class="rounded-xl border border-slate-300 p-1.5 text-slate-500 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
      onclick={() => onchange(page + 1)}
      disabled={page >= totalPages}
      aria-label="ถัดไป"
    >
      <ChevronRight class="h-4 w-4" />
    </button>
  </nav>
{/if}
