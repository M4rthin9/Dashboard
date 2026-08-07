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

<ToastContainer />

{#if route.path === '/login'}
  <route.component />
{:else}
  <AppLayout>
    <route.component />
  </AppLayout>
{/if}
