ALTER TABLE "client_surveys" ADD COLUMN "google_prompt_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD COLUMN "google_clicked_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD COLUMN "copy_clicked_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD COLUMN "google_prompt_reminders_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD COLUMN "last_reminder_sent_at" timestamp;