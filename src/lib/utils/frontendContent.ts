import catalog from '../content/frontend-text.json';
import type { FrontendContent, FrontendChanges } from '../api/endpoints';

export const contentLanguages = ['th', 'en', 'zh', 'vi'] as const;
export type ContentLanguage = (typeof contentLanguages)[number];
export const contentCategories = [
  { key: 'home', label: 'หน้าแรกและโครงการ' },
  { key: 'booking', label: 'แบบฟอร์มและการจองเยี่ยม' },
  { key: 'tables', label: 'การจองโต๊ะ (TBL)' },
  { key: 'status', label: 'สถานะและการยกเลิก' },
  { key: 'payment', label: 'การชำระเงิน' },
  { key: 'promotions', label: 'ข่าวประชาสัมพันธ์' },
  { key: 'chat', label: 'แชทช่วยเหลือ' },
  { key: 'privacy', label: 'คุกกี้และความเป็นส่วนตัว' },
  { key: 'general', label: 'เมนู ปุ่ม และข้อความทั่วไป' },
];
export { catalog as frontendTextCatalog };

export function contentChanges(original: FrontendContent, draft: FrontendContent): FrontendChanges {
  const result: FrontendChanges = {};
  for (const lang of contentLanguages) {
    const changes: Record<string, string | null> = {};
    for (const entry of catalog) {
      const before = original[lang]?.[entry.key];
      const after = draft[lang]?.[entry.key];
      if (before !== after) changes[entry.key] = after ?? null;
    }
    if (Object.keys(changes).length) result[lang] = changes;
  }
  return result;
}

export function contentError(key: string, lang: ContentLanguage, value: string): string {
  const entry = catalog.find(e => e.key === key);
  if (!entry) return 'ไม่พบข้อความนี้';
  if (value.length > 10000) return 'ใช้ข้อความไม่เกิน 10,000 ตัวอักษร';
  const tokens = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
  if (JSON.stringify(tokens(value)) !== JSON.stringify(tokens(entry.defaults[lang]))) return `กรุณาคงตัวแปร ${tokens(entry.defaults[lang]).join(', ') || 'และไม่เพิ่มตัวแปรใหม่'}`;
  return '';
}
