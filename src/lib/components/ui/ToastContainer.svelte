<script lang="ts">
  import { CheckCircle2, AlertTriangle, Info, XCircle, X } from '@lucide/svelte';
  import { ui } from '../../store/ui.svelte';

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-sky-600 dark:text-sky-400',
  };
</script>

{#if ui.toasts.length > 0}
  <div class="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
    {#each ui.toasts as toast (toast.id)}
      {@const Icon = icons[toast.type]}
      <div
        class="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-lg dark:border-slate-700/60 dark:bg-slate-800"
        role="alert"
      >
        <Icon class="mt-0.5 h-5 w-5 shrink-0 {colors[toast.type]}" />
        <div class="flex-1">
          <p class="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{toast.message}</p>
          {#if toast.ok}
            <button
              class="mt-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
              onclick={() => ui.dismissToast(toast.id)}
            >
              {toast.ok}
            </button>
          {/if}
        </div>
        <button
          class="rounded-xl p-1 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          onclick={() => ui.dismissToast(toast.id)}
          aria-label="ปิด"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/each}
  </div>
{/if}
