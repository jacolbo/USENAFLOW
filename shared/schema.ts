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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type Project = typeof projects.$inferSelect;

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
