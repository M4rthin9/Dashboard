/**
 * Chat API client — calls Cloudflare Workers AI (free tier, 10k Neurons/day).
 *
 * Uses LLaMA 3.2 11B Vision for general chat (Thai + English).
 * Models are swappable via the `model` param.
 *
 * Env vars:
 *   VITE_AI_API_KEY   – Cloudflare API token (Workers AI scope)
 *   VITE_CF_ACCOUNT_ID – Cloudflare account ID
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

export const VISITOR_SYSTEM_PROMPT = `คุณคือผู้ช่วยจองโต๊ะของร้าน C&C Café ในเรือนจำ ช่วยตอบคำถามเกี่ยวกับ:
- ขั้นตอนการจองโต๊ะเยี่ยม
- วิธีชำระเงิน (โอนผ่านธนาคาร / PromptPay)
- สถานะการจอง (รอตรวจสอบผู้เข้าร่วม, รอตรวจสอบวินัย, รอชำระเงิน, ชำระแล้ว, เสร็จสิ้น)
- ข้อมูลทั่วไปเกี่ยวกับการเยี่ยม

กฎ:
- ตอบเป็นภาษาไทย สั้นกระชับ ไม่เกิน 3-4 ประโยค
- ถ้าไม่รู้คำตอบ บอกว่า "กรุณาติดต่อเจ้าหน้าที่"
- ห้ามให้ข้อมูลส่วนตัวของผู้ต้องขัง
- ไม่ต้องทักทายซ้ำ ตอบตรงประเด็น`;

export const ADMIN_SYSTEM_PROMPT = `คุณคือผู้ช่วย AI สำหรับผู้ดูแลระบบ (Admin) ของ CCC Dashboard ช่วยอธิบาย:
- วิธีใช้งาน Dashboard (หน้าหลัก, ระบบจอง, รายงาน, บันทึกเหตุการณ์)
- ขั้นตอนการอนุมัติการจอง (ผู้เข้าร่วม → วินัย → ชำระเงิน → เสร็จสิ้น)
- การจัดการผู้ใช้และผู้ต้องขัง
- สิทธิ์ของแต่ละบทบาท (Superadmin, Admin, Finance, Vinai, Tadtel, User)
- การส่งออก CSV พิมพ์รายงาน และดูสลิป
- การใช้ PromptPay QR
- เคล็ดลับและ best practices สำหรับการใช้งาน

กฎ:
- ตอบเป็นภาษาไทย สั้นกระชับ ตรงประเด็น
- ยกตัวอย่างขั้นตอนจริงเมื่อทำได้
- ถ้าไม่แน่ใจ บอกว่า "ตรวจสอบจากคู่มือในระบบ" หรือ "ติดต่อ Superadmin"
- ใช้ emoji เล็กน้อยเพื่อความสะดวกในการอ่าน`;

// ---------------------------------------------------------------------------
// Shared AI config (imported by slipVerification.ts etc.)
// ---------------------------------------------------------------------------

export const CF_ACCOUNT_ID = import.meta.env.VITE_CF_ACCOUNT_ID as string | undefined;
export const AI_API_KEY = import.meta.env.VITE_AI_API_KEY as string | undefined;
export const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

/**
 * Low-level Workers AI REST call. Returns the raw `result` object.
 * Used by both chat and slip verification.
 */
export async function runInference(
  model: string,
  input: Record<string, unknown>
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!AI_API_KEY) return { ok: false, error: 'VITE_AI_API_KEY ไม่ได้ตั้งค่า' };
  if (!CF_ACCOUNT_ID) return { ok: false, error: 'VITE_CF_ACCOUNT_ID ไม่ได้ตั้งค่า' };

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `AI API ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      success: boolean;
      result?: Record<string, unknown>;
      errors?: Array<{ message: string }>;
    };
    if (!data.success) return { ok: false, error: data.errors?.[0]?.message ?? 'Unknown AI error' };
    return { ok: true, result: data.result };
  } catch (err) {
    return { ok: false, error: `Network: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Send a chat conversation to Workers AI and return the assistant reply.
 *
 * @param messages  - Full conversation history (system + user + assistant).
 * @param model     - Workers AI model ID (default: LLaMA 3.2 11B Vision).
 * @returns         - The assistant's reply text.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL
): Promise<ChatResponse> {
  const r = await runInference(model, {
    messages,
    max_tokens: 1024,
    temperature: 0.7,
    stream: false,
  });
  if (!r.ok) return { reply: '', error: r.error };
  return { reply: (r.result?.response as string) ?? '' };
}

/**
 * Quick helper: send a single user message with a system prompt.
 */
export async function quickChat(
  userMessage: string,
  systemPrompt: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];
  return chatCompletion(messages);
}
