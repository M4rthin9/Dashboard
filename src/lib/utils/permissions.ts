export type Role = 'Superadmin' | 'Admin' | 'Finance' | 'Vinai' | 'Tadtel' | 'User';

export const PERMISSIONS: Record<Role, string[]> = {
  Superadmin: [
    'approve', 'reject', 'approve_discipline', 'reject_discipline',
    'approve_participant', 'confirm_payment', 'reject_payment',
    'cancel', 'visitor_approval', 'view_slip', 'view_detail',
    'export', 'print', 'manage_users', 'manage_settings', 'view_eventlog',
  ],
  Admin: [
    'approve', 'reject', 'approve_discipline', 'reject_discipline',
    'approve_participant', 'confirm_payment', 'reject_payment',
    'cancel', 'visitor_approval', 'view_slip', 'view_detail',
    'export', 'print', 'view_eventlog',
  ],
  Finance: ['confirm_payment', 'reject_payment', 'cancel', 'view_slip', 'view_detail'],
  Vinai: ['approve_discipline', 'reject_discipline', 'view_slip', 'view_detail'],
  Tadtel: ['approve_participant', 'visitor_approval', 'view_slip', 'view_detail'],
  User: ['print'],
};

export const SIDEBAR_MENU: Record<Role, string[]> = {
  Superadmin: ['home', 'reservations', 'reports', 'reports_overall', 'eventlog', 'users', 'prisoners', 'connection', 'promptpay', 'settings'],
  Admin: ['home', 'reservations', 'reports', 'reports_overall', 'eventlog', 'prisoners', 'connection'],
  Finance: ['reservations', 'reports', 'reports_overall'],
  Vinai: ['home', 'reservations', 'reports', 'reports_overall'],
  Tadtel: ['home', 'reservations', 'reports', 'reports_overall'],
  User: ['home'],
};

export function hasPermission(role: string | undefined, permission: string): boolean {
  if (!role) return false;
  return (PERMISSIONS[role as Role] ?? []).includes(permission);
}

export function visibleMenu(role: string | undefined): string[] {
  if (!role) return [];
  return SIDEBAR_MENU[role as Role] ?? [];
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    Superadmin: 'ผู้ดูแลระบบ',
    Admin: 'ผู้ดูแล',
    Finance: 'การเงิน',
    Vinai: 'ฝ่ายวินัย',
    Tadtel: 'ฝ่ายต้อนรับ',
    User: 'ผู้ใช้',
  };
  return labels[role] ?? role;
}
