import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  packageCount: integer("package_count").notNull(),
  selectedCount: integer("selected_count").notNull(),
  extras: integer("extras").notNull().default(0),
  extraPhotoPrice: integer("extra_photo_price").default(0), // Price per extra photo in cents
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull(),
  invoicePaid: boolean("invoice_paid").notNull().default(false),
  assignedTo: text("assigned_to"),
  rating: integer("rating"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  // Rollover tracking fields
  toEditRemaining: integer("to_edit_remaining").notNull().default(0),
  photosCompleted: integer("photos_completed").notNull().default(0),
  rolloverCount: integer("rollover_count").notNull().default(0),
  lastRolloverDate: timestamp("last_rollover_date"),
  // Shadow project fields
  originalProjectId: varchar("original_project_id"), // null for original projects, points to original for shadows
  isRolloverShadow: boolean("is_rollover_shadow").notNull().default(false),
  originalDueDate: timestamp("original_due_date"), // stores original due date for shadows
  // ShootTracker Engine fields
  shootDate: timestamp("shoot_date"), // When the photo shoot happens
  deliveryDueDate: timestamp("delivery_due_date"), // When final delivery is due to client
  riskLevel: text("risk_level").notNull().default("SAFE"), // SAFE, AT_RISK, OVERDUE
  calendarEventId: text("calendar_event_id").unique(), // Link to synced calendar event (unique)
  lastSyncedAt: timestamp("last_synced_at"), // When last synced from calendar
  createdFrom: text("created_from").notNull().default("MANUAL"), // MANUAL or CALENDAR
  // True when this row only exists so inspos/notes can be attached to a calendar
  // event BEFORE it is formally promoted in ShootTracker. Placeholders are hidden
  // from all project week boards / dashboards / task tables until promoted, at
  // which point this flips to false (see ShootTracker promote route).
  isInspoPlaceholder: boolean("is_inspo_placeholder").notNull().default(false),
  // Client share link fields (existing)
  isLinkSent: boolean("is_link_sent").notNull().default(false),
  linkSentAt: timestamp("link_sent_at"),
  // Client email for notifications
  clientEmail: text("client_email"),
  // Extras approval tracking
  extrasApproved: boolean("extras_approved").notNull().default(false),
  extrasApprovedAt: timestamp("extras_approved_at"),
  extrasApprovalToken: text("extras_approval_token"),
  // Email notification tracking
  deliveryEstimateEmailSentAt: timestamp("delivery_estimate_email_sent_at"),
  projectAddedEmailSentAt: timestamp("project_added_email_sent_at"),
  // Gallery link delivery fields
  galleryLink: text("gallery_link"),
  galleryLinkAddedAt: timestamp("gallery_link_added_at"),
  galleryLinkAddedBy: text("gallery_link_added_by"),
  deliveryApproved: boolean("delivery_approved").notNull().default(false),
  deliveryApprovedAt: timestamp("delivery_approved_at"),
  deliveryApprovedBy: text("delivery_approved_by"),
  deliveryEmailSentAt: timestamp("delivery_email_sent_at"),
  // Google Drive integration fields
  driveFolderId: text("drive_folder_id"),
  driveFolderName: text("drive_folder_name"),
  driveBwFolderId: text("drive_bw_folder_id"),
  drivePhotoCount: integer("drive_photo_count").notNull().default(0),
  driveBwPhotoCount: integer("drive_bw_photo_count").notNull().default(0),
  driveStorageBytes: integer("drive_storage_bytes").notNull().default(0),
  driveGalleryLink: text("drive_gallery_link"),
  driveBwSent: boolean("drive_bw_sent").notNull().default(false),
  driveBwSentAt: timestamp("drive_bw_sent_at"),
  driveDeliveryComplete: boolean("drive_delivery_complete").notNull().default(false),
  driveDeliveryCompletedAt: timestamp("drive_delivery_completed_at"),
  driveDeliveryEmailSent: boolean("drive_delivery_email_sent").notNull().default(false),
  driveDeliveryEmailSentAt: timestamp("drive_delivery_email_sent_at"),
  driveAccessGranted: boolean("drive_access_granted").notNull().default(false),
  driveAccessGrantedAt: timestamp("drive_access_granted_at"),
  driveLastCheckedAt: timestamp("drive_last_checked_at"),
  driveClientAccessedAt: timestamp("drive_client_accessed_at"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: text("deleted_by"),
  chatArchived: boolean("chat_archived").notNull().default(false),
  chatArchivedAt: timestamp("chat_archived_at"),
  chatArchivedBy: text("chat_archived_by"),
  drivePreviewEmailSent: boolean("drive_preview_email_sent").notNull().default(false),
  drivePreviewEmailSentAt: timestamp("drive_preview_email_sent_at"),
  qualityGateScore: integer("quality_gate_score"),
  qualityGatePassed: boolean("quality_gate_passed"),
  qualityGateAt: timestamp("quality_gate_at"),
  qualityGateOverride: boolean("quality_gate_override").notNull().default(false),
  qualityGateOverrideBy: text("quality_gate_override_by"),
  qualityGateOverrideAt: timestamp("quality_gate_override_at"),
  qualityGateFeedback: jsonb("quality_gate_feedback"),
  // Campaign fields (Noël Set 2026 pipeline)
  campaignId: varchar("campaign_id"),
  assignedRetoucherId: text("assigned_retoucher_id"),
  promisedDeliveryDate: timestamp("promised_delivery_date"),
  lastCommunicatedDate: text("last_communicated_date"),
  lastCommunicatedAt: timestamp("last_communicated_at"),
  dueDateHistory: jsonb("due_date_history"),
  selectedPhotoCount: integer("selected_photo_count"),
  plannedWorkDate: timestamp("planned_work_date"),
  // True when the team manually pinned the work day (chip drag/click) — auto-scheduler must not move it
  workDatePinned: boolean("work_date_pinned").default(false),
  // Noël photo selection flow
  pixiesetLink: text("pixieset_link"),
  selectionAllowance: integer("selection_allowance"),
});

