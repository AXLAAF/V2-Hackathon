// Minimal OpenRouter client for the batch evaluation harness.
// Mirrors API/src/services/openrouter.js (same endpoint + auth), but uses
// non-streaming calls with retries/backoff, which suit unattended batch runs.

const BASE_URL = 'https://openrouter.ai/api/v1';

function authHeaders() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      'Missing OPENROUTER_API_KEY. Copy evaluation/.env.example to evaluation/.env and add your key.'
    );
  }
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.APP_URL || 'http://localhost:4747',
    'X-Title': process.env.APP_TITLE || 'HAZE-eval',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Single non-streaming chat completion with retries on 429/5xx/network errors.
 * Returns { content, usage, model } so the harness can track token cost.
 */
export async function chat({
  model,
  messages,
  temperature = 0.2,
  maxTokens = 900,
  responseFormat,
  timeoutMs = 120000,
  maxRetries = 4,
}) {
  const body = { model, messages, temperature, max_tokens: maxTokens };
  if (responseFormat) body.response_format = responseFormat;

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      if (res.status === 429 || res.status >= 500) {
        const detail = await res.text().catch(() => '');
        lastErr = new Error(`OpenRouter ${res.status} (${model}): ${detail.slice(0, 200)}`);
        await sleep(Math.min(2000 * 2 ** attempt, 20000));
        continue;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`OpenRouter ${res.status} (${model}): ${detail.slice(0, 300)}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content ?? '';
      return { content, usage: json.usage || null, model };
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') {
        lastErr = new Error(`Timeout after ${timeoutMs}ms (${model})`);
      }
      await sleep(Math.min(2000 * 2 ** attempt, 20000));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error(`OpenRouter call failed (${model})`);
}
