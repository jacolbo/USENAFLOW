import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
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
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull(),
  invoicePaid: boolean("invoice_paid").notNull().default(false),
  assignedTo: text("assigned_to"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  deliveredAt: timestamp("delivered_at"),
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
  deliveredAt: true,
}).extend({
  dueDate: z.string().transform((str) => new Date(str)),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProjectNote = z.infer<typeof insertProjectNoteSchema>;
export type UpdateProjectNote = z.infer<typeof updateProjectNoteSchema>;
export type ProjectNote = typeof projectNotes.$inferSelect;

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
  DELIVERED: "Delivered",
} as const;
