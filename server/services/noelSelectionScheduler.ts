/**
 * Noël Selection Reminder Scheduler
 * Polls every 15 minutes and sends escalating reminder emails to clients
 * who have not yet completed their photo selection.
 *
 * Tiers:
 *   0 → invite already sent, no reminder yet
 *   T+12 h → orange reminder (bumps tier to 1)
 *   T+24 h → red final warning (bumps tier to 2)
 *   2 = done (no more reminders)
 */

import { db } from '../db';
import { projects } from '@shared/schema';
import { and, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import {
  sendNoelSelectionReminderOrange,
  sendNoelSelectionReminderRed,
} from './emailService';
import { storage } from '../storage';

const ORANGE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours
const RED_THRESHOLD_MS = 24 * 60 * 60 * 1000;    // 24 hours

let schedulerInterval: NodeJS.Timeout | null = null;

export async function runNoelSelectionReminders(): Promise<void> {
  console.log('[NoelSelectionScheduler] Running selection reminder check…');

  const now = new Date();

  // Find projects needing reminders:
  // selectionEmailSentAt is set, clientSelectionDoneAt is null, selectionReminderTier < 2
  const candidates = await db.select().from(projects).where(
    and(
      isNotNull(projects.selectionEmailSentAt),
      isNull(projects.clientSelectionDoneAt),
      sql`${projects.selectionReminderTier} < 2`,
      isNotNull(projects.clientEmail),
    )
  );

  console.log(`[NoelSelectionScheduler] Found ${candidates.length} candidate(s)`);

  for (const project of candidates) {
    if (!project.selectionEmailSentAt || !project.clientEmail) continue;

    const sentAt = new Date(project.selectionEmailSentAt);
    const elapsedMs = now.getTime() - sentAt.getTime();
    const tier = project.selectionReminderTier ?? 0;

    // Build the selection link (reuse client auth token)
    const base = process.env.APP_URL?.replace(/\/$/, '') ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000');

    const tokenRecord = await storage.getClientAuthTokenByProjectId(project.id).catch(() => null);
    const selectionLink = tokenRecord?.token
      ? `${base}/noel-select/${tokenRecord.token}`
      : base;

    try {
      if (tier === 0 && elapsedMs >= ORANGE_THRESHOLD_MS) {
        // Send orange reminder
        const result = await sendNoelSelectionReminderOrange(
          project.id,
          project.clientName,
          project.clientEmail,
          selectionLink
        );
        if (result.success) {
          await storage.updateProject(project.id, { selectionReminderTier: 1 });
          console.log(`[NoelSelectionScheduler] Orange reminder sent → ${project.clientEmail}`);
        }
      } else if (tier === 1 && elapsedMs >= RED_THRESHOLD_MS) {
        // Send red final warning
        const result = await sendNoelSelectionReminderRed(
          project.id,
          project.clientName,
          project.clientEmail,
          selectionLink
        );
        if (result.success) {
          await storage.updateProject(project.id, { selectionReminderTier: 2 });
          console.log(`[NoelSelectionScheduler] Red reminder sent → ${project.clientEmail}`);
        }
      }
    } catch (err: any) {
      console.error(`[NoelSelectionScheduler] Error for project ${project.id}:`, err.message);
    }
  }
}

export function startNoelSelectionScheduler(): void {
  if (schedulerInterval) {
    console.log('[NoelSelectionScheduler] Already running');
    return;
  }
  console.log('[NoelSelectionScheduler] Starting (15-minute interval)');
  // Run once immediately, then every 15 minutes
  runNoelSelectionReminders().catch(err =>
    console.error('[NoelSelectionScheduler] Initial run error:', err)
  );
  schedulerInterval = setInterval(() => {
    runNoelSelectionReminders().catch(err =>
      console.error('[NoelSelectionScheduler] Interval error:', err)
    );
  }, 15 * 60 * 1000);
}

export function stopNoelSelectionScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[NoelSelectionScheduler] Stopped');
  }
}
