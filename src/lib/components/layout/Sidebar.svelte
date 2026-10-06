<script lang="ts">
  import { ChevronDown, BarChart3 } from '@lucide/svelte';
  import { auth } from '../../store/auth.svelte';
  import { roleLabel } from '../../utils/permissions';
  import { menuFor, navGroups } from '../../utils/navigation';
  import { currentPath } from '../../router';
  let items = $derived(menuFor(auth.user?.role));
  let activePath = $derived(currentPath());
  let reportsOpen = $state(true);
  $effect(() => { if (activePath.startsWith('/reports')) reportsOpen = true; });
</script>

<aside class="workspace-sidebar sticky top-0 z-20 hidden h-screen w-[270px] shrink-0 flex-col lg:flex">
  <a href="#{items[0]?.path ?? '/login'}" class="flex h-24 shrink-0 items-center gap-3 px-6">
    <img src="/cida-logo.png" alt="CCC" class="h-11 w-11 rounded-2xl bg-white object-contain p-1" />
    <div><p class="text-lg font-semibold tracking-tight text-white">C&C <span class="font-light text-white/60">Workspace</span></p><p class="mt-0.5 text-[11px] tracking-widest text-white/45">ระบบบริหารการจองเยี่ยม</p></div>
  </a>
  <nav class="flex-1 overflow-y-auto px-4 pb-5" aria-label="เมนูหลัก">
    {#each navGroups as group (group.label)}
      {@const groupItems = items.filter(item => group.keys.includes(item.key))}
      {#if groupItems.length}
        <div class="mb-6">
          <p class="mb-2 px-3 text-[10px] font-medium tracking-wider text-white/40">{group.label}</p>
          {#if group.label === 'รายงานและการเงิน' && groupItems.some(item => item.path.startsWith('/reports'))}
            <button class="sidebar-link w-full justify-between" onclick={() => reportsOpen = !reportsOpen} aria-expanded={reportsOpen} aria-controls="report-submenu">
              <span class="flex items-center gap-3"><BarChart3 class="h-[18px] w-[18px]" />รายงาน</span><ChevronDown class="h-4 w-4 transition-transform {reportsOpen ? 'rotate-180' : ''}" />
            </button>
            <div id="report-submenu" hidden={!reportsOpen} class="ml-5 mt-1 border-l border-white/15 pl-3">
              {#each groupItems.filter(item => item.path.startsWith('/reports')) as item (item.key)}
                <a href="#{item.path}" aria-current={activePath === item.path ? 'page' : undefined} class="sidebar-link text-xs {activePath === item.path ? 'selected' : ''}">{item.label}</a>
              {/each}
            </div>
          {/if}
          {#each groupItems.filter(item => group.label !== 'รายงานและการเงิน' || !item.path.startsWith('/reports')) as item (item.key)}
            {@const Icon = item.icon}
            <a href="#{item.path}" aria-current={activePath === item.path ? 'page' : undefined} class="sidebar-link {activePath === item.path ? 'selected' : ''}"><Icon class="h-[18px] w-[18px]" />{item.label}{#if activePath === item.path}<span class="ml-auto h-1.5 w-1.5 rounded-full bg-amber-300"></span>{/if}</a>
          {/each}
        </div>
      {/if}
    {/each}
  </nav>

  <div class="flex items-center gap-3 border-t border-white/10 px-5 py-4">
    <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-sm font-semibold text-blue-900">{(auth.displayName || '?').slice(0, 1).toUpperCase()}</span>
    <div class="min-w-0"><p class="truncate text-sm text-white">{auth.displayName}</p><p class="text-xs text-white/45">{roleLabel(auth.user?.role ?? '')}</p></div>
  </div>
</aside>
