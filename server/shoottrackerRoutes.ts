import type { Express, Request, Response } from "express";
import crypto from "crypto";
import webpush from 'web-push';
import { storage } from "./storage";
import { 
  DEFAULT_SHOOTTRACKER_SETTINGS, 
  shoottrackerSettingsSchema, 
  ShoottrackerSettings,
  RiskLevel,
  ProjectStatus,
  UserRoles,
  StagingStatus,
  type CalendarEventStaging,
} from "@shared/schema";
import { verifyAdminRequest, verifyAdminOrLeadRequest, verifyChatRequest } from "./middleware/adminAuth";
import { handleClientMessageAutoResponse, clearPendingAutoResponse } from './services/chatAutoResponder';
import { 
  normalizeEvent, 
  NormalizedEvent,
  shouldExclude, 
  classifyEvent, 
  addBusinessDays, 
  parseClientNameFromTitle,
  calculateShootTrackerRiskLevel,
  countWorkingDaysBetween,
  formatDateYMD,
  createEmptySyncStats,
  ForecastResult,
  SyncStats,
  resolveTurnaroundDays,
  extractClientEmail,
} from "./services/shoottrackerEngine";
import { startReplyMonitor } from "./services/gmailReplyMonitor";
import { fetchCalendarEvents, CalendarEvent, listCalendars } from "./services/googleCalendar";
import { calculateRiskLevel } from "./services/riskCalculator";
import { getAutoSyncStatus } from "./autoSyncScheduler";
import { 
  sendDeliveryEstimateEmail, 
  sendProjectAddedEmail, 
  sendChatLinkEmail,
  sendMessageNotificationEmail,
  generateToken,
  wasGoogleReviewThanksRecentlySent,
} from "./services/emailService";
import { 
  sendDelayNotifications, 
  getDelayedProjectsForNextWeek,
  startDelayNotificationScheduler 
} from "./services/delayNotificationScheduler";

// Verify Resend webhook signature
function verifyResendWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    // Resend uses svix for webhooks - signature format: v1,signature
    const signatureParts = signature.split(',');
    if (signatureParts.length < 2) return false;
    
    const timestamp = signatureParts.find(p => p.startsWith('t='))?.substring(2);
    const sig = signatureParts.find(p => p.startsWith('v1='))?.substring(3);
    
    if (!timestamp || !sig) return false;
    
    // Create the signed payload
    const signedPayload = `${timestamp}.${payload}`;
    
    // Calculate expected signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    
    // Compare signatures
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch (error) {
    console.error("[Webhook] Signature verification error:", error);
    return false;
  }
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:hello@jepsonmyles.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const SETTINGS_KEY = "shoottracker_settings";

const ADMIN_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER];
const VIEW_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER, UserRoles.DATA_WRANGLER];

