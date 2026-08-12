export interface PromptPayDefaults {
  billerId: string;
  ref1: string;
  ref2: string;
  ref3: string;
  pointOfInitiation: '11' | '12';
}

export const PROMPTPAY_DEFAULTS: PromptPayDefaults = {
  billerId: '010753700088205',
  ref1: 'ML099400ZO0160208VX',
  ref2: 'CIDA',
  ref3: '0000',
  pointOfInitiation: '11',
};

export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export interface PromptPayValidation {
  ok: boolean;
  message: string;
}

export function validateEmvCoPayload(payload: string): PromptPayValidation {
  if (!payload || typeof payload !== 'string') {
    return { ok: false, message: 'ไม่พบ payload' };
  }
  if (!payload.startsWith('000201')) {
    return { ok: false, message: 'Payload ต้องเริ่มต้นด้วย 000201 (Payload Format + POI)' };
  }
  const crcIdx = payload.indexOf('6304', payload.length - 10);
  if (crcIdx === -1 || payload.length - crcIdx !== 8) {
    return { ok: false, message: 'ไม่พบ CRC (6304) ท้าย payload' };
  }
  const expected = payload.slice(crcIdx + 4);
  if (!/^[0-9A-Fa-f]{4}$/.test(expected)) {
    return { ok: false, message: 'ค่า CRC ไม่ใช่เลขฐาน 16 4 หลัก' };
  }
  const recomputed = crc16(payload.slice(0, crcIdx + 4));
  if (recomputed !== expected.toUpperCase()) {
    return { ok: false, message: `CRC ไม่ตรงกัน (คำนวณได้ ${recomputed}, ที่ได้มา ${expected.toUpperCase()})` };
  }
  return { ok: true, message: 'QR payload ถูกต้อง ใช้งานได้' };
}

function tpl(tag: string, value: string): string {
  return tag + String(value.length).padStart(2, '0') + value;
}

/** Build an EMVCo biller payload mirroring the backend structure. */
export function buildSamplePayload(d: PromptPayDefaults): string {
  const biller =
    tpl('00', 'A000000677010112') +
    tpl('01', d.billerId) +
    tpl('02', d.ref1) +
    tpl('03', d.ref2);
  const additional = tpl('07', d.ref3);
  const base =
    '000201' +
    tpl('01', d.pointOfInitiation) +
    tpl('30', biller) +
    tpl('53', '764') +
    tpl('58', 'TH') +
    tpl('62', additional) +
    '6304';
  return base + crc16(base);
}

export function parsePayloadValues(payload: string): Record<string, string> {
  const values: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (isNaN(len)) break;
    const value = payload.slice(i + 4, i + 4 + len);
    values[tag] = value;
    i += 4 + len;
  }
  return values;
}
