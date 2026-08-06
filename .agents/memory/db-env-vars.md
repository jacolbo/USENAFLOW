---
name: Dev DB env vars
description: Which connection string the app actually uses, and how to add columns safely
---
- The app and drizzle.config both read `DATABASE_URL`, NOT `NEON_DATABASE_URL` (which also exists as a secret and may point elsewhere). Apply manual DDL against `$DATABASE_URL`.
- **Why:** a column added via `psql "$NEON_DATABASE_URL"` left the app crashing with "column does not exist" on boot.
- `npm run db:push -- --force` still blocks on an interactive create-vs-rename prompt (many orphaned columns in `projects` from an old task). For single columns, run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via psql instead.
