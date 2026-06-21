import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import apiRoutes from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
  logger: { transport: undefined, level: 'info' },
  bodyLimit: 5 * 1024 * 1024, // 5 MB: permite artefactos grandes
});

await fastify.register(fastifyCors, { origin: true });

// Sirve el frontend (monolito) desde /public.
await fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/',
});

await fastify.register(apiRoutes);

const port = Number(process.env.PORT) || 4747;
const host = process.env.HOST || '0.0.0.0';

try {
  await fastify.listen({ port, host });
  if (!process.env.OPENROUTER_API_KEY) {
    fastify.log.warn('⚠️  OPENROUTER_API_KEY no está definida. Copia .env.example a .env.');
  }
  fastify.log.info(`HAZE — adversarial analysis en http://localhost:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
