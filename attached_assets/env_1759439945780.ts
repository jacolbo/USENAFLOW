export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'http://localhost:3000'
};
if (!env.DATABASE_URL) {
  console.warn('[env] DATABASE_URL is not set. Set it in Replit → Secrets for real DB.');
}
