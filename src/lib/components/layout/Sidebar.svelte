<script lang="ts">
  import type { Component } from 'svelte';
  import {
    LayoutDashboard,
    CalendarDays,
    BarChart3,
    ClipboardList,
    Users,
    UserRound,
    Link2,
    Settings,
  } from '@lucide/svelte';
  import { auth } from '../../store/auth.svelte';
  import { visibleMenu, roleLabel } from '../../utils/permissions';
  import { currentPath } from '../../router';

  interface NavItem {
    path: string;
    label: string;
    icon: Component;
  }

  const NAV_ITEMS: Record<string, NavItem> = {
    home: { path: '/dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
    reservations: { path: '/reservations', label: 'ระบบจอง', icon: CalendarDays },
    reports: { path: '/reports', label: 'รายงาน', icon: BarChart3 },
    eventlog: { path: '/eventlog', label: 'บันทึกเหตุการณ์', icon: ClipboardList },
    users: { path: '/users', label: 'ผู้ใช้', icon: Users },
    prisoners: { path: '/prisoners', label: 'ผู้ต้องขัง', icon: UserRound },
    connection: { path: '/connection', label: 'การเชื่อมต่อ', icon: Link2 },
    settings: { path: '/settings', label: 'ตั้งค่า', icon: Settings },
  };

  let items = $derived(
    visibleMenu(auth.user?.role).map((key) => NAV_ITEMS[key]).filter(Boolean)
  );
  let activePath = $derived(currentPath());
</script>

<aside class="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-900 text-slate-100 lg:flex">
  <div class="flex h-16 shrink-0 items-center gap-2.5 px-5">
    <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold">
      CCC
    </span>
    <div>
      <p class="text-sm font-semibold leading-tight">CCC Dashboard</p>
      <p class="text-xs text-slate-400">ระบบจองเยี่ยม</p>
    </div>
  </div>

  <nav class="flex-1 overflow-y-auto px-3 py-5">
    <ul class="flex flex-col gap-1">
      {#each items as item (item.path)}
        {@const Icon = item.icon}
        {@const isActive = activePath === item.path}
        <li>
          <a
            href="#{item.path}"
            class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ease-in-out {isActive
              ? 'bg-indigo-600/15 text-indigo-400'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'}"
          >
            {#if isActive}
              <span class="h-5 w-0.5 shrink-0 rounded-full bg-indigo-500"></span>
            {/if}
            <Icon class={isActive ? 'h-[18px] w-[18px] text-indigo-400' : 'h-[18px] w-[18px] text-slate-400'} />
            {item.label}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="shrink-0 border-t border-slate-800 px-5 py-4">
    <div class="flex items-center gap-3">
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
        {(auth.displayName || '?').slice(0, 1).toUpperCase()}
      </span>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-slate-100">{auth.displayName}</p>
        <p class="truncate text-xs text-slate-400">{roleLabel(auth.user?.role ?? '')}</p>
      </div>
    </div>
  </div>
</aside>
