import { db } from "./db";
import { storage } from "./storage";
import { sendGoogleReviewPromptEmail } from "./services/emailService";
import { clientSurveys } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_OFFSETS_DAYS = [3, 7, 14] as const;
const MAX_REMINDERS = REMINDER_OFFSETS_DAYS.length;
// Feature launch date — surveys completed BEFORE this are excluded from
// the Google review prompt automation (no retroactive emails).
const FEATURE_LAUNCH_AT = new Date("2026-05-12T00:00:00Z");

let promptIntervalHandle: NodeJS.Timeout | null = null;
let reminderIntervalHandle: NodeJS.Timeout | null = null;
let promptInFlight = false;
let reminderInFlight = false;

async function processGooglePrompts() {
  if (promptInFlight) return;
  promptInFlight = true;
  try {
    const candidates = await storage.getSurveysAwaitingGooglePrompt(FIVE_MINUTES_MS);
    for (const s of candidates) {
      try {
        // Defence in depth: never send for surveys completed before launch
        if (!s.completedAt || s.completedAt < FEATURE_LAUNCH_AT) continue;
        const now = new Date();
        // Atomic claim: only proceed if googlePromptSentAt is still NULL
        const claimed = await db
          .update(clientSurveys)
          .set({ googlePromptSentAt: now })
          .where(and(eq(clientSurveys.id, s.id), isNull(clientSurveys.googlePromptSentAt)))
          .returning({ id: clientSurveys.id });
        if (claimed.length === 0) continue;

        const result = await sendGoogleReviewPromptEmail(
          s.clientEmail,
          s.clientName,
          s.surveyToken,
          s.feedback,
          s.projectId,
          false,
          0,
        );
        if (!result.success) {
          // Rollback claim so it can retry next tick
          await db
            .update(clientSurveys)
            .set({ googlePromptSentAt: null })
            .where(eq(clientSurveys.id, s.id));
          console.warn(`[GoogleReviewScheduler] Prompt send failed, rolled back: ${s.id}`);
        }
      } catch (err: any) {
        console.error(`[GoogleReviewScheduler] Prompt error for ${s.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[GoogleReviewScheduler] processGooglePrompts:", err.message);
  } finally {
    promptInFlight = false;
  }
}

async function processReminders() {
  if (reminderInFlight) return;
  reminderInFlight = true;
  try {
    const surveys = await storage.getSurveysAwaitingReminder();
    const now = Date.now();
    for (const s of surveys) {
      try {
        const sentCount = s.googlePromptRemindersSent || 0;
        if (sentCount >= MAX_REMINDERS) continue;
        if (!s.googlePromptSentAt) continue;

        // Cumulative offsets from the original prompt: day 3, day 7, day 14
        const offsetDays = REMINDER_OFFSETS_DAYS[sentCount];
        const dueAt = s.googlePromptSentAt.getTime() + offsetDays * DAY_MS;
        if (now < dueAt) continue;

        // Atomic claim: only advance if reminder count hasn't moved
        const nextCount = sentCount + 1;
        const reminderTime = new Date();
        const claimed = await db
          .update(clientSurveys)
          .set({ googlePromptRemindersSent: nextCount, lastReminderSentAt: reminderTime })
          .where(and(
            eq(clientSurveys.id, s.id),
            eq(clientSurveys.googlePromptRemindersSent, sentCount),
            isNull(clientSurveys.googleClickedAt),
          ))
          .returning({ id: clientSurveys.id });
        if (claimed.length === 0) continue;

        const result = await sendGoogleReviewPromptEmail(
          s.clientEmail,
          s.clientName,
          s.surveyToken,
          s.feedback,
          s.projectId,
          true,
          nextCount,
        );
        if (!result.success) {
          // Rollback claim
          await db
            .update(clientSurveys)
            .set({ googlePromptRemindersSent: sentCount, lastReminderSentAt: s.lastReminderSentAt })
            .where(eq(clientSurveys.id, s.id));
          console.warn(`[GoogleReviewScheduler] Reminder #${nextCount} send failed, rolled back: ${s.id}`);
        }
      } catch (err: any) {
        console.error(`[GoogleReviewScheduler] Reminder error for ${s.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[GoogleReviewScheduler] processReminders:", err.message);
  } finally {
    reminderInFlight = false;
  }
}

export function startGoogleReviewScheduler() {
  if (promptIntervalHandle || reminderIntervalHandle) return;
  console.log("[GoogleReviewScheduler] Starting (prompts every 60s, reminders every hour, cadence 3/7/14d from prompt)");
  promptIntervalHandle = setInterval(processGooglePrompts, 60 * 1000);
  reminderIntervalHandle = setInterval(processReminders, 60 * 60 * 1000);
  setTimeout(processGooglePrompts, 10_000);
  setTimeout(processReminders, 30_000);
}
