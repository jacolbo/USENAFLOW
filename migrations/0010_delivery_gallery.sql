CREATE TABLE "delivery_galleries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"token" text NOT NULL,
	"title" text NOT NULL,
	"drive_folder_id" text NOT NULL,
	"cover_photo_id" varchar,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_galleries_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "delivery_galleries_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "delivery_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" varchar NOT NULL,
	"drive_file_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"preview_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_galleries" ADD CONSTRAINT "delivery_galleries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_photos" ADD CONSTRAINT "delivery_photos_gallery_id_delivery_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."delivery_galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_photos_gallery_idx" ON "delivery_photos" USING btree ("gallery_id","sort_order");
