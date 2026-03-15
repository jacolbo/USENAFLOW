CREATE TABLE "ai_admin_instructions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instruction" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"target_retoucher" text,
	"priority" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_memory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"context" jsonb,
	"retoucher_name" text,
	"project_id" varchar,
	"importance" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_team_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"role" text NOT NULL,
	"sender_type" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events_staging" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_event_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"event_start" timestamp NOT NULL,
	"event_end" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"promoted_project_id" varchar,
	"target_week_start" timestamp,
	"raw_payload" jsonb,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"promoted_at" timestamp,
	"promoted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"package_photos" integer DEFAULT 0 NOT NULL,
	"selected_photos" integer DEFAULT 0 NOT NULL,
	"client_email" text,
	CONSTRAINT "calendar_events_staging_calendar_event_id_unique" UNIQUE("calendar_event_id")
);
--> statement-breakpoint
CREATE TABLE "chat_encryption_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"encryption_key" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_auth_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"project_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_auth_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "client_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"sender_type" text NOT NULL,
	"sender_email" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"attachment_url" text,
	"attachment_type" text,
	"attachment_name" text,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_email" text NOT NULL,
	"client_name" text NOT NULL,
	"total_projects" integer DEFAULT 0 NOT NULL,
	"total_delivered" integer DEFAULT 0 NOT NULL,
	"vip_tier" text DEFAULT 'Standard' NOT NULL,
	"bonus_photos" integer DEFAULT 0 NOT NULL,
	"bonus_photos_used" integer DEFAULT 0 NOT NULL,
	"priority_turnaround" boolean DEFAULT false NOT NULL,
	"notes" text,
	"first_project_at" timestamp,
	"last_project_at" timestamp,
	"total_bookings" integer DEFAULT 0 NOT NULL,
	"referral_match_count" integer DEFAULT 0 NOT NULL,
	"reward_score" integer DEFAULT 0 NOT NULL,
	"reward_tier" text DEFAULT 'Bronze' NOT NULL,
	"last_reward_sync_at" timestamp,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"unsubscribed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_profiles_client_email_unique" UNIQUE("client_email")
);
--> statement-breakpoint
CREATE TABLE "client_surveys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"client_email" text NOT NULL,
	"client_name" text NOT NULL,
	"rating" integer,
	"communication_rating" integer,
	"feedback" text,
	"would_recommend" boolean,
	"survey_token" text NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_surveys_survey_token_unique" UNIQUE("survey_token")
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"reported_by" text NOT NULL,
	"issue_description" text NOT NULL,
	"requested_due_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"image_urls" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"widget_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hidden_widgets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"widget_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"email_type" text NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"resend_message_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"available_variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_customized" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
