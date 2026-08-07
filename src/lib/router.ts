import type { Component } from 'svelte';
import Login from '../routes/Login.svelte';
import Dashboard from '../routes/Dashboard.svelte';
import Reservations from '../routes/Reservations.svelte';
import Reports from '../routes/Reports.svelte';
import EventLog from '../routes/EventLog.svelte';
import Users from '../routes/Users.svelte';
import Prisoners from '../routes/Prisoners.svelte';
import Connection from '../routes/Connection.svelte';
import Settings from '../routes/Settings.svelte';
import { auth } from './store/auth.svelte';
import { visibleMenu } from './utils/permissions';

export interface RouteDef {
  path: string;
  key: string;
  title: string;
  component: Component;
  roles?: string[];
}

export const routes: RouteDef[] = [
  { path: '/login', key: 'login', title: 'เข้าสู่ระบบ', component: Login },
  { path: '/dashboard', key: 'home', title: 'หน้าหลัก', component: Dashboard },
  { path: '/reservations', key: 'reservations', title: 'ระบบจอง', component: Reservations },
  { path: '/reports', key: 'reports', title: 'รายงาน', component: Reports },
  { path: '/eventlog', key: 'eventlog', title: 'บันทึกเหตุการณ์', component: EventLog, roles: ['Superadmin', 'Admin'] },
  { path: '/users', key: 'users', title: 'ผู้ใช้', component: Users, roles: ['Superadmin'] },
  { path: '/prisoners', key: 'prisoners', title: 'ผู้ต้องขัง', component: Prisoners },
  { path: '/connection', key: 'connection', title: 'การเชื่อมต่อ', component: Connection },
  { path: '/settings', key: 'settings', title: 'ตั้งค่า', component: Settings },
];

export function navigate(path: string): void {
  if (location.hash === `#${path}`) return;
  location.hash = path;
}

export function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/dashboard';
}

export function resolveRoute(): RouteDef {
  const path = currentPath();
  const fallback = routes.find((r) => r.path === '/dashboard')!;
  const candidate = routes.find((r) => r.path === path) ?? fallback;

  if (candidate.path === '/login') {
    return auth.isAuthenticated ? fallback : candidate;
  }
  if (!auth.isAuthenticated) {
    return routes.find((r) => r.path === '/login')!;
  }
  if (candidate.roles && auth.user && !candidate.roles.includes(auth.user.role)) {
    return fallback;
  }
  if (auth.user && !visibleMenu(auth.user.role).includes(candidate.key)) {
    return fallback;
  }
  return candidate;
}
