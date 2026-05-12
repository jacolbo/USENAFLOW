ALTER TABLE "client_messages" ADD COLUMN "tag" text;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD COLUMN "already_reviewed_on_google" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD COLUMN "already_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD COLUMN "already_reviewed_source" text;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD COLUMN "already_reviewed_matched_author" text;