CREATE TABLE "galleries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"password" text,
	"download_pin" text,
	"cover_image_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"settings" jsonb DEFAULT '{"downloadEnabled":true,"downloadSizes":["original","web"],"favoritesEnabled":true,"favoriteNotesEnabled":true,"slideshowEnabled":true,"socialSharingEnabled":false,"filenameDisplay":true,"watermarkEnabled":true,"emailRegistration":false,"galleryAssist":false,"language":"en","gridStyle":"vertical","thumbnailSize":"regular","colorTheme":"light","fontTheme":"sans"}'::jsonb NOT NULL,
	"expires_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "galleries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gallery_auth_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" varchar NOT NULL,
	"client_email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_auth_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "gallery_downloads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" varchar NOT NULL,
	"client_email" text NOT NULL,
	"download_type" text NOT NULL,
	"photo_ids" jsonb,
	"download_size" text DEFAULT 'original' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_fav_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" varchar NOT NULL,
	"client_email" text NOT NULL,
	"name" text DEFAULT 'My Favorites' NOT NULL,
	"selection_limit" integer,
	"is_submitted" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp,
	"submitted_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" varchar NOT NULL,
	"gallery_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"width" integer,
	"height" integer,
	"file_size" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_selections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fav_list_id" varchar NOT NULL,
	"photo_id" varchar NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" varchar NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_downloadable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"weekdays_count" integer NOT NULL,
	"reason" text NOT NULL,
	"leave_type" text DEFAULT 'annual' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"ai_decision" text,
	"ai_reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"event_date" timestamp NOT NULL,
	"photos_completed" integer,
	"photos_remaining" integer,
	"details" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"note_type" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_status_transitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"changed_by" text NOT NULL,
	"transitioned_at" timestamp DEFAULT now() NOT NULL,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"package_count" integer NOT NULL,
	"selected_count" integer NOT NULL,
	"extras" integer DEFAULT 0 NOT NULL,
	"extra_photo_price" integer DEFAULT 0,
	"due_date" timestamp NOT NULL,
	"status" text NOT NULL,
	"invoice_paid" boolean DEFAULT false NOT NULL,
	"assigned_to" text,
	"rating" integer,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"to_edit_remaining" integer DEFAULT 0 NOT NULL,
	"photos_completed" integer DEFAULT 0 NOT NULL,
	"rollover_count" integer DEFAULT 0 NOT NULL,
	"last_rollover_date" timestamp,
	"original_project_id" varchar,
	"is_rollover_shadow" boolean DEFAULT false NOT NULL,
	"original_due_date" timestamp,
	"shoot_date" timestamp,
	"delivery_due_date" timestamp,
	"risk_level" text DEFAULT 'SAFE' NOT NULL,
	"calendar_event_id" text,
	"last_synced_at" timestamp,
	"created_from" text DEFAULT 'MANUAL' NOT NULL,
	"is_link_sent" boolean DEFAULT false NOT NULL,
	"link_sent_at" timestamp,
	"client_email" text,
	"extras_approved" boolean DEFAULT false NOT NULL,
	"extras_approved_at" timestamp,
	"extras_approval_token" text,
	"delivery_estimate_email_sent_at" timestamp,
	"project_added_email_sent_at" timestamp,
	"gallery_link" text,
	"gallery_link_added_at" timestamp,
	"gallery_link_added_by" text,
	"delivery_approved" boolean DEFAULT false NOT NULL,
	"delivery_approved_at" timestamp,
	"delivery_approved_by" text,
	"delivery_email_sent_at" timestamp,
	"drive_folder_id" text,
	"drive_folder_name" text,
	"drive_bw_folder_id" text,
	"drive_photo_count" integer DEFAULT 0 NOT NULL,
	"drive_bw_photo_count" integer DEFAULT 0 NOT NULL,
	"drive_storage_bytes" integer DEFAULT 0 NOT NULL,
	"drive_gallery_link" text,
	"drive_bw_sent" boolean DEFAULT false NOT NULL,
	"drive_bw_sent_at" timestamp,
	"drive_delivery_complete" boolean DEFAULT false NOT NULL,
	"drive_delivery_completed_at" timestamp,
	"drive_delivery_email_sent" boolean DEFAULT false NOT NULL,
	"drive_delivery_email_sent_at" timestamp,
	"drive_access_granted" boolean DEFAULT false NOT NULL,
	"drive_access_granted_at" timestamp,
	"drive_last_checked_at" timestamp,
	"drive_client_accessed_at" timestamp,
	"chat_archived" boolean DEFAULT false NOT NULL,
	"chat_archived_at" timestamp,
	"chat_archived_by" text,
	"drive_preview_email_sent" boolean DEFAULT false NOT NULL,
	"drive_preview_email_sent_at" timestamp,
	"quality_gate_score" integer,
	"quality_gate_passed" boolean,
	"quality_gate_at" timestamp,
	"quality_gate_override" boolean DEFAULT false NOT NULL,
	"quality_gate_override_by" text,
	"quality_gate_override_at" timestamp,
	"quality_gate_feedback" jsonb,
	CONSTRAINT "projects_calendar_event_id_unique" UNIQUE("calendar_event_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_reward_claims" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_email" text NOT NULL,
	"client_name" text NOT NULL,
	"project_id" varchar NOT NULL,
	"photos_applied" integer NOT NULL,
	"applied_by" text NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_email" text NOT NULL,
	"referrer_name" text NOT NULL,
	"referral_code" text NOT NULL,
	"referred_email" text,
	"referred_name" text,
	"referred_first_name" text,
	"referred_last_name" text,
	"referred_project_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"reward_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "referrals_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "shoottracker_meta" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"link_sent" boolean DEFAULT false NOT NULL,
	"delivered" boolean DEFAULT false NOT NULL,
	"turnaround_days" integer DEFAULT 5 NOT NULL,
	"working_days" jsonb DEFAULT '["Mon","Tue","Wed","Thu","Fri"]'::jsonb NOT NULL,
	"holidays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_calendar_sync" timestamp,
	"raw_event_payload" jsonb,
	CONSTRAINT "shoottracker_meta_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "sneak_peeks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"image_url" text NOT NULL,
	"caption" text,
	"sent_at" timestamp,
	"sent_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_offers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_user" text NOT NULL,
	"offering_project_id" varchar NOT NULL,
	"target_user" text,
	"requested_project_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_by" text,
	"accepted_project_id" varchar,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "wrangler_commissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wrangler_username" text NOT NULL,
	"project_id" varchar NOT NULL,
	"extra_photo_price" integer NOT NULL,
	"extra_count" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"commission_amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events_staging" ADD CONSTRAINT "calendar_events_staging_promoted_project_id_projects_id_fk" FOREIGN KEY ("promoted_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_encryption_keys" ADD CONSTRAINT "chat_encryption_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_auth_tokens" ADD CONSTRAINT "client_auth_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_messages" ADD CONSTRAINT "client_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_surveys" ADD CONSTRAINT "client_surveys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_auth_tokens" ADD CONSTRAINT "gallery_auth_tokens_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_downloads" ADD CONSTRAINT "gallery_downloads_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_fav_lists" ADD CONSTRAINT "gallery_fav_lists_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_set_id_gallery_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."gallery_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_selections" ADD CONSTRAINT "gallery_selections_fav_list_id_gallery_fav_lists_id_fk" FOREIGN KEY ("fav_list_id") REFERENCES "public"."gallery_fav_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_selections" ADD CONSTRAINT "gallery_selections_photo_id_gallery_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."gallery_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_sets" ADD CONSTRAINT "gallery_sets_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_transitions" ADD CONSTRAINT "project_status_transitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_reward_claims" ADD CONSTRAINT "referral_reward_claims_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_project_id_projects_id_fk" FOREIGN KEY ("referred_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoottracker_meta" ADD CONSTRAINT "shoottracker_meta_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sneak_peeks" ADD CONSTRAINT "sneak_peeks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_offering_project_id_projects_id_fk" FOREIGN KEY ("offering_project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_requested_project_id_projects_id_fk" FOREIGN KEY ("requested_project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_accepted_project_id_projects_id_fk" FOREIGN KEY ("accepted_project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrangler_commissions" ADD CONSTRAINT "wrangler_commissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;