async function getSettings(): Promise<ShoottrackerSettings> {
  const setting = await storage.getAppSetting(SETTINGS_KEY);
  if (setting && typeof setting.value === 'object') {
    try {
      // Merge stored settings with defaults to handle missing fields
      const merged = {
        ...DEFAULT_SHOOTTRACKER_SETTINGS,
        ...setting.value,
        // Ensure arrays are properly merged (don't use defaults if stored has values)
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

export function registerShoottrackerRoutes(app: Express): void {
  
  // Settings routes (Admin/Lead Retoucher only - enforced via verifyAdminRequest middleware)
  app.get("/api/admin/shoottracker/settings", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const settings = await getSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching ShootTracker settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/admin/shoottracker/settings", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const validatedSettings = shoottrackerSettingsSchema.parse(req.body);
      await storage.setAppSetting(SETTINGS_KEY, validatedSettings);

      const allProjects = await storage.getAllProjects();
      const activeCalendarProjects = allProjects.filter(
        (p) => p.createdFrom === "CALENDAR" && p.shootDate && p.status !== "Delivered" && p.status !== "Cancelled"
      );

      let recalculated = 0;
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const getWeekStartSunday = (date: Date) => {
        const sunday = new Date(date);
        sunday.setDate(sunday.getDate() - sunday.getDay());
        sunday.setHours(0, 0, 0, 0);
        return sunday;
      };

      for (const project of activeCalendarProjects) {
        const shootDate = new Date(project.shootDate!);
        const { turnaroundDays } = resolveTurnaroundDays(project.clientName, validatedSettings);

        const newDeliveryDueDate = addBusinessDays(
          shootDate,
          turnaroundDays,
          validatedSettings.working_days,
          validatedSettings.holidays,
          validatedSettings.timezone
        );

        const newRiskLevel = calculateShootTrackerRiskLevel(
          newDeliveryDueDate,
          false,
          validatedSettings.working_days,
          validatedSettings.holidays,
          new Date()
        );

        const dueWeekStart = getWeekStartSunday(newDeliveryDueDate);
        const thisWeekStart = getWeekStartSunday(now);
        const weekStart = newDeliveryDueDate < now ? thisWeekStart : dueWeekStart;

        await storage.updateProject(project.id, {
          deliveryDueDate: newDeliveryDueDate,
          dueDate: weekStart,
          riskLevel: newRiskLevel,
        });
        recalculated++;
      }

      console.log(`[ShootTracker] Settings updated. Recalculated ${recalculated} active project due dates.`);
      res.json({ success: true, settings: validatedSettings, recalculatedProjects: recalculated });
    } catch (error: any) {
      console.error("Error saving ShootTracker settings:", error);
      res.status(400).json({ error: error.message || "Invalid settings" });
    }
  });

  app.get("/api/admin/shoottracker/calendars", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const calendars = await listCalendars();
      res.json(calendars);
    } catch (error: any) {
      console.error("Error listing calendars:", error);
      res.status(500).json({ error: error.message || "Failed to list calendars" });
    }
  });

  app.get("/api/admin/shoottracker/autosync-status", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const settings = await getSettings();
      const status = getAutoSyncStatus();
      res.json({
        enabled: settings.auto_sync_enabled,
        intervalMinutes: settings.auto_sync_interval_minutes,
        lastSyncAt: settings.last_auto_sync_at || null,
        isCurrentlySyncing: status.isRunning,
      });
    } catch (error: any) {
      console.error("Error fetching auto-sync status:", error);
      res.status(500).json({ error: "Failed to fetch auto-sync status" });
    }
  });

  // Sync route - stores events in staging table for user to review
  app.post("/api/admin/shoottracker/sync", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const settings = await getSettings();
      const stats = { fetched: 0, staged: 0, updated: 0, excluded: 0, errors: [] as string[] };
      const now = new Date();
      const timeMin = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      const calendarIds = settings.selected_calendar_ids.length > 0 
        ? settings.selected_calendar_ids 
        : ['primary'];
      
      console.log(`🔄 Syncing ${calendarIds.length} calendar(s): ${calendarIds.join(', ')}`);
      
      for (const calendarId of calendarIds) {
        try {
          const events = await fetchCalendarEvents(calendarId, timeMin, timeMax);
          stats.fetched += events.length;
          
          for (const rawEvent of events) {
            const event = normalizeEvent(rawEvent);
            
            if (shouldExclude(event, settings.exclude_keywords)) {
              stats.excluded++;
              continue;
            }
            
            const existing = await storage.getStagedEventByCalendarEventId(event.id);
            
            const clientEmail = extractClientEmail(event.description, event.location, event.attendeeEmails);
            if (!clientEmail) {
              console.log(`📅 [Sync] No email found for "${event.title}" — description: ${event.description ? 'has text' : 'empty'}, location: ${event.location ? 'has text' : 'empty'}, attendees: ${event.attendeeEmails.length}`);
            } else {
              console.log(`📅 [Sync] Email found for "${event.title}": ${clientEmail}`);
            }
            
            if (existing) {
              if (existing.status === StagingStatus.PROMOTED) {
                if (clientEmail && existing.promotedProjectId) {
                  const promotedProject = await storage.getProject(existing.promotedProjectId);
                  if (promotedProject && !promotedProject.clientEmail) {
                    await storage.updateProject(existing.promotedProjectId, { clientEmail });
                    console.log(`📅 [Sync] Backfilled email ${clientEmail} to promoted project "${event.title}"`);
                  }
                }
                continue;
              }
              if (existing.status === StagingStatus.IGNORED) {
                continue;
              }
              await storage.updateStagedEvent(existing.id, {
                title: event.title,
                description: event.description,
                location: event.location,
                eventStart: event.start,
                eventEnd: event.end,
                rawPayload: event.rawPayload,
                clientEmail,
              });
              stats.updated++;
            } else {
              await storage.createStagedEvent({
                calendarEventId: event.id,
                calendarId,
                title: event.title,
                description: event.description,
                location: event.location,
                eventStart: event.start,
                eventEnd: event.end,
                status: StagingStatus.PENDING,
                rawPayload: event.rawPayload,
                clientEmail,
              });
              stats.staged++;
            }
          }
        } catch (error: any) {
          stats.errors.push(`Calendar ${calendarId}: ${error.message}`);
        }
      }
      
      console.log(`📅 ShootTracker: Synced ${stats.fetched} events (${stats.staged} new, ${stats.updated} updated, ${stats.excluded} excluded)`);
      res.json(stats);
    } catch (error: any) {
      console.error("❌ ShootTracker sync error:", error);
      res.status(500).json({ error: error.message || "Sync failed" });
    }
  });

  // Get staged events (pending calendar events)
  app.get("/api/admin/shoottracker/staged", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const events = await storage.getStagedEvents(status as string | undefined);
      res.json(events);
    } catch (error: any) {
      console.error("Error fetching staged events:", error);
      res.status(500).json({ error: "Failed to fetch staged events" });
    }
  });

  // Promote staged event to project
  app.post("/api/admin/shoottracker/staged/:id/promote", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { targetWeekStart } = req.body;
      const userId = req.headers["x-usena-user-id"] as string;
      
      const stagedEvent = await storage.getStagedEvents().then(events => events.find(e => e.id === id));
      if (!stagedEvent) {
        return res.status(404).json({ error: "Staged event not found" });
      }
      
      if (stagedEvent.status === StagingStatus.PROMOTED) {
        return res.status(400).json({ error: "Event already promoted" });
      }
      
      const settings = await getSettings();
      const shootDate = stagedEvent.eventStart;
      
      const { turnaroundDays, matchedRule } = resolveTurnaroundDays(stagedEvent.title, settings);
      console.log(`📅 Event "${stagedEvent.title}" → turnaround: ${turnaroundDays} days${matchedRule ? ` (matched: ${matchedRule})` : ' (default)'}`);
      
      const deliveryDueDate = addBusinessDays(
        shootDate,
        turnaroundDays,
        settings.working_days,
        settings.holidays,
        settings.timezone
      );
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const getWeekStartSunday = (date: Date) => {
        const sunday = new Date(date);
        sunday.setDate(sunday.getDate() - sunday.getDay());
        sunday.setHours(0, 0, 0, 0);
        return sunday;
      };
      
      const dueWeekStart = getWeekStartSunday(deliveryDueDate);
      const thisWeekStart = getWeekStartSunday(now);
      
      const weekStart = deliveryDueDate < now ? thisWeekStart : dueWeekStart;
      console.log(`📅 Project week: ${deliveryDueDate < now ? 'OVERDUE → This Week' : 'Due Week'} (${weekStart.toISOString().split('T')[0]})`);
      
      const riskLevel = calculateShootTrackerRiskLevel(
        deliveryDueDate,
        false,
        settings.working_days,
        settings.holidays,
        new Date()
      );
      
      const clientName = parseClientNameFromTitle(stagedEvent.title);

      // Safety net: if staging row was created before email-extraction was added,
      // try to extract from description/location at promote time.
      const resolvedClientEmail = stagedEvent.clientEmail
        || extractClientEmail(stagedEvent.description || '', stagedEvent.location || '', [])
        || null;

      // Idempotent: if a project already exists for this calendar event
      // (e.g. created on-the-fly from Today's Shoot so Photographer/DW could
      // attach inspos before sync), reuse it instead of inserting a new row
      // (calendar_event_id is unique). Preserve any inspos/notes already
      // attached and just back-fill the proper ShootTracker fields.
      const existingForEvent = stagedEvent.calendarEventId
        ? await storage.getProjectByCalendarEventId(stagedEvent.calendarEventId)
        : undefined;

      let newProject;
      if (existingForEvent) {
        const updated = await storage.updateProject(existingForEvent.id, {
          clientName,
          packageCount: stagedEvent.packagePhotos || existingForEvent.packageCount || 0,
          selectedCount: stagedEvent.selectedPhotos || existingForEvent.selectedCount || 0,
          dueDate: weekStart,
          shootDate,
          deliveryDueDate,
          riskLevel,
          lastSyncedAt: new Date(),
          createdFrom: "CALENDAR",
          clientEmail: existingForEvent.clientEmail || resolvedClientEmail,
        });
        newProject = updated || existingForEvent;
      } else {
        newProject = await storage.createProject({
          clientName,
          packageCount: stagedEvent.packagePhotos || 0,
          selectedCount: stagedEvent.selectedPhotos || 0,
          dueDate: weekStart,
          assignedTo: null,
          shootDate,
          deliveryDueDate,
          riskLevel,
          calendarEventId: stagedEvent.calendarEventId,
          lastSyncedAt: new Date(),
          createdFrom: "CALENDAR",
          clientEmail: resolvedClientEmail,
        });
      }

      const existingMeta = await storage.getShoottrackerMeta(newProject.id).catch(() => undefined);
      if (!existingMeta) {
        await storage.createShoottrackerMeta({
          projectId: newProject.id,
          linkSent: false,
          delivered: false,
          turnaroundDays: turnaroundDays,
          workingDays: settings.working_days,
          holidays: settings.holidays,
          lastCalendarSync: new Date(),
          rawEventPayload: stagedEvent.rawPayload as any,
        });
      }
      
      await storage.updateStagedEvent(id, {
        status: StagingStatus.PROMOTED,
        promotedProjectId: newProject.id,
        targetWeekStart: weekStart,
        promotedAt: new Date(),
        promotedBy: userId,
      });

      try {
        const { createDriveFolderForProject } = await import('./services/driveMonitorService');
        await createDriveFolderForProject(newProject.id);
        console.log(`📁 Auto-created Drive folder for ${clientName}`);
      } catch (driveErr: any) {
        console.error(`📁 Drive folder creation failed for ${clientName}: ${driveErr.message}`);
      }
      
      try {
        const clientEmail = stagedEvent.clientEmail || "";
        let matchingReferrals: any[] = [];
        if (clientEmail) {
          matchingReferrals = await storage.getSubmittedReferralsByEmail(clientEmail);
        }
        if (matchingReferrals.length === 0) {
          matchingReferrals = await storage.getSubmittedReferralsByName(clientName);
        }
        const matchedIds = new Set<string>();
        for (const ref of matchingReferrals) {
          if (matchedIds.has(ref.id)) continue;
          matchedIds.add(ref.id);
          await storage.updateReferral(ref.id, {
            referredProjectId: newProject.id,
            status: "completed",
            completedAt: new Date(),
          });
          const matchMethod = clientEmail && ref.referredEmail === clientEmail.toLowerCase() ? "email" : "name";
          console.log(`🎉 Referral matched by ${matchMethod}: "${clientName}" (${clientEmail}) matched referral from ${ref.referrerName} (code: ${ref.referralCode})`);
          try {
            await storage.creditBonusPhotos(ref.referrerEmail, ref.referrerName, 5);
            console.log(`🎁 Credited 5 bonus photos to ${ref.referrerEmail} for referral ${ref.referralCode}`);
          } catch (creditErr: any) {
            console.error("Error crediting bonus photos:", creditErr.message);
          }
        }
      } catch (matchError: any) {
        console.error("Referral matching error (non-fatal):", matchError.message);
      }
      
      res.json({ success: true, project: newProject });
    } catch (error: any) {
      console.error("Error promoting staged event:", error);
      res.status(500).json({ error: error.message || "Failed to promote event" });
    }
  });

  // Ignore staged event
  app.post("/api/admin/shoottracker/staged/:id/ignore", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const updated = await storage.updateStagedEvent(id, {
        status: StagingStatus.IGNORED,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Staged event not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error ignoring staged event:", error);
      res.status(500).json({ error: "Failed to ignore event" });
    }
  });

  // Restore ignored event to pending
  app.post("/api/admin/shoottracker/staged/:id/restore", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const updated = await storage.updateStagedEvent(id, {
        status: StagingStatus.PENDING,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Staged event not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error restoring staged event:", error);
      res.status(500).json({ error: "Failed to restore event" });
    }
  });

  // Update package info for staged event
  app.patch("/api/admin/shoottracker/staged/:id/package", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { packagePhotos, selectedPhotos } = req.body;
      
      const updates: any = {};
      
      if (packagePhotos !== undefined) {
        const parsed = Number(packagePhotos);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({ error: "packagePhotos must be a non-negative number" });
        }
        updates.packagePhotos = Math.floor(parsed);
      }
      
      if (selectedPhotos !== undefined) {
        const parsed = Number(selectedPhotos);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({ error: "selectedPhotos must be a non-negative number" });
        }
        updates.selectedPhotos = Math.floor(parsed);
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const updated = await storage.updateStagedEvent(id, updates);
      
      if (!updated) {
        return res.status(404).json({ error: "Staged event not found" });
      }
      
      res.json({ success: true, event: updated });
    } catch (error: any) {
      console.error("Error updating package info:", error);
      res.status(500).json({ error: "Failed to update package info" });
    }
  });

  app.get("/api/shoottracker/forecast", async (req: Request, res: Response) => {
    try {
      const { targetDate } = req.query;
      
      if (!targetDate || typeof targetDate !== 'string') {
        return res.status(400).json({ error: "targetDate query param required (YYYY-MM-DD)" });
      }
      
      const target = new Date(targetDate);
      if (isNaN(target.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const settings = await getSettings();
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const projects = await storage.getAllProjects();
      
      const activeProjects = [];
      for (const project of projects) {
        if (project.status === ProjectStatus.DELIVERED || project.status === ProjectStatus.DONE) {
          continue;
        }
        
        const meta = await storage.getShoottrackerMeta(project.id);
        if (meta?.delivered) {
          continue;
        }
        
        activeProjects.push({ project, meta });
      }
      
      const projectsDueBeforeTarget = activeProjects.filter(({ project }) => {
        const dueDate = project.deliveryDueDate || project.dueDate;
        if (!dueDate) return false;
        return new Date(dueDate) <= target;
      });
      
      const workingDaysAvailable = countWorkingDaysBetween(
        tomorrow,
        target,
        settings.working_days,
        settings.holidays
      );
      
      const availableCapacity = workingDaysAvailable * settings.daily_capacity_projects;
      
      const atRiskProjects = activeProjects
        .filter(({ project }) => {
          const riskLevel = calculateRiskLevel(project);
          return riskLevel !== RiskLevel.SAFE;
        })
        .map(({ project }) => ({
          id: project.id,
          client_name: project.clientName,
          delivery_due_date: formatDateYMD(project.deliveryDueDate || project.dueDate),
          risk_level: calculateRiskLevel(project),
        }));
      
      const result: ForecastResult = {
        targetDate,
        projects_due_before_target: projectsDueBeforeTarget.length,
        available_capacity_before_target: availableCapacity,
        feasible: availableCapacity >= projectsDueBeforeTarget.length,
        at_risk_projects: atRiskProjects,
      };
      
      res.json(result);
    } catch (error: any) {
      console.error("Error generating forecast:", error);
      res.status(500).json({ error: "Failed to generate forecast" });
    }
  });

  app.patch("/api/shoottracker/project/:id/link-sent", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { link_sent } = req.body;
      
      if (typeof link_sent !== 'boolean') {
        return res.status(400).json({ error: "link_sent must be a boolean" });
      }
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      let meta = await storage.getShoottrackerMeta(id);
      
      if (meta) {
        meta = await storage.updateShoottrackerMeta(id, { linkSent: link_sent });
      } else {
        meta = await storage.createShoottrackerMeta({
          projectId: id,
          linkSent: link_sent,
          delivered: false,
        });
      }
      
      res.json({ success: true, meta });
    } catch (error: any) {
      console.error("Error updating link_sent:", error);
      res.status(500).json({ error: "Failed to update link_sent" });
    }
  });

  app.patch("/api/shoottracker/project/:id/delivered", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { delivered } = req.body;
      
      if (typeof delivered !== 'boolean') {
        return res.status(400).json({ error: "delivered must be a boolean" });
      }
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      let meta = await storage.getShoottrackerMeta(id);
      
      if (meta) {
        meta = await storage.updateShoottrackerMeta(id, { delivered });
      } else {
        meta = await storage.createShoottrackerMeta({
          projectId: id,
          linkSent: false,
          delivered,
        });
      }
      
      const settings = await getSettings();
      
      if (delivered) {
        await storage.updateProject(id, {
          status: ProjectStatus.DELIVERED,
          riskLevel: RiskLevel.SAFE,
          deliveredAt: new Date(),
        });
      } else {
        const deliveryDueDate = project.deliveryDueDate || project.dueDate;
        const newRiskLevel = calculateShootTrackerRiskLevel(
          deliveryDueDate,
          false,
          settings.working_days,
          settings.holidays
        );
        
        await storage.updateProject(id, {
          riskLevel: newRiskLevel,
        });
      }
      
      const updatedProject = await storage.getProject(id);
      
      res.json({ success: true, project: updatedProject, meta });
    } catch (error: any) {
      console.error("Error updating delivered status:", error);
      res.status(500).json({ error: "Failed to update delivered status" });
    }
  });

  app.get("/api/shoottracker/project/:id/meta", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const meta = await storage.getShoottrackerMeta(id);
      
      res.json({
        project: {
          id: project.id,
          clientName: project.clientName,
          shootDate: project.shootDate,
          deliveryDueDate: project.deliveryDueDate,
          riskLevel: project.riskLevel,
          calendarEventId: project.calendarEventId,
          createdFrom: project.createdFrom,
        },
        meta: meta || null,
      });
    } catch (error: any) {
      console.error("Error fetching project meta:", error);
      res.status(500).json({ error: "Failed to fetch project meta" });
    }
  });

  // ============ EMAIL NOTIFICATION ROUTES ============
  
  // Send delivery estimate email to client
  app.post("/api/admin/shoottracker/project/:id/send-delivery-estimate", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (!project.clientEmail) {
        return res.status(400).json({ error: "No client email found for this project" });
      }
      
      if (!project.shootDate || !project.deliveryDueDate) {
        return res.status(400).json({ error: "Project is missing shoot date or delivery due date" });
      }
      
      const result = await sendDeliveryEstimateEmail(
        project.clientEmail,
        project.clientName,
        new Date(project.shootDate),
        new Date(project.deliveryDueDate),
        project.id
      );
      
      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(500).json({ error: result.error || "Failed to send email" });
      }
    } catch (error: any) {
      console.error("Error sending delivery estimate email:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });
  
  // Send project added email with package info
  app.post("/api/admin/shoottracker/project/:id/send-project-added", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (!project.clientEmail) {
        return res.status(400).json({ error: "No client email found for this project" });
      }
      
      // Generate approval token if there are extras
      const extras = Math.max(0, project.selectedCount - project.packageCount);
      let approvalToken = project.extrasApprovalToken || '';
      
      if (extras > 0 && !approvalToken) {
        approvalToken = generateToken();
        await storage.updateProject(id, { extrasApprovalToken: approvalToken });
      }
      
      const result = await sendProjectAddedEmail(
        project.clientEmail,
        project.clientName,
        project.packageCount,
        project.selectedCount,
        extras,
        project.id,
        approvalToken
      );
      
      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(500).json({ error: result.error || "Failed to send email" });
      }
    } catch (error: any) {
      console.error("Error sending project added email:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });
  
  // Send chat link email to client
  app.post("/api/admin/shoottracker/project/:id/send-chat-link", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (!project.clientEmail) {
        return res.status(400).json({ error: "No client email found for this project" });
      }
      
      if (!project.assignedTo) {
        return res.status(400).json({ error: "Project has not been assigned to a retoucher yet" });
      }
      
      // Generate a chat token for this client/project
      const chatToken = generateToken();
      
      // Store the token in client_auth_tokens table (tied to specific project)
      await storage.createClientAuthToken({
        email: project.clientEmail,
        projectId: project.id,
        token: chatToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
      
      const result = await sendChatLinkEmail(
        project.clientEmail,
        project.clientName,
        project.assignedTo,
        project.id,
        chatToken
      );
      
      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(500).json({ error: result.error || "Failed to send email" });
      }
    } catch (error: any) {
      console.error("Error sending chat link email:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });
  
  // ============ EXTRAS APPROVAL ROUTES ============
  
  // Public route - client approves extras via token
  app.post("/api/approve-extras/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      // Find project with this approval token
      const projects = await storage.getAllProjects();
      const project = projects.find(p => p.extrasApprovalToken === token);
      
      if (!project) {
        return res.status(404).json({ error: "Invalid or expired approval link" });
      }
      
      if (project.extrasApproved) {
        return res.status(400).json({ error: "Extras already approved" });
      }
      
      // Approve the extras
      await storage.updateProject(project.id, {
        extrasApproved: true,
        extrasApprovedAt: new Date(),
      });
      
      res.json({ 
        success: true, 
        message: "Extras approved successfully",
        projectName: project.clientName,
        extras: Math.max(0, project.selectedCount - project.packageCount),
      });
    } catch (error: any) {
      console.error("Error approving extras:", error);
      res.status(500).json({ error: error.message || "Failed to approve extras" });
    }
  });
  
  // Get project info for extras approval page (public)
  app.get("/api/approve-extras/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const projects = await storage.getAllProjects();
      const project = projects.find(p => p.extrasApprovalToken === token);
      
      if (!project) {
        return res.status(404).json({ error: "Invalid or expired approval link" });
      }
      
      const extras = Math.max(0, project.selectedCount - project.packageCount);
      
      res.json({
        projectName: project.clientName,
        packageCount: project.packageCount,
        selectedCount: project.selectedCount,
        extras,
        extrasApproved: project.extrasApproved,
      });
    } catch (error: any) {
      console.error("Error fetching extras info:", error);
      res.status(500).json({ error: error.message || "Failed to fetch extras info" });
    }
  });
  
  // Update client email on project
  app.patch("/api/admin/shoottracker/project/:id/client-email", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { clientEmail } = req.body;
      
      if (!clientEmail || typeof clientEmail !== 'string') {
        return res.status(400).json({ error: "Valid email is required" });
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clientEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      await storage.updateProject(id, { clientEmail: clientEmail.toLowerCase() });
      
      res.json({ success: true, clientEmail: clientEmail.toLowerCase() });
    } catch (error: any) {
      console.error("Error updating client email:", error);
      res.status(500).json({ error: error.message || "Failed to update client email" });
    }
  });

  // ============ CLIENT CHAT ROUTES ============
  
  // Verify chat token and get project info (public)
  app.get("/api/client-chat/verify/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      console.log(`[ChatVerify] Verifying token: ${token.substring(0, 8)}...`);
      
      const authToken = await storage.getClientAuthTokenByToken(token);
      
      if (!authToken) {
        console.log(`[ChatVerify] Token not found in database: ${token.substring(0, 8)}...`);
        return res.json({ valid: false, reason: "not_found" });
      }
      
      if (new Date(authToken.expiresAt) < new Date()) {
        console.log(`[ChatVerify] Token expired: ${token.substring(0, 8)}... (expired ${authToken.expiresAt})`);
        return res.json({ valid: false, reason: "expired" });
      }
      
      const project = await storage.getProject(authToken.projectId);
      
      if (!project) {
        console.log(`[ChatVerify] Project not found for token: ${token.substring(0, 8)}... (projectId: ${authToken.projectId})`);
        return res.json({ valid: false, reason: "project_not_found" });
      }
      
      console.log(`[ChatVerify] Token valid for project: ${project.clientName} (${project.id})`);
      res.json({
        valid: true,
        email: authToken.email,
        projectId: authToken.projectId,
        project: {
          id: project.id,
          clientName: project.clientName,
          assignedTo: project.assignedTo || "Unassigned",
          clientEmail: project.clientEmail,
        },
      });
    } catch (error: any) {
      console.error("[ChatVerify] Error verifying chat token:", error);
      res.status(500).json({ error: "Failed to verify token" });
    }
  });
  
  // Get chat messages for a project (public, authenticated by token)
  app.get("/api/client-chat/messages/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const authToken = await storage.getClientAuthTokenByToken(token);
      
      if (!authToken || new Date(authToken.expiresAt) < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Use projectId from token directly (no email-based search)
      const messages = await storage.getMessagesByProject(authToken.projectId);
      
      await storage.markMessagesAsRead(authToken.projectId, 'retoucher');
      
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  
  // Send a chat message (public, authenticated by token)
  app.post("/api/client-chat/:token/send", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { message, email, attachmentUrl, attachmentType, attachmentName } = req.body;
      
      // Either message or attachment is required
      if ((!message || typeof message !== 'string' || !message.trim()) && !attachmentUrl) {
        return res.status(400).json({ error: "Message or attachment is required" });
      }
      
      const authToken = await storage.getClientAuthTokenByToken(token);
      
      if (!authToken || new Date(authToken.expiresAt) < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Validate email matches the token's email
      if (email.toLowerCase() !== authToken.email.toLowerCase()) {
        return res.status(403).json({ error: "Email mismatch" });
      }
      
      // Use projectId from token directly (no email-based search)
      const newMessage = await storage.createClientMessage({
        projectId: authToken.projectId,
        senderType: 'client',
        senderEmail: authToken.email.toLowerCase(),
        message: message?.trim() || '',
        isRead: false,
        attachmentUrl: attachmentUrl || null,
        attachmentType: attachmentType || null,
        attachmentName: attachmentName || null,
      });
      
      handleClientMessageAutoResponse(authToken.projectId);

      res.json({ success: true, message: newMessage });
    } catch (error: any) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // Editor/Retoucher chat routes - allows all editor roles
  
  // Get all projects with unread message counts for the editor dashboard
  // Admins/Lead Retouchers see all projects, regular retouchers only see their assigned projects
  app.get("/api/admin/chat/projects", verifyChatRequest, async (req: Request, res: Response) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;
      const archived = req.query.archived === 'true';
      const postReviewOnly = req.query.postReviewOnly === 'true';
      
      // Admins and Lead Retouchers can see all projects, retouchers only their own
      const isAdmin = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER].includes(role as any);
      const assignedTo = isAdmin ? undefined : userId;
      
      const projectsWithCounts = await storage.getProjectsWithUnreadCounts(assignedTo, archived, postReviewOnly);
      // Disable caching to ensure unread counts are always fresh
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json(projectsWithCounts);
    } catch (error: any) {
      console.error("Error fetching projects with unread counts:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });
  
  app.get("/api/admin/chat/project/:projectId/messages", verifyChatRequest, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;
      
      // Check if user is authorized to view this project's messages
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const isAdmin = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER].includes(role as any);
      if (!isAdmin && project.assignedTo !== userId) {
        return res.status(403).json({ error: "Not authorized to view this conversation" });
      }
      
      const messages = await storage.getMessagesByProject(projectId);
      await storage.markMessagesAsRead(projectId, 'client');
      
      // Disable caching to ensure fresh messages are always returned
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  
  app.post("/api/admin/chat/project/:projectId/send", verifyChatRequest, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { message, attachmentUrl, attachmentType, attachmentName } = req.body;
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;
      
      // Either message or attachment is required
      if ((!message || typeof message !== 'string' || !message.trim()) && !attachmentUrl) {
        return res.status(400).json({ error: "Message or attachment is required" });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check if user is authorized to send messages for this project
      const isAdmin = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER].includes(role as any);
      if (!isAdmin && project.assignedTo !== userId) {
        return res.status(403).json({ error: "Not authorized to send messages for this project" });
      }
      
      const newMessage = await storage.createClientMessage({
        projectId,
        senderType: 'retoucher',
        senderEmail: userId || 'retoucher',
        message: message?.trim() || '',
        isRead: false,
        attachmentUrl: attachmentUrl || null,
        attachmentType: attachmentType || null,
        attachmentName: attachmentName || null,
      });
      
      clearPendingAutoResponse(projectId);
      
      // Send email notification to client if they have an email
      if (project.clientEmail) {
        try {
          // Get or create a chat token for this project/client
          let existingToken = await storage.getClientAuthTokenByProjectId(projectId);
          
          if (!existingToken || new Date(existingToken.expiresAt) < new Date()) {
            // Create a new token
            const chatToken = generateToken();
            await storage.createClientAuthToken({
              email: project.clientEmail,
              projectId: projectId,
              token: chatToken,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
            existingToken = await storage.getClientAuthTokenByProjectId(projectId);
          }
          
          if (existingToken) {
            // Fetch all messages to include in the email thread
            const allMessages = await storage.getMessagesByProject(projectId);
            
            // Convert messages to thread format for email
            const conversationThread = allMessages.map(msg => ({
              content: msg.message,
              senderType: (msg.senderType === 'client' ? 'client' : 'editor') as 'editor' | 'client',
              sentAt: new Date(msg.createdAt),
              senderName: msg.senderType === 'client' ? project.clientName : project.assignedTo || 'Your Retoucher'
            }));
            
            // Send notification email with full conversation thread
            await sendMessageNotificationEmail(
              project.clientEmail,
              project.clientName,
              project.assignedTo || 'Your Retoucher',
              projectId,
              message.trim(),
              existingToken.token,
              conversationThread
            );
          }
        } catch (emailError) {
          console.error("Failed to send email notification to client:", emailError);
          // Don't fail the request if email fails
        }
      }
      
      // Send push notification to client
      try {
        const subscriptions = await storage.getPushSubscriptionsByProject(projectId);
        let chatToken = await storage.getClientAuthTokenByProjectId(projectId);
        if (!chatToken && project.clientEmail) {
          const newToken = generateToken();
          await storage.createClientAuthToken({
            email: project.clientEmail,
            projectId: projectId,
            token: newToken,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
          chatToken = await storage.getClientAuthTokenByProjectId(projectId);
        }
        const pushPayload = JSON.stringify({
          title: 'Jepson Myles Studio',
          body: message?.trim() ? `New message from your retoucher: ${message.trim().substring(0, 100)}` : 'Your retoucher sent you a file',
          url: chatToken ? `/client-chat/${chatToken.token}` : '/',
        });
        
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            }, pushPayload);
          } catch (pushError: any) {
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              await storage.deletePushSubscription(sub.endpoint);
            }
            console.error('[Push] Failed to send notification:', pushError.message);
          }
        }
      } catch (pushErr) {
        console.error('[Push] Error sending push notifications:', pushErr);
      }

      res.json({ success: true, message: newMessage });
    } catch (error: any) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Archive a chat project
  app.post("/api/admin/chat/project/:projectId/archive", verifyChatRequest, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const isAdmin = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER].includes(role as any);
      if (!isAdmin && project.assignedTo !== userId) {
        return res.status(403).json({ error: "Not authorized to archive this chat" });
      }

      await storage.updateProject(projectId, {
        chatArchived: true,
        chatArchivedAt: new Date(),
        chatArchivedBy: userId,
      });

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error archiving chat:", error);
      res.status(500).json({ error: "Failed to archive chat" });
    }
  });

  // Unarchive a chat project
  app.post("/api/admin/chat/project/:projectId/unarchive", verifyChatRequest, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const isAdmin = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER].includes(role as any);
      if (!isAdmin && project.assignedTo !== userId) {
        return res.status(403).json({ error: "Not authorized to unarchive this chat" });
      }

      await storage.updateProject(projectId, {
        chatArchived: false,
        chatArchivedAt: null,
        chatArchivedBy: null,
      });

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error unarchiving chat:", error);
      res.status(500).json({ error: "Failed to unarchive chat" });
    }
  });

  // Push subscription route
  app.post("/api/push/subscribe", async (req: Request, res: Response) => {
    try {
      const { token, endpoint, p256dh, auth } = req.body;
      
      if (!token || !endpoint || !p256dh || !auth) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const authToken = await storage.getClientAuthTokenByToken(token);
      if (!authToken || new Date(authToken.expiresAt) < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      await storage.savePushSubscription({
        projectId: authToken.projectId,
        endpoint,
        p256dh,
        auth,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  // Webhook endpoint for receiving inbound email replies from Resend
  // Clients can reply to notification emails and their message will be stored
  app.post("/api/webhooks/email-reply", async (req: Request, res: Response) => {
    try {
      // Verify webhook signature if secret is configured
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
      const signature = req.headers['svix-signature'] as string;
      
      if (webhookSecret && signature) {
        const payload = JSON.stringify(req.body);
        const isValid = verifyResendWebhookSignature(payload, signature, webhookSecret);
        
        if (!isValid) {
          console.log("[Email Webhook] Invalid signature - rejecting request");
          return res.status(401).json({ error: "Invalid webhook signature" });
        }
        console.log("[Email Webhook] Signature verified successfully");
      } else if (webhookSecret && !signature) {
        console.log("[Email Webhook] Missing signature header - rejecting request");
        return res.status(401).json({ error: "Missing webhook signature" });
      }
      
      console.log("[Email Webhook] Received inbound email:", JSON.stringify(req.body, null, 2));
      
      // Resend wraps inbound emails in an event structure
      // Handle both direct format and event wrapper format
      let emailData = req.body;
      if (req.body.type === 'email.received' && req.body.data) {
        emailData = req.body.data;
        console.log("[Email Webhook] Extracted email data from event wrapper");
      }
      
      const { from, to, subject, text, html } = emailData;
      
      if (!from || !to) {
        console.log("[Email Webhook] Missing from or to fields in:", emailData);
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Extract project ID from the reply-to address
      // Format: reply+{projectId}@domain.com
      let projectId: string | null = null;
      
      // 'to' might be a string or array
      const toAddresses = Array.isArray(to) ? to : [to];
      for (const addr of toAddresses) {
        const match = addr.match(/reply\+([^@]+)@/);
        if (match) {
          projectId = match[1];
          break;
        }
      }
      
      if (!projectId) {
        console.log("[Email Webhook] Could not extract project ID from:", toAddresses);
        return res.status(400).json({ error: "Could not identify project from reply address" });
      }
      
      // Get sender email
      const senderEmail = typeof from === 'string' ? from : (from.email || from.address || String(from));
      const cleanSenderEmail = senderEmail.match(/[^<]*<([^>]+)>/)?.[1] || senderEmail;
      
      // Verify the project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        console.log("[Email Webhook] Project not found:", projectId);
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Verify sender is the client for this project
      if (project.clientEmail && cleanSenderEmail.toLowerCase() !== project.clientEmail.toLowerCase()) {
        console.log("[Email Webhook] Sender email mismatch:", cleanSenderEmail, "vs", project.clientEmail);
        return res.status(403).json({ error: "Sender not authorized for this project" });
      }
      
      // Extract the message content - prefer plain text, strip quoted content
      let messageContent = text || '';
      
      // Remove quoted previous messages (lines starting with > or preceded by "On ... wrote:")
      const lines = messageContent.split('\n');
      const cleanLines: string[] = [];
      let foundQuoteMarker = false;
      
      for (const line of lines) {
        // Stop at quote markers
        if (line.match(/^On .* wrote:$/i) || line.match(/^-+ ?Original Message ?-+$/i)) {
          foundQuoteMarker = true;
          break;
        }
        // Skip quoted lines
        if (line.startsWith('>')) {
          continue;
        }
        // Skip email signature markers
        if (line.match(/^-- ?$/)) {
          break;
        }
        cleanLines.push(line);
      }
      
      messageContent = cleanLines.join('\n').trim();
      
      if (!messageContent) {
        console.log("[Email Webhook] No message content after cleaning");
        return res.status(400).json({ error: "No message content found" });
      }
      
      // Tag replies that arrive shortly after a Google review thank-you,
      // so they surface as warm leads in the admin inbox.
      const isPostReviewReply = await wasGoogleReviewThanksRecentlySent(projectId);

      // Store the message
      const newMessage = await storage.createClientMessage({
        projectId,
        senderType: 'client',
        senderEmail: cleanSenderEmail.toLowerCase(),
        message: messageContent,
        isRead: false,
        tag: isPostReviewReply ? 'post_review_reply' : null,
      });
      
      console.log(`[Email Webhook] Message saved for project ${projectId} from ${cleanSenderEmail}: "${messageContent.substring(0, 50)}..."`);
      
      res.json({ success: true, messageId: newMessage.id });
    } catch (error: any) {
      console.error("[Email Webhook] Error processing inbound email:", error);
      res.status(500).json({ error: "Failed to process email reply" });
    }
  });

  // Gmail reply monitor disabled - requires gmail.readonly permission
  // which is not included in the current Gmail integration scope.
  // Clients can still reply via the chat link in emails.
  // To enable: reconnect Gmail with full inbox access permissions
  // try {
  //   startReplyMonitor(60); // Check every 60 seconds
  //   console.log("✅ Gmail reply monitor started");
  // } catch (error) {
  //   console.log("⚠️ Gmail reply monitor not started (may not be configured)");
  // }

  // Delay notification routes
  
  // GET /api/admin/shoottracker/delay-check/preview - Preview delayed projects without sending emails
  app.get("/api/admin/shoottracker/delay-check/preview", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const delayedProjects = await getDelayedProjectsForNextWeek();
      res.json({
        success: true,
        totalDelayed: delayedProjects.length,
        projects: delayedProjects.map(p => ({
          id: p.id,
          clientName: p.clientName,
          clientEmail: p.clientEmail,
          originalDueDate: p.originalDueDate,
          deliveryDueDate: p.deliveryDueDate,
          delayDays: p.delayDays,
          rolloverCount: p.rolloverCount,
        })),
      });
    } catch (error: any) {
      console.error("[DelayCheck] Error previewing delayed projects:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/admin/shoottracker/delay-check/send - Manually trigger delay notifications
  app.post("/api/admin/shoottracker/delay-check/send", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      console.log("[DelayCheck] Manual delay notification triggered");
      const result = await sendDelayNotifications();
      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("[DelayCheck] Error sending delay notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Start the Thursday morning delay notification scheduler
  startDelayNotificationScheduler();
  console.log("✅ Delay notification scheduler started");

  async function autoArchiveDeliveredChats() {
    try {
      const allProjects = await storage.getProjectsWithUnreadCounts(undefined, false);
      const now = new Date();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      let archived = 0;

      for (const { project } of allProjects) {
        if (project.deliveredAt && !project.chatArchived) {
          const deliveredDate = new Date(project.deliveredAt);
          if (now.getTime() - deliveredDate.getTime() >= sevenDaysMs) {
            await storage.updateProject(project.id, {
              chatArchived: true,
              chatArchivedAt: new Date(),
              chatArchivedBy: "system",
            });
            archived++;
          }
        }
      }

      if (archived > 0) {
        console.log(`[AutoArchive] Archived ${archived} chats (7+ days after delivery)`);
      }
    } catch (error) {
      console.error("[AutoArchive] Error:", error);
    }
  }

  autoArchiveDeliveredChats();
  setInterval(autoArchiveDeliveredChats, 6 * 60 * 60 * 1000);
  console.log("✅ Auto-archive scheduler started (every 6 hours)");

  console.log("✅ ShootTracker routes registered");
}
