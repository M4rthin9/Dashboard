<script lang="ts">
  import { X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  let { open, title, onclose, children, width = 'max-w-lg' }: {
    open: boolean;
    title?: string;
    onclose: () => void;
    children: Snippet;
    width?: string;
  } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      onclick={onclose}
      aria-hidden="true"
    ></div>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      class="relative w-full {width} max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
    >
      {#if title}
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            onclick={onclose}
            aria-label="ปิด"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      {/if}
      <div class="p-5">{@render children()}</div>
    </div>
  </div>
{/if}
