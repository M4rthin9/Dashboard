<script lang="ts">
  import type { Snippet } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import Topbar from './Topbar.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-screen w-full bg-slate-50/50 dark:bg-slate-950">
  <Sidebar />
  <div class="flex min-w-0 flex-1 flex-col">
    <Topbar />
    <main class="flex-1 overflow-y-auto overflow-x-hidden">
      <div class="w-full px-4 py-6 lg:px-6 lg:py-8">
        {@render children()}
      </div>
    </main>
  </div>
</div>
