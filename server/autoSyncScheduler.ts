import { storage } from "./storage";
import { DEFAULT_SHOOTTRACKER_SETTINGS, shoottrackerSettingsSchema } from "@shared/schema";
import { 
  normalizeEvent, 
  shouldExclude, 
  classifyEvent, 
  addBusinessDays, 
  parseClientNameFromTitle,
  calculateShootTrackerRiskLevel,
  createEmptySyncStats,
} from "./services/shoottrackerEngine";
import { fetchCalendarEvents } from "./services/googleCalendar";

const SETTINGS_KEY = "shoottracker_settings";
const SYNC_INTERVAL_MS = 30 * 60 * 1000;

let syncIntervalId: NodeJS.Timeout | null = null;

async function getSettings() {
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

async function performAutoSync(): Promise<void> {
  console.log(`🔄 [AutoSync] Starting scheduled sync at ${new Date().toISOString()}`);
  
  try {
    const settings = await getSettings();
    
    if (settings.selected_calendar_ids.length === 0) {
      console.log("⚠️ [AutoSync] No calendars selected, skipping sync");
      return;
    }
    
    const stats = createEmptySyncStats();
    const now = new Date();
    const timeMin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    for (const calendarId of settings.selected_calendar_ids) {
      try {
        const events = await fetchCalendarEvents(calendarId, timeMin, timeMax);
        stats.fetched += events.length;
        
        for (const rawEvent of events) {
          try {
            const event = normalizeEvent(rawEvent);
            
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
            stats.errors.push(`Event: ${eventError.message}`);
          }
        }
      } catch (calendarError: any) {
        stats.errors.push(`Calendar ${calendarId}: ${calendarError.message}`);
      }
    }
    
    console.log(`✅ [AutoSync] Complete: ${stats.created} created, ${stats.updated} updated, ${stats.excluded} excluded, ${stats.errors.length} errors`);
    
  } catch (error: any) {
    console.error(`❌ [AutoSync] Failed:`, error.message);
  }
}

export function startAutoSync(): void {
  const autoSyncEnabled = process.env.SHOOTTRACKER_AUTOSYNC === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!autoSyncEnabled) {
    console.log("ℹ️ [AutoSync] Disabled (set SHOOTTRACKER_AUTOSYNC=true to enable)");
    return;
  }
  
  if (!isProduction) {
    console.log("ℹ️ [AutoSync] Disabled in development mode (only runs in production)");
    return;
  }
  
  if (syncIntervalId) {
    console.log("⚠️ [AutoSync] Already running");
    return;
  }
  
  console.log(`🚀 [AutoSync] Starting with ${SYNC_INTERVAL_MS / 60000} minute interval`);
  
  syncIntervalId = setInterval(async () => {
    try {
      await performAutoSync();
    } catch (error) {
      console.error("❌ [AutoSync] Unhandled error:", error);
    }
  }, SYNC_INTERVAL_MS);
  
  setTimeout(async () => {
    try {
      await performAutoSync();
    } catch (error) {
      console.error("❌ [AutoSync] Initial sync failed:", error);
    }
  }, 5000);
}

export function stopAutoSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("🛑 [AutoSync] Stopped");
  }
}
