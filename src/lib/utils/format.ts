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
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300';
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
