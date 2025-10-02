import fs from 'fs';
import pg from 'pg';

const sqlPath = 'migrations/2025-10-02_share_links.sql';
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in Replit → Tools → Secrets.');
  process.exit(1);
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});
const sql = fs.readFileSync(sqlPath, 'utf8');
try {
  await client.connect();
  console.log('Connected. Running migration…');
  await client.query('begin');
  await client.query(sql);
  await client.query('commit');
  console.log('Migration complete ✅');
} catch (e) {
  console.error('Migration failed ❌', e.message);
  try { await client.query('rollback'); } catch {}
  process.exit(1);
} finally {
  await client.end();
}
