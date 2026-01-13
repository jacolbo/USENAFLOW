import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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
  // Client share link fields (existing)
  isLinkSent: boolean("is_link_sent").notNull().default(false),
  linkSentAt: timestamp("link_sent_at"),
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

// ShootTracker settings schema
export const shoottrackerSettingsSchema = z.object({
  turnaround_days: z.number().int().min(1).max(30).default(5),
  working_days: z.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])).default(["MON", "TUE", "WED", "THU", "FRI"]),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  exclude_keywords: z.array(z.string()).default(["FULL DAY", "BLOCK", "HOLD", "CANCEL", "NO SHOW"]),
  selected_calendar_ids: z.array(z.string()).default([]),
  timezone: z.string().default("Africa/Johannesburg"),
  daily_capacity_projects: z.number().int().min(1).max(50).default(3),
  ics_calendar_url: z.string().optional().default(""),
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
