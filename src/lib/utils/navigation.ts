import type { Component } from 'svelte';
import { LayoutDashboard, CalendarDays, Archive, BarChart3, Wallet, ClipboardList, Users, UserRound, Link2, QrCode, Settings, Utensils, Bell, PanelsTopLeft, ShieldCheck, CalendarClock, CreditCard } from '@lucide/svelte';
import { visibleMenu } from './permissions';
export interface NavItem { key: string; path: string; label: string; description: string; icon: Component }
export const navigation: NavItem[] = [
  { key: 'home', path: '/dashboard', label: 'ภาพรวม', description: 'การจองวันนี้และงานที่ต้องดำเนินการ', icon: LayoutDashboard },
  { key: 'reservations', path: '/reservations', label: 'การจองเยี่ยม (VIS)', description: 'ตรวจสอบ อนุมัติ และติดตามการจองเยี่ยมผู้ต้องขัง', icon: CalendarDays },
  { key: 'reservations_archive', path: '/reservations/archive', label: 'ย้อนหลัง (VIS)', description: 'ค้นหาและตรวจสอบการจองเยี่ยมที่เก็บถาวร', icon: Archive },
  { key: 'reservations_tables', path: '/reservations/tables', label: 'การจองโต๊ะ (TBL)', description: 'จัดการการจองโต๊ะสำหรับบุคคลภายนอก', icon: Utensils },
  { key: 'reservations_tables_archive', path: '/reservations/tables/archive', label: 'ย้อนหลัง (TBL)', description: 'ค้นหาและตรวจสอบการจองโต๊ะที่เก็บถาวร', icon: Archive },
  { key: 'prisoners', path: '/prisoners', label: 'ผู้ต้องขัง', description: 'ข้อมูลผู้ต้องขังและวินัย', icon: UserRound },
  { key: 'reports', path: '/reports', label: 'สรุปการจอง', description: 'สถิติและรายงานการจอง', icon: BarChart3 },
  { key: 'reports_overall', path: '/reports/overall', label: 'รายงานการเงิน', description: 'รายได้และการชำระเงิน', icon: Wallet },
  { key: 'reports_tables', path: '/reports/tables', label: 'รายงานโต๊ะ (TBL)', description: 'รายงานการใช้โต๊ะ', icon: Utensils },
  { key: 'promptpay', path: '/promptpay', label: 'PromptPay QR', description: 'จัดการ QR สำหรับชำระเงิน', icon: QrCode },
  { key: 'refunds', path: '/refunds', label: 'คืนเงิน', description: 'เลือกการจอง จัดทำเอกสาร และพิมพ์รายงานคืนเงิน', icon: Wallet },
  { key: 'notifications', path: '/notifications', label: 'ส่งแจ้งเตือน', description: 'ส่งข่าวสารให้ผู้สมัครรับการแจ้งเตือน', icon: Bell },
  { key: 'users', path: '/users', label: 'ผู้ใช้งาน', description: 'บัญชีและสิทธิ์การใช้งาน', icon: Users },
  { key: 'eventlog', path: '/eventlog', label: 'บันทึกเหตุการณ์', description: 'ติดตามกิจกรรมในระบบ', icon: ClipboardList },
  { key: 'connection', path: '/connection', label: 'การเชื่อมต่อ', description: 'ตรวจสอบบริการที่เชื่อมต่อ', icon: Link2 },
  { key: 'frontend_editor', path: '/frontend-editor', label: 'Frontend Editor', description: 'ข้อความทุกหน้า โปรโมชั่น รูปภาพ และประกาศ', icon: PanelsTopLeft },
  { key: 'booking_settings', path: '/booking-settings', label: 'การเปิดรับจองและปฏิทิน', description: 'เปิด/ปิดการจอง นับถอยหลัง และกำหนดวันที่', icon: CalendarClock },
  { key: 'payment_settings', path: '/payment-settings', label: 'การรับชำระเงิน', description: 'เปิด/ปิดการรับเงินและข้อความแจ้งผู้จอง', icon: CreditCard },
  { key: 'privacy_settings', path: '/privacy-settings', label: 'คุกกี้และ PDPA', description: 'นโยบายความเป็นส่วนตัวและข้อมูลความยินยอม', icon: ShieldCheck },
  { key: 'settings', path: '/settings', label: 'ตั้งค่าระบบ', description: 'ธีม การดูแลคลังข้อมูล และการตั้งค่าขั้นสูง', icon: Settings },
];
export const navGroups = [
  { label: 'ภาพรวม', keys: ['home'] },
  { label: 'การจองและผู้ต้องขัง', keys: ['reservations', 'reservations_archive', 'reservations_tables', 'reservations_tables_archive', 'prisoners', 'booking_settings'] },
  { label: 'รายงาน', keys: ['reports', 'reports_overall', 'reports_tables'] },
  { label: 'การชำระเงิน', keys: ['refunds', 'promptpay', 'payment_settings'] },
  { label: 'เว็บไซต์และการสื่อสาร', keys: ['frontend_editor', 'notifications'] },
  { label: 'ดูแลระบบ', keys: ['users', 'eventlog', 'connection', 'privacy_settings', 'settings'] },
];
export function menuFor(role: string | undefined): NavItem[] {
  const allowed = visibleMenu(role);
  return navGroups.flatMap(group => group.keys.flatMap(key => {
    const item = navigation.find(entry => entry.key === key);
    return item && allowed.includes(key) ? [item] : [];
  }));
}
