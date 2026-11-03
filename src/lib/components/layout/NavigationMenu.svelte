<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { auth } from '../../store/auth.svelte';
  import { currentPath } from '../../router';
  import { menuFor, navGroups } from '../../utils/navigation';

  let { idPrefix, onNavigate }: { idPrefix: string; onNavigate?: (path: string) => void } = $props();
  const items = $derived(menuFor(auth.user?.role));
  const groups = $derived(navGroups.map(group => ({ ...group, items: items.filter(item => group.keys.includes(item.key)) })).filter(group => group.items.length));
  const activePath = $derived(currentPath());
  // A writable derived value preserves manual toggling until the route or role changes.
  let expanded = $derived<string | null>(groups.find(group => !group.keys.includes('home') && group.items.some(item => item.path === activePath))?.label ?? null);
</script>

<nav class="navigation-menu" aria-label="เมนูหลัก">
  {#each groups as group, index (group.label)}
    {@const GroupIcon = group.icon}
    {#if group.keys.includes('home')}
      {#each group.items as item (item.key)}
        <a href="#{item.path}" class="navigation-home {activePath === item.path ? 'selected' : ''}" aria-current={activePath === item.path ? 'page' : undefined} onclick={() => onNavigate?.(item.path)}>
          <GroupIcon class="h-[18px] w-[18px] shrink-0" />{item.label}
        </a>
      {/each}
    {:else}
      {@const isExpanded = expanded === group.label}
      {@const isActive = group.items.some(item => item.path === activePath)}
      <div class="navigation-category">
        <button class="navigation-category-toggle {isActive ? 'current' : ''}" aria-expanded={isExpanded} aria-controls="{idPrefix}-category-{index}" onclick={() => expanded = isExpanded ? null : group.label}>
          <GroupIcon class="h-[18px] w-[18px] shrink-0" />
          <span class="min-w-0 flex-1 text-left">{group.label}</span>
          <ChevronDown class="navigation-chevron h-3.5 w-3.5 shrink-0 {isExpanded ? 'rotate-180' : ''}" />
        </button>
        <div id="{idPrefix}-category-{index}" class="navigation-children" hidden={!isExpanded}>
          {#each group.items as item (item.key)}
            <a href="#{item.path}" class:selected={activePath === item.path} aria-current={activePath === item.path ? 'page' : undefined} onclick={() => onNavigate?.(item.path)}>{item.label}</a>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</nav>
