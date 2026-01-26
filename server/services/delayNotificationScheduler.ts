import { db } from '../db';
import { projects, emailLogs, EmailType, DEFAULT_SHOOTTRACKER_SETTINGS, shoottrackerSettingsSchema } from '@shared/schema';
import { eq, and, isNotNull, ne, gt, sql } from 'drizzle-orm';
import { sendDelayNotificationEmail } from './emailService';
import { countWorkingDaysBetween, formatDateYMD } from './shoottrackerEngine';
import { storage } from '../storage';

const SETTINGS_KEY = "shoottracker_settings";

async function getSettings() {
  const setting = await storage.getAppSetting(SETTINGS_KEY);
  if (setting && typeof setting.value === 'object') {
    try {
      const merged = {
        ...DEFAULT_SHOOTTRACKER_SETTINGS,
        ...setting.value,
        keyword_turnaround_rules: (setting.value as any).keyword_turnaround_rules || DEFAULT_SHOOTTRACKER_SETTINGS.keyword_turnaround_rules,
      };
      return shoottrackerSettingsSchema.parse(merged);
    } catch (error) {
      console.error("Error parsing settings, using defaults:", error);
      return DEFAULT_SHOOTTRACKER_SETTINGS;
    }
  }
  return DEFAULT_SHOOTTRACKER_SETTINGS;
}

interface DelayedProject {
  id: string;
  clientName: string;
  clientEmail: string;
  originalDueDate: Date;
  deliveryDueDate: Date;
  delayDays: number;
  rolloverCount: number;
}

export async function getDelayedProjectsForNextWeek(): Promise<DelayedProject[]> {
  const now = new Date();
  
  const settings = await getSettings();
  const workingDays = settings.working_days || ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const holidays = settings.holidays || [];
  
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const dayOfWeek = today.getDay();
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  
  const nextWeekStart = new Date(today);
  nextWeekStart.setDate(today.getDate() + daysUntilNextMonday);
  
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
  nextWeekEnd.setHours(23, 59, 59, 999);
  
  const followingWeekStart = new Date(nextWeekEnd);
  followingWeekStart.setDate(nextWeekEnd.getDate() + 1);
  followingWeekStart.setHours(0, 0, 0, 0);
  
  console.log(`[DelayScheduler] Checking for delayed projects...`);
  console.log(`[DelayScheduler] Next week (original due): ${formatDateYMD(nextWeekStart)} to ${formatDateYMD(nextWeekEnd)}`);
  console.log(`[DelayScheduler] Following week (rolled over to): starts ${formatDateYMD(followingWeekStart)}`);
  
  const delayedProjects = await db.select()
    .from(projects)
    .where(and(
      isNotNull(projects.clientEmail),
      isNotNull(projects.originalDueDate),
      isNotNull(projects.deliveryDueDate),
      gt(projects.rolloverCount, 0),
      ne(projects.status, 'Delivered'),
      sql`${projects.originalDueDate} >= ${nextWeekStart.toISOString()}::timestamp`,
      sql`${projects.originalDueDate} <= ${nextWeekEnd.toISOString()}::timestamp`,
      sql`${projects.deliveryDueDate} >= ${followingWeekStart.toISOString()}::timestamp`
    ));
  
  console.log(`[DelayScheduler] Found ${delayedProjects.length} projects originally due next week but rolled over`);
  
  const result: DelayedProject[] = [];
  
  for (const project of delayedProjects) {
    if (!project.clientEmail || !project.originalDueDate || !project.deliveryDueDate) {
      continue;
    }
    
    const originalDate = new Date(project.originalDueDate);
    const newDate = new Date(project.deliveryDueDate);
    
    if (newDate <= originalDate) {
      continue;
    }
    
    const delayDays = countWorkingDaysBetween(originalDate, newDate, workingDays, holidays);
    
    if (delayDays > 0) {
      result.push({
        id: project.id,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        originalDueDate: originalDate,
        deliveryDueDate: newDate,
        delayDays,
        rolloverCount: project.rolloverCount,
      });
    }
  }
  
  console.log(`[DelayScheduler] ${result.length} projects have actual delays`);
  return result;
}

