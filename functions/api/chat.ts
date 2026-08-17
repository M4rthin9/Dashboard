interface Env {
  CF_ACCOUNT_ID: string;
  AI_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { CF_ACCOUNT_ID, AI_API_KEY } = context.env;
  if (!CF_ACCOUNT_ID || !AI_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { messages?: unknown[]; model?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const model = body.model || '@cf/google/gemma-4-26b-a4b-it';
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        messages: body.messages,
        max_tokens: 1024,
        temperature: 0.7,
        stream: false,
      }),
    });

    const raw = await res.json() as Record<string, unknown>;

    if (!raw.success) {
      const errors = raw.errors as Array<{ message: string }> | undefined;
      return new Response(JSON.stringify({ error: errors?.[0]?.message ?? 'AI error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Workers AI returns different shapes depending on the model.
    // Gemma 4 (OpenAI-compatible): { result: { choices: [{ message: { content } }] } }
    // Older models (native):       { result: { response: string } }
    let text = '';
    const result = raw.result as Record<string, unknown> | undefined;

    if (result) {
      // OpenAI-compatible format
      const choices = result.choices as Array<{ message?: { content?: string } }> | undefined;
      if (choices?.[0]?.message?.content) {
        text = choices[0].message.content;
      }
      // Native Workers AI format
      else if (typeof result.response === 'string') {
        text = result.response;
      }
    }

    return new Response(JSON.stringify({ response: text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Upstream: ${err instanceof Error ? err.message : String(err)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
