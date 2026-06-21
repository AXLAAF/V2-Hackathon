// Rutas de la API: configuración, modelos y el debate en streaming (SSE).

import { rosterForClient } from '../config/roles.js';
import { listModels } from '../services/openrouter.js';
import { runDebate } from '../services/orchestrator.js';

export default async function apiRoutes(fastify) {
  // Metadata de roles/equipos por defecto para construir la UI.
  fastify.get('/api/config', async () => rosterForClient());

  // Lista de modelos disponibles en OpenRouter (para los selectores).
  fastify.get('/api/models', async (req, reply) => {
    try {
      return { models: await listModels() };
    } catch (err) {
      reply.code(502);
      return { error: err.message, models: [] };
    }
  });

  // Debate en streaming. POST + Server-Sent Events sobre la misma respuesta.
  fastify.post('/api/analyze', async (request, reply) => {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event, data) => {
      raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const ac = new AbortController();
    request.raw.on('close', () => ac.abort());

    try {
      send('open', { ts: Date.now() });
      await runDebate(request.body || {}, send, ac.signal);
    } catch (err) {
      send('error', { message: err.message });
    } finally {
      if (!ac.signal.aborted) {
        send('done', { ts: Date.now() });
        raw.end();
      }
    }
  });
}
