<script lang="ts">
  import { X } from '@lucide/svelte';
  import type { Snippet, Component } from 'svelte';

  let { open, title, onclose, children, footer, width = 'max-w-lg', accent = 'blue', icon, subtitle }: {
    open: boolean;
    title?: string;
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
    width?: string;
    accent?: 'blue' | 'emerald' | 'red' | 'amber' | 'sky' | 'slate';
    icon?: Component;
    subtitle?: string;
  } = $props();

  let dialogEl = $state<HTMLDivElement | null>(null);
  let lastFocused: HTMLElement | null = null;

  $effect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lastFocused = document.activeElement as HTMLElement | null;
    dialogEl?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      lastFocused?.focus();
      lastFocused = null;
    };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) onclose();
  }

  const accentBar: Record<string, string> = {
    blue: 'bg-blue-700',
    emerald: 'bg-emerald-600',
    red: 'bg-red-600',
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
    slate: 'bg-slate-400',
  };
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div
      class="absolute inset-0 z-0 animate-fade-in bg-slate-900/60 backdrop-blur-sm"
      onclick={onclose}
      aria-hidden="true"
    ></div>
    <div
      bind:this={dialogEl}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      class="animate-modal-pop relative z-[71] flex w-full {width} max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl outline-none dark:border-slate-700/60 dark:bg-slate-900"
    >
      <div class="pointer-events-none absolute inset-x-0 top-0 z-0 h-1 {accentBar[accent]}" aria-hidden="true"></div>
      {#if title}
        <div class="relative flex items-center gap-3 border-b border-slate-200/80 px-6 py-4 dark:border-slate-700/60">
          {#if icon}
            {@const HIcon = icon}
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
            >
              <HIcon class="h-5 w-5" />
            </div>
          {/if}
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {#if subtitle}
              <p class="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            {/if}
          </div>
          <button
            class="rounded-xl p-2 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            onclick={onclose}
            aria-label="ปิด"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      {/if}
      <div class="modal-scroll flex-1 overflow-y-auto px-6 py-5">
        {@render children()}
      </div>
      {#if footer}
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-slate-200/80 bg-slate-50/50 px-6 py-3.5 dark:border-slate-700/60 dark:bg-slate-800/40">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
