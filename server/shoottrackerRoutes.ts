import type { Express, Request, Response } from "express";
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
import { verifyAdminRequest } from "./middleware/adminAuth";
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
} from "./services/shoottrackerEngine";
import { fetchCalendarEvents, CalendarEvent, listCalendars } from "./services/googleCalendar";
import { calculateRiskLevel } from "./services/riskCalculator";

const SETTINGS_KEY = "shoottracker_settings";

const ADMIN_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER];
const VIEW_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER, UserRoles.DATA_WRANGLER];

async function getSettings(): Promise<ShoottrackerSettings> {
  const setting = await storage.getAppSetting(SETTINGS_KEY);
  if (setting) {
    try {
      return shoottrackerSettingsSchema.parse(setting.value);
    } catch {
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

  app.put("/api/admin/shoottracker/settings", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const validatedSettings = shoottrackerSettingsSchema.parse(req.body);
      await storage.setAppSetting(SETTINGS_KEY, validatedSettings);
      res.json({ success: true, settings: validatedSettings });
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

  // Sync route - stores events in staging table for user to review
  app.post("/api/admin/shoottracker/sync", verifyAdminRequest, async (req: Request, res: Response) => {
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
            
            if (existing) {
              await storage.updateStagedEvent(existing.id, {
                title: event.title,
                description: event.description,
                location: event.location,
                eventStart: event.start,
                eventEnd: event.end,
                rawPayload: event.rawPayload,
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
  app.post("/api/admin/shoottracker/staged/:id/promote", verifyAdminRequest, async (req: Request, res: Response) => {
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
      
      const deliveryDueDate = addBusinessDays(
        shootDate,
        settings.turnaround_days,
        settings.working_days,
        settings.holidays,
        settings.timezone
      );
      
      const weekStart = targetWeekStart ? new Date(targetWeekStart) : (() => {
        const sunday = new Date(shootDate);
        sunday.setDate(sunday.getDate() - sunday.getDay());
        sunday.setHours(0, 0, 0, 0);
        return sunday;
      })();
      
      const now = new Date();
      const riskLevel = calculateShootTrackerRiskLevel(
        deliveryDueDate,
        false,
        settings.working_days,
        settings.holidays,
        now
      );
      
      const clientName = parseClientNameFromTitle(stagedEvent.title);
      
      const newProject = await storage.createProject({
        clientName,
        packageCount: 0,
        selectedCount: 0,
        dueDate: weekStart,
        assignedTo: null,
        shootDate,
        deliveryDueDate,
        riskLevel,
        calendarEventId: stagedEvent.calendarEventId,
        lastSyncedAt: new Date(),
        createdFrom: "CALENDAR",
      });
      
      await storage.createShoottrackerMeta({
        projectId: newProject.id,
        linkSent: false,
        delivered: false,
        turnaroundDays: settings.turnaround_days,
        workingDays: settings.working_days,
        holidays: settings.holidays,
        lastCalendarSync: new Date(),
        rawEventPayload: stagedEvent.rawPayload as any,
      });
      
      await storage.updateStagedEvent(id, {
        status: StagingStatus.PROMOTED,
        promotedProjectId: newProject.id,
        targetWeekStart: weekStart,
        promotedAt: new Date(),
        promotedBy: userId,
      });
      
      res.json({ success: true, project: newProject });
    } catch (error: any) {
      console.error("Error promoting staged event:", error);
      res.status(500).json({ error: error.message || "Failed to promote event" });
    }
  });

  // Ignore staged event
  app.post("/api/admin/shoottracker/staged/:id/ignore", verifyAdminRequest, async (req: Request, res: Response) => {
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
  app.post("/api/admin/shoottracker/staged/:id/restore", verifyAdminRequest, async (req: Request, res: Response) => {
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

  app.patch("/api/shoottracker/project/:id/link-sent", async (req: Request, res: Response) => {
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

  app.patch("/api/shoottracker/project/:id/delivered", async (req: Request, res: Response) => {
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

  console.log("✅ ShootTracker routes registered");
}
