/**
 * Chat API client — calls Cloudflare Workers AI via Pages Functions proxy.
 * No CORS issues since /api/chat is same-origin.
 *
 * Env vars are on the server side (Pages Functions):
 *   CF_ACCOUNT_ID  – Cloudflare account ID
 *   AI_API_KEY     – Workers AI API token
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
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
// Shared helper — calls Pages Function proxy (same-origin, no CORS)
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';

/**
 * Low-level call to our Pages Function proxy.
 * The proxy forwards to Workers AI server-side (no CORS, no exposed keys).
 */
export async function runInference(
  model: string,
  input: Record<string, unknown>
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, ...input }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `API ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { response?: string; error?: string };
    if (data.error) return { ok: false, error: data.error };
    return { ok: true, result: { response: data.response } };
  } catch (err) {
    return { ok: false, error: `Network: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Send a chat conversation and return the assistant reply.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL
): Promise<ChatResponse> {
  const r = await runInference(model, { messages });
  if (!r.ok) return { reply: '', error: r.error };
  return { reply: (r.result?.response as string) ?? '' };
}

/**
 * Quick helper: single user message with a system prompt.
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
