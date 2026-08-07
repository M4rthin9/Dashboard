<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    subtitle,
    actions,
    padding = true,
    children,
  }: {
    title?: string;
    subtitle?: string;
    actions?: Snippet;
    padding?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
  {#if title || actions}
    <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
      <div>
        {#if title}
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {/if}
        {#if subtitle}
          <p class="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex items-center gap-2">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  <div class={padding ? 'p-5' : ''}>
    {@render children()}
  </div>
</div>
