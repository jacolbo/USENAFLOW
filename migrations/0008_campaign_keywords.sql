-- Add editable keywords column to campaigns table
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "keywords" text[];

-- Seed existing rows with the default Noël keyword set
UPDATE "campaigns"
SET "keywords" = ARRAY['noël','noel','noel set','noël set','christmas set']
WHERE "keywords" IS NULL;
