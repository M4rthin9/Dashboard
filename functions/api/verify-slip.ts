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

  let body: { image?: string; model?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.image) {
    return new Response(JSON.stringify({ error: 'image required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const imageUrl = body.image.startsWith('data:')
    ? body.image
    : `data:image/jpeg;base64,${body.image}`;

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
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: imageUrl },
              {
                type: 'text',
                text: 'Extract ALL text from this Thai bank transfer slip. Return the raw text only — no commentary, no markdown. Preserve line breaks between fields.',
              },
            ],
          },
        ],
        max_tokens: 1024,
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

    let text = '';
    const result = raw.result as Record<string, unknown> | undefined;

    if (result) {
      const choices = result.choices as Array<{ message?: { content?: string } }> | undefined;
      if (choices?.[0]?.message?.content) {
        text = choices[0].message.content;
      } else if (typeof result.response === 'string') {
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
