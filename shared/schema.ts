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

export const teamTasks = pgTable("team_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  clientName: text("client_name").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: text("assigned_to").notNull(),
  assignedBy: text("assigned_by").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'completed'
  priority: text("priority").notNull().default("normal"), // 'normal', 'urgent'
  dueDate: timestamp("due_date").notNull(),
  completedAt: timestamp("completed_at"),
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

export const insertTeamTaskSchema = createInsertSchema(teamTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  dueDate: z.string().transform((str) => new Date(str)),
});

export const updateTeamTaskSchema = createInsertSchema(teamTasks).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dueDate: z.string().transform((str) => new Date(str)).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type InsertTeamTask = z.infer<typeof insertTeamTaskSchema>;
export type UpdateTeamTask = z.infer<typeof updateTeamTaskSchema>;
export type TeamTask = typeof teamTasks.$inferSelect;
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

// Notification system schemas
export interface Notification {
  id: string;
  type: 'project_assigned' | 'project_completed' | 'project_created' | 'status_change' | 'task_assigned' | 'task_completed';
  title: string;
  message: string;
  projectId?: string;
  userId?: string;
  createdAt: Date;
  read: boolean;
}

export interface WebSocketMessage {
  type: 'NOTIFICATION' | 'PROJECT_UPDATE' | 'SYNC_REQUEST' | 'USER_IDENTIFY' | 'TASK_UPDATE';
  data: any;
  timestamp: Date;
}
