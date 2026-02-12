import { db } from '../db';
import { projects } from '@shared/schema';
import { and, isNotNull, inArray } from 'drizzle-orm';
import * as driveService from './googleDriveService';
import { storage } from '../storage';
let openai: any = null;

function getOpenAI() {
  if (!openai) {
    const OpenAI = require("openai").default;
    openai = new OpenAI();
  }
  return openai;
}

interface IncompleteProject {
  id: string;
  clientName: string;
  selectedCount: number;
  uploadedCount: number;
  assignedTo: string;
  driveFolderId: string;
}

function formatDateYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isWeekdayMorning(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 10;
}

async function getIncompleteProjects(): Promise<IncompleteProject[]> {
  const activeProjects = await db.select()
    .from(projects)
    .where(and(
      inArray(projects.status, ['Assigned', 'Review']),
      isNotNull(projects.driveFolderId),
      isNotNull(projects.assignedTo)
    ));

  console.log(`[MorningCheck] Found ${activeProjects.length} active projects with Drive folders`);

  const incomplete: IncompleteProject[] = [];

  for (const project of activeProjects) {
    if (!project.driveFolderId || !project.assignedTo) continue;

    try {
      const stats = await driveService.countImagesInFolder(project.driveFolderId);

      if (stats.imageCount < project.selectedCount) {
        incomplete.push({
          id: project.id,
          clientName: project.clientName,
          selectedCount: project.selectedCount,
          uploadedCount: stats.imageCount,
          assignedTo: project.assignedTo,
          driveFolderId: project.driveFolderId,
        });
      }
    } catch (error: any) {
      console.error(`[MorningCheck] Error checking Drive folder for project ${project.id} (${project.clientName}): ${error.message}`);
    }
  }

  console.log(`[MorningCheck] ${incomplete.length} projects have incomplete photo uploads`);
  return incomplete;
}

async function generateMorningMessage(retoucherName: string, incompleteProjects: IncompleteProject[]): Promise<string> {
  const projectSummaries = incompleteProjects.map(p =>
    `- ${p.clientName}: ${p.uploadedCount}/${p.selectedCount} photos uploaded`
  ).join('\n');

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are the Studio Manager AI for a photo retouching studio. You check in with retouchers each morning about their progress. Be friendly but firm — you care about the team and the clients. Keep messages concise (3-5 sentences). Always remind them to communicate with their client if there are delays.`
        },
        {
          role: "user",
          content: `Generate a morning check-in message for retoucher "${retoucherName}". They have the following incomplete projects:\n\n${projectSummaries}\n\nAsk them why they're behind, encourage them, and remind them to keep their clients informed about progress.`
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content || `Good morning ${retoucherName}! You have ${incompleteProjects.length} project(s) with incomplete uploads. Please check your progress and communicate with your clients.`;
  } catch (error: any) {
    console.error(`[MorningCheck] Error generating AI message for ${retoucherName}: ${error.message}`);
    const fallbackSummaries = incompleteProjects.map(p =>
      `${p.clientName} (${p.uploadedCount}/${p.selectedCount} photos)`
    ).join(', ');
    return `Good morning ${retoucherName}! Just checking in — the following projects still need attention: ${fallbackSummaries}. Please update your progress and let your clients know if there are any delays.`;
  }
}

async function runMorningCheck(): Promise<void> {
  console.log(`[MorningCheck] Starting morning check...`);

  const incompleteProjects = await getIncompleteProjects();

  if (incompleteProjects.length === 0) {
    console.log(`[MorningCheck] All projects are up to date. No messages needed.`);
    return;
  }

  const byRetoucher = new Map<string, IncompleteProject[]>();
  for (const project of incompleteProjects) {
    const existing = byRetoucher.get(project.assignedTo) || [];
    existing.push(project);
    byRetoucher.set(project.assignedTo, existing);
  }

  console.log(`[MorningCheck] ${byRetoucher.size} retoucher(s) have incomplete work`);

  for (const [retoucherName, retoucherProjects] of Array.from(byRetoucher.entries())) {
    try {
      const message = await generateMorningMessage(retoucherName, retoucherProjects);

      await storage.createAiTeamMessage({
        username: retoucherName,
        role: 'system',
        senderType: 'ai',
        message,
        metadata: {
          type: 'morning_check',
          date: new Date().toISOString(),
          projects: retoucherProjects.map(p => ({
            id: p.id,
            clientName: p.clientName,
            uploaded: p.uploadedCount,
            expected: p.selectedCount,
          })),
        },
      });

      console.log(`[MorningCheck] Sent morning check message to ${retoucherName} (${retoucherProjects.length} project(s))`);
    } catch (error: any) {
      console.error(`[MorningCheck] Error sending message to ${retoucherName}: ${error.message}`);
    }
  }

  console.log(`[MorningCheck] Morning check complete.`);
}

let schedulerInterval: NodeJS.Timeout | null = null;
let lastRunDate: string | null = null;

export function startMorningCheckScheduler(): void {
  if (schedulerInterval) {
    console.log('[MorningCheck] Scheduler already running');
    return;
  }

  console.log('[MorningCheck] Starting weekday morning check scheduler');

  schedulerInterval = setInterval(async () => {
    const today = formatDateYMD(new Date());

    if (isWeekdayMorning() && lastRunDate !== today) {
      console.log('[MorningCheck] Weekday morning detected, running morning check...');
      lastRunDate = today;

      try {
        await runMorningCheck();
      } catch (error) {
        console.error('[MorningCheck] Error running morning check:', error);
      }
    }
  }, 60000);

  console.log('[MorningCheck] Scheduler started, checking every minute for weekday 9:00-9:59 AM');
}

export function stopMorningCheckScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[MorningCheck] Scheduler stopped');
  }
}
