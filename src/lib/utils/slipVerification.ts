/**
 * Automated bank-transfer slip verification using OCR.
 *
 * Primary OCR:  Cloudflare Workers AI (10,000 free Neurons/day, no API key).
 * Fallback OCR: OpenAI Vision API (requires OPENAI_API_KEY).
 *
 * Auto-status logic:
 *   name ✓ + amount ✓  →  เสร็จสิ้น  (fully verified, no admin review needed)
 *   any  ✗              →  ชำระแล้ว   (admin must manually approve)
 *
 * Flow:
 *   1. Send slip image to vision model → raw text
 *   2. Extract sender name + amount via regex
 *   3. Fuzzy-match name against booking customer
 *   4. Compare extracted amount with required amount
 *   5. Return verification result + recommended target status
 */

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
// OCR engines
// ---------------------------------------------------------------------------

/**
 * Cloudflare Workers AI — FREE (10,000 Neurons/day).
 * Uses env.AI.run() binding available in CF Worker context.
 * Model: @cf/meta/llama-3.2-11b-vision-instruct (supports Thai).
 */
async function ocrWithWorkersAI(
  slipImage: string,
  aiBinding?: { run: (model: string, input: Record<string, unknown>) => Promise<unknown> }
): Promise<string> {
  if (!aiBinding) throw new Error("Workers AI binding not available");

  const imageUrl = slipImage.startsWith("data:")
    ? slipImage
    : `data:image/jpeg;base64,${slipImage}`;

  const response = await aiBinding.run(
    "@cf/meta/llama-3.2-11b-vision-instruct",
    {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: imageUrl,
            },
            {
              type: "text",
              text: [
                "Extract ALL text from this Thai bank transfer slip.",
                "Return the raw text only — no commentary, no markdown.",
                "Preserve line breaks between fields.",
              ].join(" "),
            },
          ],
        },
      ],
      max_tokens: 1024,
    }
  );

  // Workers AI returns { response: { response: string } } or similar
  const res = response as Record<string, unknown>;
  const inner = res.response as Record<string, unknown> | undefined;
  return (inner?.response as string) ?? (res.response as string) ?? "";
}

/**
 * OpenAI Vision API — fallback when Workers AI binding is unavailable.
 * Requires OPENAI_API_KEY env var.
 */
async function ocrWithOpenAI(slipImage: string): Promise<string> {
  const apiKey =
    (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : undefined)
    ?? (typeof globalThis !== "undefined"
      ? (globalThis as unknown as Record<string, string>).OPENAI_API_KEY
      : undefined);

  if (!apiKey) throw new Error("No OCR provider available (no Workers AI binding, no OPENAI_API_KEY)");

  const imageUrl = slipImage.startsWith("data:")
    ? slipImage
    : `data:image/jpeg;base64,${slipImage}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Extract ALL text from this Thai bank transfer slip.",
                "Return the raw text only — no commentary, no markdown.",
                "Preserve line breaks.",
              ].join(" "),
            },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI Vision API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// ---------------------------------------------------------------------------
// Main verification
// ---------------------------------------------------------------------------

const NAME_SIMILARITY_THRESHOLD = 0.8;

export interface WorkersAIBinding {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Verify a bank transfer slip against booking data.
 *
 * @param slipImage   - Base64 string or data-URL of the slip image.
 * @param bookingData - Expected customer name and amount.
 * @param aiBinding   - Optional Workers AI binding (auto-detected in CF Worker).
 * @returns Verification result with targetStatus for auto-updating the booking.
 */
export async function verifySlip(
  slipImage: string,
  bookingData: BookingData,
  aiBinding?: WorkersAIBinding
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

  // --- Step 1: OCR (try Workers AI first, then OpenAI) --------------------
  let rawText: string;
  try {
    rawText = await ocrWithWorkersAI(slipImage, aiBinding);
  } catch {
    try {
      rawText = await ocrWithOpenAI(slipImage);
    } catch (err) {
      return fail(`OCR failed: ${err instanceof Error ? err.message : String(err)}`);
    }
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
  //  Both match → เสร็จสิ้น (auto-complete, no admin review)
  //  Any mismatch → ชำระแล้ว (admin must approve manually)
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
