<script lang="ts">
  import { onMount } from 'svelte';
  import AppLayout from './lib/components/layout/AppLayout.svelte';
  import ToastContainer from './lib/components/ui/ToastContainer.svelte';
  import { ui } from './lib/store/ui.svelte';
  import { resolveRoute, type RouteDef } from './lib/router';

  let route = $state<RouteDef>(resolveRoute());

  $effect(() => {
    route = resolveRoute();
  });

  onMount(() => {
    ui.initDarkMode();
    window.addEventListener('hashchange', () => {
      route = resolveRoute();
    });
  });
</script>

<svelte:boundary {onerror}>
  <ToastContainer />

  {#if route.path === '/login'}
    <route.component />
  {:else}
    <AppLayout>
      <route.component />
    </AppLayout>
  {/if}
</svelte:boundary>

{#snippet onerror(error: unknown)}
  <div class="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
    <p class="text-base font-semibold text-red-600 dark:text-red-400">เกิดข้อผิดพลาดในการแสดงหน้านี้</p>
    <p class="max-w-md break-words text-xs text-red-500 dark:text-red-400">
      {error instanceof Error ? error.message : String(error)}
    </p>
    <button
      class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      onclick={() => location.reload()}
      aria-label="ลองใหม่"
    >
      ลองใหม่
    </button>
  </div>
{/snippet}
