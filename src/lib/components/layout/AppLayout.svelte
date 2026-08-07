<script lang="ts">
  import type { Snippet } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import Topbar from './Topbar.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex h-full min-h-screen">
  <Sidebar />
  <div class="flex min-w-0 flex-1 flex-col">
    <Topbar />
    <main class="flex-1 overflow-y-auto p-4 lg:p-6">
      {@render children()}
    </main>
  </div>
</div>
