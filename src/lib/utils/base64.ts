const MIME_BY_MAGIC: Array<[Uint8Array, string]> = [
  [new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/png'],
  [new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg'],
  [new Uint8Array([0x47, 0x49, 0x46, 0x38]), 'image/gif'],
  [new Uint8Array([0x42, 0x4d]), 'image/bmp'],
];

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function isBase64Image(value: string | null | undefined): boolean {
  const clean = String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
  if (!clean || clean.startsWith('data:')) return false;
  if (!BASE64_RE.test(clean)) return false;
  try {
    atob(clean);
    return true;
  } catch {
    return false;
  }
}

function detectImageMime(bytes: Uint8Array): string {
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  for (const [magic, mime] of MIME_BY_MAGIC) {
    if (bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b)) return mime;
  }
  return 'image/png';
}

export function decodeBase64Image(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (/^(data:|https?:\/\/|blob:|file:)/i.test(trimmed)) return trimmed;
  const clean = trimmed.replace(/\s+/g, '');
  if (!clean || !BASE64_RE.test(clean)) return trimmed;
  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return `data:${detectImageMime(bytes)};base64,${clean}`;
  } catch {
    return trimmed;
  }
}
