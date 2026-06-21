// Cliente mínimo para la API de OpenRouter (compatible con OpenAI).
// Usa el fetch global de Node (>=18). No requiere dependencias externas.

const BASE_URL = 'https://openrouter.ai/api/v1';

function authHeaders() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      'Falta OPENROUTER_API_KEY en el entorno. Copia .env.example a .env y añade tu clave.'
    );
  }
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    // Encabezados recomendados por OpenRouter para atribución (opcionales).
    'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
    'X-Title': process.env.APP_TITLE || 'ChismeLLM V2',
  };
}

/**
 * Llamada en streaming. Invoca onToken(delta) por cada fragmento de texto
 * y resuelve con el texto completo acumulado.
 */
export async function streamChat({
  model,
  messages,
  temperature = 0.7,
  maxTokens = 700,
  onToken,
  signal,
}) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status} (${model}): ${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue; // ignora comentarios/keep-alives
      const data = line.slice(5).trim();
      if (data === '[DONE]') return full;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onToken?.(delta);
        }
      } catch {
        // fragmento incompleto: se reintentará cuando llegue más buffer
      }
    }
  }
  return full;
}

/**
 * Llamada sin streaming. Devuelve el texto del mensaje. Si responseFormat
 * está definido se solicita salida estructurada (p. ej. JSON).
 */
export async function chat({
  model,
  messages,
  temperature = 0.2,
  maxTokens = 900,
  responseFormat,
  signal,
}) {
  const body = { model, messages, temperature, max_tokens: maxTokens };
  if (responseFormat) body.response_format = responseFormat;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status} (${model}): ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

/**
 * Lista de modelos disponibles en OpenRouter (para poblar la UI).
 */
export async function listModels() {
  const res = await fetch(`${BASE_URL}/models`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`OpenRouter ${res.status} al listar modelos`);
  const json = await res.json();
  return (json.data || [])
    .map((m) => ({ id: m.id, name: m.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
