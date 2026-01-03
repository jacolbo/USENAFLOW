import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  turnaroundDays: integer("turnaround_days").notNull().default(5),
  workdays: text("workdays").notNull().default("1,2,3,4,5"),
  holidays: text("holidays").default(""),
  exclusionKeywords: text("exclusion_keywords").notNull().default("FULL DAY,BLOCK,HOLD,OUT OF OFFICE"),
  cancelKeywords: text("cancel_keywords").notNull().default("CANCEL,CANCELLED,DID NOT COME,NO SHOW,NOT COMING"),
  deadlineDate: date("deadline_date"),
  dateRangeStart: date("date_range_start"),
  dateRangeEnd: date("date_range_end"),
  capacityPerDay: integer("capacity_per_day"),
  selectedCalendarId: text("selected_calendar_id"),
  selectedCalendarIds: text("selected_calendar_ids").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventOverrides = pgTable("event_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull(),
  eventStartTime: timestamp("event_start_time").notNull(),
  linkSent: boolean("link_sent").notNull().default(false),
  linkSentAt: timestamp("link_sent_at"),
  delivered: boolean("delivered").notNull().default(false),
  deliveredAt: timestamp("delivered_at"),
  notes: text("notes").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertEventOverrideSchema = createInsertSchema(eventOverrides).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

export type InsertEventOverride = z.infer<typeof insertEventOverrideSchema>;
export type EventOverride = typeof eventOverrides.$inferSelect;

export const eventStatusSchema = z.enum(["done", "upcoming", "excluded"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: eventStatusSchema,
  deliveryDueDate: z.string().nullable(),
  isLinkSent: z.boolean(),
  linkSentAt: z.string().nullable(),
  isDelivered: z.boolean(),
  isOverdue: z.boolean(),
  deliveredAt: z.string().nullable(),
  notes: z.string(),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const forecastSchema = z.object({
  totalProjects: z.number(),
  projectsDueByDeadline: z.number(),
  projectsAtRisk: z.number(),
  requiredThroughput: z.number(),
  remainingWorkingDays: z.number(),
  feasibilityStatus: z.enum(["green", "amber", "red"]),
  dailyWorkload: z.array(z.object({
    date: z.string(),
    count: z.number(),
    isWorkday: z.boolean(),
    isHoliday: z.boolean(),
  })),
});

export type Forecast = z.infer<typeof forecastSchema>;

export const kpiDataSchema = z.object({
  total: z.number(),
  done: z.number(),
  upcoming: z.number(),
  delivered: z.number(),
  dueThisWeek: z.number(),
  overdue: z.number(),
  dueByDeadline: z.number(),
  atRisk: z.number(),
});

export type KPIData = z.infer<typeof kpiDataSchema>;

export const calendarInfoSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  primary: z.boolean().optional(),
});

export type CalendarInfo = z.infer<typeof calendarInfoSchema>;

export const monthlyStatsSchema = z.object({
  month: z.string(),
  done: z.number(),
  delivered: z.number(),
  onTimeDeliveries: z.number(),
  avgTurnaroundDays: z.number(),
});

export type MonthlyStats = z.infer<typeof monthlyStatsSchema>;

export const analyticsDataSchema = z.object({
  monthlyStats: z.array(monthlyStatsSchema),
  overallCompletionRate: z.number(),
  overallOnTimeRate: z.number(),
  avgTurnaroundDays: z.number(),
  totalProjects: z.number(),
  deliveredProjects: z.number(),
});

export type AnalyticsData = z.infer<typeof analyticsDataSchema>;
