/**
 * Noël Set 2026 Campaign Scheduler
 *
 * Responsibilities:
 *  1. calculateNoelDueDate   — shoot + 5 working days, capped at 19 Dec hard deadline
 *  2. scheduleCampaignWorkDates — photo-weighted daily-capacity forward scheduling
 *  3. runPacingEngine        — velocity / forecast / warning
 *  4. runNightlyPacing       — nightly snapshot + reschedule at 02:00
 *  5. wireUpCampaignListeners — event subscribers with true subscribe/unsubscribe
 *  6. startCampaignCron      — boots cron + listeners
 *
 * True Automation Hub toggle support:
 *  - Each listener is registered with a named reference so it can be detached
 *    when an automation is disabled and re-attached when re-enabled.
 *  - The registry's onAutomationToggle hook calls setCampaignListenerEnabled().
 */

import { storage } from "../storage";
import { campaignBus, type CampaignEvents } from "../events";
import { recordFired, isEnabled, onAutomationToggle } from "./automationRegistry";
import {
  sendNoelDeliveryEstimateEmail,
  sendNoelPhotosReadyEmail,
  sendNoelSurveyEmail,
} from "./emailService";
import type { Project, Campaign } from "@shared/schema";

const HARD_DEADLINE = new Date("2026-12-19T23:59:59");
const CAMPAIGN_YEAR = 2026;
const DAILY_PHOTO_CAPACITY = 30;
// True cancel-and-reschedule debounce: absorbs rapid date corrections within 5 minutes.
// When a date change fires, any pending timer for that project is cancelled and restarted
// with the latest values.  The notification fires only after 5 quiet minutes.
const DEBOUNCE_MS = 5 * 60 * 1000;
const dateChangePendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─────────────────────── Date utilities ────────────────────────

function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function addWorkingDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isWorkingDay(result)) added++;
  }
  return result;
}

function subtractWorkingDays(from: Date, days: number): Date {
  const result = new Date(from);
  let subtracted = 0;
  while (subtracted < days) {
    result.setDate(result.getDate() - 1);
    if (isWorkingDay(result)) subtracted++;
  }
  return result;
}

function countWorkingDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let count = 0;
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= to) {
    if (isWorkingDay(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─────────────────────── Core functions ────────────────────────

/**
 * Promised delivery date: shoot + 5 working days, capped at the 19 Dec hard deadline.
 * No buffer is subtracted here — bufferDays is a scheduling buffer only, not a client promise.
 */
export function calculateNoelDueDate(shootDate: Date): Date {
  const fiveWorkingDays = addWorkingDays(shootDate, 5);
  return fiveWorkingDays > HARD_DEADLINE ? HARD_DEADLINE : fiveWorkingDays;
}

export function isNoelKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("noël") ||
    lower.includes("noel") ||
    lower.includes("christmas set") ||
    lower.includes("noël set")
  );
}

// ─────────────────────── Campaign setup ────────────────────────

export async function ensureNoelCampaign(): Promise<Campaign> {
  const existing = await storage.getActiveCampaign();
  if (existing) return existing;
  const campaign = await storage.createCampaign({
    name: "Noël Set 2026",
    year: CAMPAIGN_YEAR,
    hardDeadline: HARD_DEADLINE,
    surveyDelayDays: 3,
    reviewMode: "spot-check",
    isActive: true,
    status: "active",
    bufferDays: 2,
    dateSlipThresholdDays: 0,
  });
  console.log(`🎄 Created Noël 2026 campaign: ${campaign.id}`);
  return campaign;
}

// ─────────────────────── Photo-weighted day planner ────────────

/**
 * Photo-weighted, daily-capacity forward scheduler.
 *
 * Algorithm:
 *  1. Sort pending projects by promisedDeliveryDate ascending (most urgent first).
 *  2. Walk forward from tomorrow through to the hard deadline, day by day.
 *  3. On each working day, fill projects (urgency order) until daily capacity exhausted.
 *     Capacity = DAILY_PHOTO_CAPACITY × distinct-retoucher-count.
 *  4. Each project's plannedWorkDate = first day it is scheduled.
 *  5. Persist only rows whose plannedWorkDate changed.
 */
export async function scheduleCampaignWorkDates(campaignId: string): Promise<void> {
  try {
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) return;

    const projectList = await storage.getCampaignProjects(campaignId);
    const pending = projectList.filter((p) => p.status !== "Delivered");
    if (pending.length === 0) return;

    const retoucherIds = new Set(
      pending.map((p) => p.assignedRetoucherId || p.assignedTo).filter(Boolean) as string[]
    );
    const dailyCapacity = DAILY_PHOTO_CAPACITY * Math.max(1, retoucherIds.size);

    const sorted = [...pending].sort((a, b) => {
      const da = new Date(a.promisedDeliveryDate || a.deliveryDueDate || HARD_DEADLINE);
      const db = new Date(b.promisedDeliveryDate || b.deliveryDueDate || HARD_DEADLINE);
      return da.getTime() - db.getTime();
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignments = new Map<string, Date>();
    const queue = [...sorted];
    let dayUsed = 0;
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + 1);

    while (queue.length > 0) {
      if (cursor > HARD_DEADLINE) {
        const fallback = isWorkingDay(today) ? new Date(today) : subtractWorkingDays(HARD_DEADLINE, 0);
        for (const p of queue) assignments.set(p.id, new Date(fallback));
        break;
      }
      if (!isWorkingDay(cursor)) { cursor.setDate(cursor.getDate() + 1); continue; }

      while (queue.length > 0 && dayUsed < dailyCapacity) {
        const next = queue[0];
        const photos = Math.max(1, next.selectedPhotoCount || next.selectedCount || 0);
        if (photos >= dailyCapacity && dayUsed === 0) {
          assignments.set(next.id, new Date(cursor));
          queue.shift();
          dayUsed = dailyCapacity;
          break;
        }
        if (dayUsed + photos > dailyCapacity) break;
        assignments.set(next.id, new Date(cursor));
        dayUsed += photos;
        queue.shift();
      }
      cursor.setDate(cursor.getDate() + 1);
      dayUsed = 0;
    }

    let updated = 0;
    for (const project of pending) {
      const plannedWorkDate = assignments.get(project.id);
      if (!plannedWorkDate) continue;
      const existing = project.plannedWorkDate ? new Date(project.plannedWorkDate) : null;
      if (!existing || isoDate(existing) !== isoDate(plannedWorkDate)) {
        await storage.updateProject(project.id, { plannedWorkDate });
        updated++;
        console.log(`🎄 [Scheduler] ${project.clientName} → planned work ${plannedWorkDate.toDateString()}`);
      }
    }
    recordFired("noel_work_scheduler", `Scheduled ${updated} work dates for ${pending.length} pending projects`);
  } catch (err: any) {
    console.error("🎄 [Scheduler] scheduleCampaignWorkDates error:", err.message);
  }
}

// ─────────────────────── Pacing engine ─────────────────────────

interface PacingResult {
  photosCompleted: number;
  photosRemaining: number;
  requiredDailyRate: number;
  forecastFinishDate: Date | null;
  actualDailyRate: number;
  isOnTrack: boolean;
  warningMessage: string | null;
}

export async function runPacingEngine(campaignId: string): Promise<PacingResult> {
  const campaignProjects = await storage.getCampaignProjects(campaignId);
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const delivered = campaignProjects.filter((p) => p.status === "Delivered");
  const photosCompleted = delivered.reduce((sum, p) => sum + (p.selectedPhotoCount || p.selectedCount || 0), 0);
  const photosTotal = campaignProjects.reduce((sum, p) => sum + (p.selectedPhotoCount || p.selectedCount || 0), 0);
  const photosRemaining = photosTotal - photosCompleted;

  const now = new Date();
  const workingDaysLeft = countWorkingDaysBetween(now, HARD_DEADLINE);
  const requiredDailyRate = workingDaysLeft > 0 ? Math.ceil(photosRemaining / workingDaysLeft) : photosRemaining;

  const snapshots = await storage.getVelocitySnapshots(campaignId, 7);
  let actualDailyRate = 0;
  if (snapshots.length >= 2) {
    const newest = snapshots[0];
    const oldest = snapshots[snapshots.length - 1];
    const daysBetween = Math.max(1, countWorkingDaysBetween(new Date(oldest.snapshotAt), new Date(newest.snapshotAt)));
    actualDailyRate = Math.round((newest.photosCompleted - oldest.photosCompleted) / daysBetween);
  } else {
    actualDailyRate = DAILY_PHOTO_CAPACITY;
  }

  let forecastFinishDate: Date | null = null;
  if (actualDailyRate > 0 && photosRemaining > 0) {
    forecastFinishDate = addWorkingDays(now, Math.ceil(photosRemaining / actualDailyRate));
  }

  const isOnTrack = forecastFinishDate === null || forecastFinishDate <= HARD_DEADLINE;

  const CAPACITY_THRESHOLD = 200;
  const deliveryWeekPhotos: Record<string, number> = {};
  for (const p of campaignProjects) {
    if (!p.promisedDeliveryDate) continue;
    const wk = getWeekKey(new Date(p.promisedDeliveryDate));
    deliveryWeekPhotos[wk] = (deliveryWeekPhotos[wk] || 0) + (p.selectedPhotoCount || p.selectedCount || 0);
  }

  let warningMessage: string | null = null;
  for (const [week, count] of Object.entries(deliveryWeekPhotos)) {
    if (count > CAPACITY_THRESHOLD) {
      warningMessage = `Week of ${week}: ${count} photos promised — exceeds ${CAPACITY_THRESHOLD} capacity`;
      break;
    }
  }
  if (!isOnTrack && !warningMessage) {
    warningMessage = `Behind schedule: need ${requiredDailyRate}/day but actual rate is ${actualDailyRate}/day. Forecast: ${forecastFinishDate?.toDateString() || "unknown"}`;
  }

  return { photosCompleted, photosRemaining, requiredDailyRate, forecastFinishDate, actualDailyRate, isOnTrack, warningMessage };
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

// ─────────────────────── Nightly run ───────────────────────────

export async function runNightlyPacing(): Promise<void> {
  try {
    const campaign = await storage.getActiveCampaign();
    if (!campaign) return;
    await scheduleCampaignWorkDates(campaign.id);
    const result = await runPacingEngine(campaign.id);
    await storage.createVelocitySnapshot({
      campaignId: campaign.id,
      photosCompleted: result.photosCompleted,
      photosRemaining: result.photosRemaining,
      requiredDailyRate: result.requiredDailyRate,
      forecastFinishDate: result.forecastFinishDate || undefined,
      actualDailyRate: result.actualDailyRate,
      isOnTrack: result.isOnTrack,
    });
    recordFired("noel_pacing_engine", `${result.photosCompleted} done, ${result.photosRemaining} remaining, on-track: ${result.isOnTrack}`);
    if (!result.isOnTrack && result.warningMessage) {
      campaignBus.emit("pacing.warning", { campaignId: campaign.id, message: result.warningMessage });
      console.warn(`🎄 [Noël Pacing] ⚠️  ${result.warningMessage}`);
    } else {
      console.log(`🎄 [Noël Pacing] On track — ${result.photosCompleted} done, ${result.photosRemaining} remaining`);
    }
  } catch (err: any) {
    console.error("🎄 [Noël Pacing] Error:", err.message);
  }
}

// ─────────────────────── Delivery chain ────────────────────────

/**
 * Full campaign delivery chain (project.driveComplete or manual mark-delivered):
 *  1. Guard: skip if delivery email already sent (prevents duplicate Noël emails)
 *  2. Flip status → Delivered
 *  3. Emit project.delivered
 *  4. Send Email 2 (Photos Ready) + automated "photos ready" client chat message
 *  5. Schedule Email 3 (Survey) after campaign.surveyDelayDays
 */
async function runDeliveryChain(projectId: string, campaignId: string): Promise<void> {
  if (!isEnabled("noel_delivery_chain")) return;
  try {
    const project = await storage.getProject(projectId);
    if (!project) return;

    const alreadySentDelivery = project.driveDeliveryEmailSent === true;

    if (project.status !== "Delivered") {
      await storage.updateProject(projectId, {
        status: "Delivered",
        deliveredAt: new Date(),
        deliveryApproved: true,
        deliveryApprovedAt: new Date(),
        deliveryApprovedBy: "Campaign Drive Auto-Detection",
      });
      console.log(`🎄 [DeliveryChain] ${project.clientName} → Delivered`);
    }

    campaignBus.emit("project.delivered", { projectId, campaignId });

    if (!alreadySentDelivery && project.clientEmail) {
      try {
        await sendNoelPhotosReadyEmail(projectId, project.clientName, project.clientEmail, project.galleryLink || "");
        await storage.updateProject(projectId, {
          driveDeliveryEmailSent: true,
          driveDeliveryEmailSentAt: new Date(),
          deliveryEmailSentAt: new Date(),
        });
        recordFired("noel_email_ready", `Email 2 (Photos Ready) auto-sent to ${project.clientEmail}`);
        console.log(`🎄 [DeliveryChain] Email 2 sent to ${project.clientEmail}`);
      } catch (emailErr: any) {
        console.error(`🎄 [DeliveryChain] Email 2 failed (non-fatal): ${emailErr.message}`);
      }
    }

    // Automated "photos are ready" client chat message
    try {
      const firstName = project.clientName.split(" ")[0];
      const tokenRecord = await storage.getClientAuthTokenByProjectId(projectId).catch(() => null);
      if (tokenRecord) {
        await storage.createClientMessage({
          projectId,
          senderType: "system",
          senderEmail: "system@jepsonmyles.com",
          message: `🎄 Great news, ${firstName}! Your Noël Set photos are ready and have been sent to your email. We hope you love them! 📸`,
          automated: true,
        });
        recordFired("noel_delivery_chain", `Chat "photos ready" message sent for ${project.clientName}`);
      }
    } catch (chatErr: any) {
      console.error(`🎄 [DeliveryChain] Chat message failed (non-fatal): ${chatErr.message}`);
    }

    scheduleSurveyEmail(projectId, campaignId);
    recordFired("noel_delivery_chain", `Delivery chain completed for ${project.clientName}`);
  } catch (err: any) {
    console.error(`🎄 [DeliveryChain] Error for project ${projectId}:`, err.message);
  }
}

function scheduleSurveyEmail(projectId: string, campaignId: string): void {
  if (!isEnabled("noel_email_survey")) return;
  (async () => {
    try {
      const campaign = await storage.getCampaign(campaignId);
      const delayMs = (campaign?.surveyDelayDays ?? 3) * 24 * 60 * 60 * 1000;
      console.log(`🎄 [DeliveryChain] Email 3 scheduled in ${campaign?.surveyDelayDays ?? 3} days for project ${projectId}`);

      // Create/reuse a persisted survey record so the token-based survey + Google review URLs are valid
      const p = await storage.getProject(projectId);
      if (!p || !p.clientEmail) return;
      let surveyRecord = await storage.getSurveyByProjectId(projectId).catch(() => null);
      if (!surveyRecord) {
        const { randomUUID } = await import("crypto");
        surveyRecord = await storage.createSurvey({
          projectId,
          clientEmail: p.clientEmail,
          clientName: p.clientName,
          surveyToken: randomUUID(),
        });
      }
      const surveyToken = surveyRecord.surveyToken;

      setTimeout(async () => {
        if (!isEnabled("noel_email_survey")) return;
        try {
          const freshProject = await storage.getProject(projectId);
          if (!freshProject || !freshProject.clientEmail) return;
          await sendNoelSurveyEmail(projectId, freshProject.clientName, freshProject.clientEmail, surveyToken);
          recordFired("noel_email_survey", `Email 3 (Survey + Google Review) sent to ${freshProject.clientEmail}`);
        } catch (err: any) {
          console.error(`🎄 [DeliveryChain] Email 3 error:`, err.message);
        }
      }, delayMs);
    } catch (err: any) {
      console.error(`🎄 [DeliveryChain] Survey schedule error:`, err.message);
    }
  })();
}

// ─────────────────────── Email 1 — evening scheduling ──────────

/**
 * Schedule Email 1 (Delivery Estimate) for 18:00 today (same evening).
 * If already past 18:00, schedules for 08:00 tomorrow morning.
 *
 * Debounce: skip if lastCommunicatedDate equals the PROMISED DATE already communicated
 * (not today's calendar date). This prevents re-sending when the promised date hasn't changed.
 * After sending, update lastCommunicatedDate to the promised delivery date string.
 */
async function scheduleEstimateEmail(project: Project, chatLink?: string): Promise<void> {
  if (!isEnabled("noel_email_estimate")) return;
  if (!project.clientEmail) return;

  const promisedDate = project.promisedDeliveryDate
    ? isoDate(new Date(project.promisedDeliveryDate))
    : isoDate(HARD_DEADLINE);

  // Debounce: skip if we already communicated THIS promised date
  if (project.lastCommunicatedDate === promisedDate) {
    console.log(`🎄 [AutoEmail] Email 1 skipped — already communicated date ${promisedDate} to ${project.clientName}`);
    return;
  }

  const now = new Date();
  const target = new Date(now);
  target.setHours(18, 0, 0, 0);
  if (now >= target) {
    // Past 18:00 — schedule for 08:00 tomorrow
    target.setDate(target.getDate() + 1);
    target.setHours(8, 0, 0, 0);
  }
  const delayMs = target.getTime() - now.getTime();
  console.log(`🎄 [AutoEmail] Email 1 scheduled for ${target.toLocaleTimeString()} (~${Math.round(delayMs / 60000)} min) for ${project.clientEmail}`);

  const capturedPromisedDate = promisedDate;
  const capturedChatLink = chatLink || "";

  setTimeout(async () => {
    if (!isEnabled("noel_email_estimate")) return;
    try {
      const fresh = await storage.getProject(project.id);
      if (!fresh || !fresh.clientEmail) return;
      const freshPromised = fresh.promisedDeliveryDate
        ? isoDate(new Date(fresh.promisedDeliveryDate))
        : isoDate(HARD_DEADLINE);
      if (fresh.lastCommunicatedDate === freshPromised) return; // Re-check debounce
      await sendNoelDeliveryEstimateEmail(
        fresh.id,
        fresh.clientName,
        fresh.clientEmail,
        fresh.promisedDeliveryDate || fresh.deliveryDueDate,
        capturedChatLink
      );
      await storage.updateProject(fresh.id, {
        lastCommunicatedDate: freshPromised,
        lastCommunicatedAt: new Date(),
      });
      recordFired("noel_email_estimate", `Email 1 sent to ${fresh.clientEmail}`);
      console.log(`🎄 [AutoEmail] Email 1 sent to ${fresh.clientEmail}`);
    } catch (err: any) {
      console.error(`🎄 [AutoEmail] Email 1 failed:`, err.message);
    }
  }, delayMs);
}

// ─────────────────────── Date-change slip alert ─────────────────

function getAbsoluteChatLink(projectId: string, token: string | null): string {
  if (!token) return "";
  const base = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, "")
    : process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://usena-flow.replit.app";
  return `${base}/client-chat/${token}`;
}

/**
 * Fires the actual slip-alert chat message after the debounce window has elapsed.
 * Called only from the debounce timer, never directly from event handlers.
 */
async function fireDateSlipAlert(
  projectId: string,
  campaignId: string,
  newDate: Date,
  slipDays: number,
  threshold: number
): Promise<void> {
  if (!isEnabled("noel_date_slip_alert")) return;
  if (slipDays < threshold) return;
  try {
    const project = await storage.getProject(projectId);
    if (!project) return;
    const formattedDate = newDate.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
    await storage.createClientMessage({
      projectId,
      senderType: "system",
      senderEmail: "system@jepsonmyles.com",
      message: `Hi ${project.clientName.split(" ")[0]}! Just a quick update — your Noël Set delivery has been rescheduled to ${formattedDate}. We look forward to sharing your beautiful photos with you! 🎄`,
      automated: true,
    });
    // lastCommunicatedDate = the new PROMISED DATE (not "today")
    const newDateStr = isoDate(newDate);
    await storage.updateProject(projectId, {
      lastCommunicatedDate: newDateStr,
      lastCommunicatedAt: new Date(),
    });
    recordFired("noel_date_slip_alert", `Chat alert sent for ${slipDays}d slip on project ${projectId}`);
    console.log(`🎄 [DateAlert] Slip alert sent for ${project.clientName} (${slipDays}d slip)`);
  } catch (err: any) {
    console.error(`🎄 [DateAlert] fireDateSlipAlert error:`, err.message);
  }
}

/**
 * True cancel-and-reschedule debounce.
 * Each new date-change event cancels any pending timer for that project and
 * restarts a fresh 5-minute window.  The notification fires only after
 * 5 minutes of quiet (no further date changes) — absorbs rapid corrections.
 */
function scheduleDebouncedSlipAlert(
  projectId: string,
  campaignId: string,
  newDate: Date,
  slipDays: number,
  threshold: number
): void {
  const existing = dateChangePendingTimers.get(projectId);
  if (existing) {
    clearTimeout(existing);
    dateChangePendingTimers.delete(projectId);
    console.log(`🎄 [DateAlert] Reset debounce timer for project ${projectId}`);
  }
  const timer = setTimeout(async () => {
    dateChangePendingTimers.delete(projectId);
    await fireDateSlipAlert(projectId, campaignId, newDate, slipDays, threshold);
  }, DEBOUNCE_MS);
  dateChangePendingTimers.set(projectId, timer);
  console.log(`🎄 [DateAlert] Debounce timer set for project ${projectId} (fires in 5 min)`);
}

// ─────────────────────── Listener registry (subscribe/unsubscribe) ─────────

type ListenerEntry = { event: keyof CampaignEvents; fn: (payload: any) => void };
const listenerRegistry = new Map<string, ListenerEntry[]>();

function registerListener<K extends keyof CampaignEvents>(
  automationId: string,
  event: K,
  fn: (payload: CampaignEvents[K]) => void
): void {
  const entries = listenerRegistry.get(automationId) || [];
  entries.push({ event, fn });
  listenerRegistry.set(automationId, entries);
  if (isEnabled(automationId)) {
    campaignBus.on(event, fn);
  }
}

/** Called by the automation registry's toggle hook — attaches or detaches listeners. */
export function setCampaignListenerEnabled(id: string, enabled: boolean): void {
  const entries = listenerRegistry.get(id) || [];
  for (const { event, fn } of entries) {
    if (enabled) {
      campaignBus.on(event, fn);
    } else {
      campaignBus.off(event, fn);
    }
  }
}

// ─────────────────────── Event listeners ───────────────────────

let listenersWired = false;

export function wireUpCampaignListeners(): void {
  if (listenersWired) return;
  listenersWired = true;

  // Register the toggle hook so Automation Hub can subscribe/unsubscribe
  onAutomationToggle((id, enabled) => {
    setCampaignListenerEnabled(id, enabled);
  });

  // ── project.created ── ShootTracker emits this; detection listener ONLY tags + computes due date
  // Work-date scheduling is the sole responsibility of noel_work_scheduler listener below.
  registerListener("noel_detection", "project.created", async ({ project, campaignId }) => {
    console.log(`🎄 [Listener:noel_detection] project.created — ${project.clientName}`);
    try {
      const shootDate = project.shootDate ? new Date(project.shootDate) : new Date();
      const dueDate = calculateNoelDueDate(shootDate);
      await storage.updateProject(project.id, {
        campaignId,
        promisedDeliveryDate: dueDate,
        dueDate,
        deliveryDueDate: dueDate,
      });
      recordFired("noel_detection", `Tagged ${project.clientName} due ${dueDate.toDateString()}`);
      // No scheduleCampaignWorkDates here — noel_work_scheduler owns that responsibility
    } catch (err: any) {
      console.error(`🎄 [Listener:noel_detection] error:`, err.message);
    }
  });

  // ── noel_work_scheduler ── DEDICATED SCHEDULING LISTENER
  // This is the single source of all automatic work-date rescheduling.
  // Toggling noel_work_scheduler OFF in Automation Hub detaches all these listeners,
  // stopping all automatic scheduling without touching other pipeline automations.
  const scheduleWorkDates = async (campaignId: string, triggerLabel: string) => {
    console.log(`🎄 [Listener:noel_work_scheduler] scheduling triggered by ${triggerLabel}`);
    try {
      await scheduleCampaignWorkDates(campaignId);
      recordFired("noel_work_scheduler", `Work dates rescheduled after ${triggerLabel}`);
    } catch (err: any) {
      console.error(`🎄 [Listener:noel_work_scheduler] error:`, err.message);
    }
  };

  registerListener("noel_work_scheduler", "project.created", async ({ campaignId }) => {
    await scheduleWorkDates(campaignId, "project.created");
  });
  registerListener("noel_work_scheduler", "project.countEntered", async ({ campaignId }) => {
    await scheduleWorkDates(campaignId, "project.countEntered");
  });
  registerListener("noel_work_scheduler", "project.dateChanged", async ({ campaignId }) => {
    await scheduleWorkDates(campaignId, "project.dateChanged");
  });
  registerListener("noel_work_scheduler", "project.moved", async ({ campaignId }) => {
    await scheduleWorkDates(campaignId, "project.moved");
  });
  registerListener("noel_work_scheduler", "project.delivered", async ({ campaignId }) => {
    await scheduleWorkDates(campaignId, "project.delivered");
  });

  // ── project.countEntered ── Email 1 only (no scheduling — noel_work_scheduler handles that)
  // Guard: Email 1 is never sent before the shoot has occurred.
  registerListener("noel_count_entry", "project.countEntered", async ({ projectId, campaignId, photoCount }) => {
    console.log(`🎄 [Listener:noel_count_entry] project.countEntered — ${projectId} count=${photoCount}`);
    try {
      const project = await storage.getProject(projectId);
      if (!project) return;
      // Guard: shoot must have already occurred before we promise a delivery estimate
      const shootDate = project.shootDate ? new Date(project.shootDate) : null;
      if (shootDate) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (shootDate > todayStart) {
          console.log(`🎄 [AutoEmail] Email 1 deferred — shoot ${shootDate.toDateString()} hasn't happened yet`);
          recordFired("noel_count_entry", `Email 1 deferred (shoot future) for ${projectId}`);
          return;
        }
      }
      // Token is mandatory — Email 1 MUST carry the chat link per the Noël spec.
      // If we cannot ensure a token exists, do not schedule the email.
      let tokenRecord = await storage.getClientAuthTokenByProjectId(projectId).catch(() => null);
      if (!tokenRecord) {
        if (!project.clientEmail) {
          console.log(`🎄 [AutoEmail] Email 1 skipped — no client email on ${projectId}`);
          recordFired("noel_count_entry", `Email 1 skipped (no client email) for ${projectId}`);
          return;
        }
        const { randomUUID } = await import("crypto");
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
        try {
          tokenRecord = await storage.createClientAuthToken({
            email: project.clientEmail,
            projectId,
            token: randomUUID(),
            expiresAt,
          });
        } catch (tokenErr: any) {
          console.error(`🎄 [AutoEmail] Token creation failed for ${projectId} — Email 1 NOT sent:`, tokenErr.message);
          recordFired("noel_count_entry", `Email 1 blocked (token creation failed) for ${projectId}`);
          return;
        }
      }
      const chatLink = getAbsoluteChatLink(projectId, tokenRecord.token);
      await scheduleEstimateEmail(project, chatLink);
    } catch (err: any) {
      console.error(`🎄 [Listener:noel_count_entry] error:`, err.message);
    }
  });

  // ── project.dateChanged / project.moved ── debounced slip alert ONLY (no scheduling)
  // noel_work_scheduler already subscribes to these events for rescheduling.
  const handleDateChanged = async ({
    projectId, campaignId, newDate, slipDays,
  }: { projectId: string; campaignId: string; newDate: Date; oldDate: Date; slipDays: number }) => {
    console.log(`🎄 [Listener:noel_date_move] date changed — project ${projectId} slip=${slipDays}d`);
    try {
      const campaign = await storage.getCampaign(campaignId);
      const threshold = campaign?.dateSlipThresholdDays ?? 0;
      // True debounce: absorbs rapid corrections; fires only after 5 quiet minutes
      scheduleDebouncedSlipAlert(projectId, campaignId, newDate, slipDays, threshold);
    } catch (err: any) {
      console.error(`🎄 [Listener:noel_date_move] error:`, err.message);
    }
  };

  // Slip-alert fires ONLY on project.dateChanged (= promised delivery date changed by admin/lead via /reschedule).
  // project.moved (= retoucher work-date drag via /move) must NOT trigger client notifications.
  registerListener("noel_date_slip_alert", "project.dateChanged", handleDateChanged);

  // ── project.driveComplete ── full delivery chain (guarded inside)
  registerListener("noel_delivery_chain", "project.driveComplete", async ({ projectId, campaignId }) => {
    console.log(`🎄 [Listener:noel_delivery_chain] project.driveComplete — running delivery chain for ${projectId}`);
    await runDeliveryChain(projectId, campaignId);
  });

  // ── project.delivered ── pacing engine summary log (scheduling is noel_work_scheduler's job)
  registerListener("noel_pacing_engine", "project.delivered", async ({ projectId, campaignId: _cid }) => {
    console.log(`🎄 [Listener:noel_pacing_engine] project.delivered — ${projectId}`);
    recordFired("noel_pacing_engine", `Delivery recorded for ${projectId}; work-dates rescheduled by noel_work_scheduler`);
  });

  // ── pacing.warning ── log to console
  campaignBus.on("pacing.warning", ({ campaignId, message }) => {
    console.warn(`🎄 [PacingWarning] Campaign ${campaignId}: ${message}`);
  });

  console.log("🎄 [CampaignBus] All event listeners wired up");
}

// ─────────────────────── Cron ──────────────────────────────────

export function startCampaignCron(): void {
  function scheduleNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const msUntilRun = next.getTime() - now.getTime();
    console.log(`🎄 [Noël Cron] Next pacing run at ${next.toLocaleString()} (in ${Math.round(msUntilRun / 60000)} min)`);
    setTimeout(async () => {
      await runNightlyPacing();
      scheduleNextRun();
    }, msUntilRun);
  }
  wireUpCampaignListeners();
  scheduleNextRun();
}