async function hasDelayEmailBeenSentThisWeek(projectId: string): Promise<boolean> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const existing = await db.select()
    .from(emailLogs)
    .where(and(
      eq(emailLogs.projectId, projectId),
      eq(emailLogs.emailType, EmailType.DELAY_NOTIFICATION),
      eq(emailLogs.status, 'sent'),
      sql`${emailLogs.createdAt} >= ${startOfWeek.toISOString()}::timestamp`
    ))
    .limit(1);
  
  return existing.length > 0;
}

export interface DelayNotificationResult {
  totalDelayed: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsFailed: number;
  details: Array<{
    projectId: string;
    clientName: string;
    clientEmail: string;
    delayDays: number;
    status: 'sent' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

export async function sendDelayNotifications(): Promise<DelayNotificationResult> {
  console.log(`[DelayScheduler] Starting delay notification check...`);
  
  const delayedProjects = await getDelayedProjectsForNextWeek();
  
  const result: DelayNotificationResult = {
    totalDelayed: delayedProjects.length,
    emailsSent: 0,
    emailsSkipped: 0,
    emailsFailed: 0,
    details: [],
  };
  
  for (const project of delayedProjects) {
    const alreadySent = await hasDelayEmailBeenSentThisWeek(project.id);
    
    if (alreadySent) {
      result.emailsSkipped++;
      result.details.push({
        projectId: project.id,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        delayDays: project.delayDays,
        status: 'skipped',
        reason: 'Email already sent this week',
      });
      continue;
    }
    
    try {
      const emailResult = await sendDelayNotificationEmail(
        project.clientEmail,
        project.clientName,
        project.originalDueDate,
        project.deliveryDueDate,
        project.delayDays,
        project.id
      );
      
      if (emailResult.success) {
        result.emailsSent++;
        result.details.push({
          projectId: project.id,
          clientName: project.clientName,
          clientEmail: project.clientEmail,
          delayDays: project.delayDays,
          status: 'sent',
        });
      } else {
        result.emailsFailed++;
        result.details.push({
          projectId: project.id,
          clientName: project.clientName,
          clientEmail: project.clientEmail,
          delayDays: project.delayDays,
          status: 'failed',
          reason: emailResult.error,
        });
      }
    } catch (error: any) {
      result.emailsFailed++;
      result.details.push({
        projectId: project.id,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        delayDays: project.delayDays,
        status: 'failed',
        reason: error.message,
      });
    }
  }
  
  console.log(`[DelayScheduler] Completed: ${result.emailsSent} sent, ${result.emailsSkipped} skipped, ${result.emailsFailed} failed`);
  return result;
}

function isThursdayMorning(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  
  return day === 4 && hour >= 8 && hour < 9;
}

let schedulerInterval: NodeJS.Timeout | null = null;
let lastRunDate: string | null = null;

export function startDelayNotificationScheduler(): void {
  if (schedulerInterval) {
    console.log('[DelayScheduler] Scheduler already running');
    return;
  }
  
  console.log('[DelayScheduler] Starting Thursday morning delay notification scheduler');
  
  schedulerInterval = setInterval(async () => {
    const today = formatDateYMD(new Date());
    
    if (isThursdayMorning() && lastRunDate !== today) {
      console.log('[DelayScheduler] Thursday morning detected, running delay notifications...');
      lastRunDate = today;
      
      try {
        const result = await sendDelayNotifications();
        console.log(`[DelayScheduler] Thursday run complete:`, result);
      } catch (error) {
        console.error('[DelayScheduler] Error running delay notifications:', error);
      }
    }
  }, 60000);
  
  console.log('[DelayScheduler] Scheduler started, checking every minute for Thursday 8-9 AM');
}

export function stopDelayNotificationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[DelayScheduler] Scheduler stopped');
  }
}
