CREATE TABLE "staging_event_inspos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "staging_event_id" varchar NOT NULL,
        "kind" text DEFAULT 'photo' NOT NULL,
        "storage_key" text,
        "caption" text,
        "body" text,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "uploaded_by" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events_staging" ADD COLUMN "inspos_overall_instructions" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "staging_event_inspos" ADD CONSTRAINT "staging_event_inspos_staging_event_id_calendar_events_staging_id_fk" FOREIGN KEY ("staging_event_id") REFERENCES "public"."calendar_events_staging"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staging_event_inspos_staging_event_id_idx" ON "staging_event_inspos" ("staging_event_id", "sort_order");