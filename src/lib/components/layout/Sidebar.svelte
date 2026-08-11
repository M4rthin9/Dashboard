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

<aside class="sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 lg:flex">
  <div class="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-100 px-5 dark:border-slate-800">
    <img src="/cida-logo.png" alt="CCC" class="h-9 w-9 shrink-0 rounded-lg object-contain shadow-sm" />
    <div>
      <p class="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">CCC Dashboard</p>
      <p class="text-xs text-slate-400 dark:text-slate-500">ระบบจองเยี่ยม</p>
    </div>
  </div>

  <nav class="flex-1 overflow-y-auto px-3 py-4">
    <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">เมนู</p>
    <ul class="flex flex-col gap-0.5">
      {#each items as item (item.path)}
        {@const Icon = item.icon}
        {@const isActive = activePath === item.path}
        <li>
          <a
            href="#{item.path}"
            class="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ease-in-out {isActive
              ? 'bg-blue-50 text-blue-800 dark:bg-blue-600/15 dark:text-blue-300'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}"
          >
            <span
              class="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-blue-700 transition-all duration-150 ease-in-out {isActive
                ? 'w-1 opacity-100'
                : 'w-0 opacity-0'}"
            ></span>
            <Icon
              class="h-5 w-5 shrink-0 {isActive
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'}"
            />
            {item.label}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="shrink-0 border-t border-slate-200 px-4 py-4 dark:border-slate-800">
    <div class="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 dark:bg-blue-600/20 dark:text-blue-300">
        {(auth.displayName || '?').slice(0, 1).toUpperCase()}
      </span>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{auth.displayName}</p>
        <p class="truncate text-xs text-slate-500 dark:text-slate-400">{roleLabel(auth.user?.role ?? '')}</p>
      </div>
    </div>
  </div>
</aside>
