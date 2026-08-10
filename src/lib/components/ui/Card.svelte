<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    subtitle,
    actions,
    padding = true,
    interactive = false,
    children,
  }: {
    title?: string;
    subtitle?: string;
    actions?: Snippet;
    padding?: boolean;
    interactive?: boolean;
    children: Snippet;
  } = $props();
</script>

<div
  class="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900 {interactive
    ? 'transition-shadow duration-200 ease-out hover:shadow-md'
    : ''}"
>
  {#if title || actions}
    <div class="flex items-center justify-between gap-3 border-b border-slate-200/80 px-6 py-4 dark:border-slate-700/60">
      <div>
        {#if title}
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {/if}
        {#if subtitle}
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex items-center gap-2">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  <div class={padding ? 'p-6' : ''}>
    {@render children()}
  </div>
</div>
