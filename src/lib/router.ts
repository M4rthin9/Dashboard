import type { Component } from 'svelte';
import Login from '../routes/Login.svelte';
import Reservations from '../routes/Reservations.svelte';
import EventLog from '../routes/EventLog.svelte';
import Users from '../routes/Users.svelte';
import Prisoners from '../routes/Prisoners.svelte';
import Connection from '../routes/Connection.svelte';
import Settings from '../routes/Settings.svelte';
import { hashState } from './store/hash.svelte';
import { auth } from './store/auth.svelte';
import { visibleMenu } from './utils/permissions';

export interface RouteDef {
  path: string;
  key: string;
  title: string;
  component?: Component;
  loader?: () => Promise<{ default: Component }>;
  roles?: string[];
}

export const routes: RouteDef[] = [
  { path: '/login', key: 'login', title: 'เข้าสู่ระบบ', component: Login },
  { path: '/dashboard', key: 'home', title: 'หน้าหลัก', loader: () => import('../routes/Dashboard.svelte') },
  { path: '/reservations', key: 'reservations', title: 'การจองเยี่ยม (VIS)', component: Reservations },
  { path: '/reservations/archive', key: 'reservations_archive', title: 'การจองเยี่ยมย้อนหลัง (VIS)', component: Reservations },
  { path: '/reservations/tables', key: 'reservations_tables', title: 'การจองโต๊ะ (TBL)', component: Reservations },
  { path: '/reservations/tables/archive', key: 'reservations_tables_archive', title: 'การจองโต๊ะย้อนหลัง (TBL)', component: Reservations },
  { path: '/reports', key: 'reports', title: 'รายงาน', loader: () => import('../routes/Reports.svelte') },
  { path: '/reports/overall', key: 'reports_overall', title: 'รายงานการเงิน', loader: () => import('../routes/OverallReport.svelte') },
  { path: '/reports/tables', key: 'reports_tables', title: 'รายงานโต๊ะ (TBL)', loader: () => import('../routes/TableReport.svelte') },
  { path: '/eventlog', key: 'eventlog', title: 'บันทึกเหตุการณ์', component: EventLog, roles: ['Superadmin', 'Admin'] },
  { path: '/users', key: 'users', title: 'ผู้ใช้', component: Users, roles: ['Superadmin'] },
  { path: '/notifications', key: 'notifications', title: 'ส่งแจ้งเตือน', loader: () => import('../routes/Notifications.svelte'), roles: ['Superadmin'] },
  { path: '/prisoners', key: 'prisoners', title: 'ผู้ต้องขัง', component: Prisoners },
  { path: '/connection', key: 'connection', title: 'การเชื่อมต่อ', component: Connection },
  { path: '/promptpay', key: 'promptpay', title: 'PromptPay QR', loader: () => import('../routes/PromptPay.svelte') },
  { path: '/settings', key: 'settings', title: 'ตั้งค่า', component: Settings },
  { path: '/frontend-editor', key: 'frontend_editor', title: 'Frontend Editor', loader: () => import('../routes/FrontendEditor.svelte'), roles: ['Superadmin'] },
  { path: '/booking-settings', key: 'booking_settings', title: 'การเปิดรับจองและปฏิทิน', loader: () => import('../routes/BookingSettings.svelte'), roles: ['Superadmin'] },
  { path: '/payment-settings', key: 'payment_settings', title: 'การรับชำระเงิน', loader: () => import('../routes/PaymentSettings.svelte'), roles: ['Superadmin'] },
  { path: '/privacy-settings', key: 'privacy_settings', title: 'คุกกี้และ PDPA', loader: () => import('../routes/PrivacySettings.svelte'), roles: ['Superadmin'] },
];

export function navigate(path: string): void {
  if (location.hash === `#${path}`) return;
  location.hash = path;
}

export function currentPath(): string {
  const raw = hashState.value.replace(/^#/, '') || '/dashboard';
  const qi = raw.indexOf('?');
  return qi === -1 ? raw : raw.slice(0, qi);
}

export function currentQuery(): URLSearchParams {
  const raw = hashState.value.replace(/^#/, '');
  const qi = raw.indexOf('?');
  return qi === -1 ? new URLSearchParams() : new URLSearchParams(raw.slice(qi + 1));
}

export function resolveRoute(): RouteDef {
  const path = currentPath();
  const allowed = visibleMenu(auth.user?.role ?? 'User');
  const fallback = routes.find((r) => r.path !== '/login' && allowed.includes(r.key) && (!r.roles || r.roles.includes(auth.user?.role ?? 'User'))) ?? routes[0];
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
