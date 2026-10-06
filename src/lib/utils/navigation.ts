import type { Component } from 'svelte';
import { LayoutDashboard, CalendarDays, Archive, BarChart3, Wallet, ClipboardList, Users, UserRound, Link2, QrCode, Settings, Utensils } from '@lucide/svelte';
import { visibleMenu } from './permissions';
export interface NavItem { key: string; path: string; label: string; description: string; icon: Component }
export const navigation: NavItem[] = [
  { key: 'home', path: '/dashboard', label: 'ภาพรวม', description: 'การจองวันนี้และงานที่ต้องดำเนินการ', icon: LayoutDashboard },
  { key: 'reservations', path: '/reservations', label: 'จัดการการจอง', description: 'ตรวจสอบ อนุมัติ และติดตามการจอง', icon: CalendarDays },
  { key: 'reservations_archive', path: '/reservations/archive', label: 'การจองย้อนหลัง', description: 'ค้นหาและตรวจสอบการจองที่เก็บถาวร', icon: Archive },
  { key: 'prisoners', path: '/prisoners', label: 'ผู้ต้องขัง', description: 'ข้อมูลผู้ต้องขังและวินัย', icon: UserRound },
  { key: 'reports', path: '/reports', label: 'สรุปการจอง', description: 'สถิติและรายงานการจอง', icon: BarChart3 },
  { key: 'reports_overall', path: '/reports/overall', label: 'รายงานการเงิน', description: 'รายได้และการชำระเงิน', icon: Wallet },
  { key: 'reports_tables', path: '/reports/tables', label: 'รายงานโต๊ะ (TBL)', description: 'รายงานการใช้โต๊ะ', icon: Utensils },
  { key: 'promptpay', path: '/promptpay', label: 'PromptPay QR', description: 'จัดการ QR สำหรับชำระเงิน', icon: QrCode },
  { key: 'users', path: '/users', label: 'ผู้ใช้งาน', description: 'บัญชีและสิทธิ์การใช้งาน', icon: Users },
  { key: 'eventlog', path: '/eventlog', label: 'บันทึกเหตุการณ์', description: 'ติดตามกิจกรรมในระบบ', icon: ClipboardList },
  { key: 'connection', path: '/connection', label: 'การเชื่อมต่อ', description: 'ตรวจสอบบริการที่เชื่อมต่อ', icon: Link2 },
  { key: 'settings', path: '/settings', label: 'ตั้งค่าระบบ', description: 'การจองและการตั้งค่าทั่วไป', icon: Settings },
];
export const navGroups = [
  { label: 'งานประจำวัน', keys: ['home', 'reservations', 'reservations_archive', 'prisoners'] },
  { label: 'รายงานและการเงิน', keys: ['reports', 'reports_overall', 'reports_tables', 'promptpay'] },
  { label: 'ดูแลระบบ', keys: ['users', 'eventlog', 'connection', 'settings'] },
];
export function menuFor(role: string | undefined): NavItem[] {
  const allowed = visibleMenu(role);
  return navigation.filter(item => allowed.includes(item.key));
}
