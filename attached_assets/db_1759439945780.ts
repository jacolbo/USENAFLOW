import pg from 'pg';
import { env } from './env.js';
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('localhost') ? false as any : { rejectUnauthorized: false }
});
export async function oneOrNone<T=any>(query: string, params: any[] = []): Promise<T|null> {
  const { rows } = await pool.query(query, params);
  return rows[0] || null;
}
export async function one<T=any>(query: string, params: any[] = []): Promise<T> {
  const { rows } = await pool.query(query, params);
  if (!rows[0]) throw new Error('Row not found');
  return rows[0];
}
export async function any<T=any>(query: string, params: any[] = []): Promise<T[]> {
  const { rows } = await pool.query(query, params);
  return rows;
}
