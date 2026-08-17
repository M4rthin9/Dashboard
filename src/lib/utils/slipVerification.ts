/**
 * Automated bank-transfer slip verification using OCR.
 *
 * Uses Cloudflare Workers AI free tier via REST API (browser-safe).
 * Model: @cf/meta/llama-3.2-11b-vision-instruct
 *
 * Auto-status logic:
 *   name ✓ + amount ✓  →  เสร็จสิ้น  (auto-complete, no admin review)
 *   any  ✗              →  ชำระแล้ว   (admin must manually approve)
 *
 * Flow:
 *   1. Send slip image to vision model → raw text
 *   2. Extract sender name + amount via regex
 *   3. Fuzzy-match name against booking customer
 *   4. Compare extracted amount with required amount
 *   5. Return verification result + recommended target status
 */

import { DEFAULT_MODEL } from './chatApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookingData {
  customerName: string;
  requiredAmount: number;
}

export interface SlipVerifyResult {
  success: boolean;
  nameMatched: boolean;
  amountMatched: boolean;
  extractedName: string;
  extractedAmount: number;
  confidenceScore: number;
  /** Recommended status: 'เสร็จสิ้น' if fully verified, 'ชำระแล้ว' if needs review. */
  targetStatus: 'เสร็จสิ้น' | 'ชำระแล้ว';
  error?: string;
}

// ---------------------------------------------------------------------------
// Name cleaning
// ---------------------------------------------------------------------------

const THAI_TITLES =
  /^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|_mr\.|mrs\.|ms\.|miss\.)/i;

function cleanName(raw: string): string {
  return raw
    .replace(THAI_TITLES, "")
    .replace(/\s+/g, "")
    .replace(/[oO]/g, "0")
    .replace(/[lIi]/g, "1")
    .toLowerCase()
    .trim();
}

function cleanNameStrict(raw: string): string {
  return raw
    .replace(THAI_TITLES, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

// ---------------------------------------------------------------------------
// Levenshtein distance → normalised 0-1 similarity
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ---------------------------------------------------------------------------
// Amount extraction (regex)
// ---------------------------------------------------------------------------

const AMOUNT_PATTERNS = [
  /(?:฿|THB|บาท|จำนวนเงิน)\s*([\d,]+\.?\d*)/i,
  /([\d,]+\.\d{2})\s*(?:฿|THB|บาท)?/i,
  /([\d,]+)\s*(?:฿|THB|บาท)/i,
];

function extractAmount(text: string): number {
  for (const pat of AMOUNT_PATTERNS) {
    const m = text.match(pat);
    if (m?.[1]) {
      const num = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return NaN;
}

// ---------------------------------------------------------------------------
// Name extraction from slip text
// ---------------------------------------------------------------------------

const NAME_KEYWORDS = /(?:ผู้โอน|จาก|From|Sender|ชื่อบัญชี)/i;

function extractName(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (NAME_KEYWORDS.test(lines[i])) {
      const afterKw = lines[i].replace(NAME_KEYWORDS, "").trim();
      if (afterKw.length >= 2) return afterKw;
      if (i + 1 < lines.length) return lines[i + 1];
    }
  }
  for (const line of lines) {
    if (/^[ก-๙a-zA-Z\s.]{2,50}$/.test(line) && !/\d{3,}/.test(line)) {
      return line;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// OCR via Pages Function proxy (same-origin, no CORS)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Image compression — resize to max 1024px and JPEG 0.7 to fit under API limit
// ---------------------------------------------------------------------------

function compressImage(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1024;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      // strip data URI prefix, return raw base64
      const raw = compressed.replace(/^data:image\/\w+;base64,/, '');
      resolve(raw);
    };
    img.onerror = () => resolve(base64);
    const src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    img.src = src;
  });
}

async function ocrSlip(slipImage: string): Promise<string> {
  const trimmed = slipImage.trim();
  const compressed = await compressImage(trimmed);

  const res = await fetch('/api/verify-slip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: compressed, model: DEFAULT_MODEL }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OCR API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { response?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.response ?? '';
}

// ---------------------------------------------------------------------------
// Main verification
// ---------------------------------------------------------------------------

const NAME_SIMILARITY_THRESHOLD = 0.8;

/**
 * Verify a bank transfer slip against booking data.
 * Runs entirely in the browser via Workers AI REST API (free tier).
 *
 * @param slipImage   - Base64 string or data-URL of the slip image.
 * @param bookingData - Expected customer name and amount.
 * @returns Verification result with targetStatus for auto-updating the booking.
 */
export async function verifySlipOCR(
  slipImage: string,
  bookingData: BookingData
): Promise<SlipVerifyResult> {
  const fail = (error: string): SlipVerifyResult => ({
    success: false,
    nameMatched: false,
    amountMatched: false,
    extractedName: "",
    extractedAmount: 0,
    confidenceScore: 0,
    targetStatus: "ชำระแล้ว",
    error,
  });

  // --- Step 1: OCR via Workers AI -----------------------------------------
  let rawText: string;
  try {
    rawText = await ocrSlip(slipImage);
  } catch (err) {
    return fail(`OCR failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!rawText.trim()) {
    return fail("OCR returned empty text — image may be unreadable");
  }

  // --- Step 2: Extract name & amount from OCR text ------------------------
  const extractedName = extractName(rawText);
  const extractedAmount = extractAmount(rawText);

  // --- Step 3: Fuzzy name comparison --------------------------------------
  const strictScore = similarity(
    cleanNameStrict(extractedName),
    cleanNameStrict(bookingData.customerName)
  );
  const fuzzyScore = similarity(
    cleanName(extractedName),
    cleanName(bookingData.customerName)
  );
  const bestNameScore = Math.max(strictScore, fuzzyScore);
  const nameMatched = bestNameScore >= NAME_SIMILARITY_THRESHOLD;

  // --- Step 4: Amount comparison ------------------------------------------
  const amountMatched =
    !isNaN(extractedAmount) &&
    Math.abs(extractedAmount - bookingData.requiredAmount) < 0.01;

  // --- Step 5: Confidence score -------------------------------------------
  const textQuality = Math.min(rawText.length / 100, 1);
  const confidenceScore = Math.round(
    (bestNameScore * 0.4 + (amountMatched ? 1 : 0) * 0.4 + textQuality * 0.2) * 100
  ) / 100;

  // --- Step 6: Determine target status ------------------------------------
  const targetStatus: 'เสร็จสิ้น' | 'ชำระแล้ว' =
    nameMatched && amountMatched ? "เสร็จสิ้น" : "ชำระแล้ว";

  return {
    success: true,
    nameMatched,
    amountMatched,
    extractedName: extractedName || "(not found)",
    extractedAmount: isNaN(extractedAmount) ? 0 : extractedAmount,
    confidenceScore,
    targetStatus,
  };
}
