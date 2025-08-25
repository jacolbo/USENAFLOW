import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { randomUUID } from "crypto";

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
  id: varchar("id").primaryKey().$defaultFn(() => randomUUID()),
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

export const UserRoles = {
  ADMIN: "Admin",
  LEAD_RETOUCHER: "LeadRetoucher", 
  DATA_WRANGLER: "DataWrangler",
  RETOUCHER_1: "Retoucher1",
  RETOUCHER_2: "Retoucher2",
  RETOUCHER_3: "Retoucher3",
} as const;

export const ProjectStatus = {
  AWAITING_PAYMENT: "Awaiting Payment",
  READY_FOR_RETOUCHING: "Ready for Retouching",
  ASSIGNED: "Assigned",
  REVIEW: "Review",
  CORRECTIONS: "Corrections",
  DELIVERED: "Delivered",
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
