import Fastify from 'fastify';
import cors from '@fastify/cors';
import shareLinksRoutes from './routes/shareLinks.js';
import publicRoutes from './routes/public.js';
import { pool } from './db.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get('/health', async () => ({ ok: true }));

await app.register(shareLinksRoutes);
await app.register(publicRoutes);

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' }).catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
