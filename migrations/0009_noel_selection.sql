-- Noël photo selection flow: new fields on projects
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "pixieset_link" text,
  ADD COLUMN IF NOT EXISTS "selection_allowance" integer,
  ADD COLUMN IF NOT EXISTS "selection_email_sent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "selection_reminder_tier" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "client_selection_count" integer,
  ADD COLUMN IF NOT EXISTS "client_selection_done_at" timestamp,
  ADD COLUMN IF NOT EXISTS "files_collected" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "files_collected_at" timestamp,
  ADD COLUMN IF NOT EXISTS "files_collected_by" text,
  ADD COLUMN IF NOT EXISTS "photos_ready_email_sent_at" timestamp;

-- Seed whatsapp_admin_number into app_settings (no-op if already present)
INSERT INTO "app_settings" ("key", "value", "updated_at")
VALUES ('whatsapp_admin_number', '"27000000000"', now())
ON CONFLICT ("key") DO NOTHING;
