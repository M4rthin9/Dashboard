import type { Reservation } from '../api/types';

export interface ExtraVisitor {
  name: string;
  id: string;
  relation: string;
  age: string;
  approved: string;
}

export function parseExtraVisitors(row: Reservation): ExtraVisitor[] {
  const str = String(row.extraVisitorNames ?? '').trim();
  if (!str) return [];
  const isNew = str.includes(';;') || str.includes('|');
  let items: Array<{ name: string; id: string; relation: string; age: string }>;
  if (isNew) {
    items = str.split(';;').map((e) => {
      const p = e.split('|');
      return { name: (p[0] ?? '').trim(), id: (p[1] ?? '').trim(), relation: (p[2] ?? '').trim(), age: (p[3] ?? '').trim() };
    });
  } else {
    items = str.split(/,(?![^(]*\))/).map((e) => {
      const m = e.trim().match(/^(.+?)\s*\(/);
      return { name: m ? m[1].trim() : e.trim(), id: '', relation: m ? e.trim().slice(m[0].length, -1) : '', age: '' };
    });
  }
  const appr = String(row.extraVisitorApproved ?? '').split(';;');
  return items
    .filter((v) => v.name)
    .map((v, i) => ({ ...v, approved: (appr[i] ?? '').trim() }));
}

export function computeDeptReportData(row: Reservation): { adults: number; kids5_8: number; kidsUnder5: number } {
  const extras = parseExtraVisitors(row);
  let adults = 1;
  let kids5_8 = 0;
  let kidsUnder5 = 0;
  extras.forEach((v) => {
    if (v.approved === 'no') return;
    if (v.relation === 'บุตร / ธิดา') {
      const a = parseInt(v.age, 10);
      if (!isNaN(a)) {
        if (a < 5) kidsUnder5++;
        else if (a <= 8) kids5_8++;
        else adults++;
      } else {
        adults++;
      }
    } else {
      adults++;
    }
  });
  return { adults, kids5_8, kidsUnder5 };
}

export function formatBaht(value: unknown): string {
  const n = Number(value ?? 0);
  if (isNaN(n)) return '0 บาท';
  return n.toLocaleString('th-TH') + ' บาท';
}

export function formatNumber(value: unknown): string {
  const n = Number(value ?? 0);
  if (isNaN(n)) return '0';
  return n.toLocaleString('th-TH');
}

export function formatDateThai(value: string | Date | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTimeThai(value: string | Date | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function visitDateLabel(visitDate?: string, visitDateISO?: string): string {
  const src = String(visitDateISO && visitDateISO.trim() ? visitDateISO : visitDate ?? '').trim();
  if (!src) return '—';
  const m = src.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d.getTime())) return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return src.replace(/^วัน.+?\s+ที่\s*/, '');
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isSameDay(iso: string | undefined, date: Date): boolean {
  if (!iso) return false;
  return iso === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const STATUS_LABELS: Record<string, string> = {
  'รอตรวจสอบผู้เข้าร่วม': 'รอตรวจสอบผู้เข้าร่วม',
  'รอตรวจสอบวินัย': 'รอตรวจสอบวินัย',
  'รอชำระเงิน': 'รอชำระเงิน',
  'ชำระแล้ว': 'ชำระแล้ว',
  'เสร็จสิ้น': 'เสร็จสิ้น',
  'ไม่อนุมัติ': 'ไม่อนุมัติ',
  'ยกเลิก': 'ยกเลิก',
};

export const STATUS_STEPS = ['รอตรวจสอบผู้เข้าร่วม', 'รอตรวจสอบวินัย', 'รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'];

export function normalizeStatus(status: string | undefined): string {
  const s = String(status ?? '').trim();
  if (s === 'รอตรวจสอบ') return 'รอตรวจสอบผู้เข้าร่วม';
  return s;
}

export const STATUS_COLORS: Record<string, string> = {
  'รอตรวจสอบผู้เข้าร่วม': '#d97706',
  'รอตรวจสอบวินัย': '#1e3a5f',
  'รอชำระเงิน': '#2563eb',
  'ชำระแล้ว': '#0f766e',
  'เสร็จสิ้น': '#1e3a5f',
  'ไม่อนุมัติ': '#b91c1c',
  'ยกเลิก': '#64748b',
};

export function statusColor(status: string | undefined): string {
  switch (status) {
    case 'รอตรวจสอบผู้เข้าร่วม':
    case 'รอตรวจสอบ':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    case 'รอตรวจสอบวินัย':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
    case 'รอชำระเงิน':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    case 'ชำระแล้ว':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    case 'เสร็จสิ้น':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'ไม่อนุมัติ':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    case 'ยกเลิก':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}