// ShootTracker metadata table (1:1 with projects)
export const shoottrackerMeta = pgTable("shoottracker_meta", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().unique().references(() => projects.id, { onDelete: "cascade" }),
  linkSent: boolean("link_sent").notNull().default(false),
  delivered: boolean("delivered").notNull().default(false),
  turnaroundDays: integer("turnaround_days").notNull().default(5),
  workingDays: jsonb("working_days").notNull().default(sql`'["Mon","Tue","Wed","Thu","Fri"]'::jsonb`), // Days of week
  holidays: jsonb("holidays").notNull().default(sql`'[]'::jsonb`), // Array of holiday dates
  lastCalendarSync: timestamp("last_calendar_sync"),
  rawEventPayload: jsonb("raw_event_payload"), // Raw calendar event data
});

export const projectNotes = pgTable("project_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  noteType: text("note_type").notNull(), // 'text' or 'image'
  content: text("content").notNull(), // text content or image path
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Trade offers system for project swapping
export const tradeOffers = pgTable("trade_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  offeringUser: text("offering_user").notNull(),
  offeringProjectId: varchar("offering_project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  targetUser: text("target_user"), // null means open to anyone
  requestedProjectId: varchar("requested_project_id").references(() => projects.id, { onDelete: "cascade" }), // null means open offer
  status: text("status").notNull().default("pending"), // pending, accepted, declined, cancelled, completed
  acceptedBy: text("accepted_by"), // user who accepted the trade
  acceptedProjectId: varchar("accepted_project_id").references(() => projects.id, { onDelete: "cascade" }), // project offered in return
  message: text("message"), // optional message from offering user
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

// Wrangler commission tracking
export const wranglerCommissions = pgTable("wrangler_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wranglerUsername: text("wrangler_username").notNull(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  extraPhotoPrice: integer("extra_photo_price").notNull(), // Price per extra photo in cents
  extraCount: integer("extra_count").notNull(),
  totalAmount: integer("total_amount").notNull(), // Total amount charged in cents
  commissionAmount: integer("commission_amount").notNull(), // 1.5% commission in cents
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Project events for tracking rollover history and completion
export const projectEvents = pgTable("project_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // "rollover", "completed", "assigned"
  eventDate: timestamp("event_date").notNull(),
  photosCompleted: integer("photos_completed"),
  photosRemaining: integer("photos_remaining"),
  details: text("details"), // additional info like "rolled over to next day"
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// App settings for ShootTracker and other configurations
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Client chat messages table
export const clientMessages = pgTable("client_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(), // 'client', 'retoucher', or 'system'
  senderEmail: text("sender_email").notNull(), // client email or retoucher username
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // 'image', 'video', 'audio', 'file'
  attachmentName: text("attachment_name"),
  readAt: timestamp("read_at"),
  tag: text("tag"), // optional tag like 'post_review_reply' to surface special replies
  automated: boolean("automated").notNull().default(false), // true = system-generated (campaign date-change notifier etc.)
});

// Client authentication tokens for chat access
export const clientAuthTokens = pgTable("client_auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const chatEncryptionKeys = pgTable("chat_encryption_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  encryptionKey: text("encryption_key").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Email logs for tracking sent emails
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  emailType: text("email_type").notNull(), // 'delivery_estimate', 'project_added', 'extras_approval', 'chat_link'
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("sent"), // 'sent', 'failed', 'bounced'
  resendMessageId: text("resend_message_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Calendar events staging table for ShootTracker
export const calendarEventsStaging = pgTable("calendar_events_staging", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  calendarEventId: text("calendar_event_id").notNull().unique(),
  calendarId: text("calendar_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  eventStart: timestamp("event_start").notNull(),
  eventEnd: timestamp("event_end").notNull(),
  status: text("status").notNull().default("pending"),
  promotedProjectId: varchar("promoted_project_id").references(() => projects.id, { onDelete: "set null" }),
  targetWeekStart: timestamp("target_week_start"),
  rawPayload: jsonb("raw_payload"),
  syncedAt: timestamp("synced_at").notNull().default(sql`now()`),
  promotedAt: timestamp("promoted_at"),
  promotedBy: text("promoted_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  // Package info editable from ShootTracker
  packagePhotos: integer("package_photos").notNull().default(0),
  selectedPhotos: integer("selected_photos").notNull().default(0),
  // Client email extracted from calendar notes
  clientEmail: text("client_email"),
  // Shoot Plan / overall instructions logged against the staging event before
  // promotion. Migrated into project_inspo_meta when the event is promoted.
  insposOverallInstructions: text("inspos_overall_instructions").notNull().default(""),
});

// Inspos / notes attached to a calendar staging event before it has been
// promoted to a project. On promotion these rows are migrated into
// project_inspos for the new project (see migrateStagingInsposToProject).
export const stagingEventInspos = pgTable("staging_event_inspos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stagingEventId: varchar("staging_event_id").notNull().references(() => calendarEventsStaging.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("photo"), // 'photo' | 'text'
  storageKey: text("storage_key"),
  caption: text("caption"),
  body: text("body"),
  sortOrder: integer("sort_order").notNull().default(0),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Complaints system for Evans to manage retoucher reports
export const complaints = pgTable("complaints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  reportedBy: text("reported_by").notNull(), // retoucher who reported the issue
  issueDescription: text("issue_description").notNull(),
  requestedDueDate: timestamp("requested_due_date").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "in_progress", "completed"
  resolvedBy: text("resolved_by"), // Evans or whoever resolves it
  resolvedAt: timestamp("resolved_at"),
  imageUrls: text("image_urls").array().default(sql`ARRAY[]::text[]`), // photo attachments
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});


export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  name: true,
  abbreviation: true,
});

export const loginUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  extras: true,
  status: true,
  invoicePaid: true,
}).extend({
  dueDate: z.string().transform((str) => new Date(str)),
  extraPhotoPrice: z.number().min(0).optional(),
});

export const updateProjectSchema = createInsertSchema(projects).partial().omit({
  id: true,
  createdAt: true,
}).extend({
  dueDate: z.string().transform((str) => new Date(str)).optional(),
  shootDate: z.string().transform((str) => new Date(str)).optional(),
  deliveryDueDate: z.string().transform((str) => new Date(str)).optional(),
});

export const insertProjectNoteSchema = createInsertSchema(projectNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProjectNoteSchema = createInsertSchema(projectNotes).partial().omit({
  id: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradeOfferSchema = createInsertSchema(tradeOffers).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const updateTradeOfferSchema = createInsertSchema(tradeOffers).partial().omit({
  id: true,
  offeringUser: true,
  offeringProjectId: true,
  createdAt: true,
});

export const insertWranglerCommissionSchema = createInsertSchema(wranglerCommissions).omit({
  id: true,
  createdAt: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ProjectNote = typeof projectNotes.$inferSelect;
export type InsertProjectNote = z.infer<typeof insertProjectNoteSchema>;
export type UpdateProjectNote = z.infer<typeof updateProjectNoteSchema>;
export type TradeOffer = typeof tradeOffers.$inferSelect;
export type InsertTradeOffer = z.infer<typeof insertTradeOfferSchema>;
export type UpdateTradeOffer = z.infer<typeof updateTradeOfferSchema>;
export type WranglerCommission = typeof wranglerCommissions.$inferSelect;
export type InsertWranglerCommission = z.infer<typeof insertWranglerCommissionSchema>;

export const insertProjectEventSchema = createInsertSchema(projectEvents).omit({
  id: true,
  createdAt: true,
});

export const insertComplaintSchema = createInsertSchema(complaints).omit({
  id: true,
  createdAt: true,
  status: true,
  resolvedBy: true,
  resolvedAt: true,
}).extend({
  requestedDueDate: z.string().transform((str) => new Date(str)),
});

export type ProjectEvent = typeof projectEvents.$inferSelect;
export type InsertProjectEvent = z.infer<typeof insertProjectEventSchema>;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;

export const UserRoles = {
  ADMIN: "Admin",
  LEAD_RETOUCHER: "LeadRetoucher", 
  DATA_WRANGLER: "DataWrangler",
  RETOUCHER_1: "Retoucher1",
  RETOUCHER_2: "Retoucher2",
  RETOUCHER_3: "Retoucher3",
  EVANS: "Evans",
  PHOTOGRAPHER: "Photographer",
} as const;

export const ProjectStatus = {
  AWAITING_PAYMENT: "Awaiting Payment",
  READY_FOR_RETOUCHING: "Ready for Retouching",
  ASSIGNED: "Assigned",
  REVIEW: "Review",
  CORRECTIONS: "Corrections",
  DELIVERED: "Delivered",
  DONE: "Done",
  ROLLED_OVER: "Rolled Over",
} as const;

// Notification system schemas
export interface Notification {
  id: string;
  type: 'PROJECT_ASSIGNED' | 'PROJECT_COMPLETED' | 'PROJECT_STATUS_CHANGED' | 'PROJECT_CREATED' | 'TRADE_OFFER_RECEIVED' | 'TRADE_OFFER_ACCEPTED' | 'TRADE_COMPLETED';
  title: string;
  message: string;
  projectId: string;
  projectName: string;
  userId?: string; // Target user for the notification
  tradeOfferId?: string; // For trade-related notifications
  createdAt: Date;
  read: boolean;
}

export interface WebSocketMessage {
  type: 'NOTIFICATION' | 'PROJECT_UPDATE' | 'SYNC_REQUEST' | 'USER_IDENTIFY' | 'TRADE_UPDATE';
  data: any;
  timestamp: Date;
}

export const TradeOfferStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted", 
  DECLINED: "declined",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
} as const;

// ShootTracker risk levels
export const RiskLevel = {
  SAFE: "SAFE",
  AT_RISK: "AT_RISK",
  OVERDUE: "OVERDUE",
} as const;

export type RiskLevelType = typeof RiskLevel[keyof typeof RiskLevel];

// ShootTracker creation source
export const CreatedFrom = {
  MANUAL: "MANUAL",
  CALENDAR: "CALENDAR",
} as const;

export type CreatedFromType = typeof CreatedFrom[keyof typeof CreatedFrom];

// ShootTracker meta schemas
export const insertShoottrackerMetaSchema = createInsertSchema(shoottrackerMeta).omit({
  id: true,
});

export const updateShoottrackerMetaSchema = createInsertSchema(shoottrackerMeta).partial().omit({
  id: true,
  projectId: true,
});

export type ShoottrackerMeta = typeof shoottrackerMeta.$inferSelect;
export type InsertShoottrackerMeta = z.infer<typeof insertShoottrackerMetaSchema>;
export type UpdateShoottrackerMeta = z.infer<typeof updateShoottrackerMetaSchema>;

// App settings types
export type AppSetting = typeof appSettings.$inferSelect;

// Keyword turnaround rule schema
export const keywordTurnaroundRuleSchema = z.object({
  name: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  turnaround_days: z.number().int().min(1).max(60),
});

export type KeywordTurnaroundRule = z.infer<typeof keywordTurnaroundRuleSchema>;

// Holiday schema with date range support
export const holidaySchema = z.object({
  name: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_public: z.boolean().default(false),
});

export type Holiday = z.infer<typeof holidaySchema>;

// ShootTracker settings schema
export const shoottrackerSettingsSchema = z.object({
  turnaround_days: z.number().int().min(1).max(30).default(5),
  working_days: z.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])).default(["MON", "TUE", "WED", "THU", "FRI"]),
  holidays: z.array(holidaySchema).default([]),
  exclude_keywords: z.array(z.string()).default(["FULL DAY", "BLOCK", "HOLD", "CANCEL", "NO SHOW"]),
  selected_calendar_ids: z.array(z.string()).default([]),
  timezone: z.string().default("Africa/Johannesburg"),
  daily_capacity_projects: z.number().int().min(1).max(50).default(3),
  ics_calendar_url: z.string().optional().default(""),
  keyword_turnaround_rules: z.array(keywordTurnaroundRuleSchema).default([]),
  auto_sync_enabled: z.boolean().default(false),
  auto_sync_interval_minutes: z.number().int().min(5).max(60).default(15),
  last_auto_sync_at: z.string().optional(),
});

export type ShoottrackerSettings = z.infer<typeof shoottrackerSettingsSchema>;

export const DEFAULT_SHOOTTRACKER_SETTINGS: ShoottrackerSettings = {
  turnaround_days: 5,
  working_days: ["MON", "TUE", "WED", "THU", "FRI"],
  holidays: [],
  exclude_keywords: ["FULL DAY", "BLOCK", "HOLD", "CANCEL", "NO SHOW"],
  selected_calendar_ids: [],
  timezone: "Africa/Johannesburg",
  daily_capacity_projects: 3,
  ics_calendar_url: "",
  keyword_turnaround_rules: [],
  auto_sync_enabled: false,
  auto_sync_interval_minutes: 15,
  last_auto_sync_at: undefined,
};

// Calendar staging status
export const StagingStatus = {
  PENDING: "pending",
  PROMOTED: "promoted",
  IGNORED: "ignored",
} as const;

export type StagingStatusType = typeof StagingStatus[keyof typeof StagingStatus];

// Calendar events staging schemas
export const insertCalendarEventStagingSchema = createInsertSchema(calendarEventsStaging).omit({
  id: true,
  createdAt: true,
  syncedAt: true,
});

export const updateCalendarEventStagingSchema = createInsertSchema(calendarEventsStaging).partial().omit({
  id: true,
  createdAt: true,
  calendarEventId: true,
});

export type CalendarEventStaging = typeof calendarEventsStaging.$inferSelect;
export type InsertCalendarEventStaging = z.infer<typeof insertCalendarEventStagingSchema>;
export type UpdateCalendarEventStaging = z.infer<typeof updateCalendarEventStagingSchema>;

export const insertStagingEventInspoSchema = createInsertSchema(stagingEventInspos).omit({ id: true, createdAt: true });
export type StagingEventInspo = typeof stagingEventInspos.$inferSelect;
export type InsertStagingEventInspo = z.infer<typeof insertStagingEventInspoSchema>;

// Client messages schemas
export const insertClientMessageSchema = createInsertSchema(clientMessages).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type ClientMessage = typeof clientMessages.$inferSelect;
export type InsertClientMessage = z.infer<typeof insertClientMessageSchema>;

// Client auth tokens schemas
export const insertClientAuthTokenSchema = createInsertSchema(clientAuthTokens).omit({
  id: true,
  createdAt: true,
});

export type ClientAuthToken = typeof clientAuthTokens.$inferSelect;
export type InsertClientAuthToken = z.infer<typeof insertClientAuthTokenSchema>;

// Email logs schemas
export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
});

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;

// Sneak peeks table for preview photos sent to clients
export const sneakPeeks = pgTable("sneak_peeks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  sentAt: timestamp("sent_at"),
  sentBy: text("sent_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertSneakPeekSchema = createInsertSchema(sneakPeeks).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type SneakPeek = typeof sneakPeeks.$inferSelect;
export type InsertSneakPeek = z.infer<typeof insertSneakPeekSchema>;

// Client satisfaction surveys
export const clientSurveys = pgTable("client_surveys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  clientEmail: text("client_email").notNull(),
  clientName: text("client_name").notNull(),
  rating: integer("rating"),
  communicationRating: integer("communication_rating"),
  feedback: text("feedback"),
  wouldRecommend: boolean("would_recommend"),
  surveyToken: text("survey_token").notNull().unique(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  googlePromptSentAt: timestamp("google_prompt_sent_at"),
  googleClickedAt: timestamp("google_clicked_at"),
  copyClickedAt: timestamp("copy_clicked_at"),
  googlePromptRemindersSent: integer("google_prompt_reminders_sent").notNull().default(0),
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  alreadyReviewedOnGoogle: boolean("already_reviewed_on_google").notNull().default(false),
  alreadyReviewedAt: timestamp("already_reviewed_at"),
  alreadyReviewedSource: text("already_reviewed_source"),
  alreadyReviewedMatchedAuthor: text("already_reviewed_matched_author"),
});

export const insertSurveySchema = createInsertSchema(clientSurveys).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  rating: true,
  communicationRating: true,
  feedback: true,
  wouldRecommend: true,
});

export type Survey = typeof clientSurveys.$inferSelect;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;

// Referral rewards system
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerEmail: text("referrer_email").notNull(),
  referrerName: text("referrer_name").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referredEmail: text("referred_email"),
  referredName: text("referred_name"),
  referredFirstName: text("referred_first_name"),
  referredLastName: text("referred_last_name"),
  referredProjectId: varchar("referred_project_id").references(() => projects.id),
  status: text("status").notNull().default("pending"),
  rewardNote: text("reward_note"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

// VIP Client Profiles
export const clientProfiles = pgTable("client_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientEmail: text("client_email").notNull().unique(),
  clientName: text("client_name").notNull(),
  totalProjects: integer("total_projects").notNull().default(0),
  totalDelivered: integer("total_delivered").notNull().default(0),
  vipTier: text("vip_tier").notNull().default("Standard"),
  bonusPhotos: integer("bonus_photos").notNull().default(0),
  bonusPhotosUsed: integer("bonus_photos_used").notNull().default(0),
  priorityTurnaround: boolean("priority_turnaround").notNull().default(false),
  notes: text("notes"),
  firstProjectAt: timestamp("first_project_at"),
  lastProjectAt: timestamp("last_project_at"),
  totalBookings: integer("total_bookings").notNull().default(0),
  referralMatchCount: integer("referral_match_count").notNull().default(0),
  rewardScore: integer("reward_score").notNull().default(0),
  rewardTier: text("reward_tier").notNull().default("Bronze"),
  lastRewardSyncAt: timestamp("last_reward_sync_at"),
  unsubscribed: boolean("unsubscribed").notNull().default(false),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertClientProfileSchema = createInsertSchema(clientProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ClientProfile = typeof clientProfiles.$inferSelect;
export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;

export const referralRewardClaims = pgTable("referral_reward_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientEmail: text("client_email").notNull(),
  clientName: text("client_name").notNull(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  photosApplied: integer("photos_applied").notNull(),
  appliedBy: text("applied_by").notNull(),
  appliedAt: timestamp("applied_at").notNull().default(sql`now()`),
});

export const insertRewardClaimSchema = createInsertSchema(referralRewardClaims).omit({
  id: true,
  appliedAt: true,
});

export type RewardClaim = typeof referralRewardClaims.$inferSelect;
export type InsertRewardClaim = z.infer<typeof insertRewardClaimSchema>;

export const VipTier = {
  STANDARD: "Standard",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
} as const;

export const RewardTier = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  DIAMOND: "Diamond",
} as const;

// Email types
export const EmailType = {
  DELIVERY_ESTIMATE: "delivery_estimate",
  PROJECT_ADDED: "project_added",
  EXTRAS_APPROVAL: "extras_approval",
  CHAT_LINK: "chat_link",
  MESSAGE_NOTIFICATION: "message_notification",
  PROJECT_ASSIGNED: "project_assigned",
  DELAY_NOTIFICATION: "delay_notification",
  GALLERY_DELIVERY: "gallery_delivery",
  SNEAK_PEEK: "sneak_peek",
  SATISFACTION_SURVEY: "satisfaction_survey",
  SCHEDULING_NOTIFICATION: "scheduling_notification",
  MANUAL_DELAY_NOTICE: "manual_delay_notice",
  GALLERY_PREVIEW: "gallery_preview",
  GOOGLE_REVIEW_PROMPT: "google_review_prompt",
  GOOGLE_REVIEW_REMINDER: "google_review_reminder",
  GOOGLE_REVIEW_THANKS: "google_review_thanks",
  NOEL_DELIVERY_ESTIMATE: "noel_delivery_estimate",
  NOEL_PHOTOS_READY: "noel_photos_ready",
  NOEL_SURVEY: "noel_survey",
  NOEL_SELECTION_INVITE: "noel_selection_invite",
  NOEL_SELECTION_REMINDER_ORANGE: "noel_selection_reminder_orange",
  NOEL_SELECTION_REMINDER_RED: "noel_selection_reminder_red",
  NOEL_SELECTION_PHOTOS_READY: "noel_selection_photos_ready",
} as const;

export type EmailTypeValue = typeof EmailType[keyof typeof EmailType];

// Dashboard preferences for customizable widget system
export const dashboardPreferences = pgTable("dashboard_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(), // Maps to user name/role combo
  widgetOrder: jsonb("widget_order").notNull().default(sql`'[]'::jsonb`), // Array of widget IDs in display order
  hiddenWidgets: jsonb("hidden_widgets").notNull().default(sql`'[]'::jsonb`), // Array of hidden widget IDs
  widgetSettings: jsonb("widget_settings").notNull().default(sql`'{}'::jsonb`), // Per-widget settings
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Dashboard preferences schemas
export const insertDashboardPreferencesSchema = createInsertSchema(dashboardPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DashboardPreferences = typeof dashboardPreferences.$inferSelect;
export type InsertDashboardPreferences = z.infer<typeof insertDashboardPreferencesSchema>;

// Widget configuration types
export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  roles: string[]; // Which roles can see this widget
}

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateKey: text("template_key").notNull().unique(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  availableVariables: jsonb("available_variables").notNull().default(sql`'[]'::jsonb`),
  isCustomized: boolean("is_customized").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  lastEditedBy: text("last_edited_by"),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  updatedAt: true,
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// Project status transitions for speed tracking
export const projectStatusTransitions = pgTable("project_status_transitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by").notNull(),
  transitionedAt: timestamp("transitioned_at").notNull().default(sql`now()`),
  durationMinutes: integer("duration_minutes"),
});

export const insertStatusTransitionSchema = createInsertSchema(projectStatusTransitions).omit({
  id: true,
  transitionedAt: true,
  durationMinutes: true,
});

export type StatusTransition = typeof projectStatusTransitions.$inferSelect;
export type InsertStatusTransition = z.infer<typeof insertStatusTransitionSchema>;

// Leave management system
export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  weekdaysCount: integer("weekdays_count").notNull(),
  reason: text("reason").notNull(),
  leaveType: text("leave_type").notNull().default("annual"),
  status: text("status").notNull().default("pending"),
  aiDecision: text("ai_decision"),
  aiReason: text("ai_reason"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
  aiDecision: true,
  aiReason: true,
  reviewedBy: true,
  reviewedAt: true,
});

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

// AI team chat messages
export const aiTeamMessages = pgTable("ai_team_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  role: text("role").notNull(),
  senderType: text("sender_type").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAiTeamMessageSchema = createInsertSchema(aiTeamMessages).omit({
  id: true,
  createdAt: true,
});

export type AiTeamMessage = typeof aiTeamMessages.$inferSelect;
export type InsertAiTeamMessage = z.infer<typeof insertAiTeamMessageSchema>;

// AI Memory - learning layer for AI to remember past observations
export const aiMemory = pgTable("ai_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'observation', 'pattern', 'feedback', 'preference', 'performance_trend'
  category: text("category").notNull(), // 'insights', 'retoucher_coach', 'team_chat', 'quality_gate', 'workload', 'risk', 'general'
  content: text("content").notNull(),
  context: jsonb("context"), // Additional structured data
  retoucherName: text("retoucher_name"), // null for general memories
  projectId: varchar("project_id"), // null for general memories
  importance: integer("importance").notNull().default(5), // 1-10 scale
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at"), // null = never expires
});

export const insertAiMemorySchema = createInsertSchema(aiMemory).omit({
  id: true,
  createdAt: true,
});

export type AiMemory = typeof aiMemory.$inferSelect;
export type InsertAiMemory = z.infer<typeof insertAiMemorySchema>;

// Admin Instructions - directives for AI on how to handle the team
export const aiAdminInstructions = pgTable("ai_admin_instructions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instruction: text("instruction").notNull(),
  category: text("category").notNull().default("general"), // 'general', 'quality', 'deadlines', 'individual', 'communication'
  targetRetoucher: text("target_retoucher"), // null = applies to all
  priority: integer("priority").notNull().default(5), // 1-10
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertAiAdminInstructionSchema = createInsertSchema(aiAdminInstructions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AiAdminInstruction = typeof aiAdminInstructions.$inferSelect;
export type InsertAiAdminInstruction = z.infer<typeof insertAiAdminInstructionSchema>;

export const galleries = pgTable("galleries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  password: text("password"),
  downloadPin: text("download_pin"),
  coverImageKey: text("cover_image_key"),
  status: text("status").notNull().default("draft"),
  settings: jsonb("settings").notNull().default(sql`'{"downloadEnabled":true,"downloadSizes":["original","web"],"favoritesEnabled":true,"favoriteNotesEnabled":true,"slideshowEnabled":true,"socialSharingEnabled":false,"filenameDisplay":true,"watermarkEnabled":true,"emailRegistration":false,"galleryAssist":false,"language":"en","gridStyle":"vertical","thumbnailSize":"regular","colorTheme":"light","fontTheme":"sans"}'::jsonb`),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  publishedAt: timestamp("published_at"),
});

export const gallerySets = pgTable("gallery_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isDownloadable: boolean("is_downloadable").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const galleryPhotos = pgTable("gallery_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  setId: varchar("set_id").notNull().references(() => gallerySets.id, { onDelete: "cascade" }),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbnailKey: text("thumbnail_key"),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const galleryFavLists = pgTable("gallery_fav_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientEmail: text("client_email").notNull(),
  name: text("name").notNull().default("My Favorites"),
  selectionLimit: integer("selection_limit"),
  isSubmitted: boolean("is_submitted").notNull().default(false),
  submittedAt: timestamp("submitted_at"),
  submittedMessage: text("submitted_message"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const gallerySelections = pgTable("gallery_selections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  favListId: varchar("fav_list_id").notNull().references(() => galleryFavLists.id, { onDelete: "cascade" }),
  photoId: varchar("photo_id").notNull().references(() => galleryPhotos.id, { onDelete: "cascade" }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const galleryDownloads = pgTable("gallery_downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientEmail: text("client_email").notNull(),
  downloadType: text("download_type").notNull(),
  photoIds: jsonb("photo_ids"),
  downloadSize: text("download_size").notNull().default("original"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const galleryAuthTokens = pgTable("gallery_auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientEmail: text("client_email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Gallery Zod schemas
// ---------------------------------------------------------------------------
// Delivery galleries
//
// A client-facing view onto a project's finished Drive folder, so the client
// never has to open Drive itself.
//
// Nothing here duplicates the photographs. The originals stay in Drive; these
// rows carry the file ids and the ordering, and a preview is cached the first
// time one is asked for. That means deleting a photo in Drive removes it from
// delivery too, rather than leaving a stale copy being handed out as final.
//
// Deliberately separate from `galleries` above: that model requires every photo
// to have a GCS `storageKey`, which a Drive-backed photo does not have.
// ---------------------------------------------------------------------------

export const deliveryGalleries = pgTable("delivery_galleries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  // The public address. This is the only thing standing between a stranger and
  // a client's photographs, so it is generated, long and unguessable — never
  // derived from the client's name or the project id.
  token: text("token").notNull().unique(),
  title: text("title").notNull(),
  // Snapshotted from the project at creation. If someone later repoints the
  // project at a different Drive folder, a gallery that has already been
  // delivered must not silently start serving different photographs.
  driveFolderId: text("drive_folder_id").notNull(),
  coverPhotoId: varchar("cover_photo_id"),
  photoCount: integer("photo_count").notNull().default(0),
  lastSyncedAt: timestamp("last_synced_at"),
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const deliveryPhotos = pgTable("delivery_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: varchar("gallery_id")
    .notNull()
    .references(() => deliveryGalleries.id, { onDelete: "cascade" }),
  // Never sent to a browser. A Drive link that works in a browser works for
  // anyone who has it, which would make the delivery gate meaningless.
  driveFileId: text("drive_file_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  // Two derivatives, both made from the Drive original and cached in object
  // storage. Null on either simply means "not built yet", never "broken".
  //
  // They exist separately because one image cannot serve both jobs: a grid of
  // 400 full previews would be most of a gigabyte, and a thumbnail opened in
  // the lightbox would look like a thumbnail.
  thumbKey: text("thumb_key"),      // grid
  previewKey: text("preview_key"),  // lightbox, full-screen
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertDeliveryGallerySchema = createInsertSchema(deliveryGalleries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeliveryPhotoSchema = createInsertSchema(deliveryPhotos).omit({
  id: true,
  createdAt: true,
});

export type DeliveryGallery = typeof deliveryGalleries.$inferSelect;
export type DeliveryPhoto = typeof deliveryPhotos.$inferSelect;
export type InsertDeliveryGallery = z.infer<typeof insertDeliveryGallerySchema>;
export type InsertDeliveryPhoto = z.infer<typeof insertDeliveryPhotoSchema>;

export const insertGallerySchema = createInsertSchema(galleries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export const updateGallerySchema = createInsertSchema(galleries).partial().omit({
  id: true,
  createdAt: true,
});

export const insertGallerySetSchema = createInsertSchema(gallerySets).omit({
  id: true,
  createdAt: true,
});

export const insertGalleryPhotoSchema = createInsertSchema(galleryPhotos).omit({
  id: true,
  createdAt: true,
});

export const insertGalleryFavListSchema = createInsertSchema(galleryFavLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isSubmitted: true,
  submittedAt: true,
  submittedMessage: true,
});

export const insertGallerySelectionSchema = createInsertSchema(gallerySelections).omit({
  id: true,
  createdAt: true,
});

export const insertGalleryDownloadSchema = createInsertSchema(galleryDownloads).omit({
  id: true,
  createdAt: true,
});

export const insertGalleryAuthTokenSchema = createInsertSchema(galleryAuthTokens).omit({
  id: true,
  createdAt: true,
});

// Gallery type exports
export type Gallery = typeof galleries.$inferSelect;
export type InsertGallery = z.infer<typeof insertGallerySchema>;
export type UpdateGallery = z.infer<typeof updateGallerySchema>;
export type GallerySet = typeof gallerySets.$inferSelect;
export type InsertGallerySet = z.infer<typeof insertGallerySetSchema>;
export type GalleryPhoto = typeof galleryPhotos.$inferSelect;
export type InsertGalleryPhoto = z.infer<typeof insertGalleryPhotoSchema>;
export type GalleryFavList = typeof galleryFavLists.$inferSelect;
export type InsertGalleryFavList = z.infer<typeof insertGalleryFavListSchema>;
export type GallerySelection = typeof gallerySelections.$inferSelect;
export type InsertGallerySelection = z.infer<typeof insertGallerySelectionSchema>;
export type GalleryDownload = typeof galleryDownloads.$inferSelect;
export type InsertGalleryDownload = z.infer<typeof insertGalleryDownloadSchema>;
export type GalleryAuthToken = typeof galleryAuthTokens.$inferSelect;
export type InsertGalleryAuthToken = z.infer<typeof insertGalleryAuthTokenSchema>;

export const GalleryStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  HIDDEN: "hidden",
  EXPIRED: "expired",
} as const;

// =====================================================
// Photographer Inspos & Wrangler Notes (Task #27)
// =====================================================
export const projectInspos = pgTable("project_inspos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("photo"), // 'photo' | 'text'
  storageKey: text("storage_key"),
  caption: text("caption"),
  body: text("body"),
  sortOrder: integer("sort_order").notNull().default(0),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const projectInspoMeta = pgTable("project_inspo_meta", {
  projectId: varchar("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  overallInstructions: text("overall_instructions").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  updatedBy: text("updated_by"),
});

export const projectWranglerNotes = pgTable("project_wrangler_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'photo' | 'text'
  storageKey: text("storage_key"),
  caption: text("caption"),
  body: text("body"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertProjectInspoSchema = createInsertSchema(projectInspos).omit({ id: true, createdAt: true });
export type ProjectInspo = typeof projectInspos.$inferSelect;
export type InsertProjectInspo = z.infer<typeof insertProjectInspoSchema>;

export const insertProjectWranglerNoteSchema = createInsertSchema(projectWranglerNotes).omit({ id: true, createdAt: true });
export type ProjectWranglerNote = typeof projectWranglerNotes.$inferSelect;
export type InsertProjectWranglerNote = z.infer<typeof insertProjectWranglerNoteSchema>;

export type ProjectInspoMeta = typeof projectInspoMeta.$inferSelect;

// =====================================================
// CAMPAIGN TABLES (Noël Set 2026 Pipeline)
// =====================================================

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  hardDeadline: timestamp("hard_deadline").notNull(),
  surveyDelayDays: integer("survey_delay_days").notNull().default(3),
  reviewMode: text("review_mode").notNull().default("spot-check"), // 'full' | 'spot-check' | 'ai-gate-only'
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'cancelled'
  bufferDays: integer("buffer_days").notNull().default(2), // extra days to finish before hard deadline
  dateSlipThresholdDays: integer("date_slip_threshold_days").notNull().default(3), // days of slip before client chat alert
  keywords: text("keywords").array(), // editable list of calendar-event keywords that identify campaign shoots
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const campaignAssignments = pgTable("campaign_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  retoucherId: text("retoucher_id").notNull(),
  retoucherName: text("retoucher_name").notNull(),
  userId: varchar("user_id"), // FK to users table (nullable for non-registered retouchers)
  roleWithinCampaign: text("role_within_campaign").notNull().default("retoucher"), // 'retoucher' | 'lead' | 'qa'
  totalAssigned: integer("total_assigned").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const campaignVelocitySnapshots = pgTable("campaign_velocity_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  snapshotAt: timestamp("snapshot_at").notNull().default(sql`now()`),
  photosCompleted: integer("photos_completed").notNull().default(0),
  photosRemaining: integer("photos_remaining").notNull().default(0),
  requiredDailyRate: integer("required_daily_rate").notNull().default(0),
  forecastFinishDate: timestamp("forecast_finish_date"),
  actualDailyRate: integer("actual_daily_rate").notNull().default(0),
  isOnTrack: boolean("is_on_track").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCampaignAssignmentSchema = createInsertSchema(campaignAssignments).omit({ id: true, createdAt: true });
export const insertCampaignVelocitySnapshotSchema = createInsertSchema(campaignVelocitySnapshots).omit({ id: true, createdAt: true });

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CampaignAssignment = typeof campaignAssignments.$inferSelect;
export type InsertCampaignAssignment = z.infer<typeof insertCampaignAssignmentSchema>;
export type CampaignVelocitySnapshot = typeof campaignVelocitySnapshots.$inferSelect;
export type InsertCampaignVelocitySnapshot = z.infer<typeof insertCampaignVelocitySnapshotSchema>;

export const CAMPAIGN_NOEL_KEYWORDS = ["noël", "noel", "noel set", "noël set", "christmas set", "blanc"];

export const GalleryPermissions = {
  FULL: ["Admin", "Evans", "Retoucher1", "Retoucher2", "Retoucher3", "DataWrangler"],
  MANAGE: ["LeadRetoucher"],
  READ_ONLY: ["Finance"],
} as const;

export const AVAILABLE_WIDGETS: WidgetConfig[] = [
  { id: "daily_quote", name: "Daily Inspiration", description: "Motivational quote of the day", icon: "Quote", defaultEnabled: true, roles: ["Admin", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "DataWrangler", "Sales", "Evans"] },
  { id: "my_tasks", name: "My Tasks", description: "Projects assigned to you", icon: "User", defaultEnabled: true, roles: ["Admin", "Retoucher1", "Retoucher2", "Retoucher3"] },
  { id: "shoottracker", name: "ShootTracker", description: "Upcoming shoots and at-risk projects", icon: "Camera", defaultEnabled: true, roles: ["Admin", "Sales", "LeadRetoucher", "DataWrangler"] },
  { id: "team_analytics", name: "Team Analytics", description: "Team performance charts", icon: "BarChart3", defaultEnabled: true, roles: ["Admin", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "DataWrangler", "Sales"] },
  { id: "project_table", name: "Project Table", description: "All projects overview", icon: "Table", defaultEnabled: true, roles: ["Admin", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "DataWrangler", "Photographer"] },
  { id: "pending_payments", name: "Pending Payments", description: "Projects awaiting payment", icon: "DollarSign", defaultEnabled: true, roles: ["Sales"] },
  { id: "ready_delivery", name: "Ready for Delivery", description: "Projects ready to deliver", icon: "Package", defaultEnabled: true, roles: ["Sales"] },
  { id: "ai_insights", name: "AI Insights", description: "AI-powered project trends and recommendations", icon: "Sparkles", defaultEnabled: true, roles: ["Admin", "LeadRetoucher", "DataWrangler", "Sales"] },
  { id: "retoucher_coach", name: "AI Coach", description: "Personalized performance tips from AI", icon: "Brain", defaultEnabled: true, roles: ["Retoucher1", "Retoucher2", "Retoucher3"] },
  { id: "workload_forecast", name: "Workload Forecast", description: "AI-powered capacity planning for upcoming weeks", icon: "BarChart3", defaultEnabled: true, roles: ["Admin", "LeadRetoucher"] },
  { id: "predictive_risk", name: "Risk Alerts", description: "AI predictions for projects likely to go overdue", icon: "Sparkles", defaultEnabled: true, roles: ["Admin", "LeadRetoucher"] },
  { id: "gallery_activity", name: "Gallery Activity", description: "Recent client gallery selections and downloads", icon: "Image", defaultEnabled: true, roles: ["Admin", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "DataWrangler", "Evans"] },
  { id: "google_review_funnel", name: "Google Review Funnel", description: "Prompts, reminders, copy-helper opens & Google clicks", icon: "Star", defaultEnabled: true, roles: ["Admin"] },
  { id: "google_place_reviews", name: "Live Google Reviews", description: "Live rating and the 5 most recent reviews from Google", icon: "Star", defaultEnabled: true, roles: ["Admin", "Sales", "LeadRetoucher"] },
];
