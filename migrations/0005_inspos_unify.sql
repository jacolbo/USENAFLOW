-- Unify Wrangler Notes into Project Inspos: allow text notes alongside photos.
ALTER TABLE "project_inspos" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'photo';
ALTER TABLE "project_inspos" ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE "project_inspos" ALTER COLUMN "storage_key" DROP NOT NULL;
