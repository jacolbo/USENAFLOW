import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { 
  DEFAULT_SHOOTTRACKER_SETTINGS, 
  shoottrackerSettingsSchema, 
  ShoottrackerSettings,
  RiskLevel,
  ProjectStatus,
  UserRoles,
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
import { fetchCalendarEvents, CalendarEvent } from "./services/googleCalendar";
import { fetchICSCalendar, ICSEvent } from "./services/icsCalendar";
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

  // Sync route (Admin/Lead Retoucher only - enforced via verifyAdminRequest middleware)
  app.post("/api/admin/shoottracker/sync", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const settings = await getSettings();
      const stats = createEmptySyncStats();
      const now = new Date();
      const timeMin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      
      let normalizedEvents: NormalizedEvent[] = [];
      
      // Priority: Use ICS URL if configured, otherwise try Google Calendar
      if (settings.ics_calendar_url && settings.ics_calendar_url.trim() !== "") {
        console.log(`📅 ShootTracker: Fetching from ICS URL`);
        try {
          const icsEvents = await fetchICSCalendar(settings.ics_calendar_url);
          
          // Filter events within time range
          const filteredEvents = icsEvents.filter(event => {
            return event.start >= timeMin && event.start <= timeMax;
          });
          
          normalizedEvents = filteredEvents.map(event => {
            const calendarEventLike: CalendarEvent = {
              id: event.uid || event.id,
              summary: event.summary,
              description: event.description,
              location: event.location,
              start: event.start.toISOString(),
              end: event.end.toISOString(),
            };
            return normalizeEvent(calendarEventLike);
          });
          
          stats.fetched = normalizedEvents.length;
          console.log(`📅 ShootTracker: Fetched ${stats.fetched} events from ICS calendar`);
        } catch (error: any) {
          stats.errors.push(`Failed to fetch ICS calendar: ${error.message}`);
        }
      } else {
        // Fall back to Google Calendar API if no ICS URL configured
        const calendarIds = settings.selected_calendar_ids.length > 0 
          ? settings.selected_calendar_ids 
          : ['primary'];
        
        let allEvents: CalendarEvent[] = [];
        
        for (const calendarId of calendarIds) {
          try {
            const events = await fetchCalendarEvents(calendarId, timeMin, timeMax);
            allEvents = allEvents.concat(events);
          } catch (error: any) {
            stats.errors.push(`Failed to fetch calendar ${calendarId}: ${error.message}`);
          }
        }
        
        for (const rawEvent of allEvents) {
          const event = normalizeEvent(rawEvent);
          normalizedEvents.push(event);
        }
        
        stats.fetched = normalizedEvents.length;
        console.log(`📅 ShootTracker: Fetched ${stats.fetched} events from ${calendarIds.length} calendar(s)`);
      }
      
      // Process all normalized events
      for (const event of normalizedEvents) {
        try {
          if (shouldExclude(event, settings.exclude_keywords)) {
            stats.excluded++;
            continue;
          }
          
          const classification = classifyEvent(event, now);
          
          if (classification === 'UPCOMING') {
            stats.upcoming++;
            continue;
          }
          
          stats.done++;
          
          const existingProject = await storage.getProjectByCalendarEventId(event.id);
          
          const shootDate = event.start;
          const deliveryDueDate = addBusinessDays(
            shootDate,
            settings.turnaround_days,
            settings.working_days,
            settings.holidays,
            settings.timezone
          );
          
          if (existingProject) {
            const meta = await storage.getShoottrackerMeta(existingProject.id);
            const delivered = meta?.delivered || false;
            
            const riskLevel = calculateShootTrackerRiskLevel(
              deliveryDueDate,
              delivered,
              settings.working_days,
              settings.holidays,
              now
            );
            
            await storage.updateProject(existingProject.id, {
              shootDate,
              deliveryDueDate,
              riskLevel,
              lastSyncedAt: new Date(),
            });
            
            if (meta) {
              await storage.updateShoottrackerMeta(existingProject.id, {
                lastCalendarSync: new Date(),
                rawEventPayload: event.rawPayload,
              });
            }
            
            stats.updated++;
          } else {
            const clientName = parseClientNameFromTitle(event.title);
            
            const sundayOfWeek = new Date(shootDate);
            sundayOfWeek.setDate(sundayOfWeek.getDate() - sundayOfWeek.getDay());
            sundayOfWeek.setHours(0, 0, 0, 0);
            
            const riskLevel = calculateShootTrackerRiskLevel(
              deliveryDueDate,
              false,
              settings.working_days,
              settings.holidays,
              now
            );
            
            const newProject = await storage.createProject({
              clientName,
              packageCount: 0,
              selectedCount: 0,
              dueDate: sundayOfWeek,
              assignedTo: null,
              shootDate,
              deliveryDueDate,
              riskLevel,
              calendarEventId: event.id,
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
              rawEventPayload: event.rawPayload,
            });
            
            stats.created++;
          }
        } catch (eventError: any) {
          stats.errors.push(`Event ${event.id}: ${eventError.message}`);
        }
      }
      
      console.log(`✅ ShootTracker sync complete: ${stats.created} created, ${stats.updated} updated, ${stats.excluded} excluded`);
      
      res.json(stats);
    } catch (error: any) {
      console.error("❌ ShootTracker sync error:", error);
      res.status(500).json({ error: error.message || "Sync failed" });
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
