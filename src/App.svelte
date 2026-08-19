<script lang="ts">
  import { onMount } from 'svelte';
  import AppLayout from './lib/components/layout/AppLayout.svelte';
  import DevBanner from './lib/components/layout/DevBanner.svelte';
  import LazyRoute from './lib/components/LazyRoute.svelte';
  import ToastContainer from './lib/components/ui/ToastContainer.svelte';
  import AlertBox from './lib/components/ui/AlertBox.svelte';
  import { ui } from './lib/store/ui.svelte';
  import { auth } from './lib/store/auth.svelte';
  import { liveSync } from './lib/store/liveSync.svelte';
  import { reservations } from './lib/store/reservations.svelte';
  import { resolveRoute } from './lib/router';

  const route = $derived(resolveRoute());

  onMount(() => {
    ui.initDarkMode();
  });

  // Poll the backend change counters while signed in and refetch only the slice
  // that actually moved, so one admin's approval reaches the others within a
  // few seconds instead of on their next manual reload.
  $effect(() => {
    if (!auth.accessToken) {
      liveSync.stop();
      return;
    }
    const off = liveSync.subscribe(async (scopes) => {
      if (scopes.includes('reservations')) await reservations.refresh();
    });
    liveSync.start();
    return () => {
      off();
      liveSync.stop();
    };
  });
</script>

<svelte:boundary {onerror}>
  <DevBanner />
  <ToastContainer />
  <AlertBox />

  {#if route.path === '/login'}
    <LazyRoute {route} />
  {:else}
    <AppLayout>
      <LazyRoute {route} />
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
