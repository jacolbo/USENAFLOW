import { storage } from "./storage";
import { DEFAULT_SHOOTTRACKER_SETTINGS, shoottrackerSettingsSchema, ShoottrackerSettings, StagingStatus } from "@shared/schema";
import { 
  normalizeEvent, 
  shouldExclude, 
  extractClientEmail,
} from "./services/shoottrackerEngine";
import { fetchCalendarEvents } from "./services/googleCalendar";

const SETTINGS_KEY = "shoottracker_settings";
const CHECK_INTERVAL_MS = 60 * 1000;

let checkIntervalId: NodeJS.Timeout | null = null;
let lastSyncTime: Date | null = null;
let isRunning = false;

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

async function saveLastSyncTime(settings: ShoottrackerSettings): Promise<void> {
  const updatedSettings = {
    ...settings,
    last_auto_sync_at: new Date().toISOString(),
  };
  await storage.setAppSetting(SETTINGS_KEY, updatedSettings);
}

async function performAutoSync(): Promise<void> {
  if (isRunning) {
    console.log("⏳ [AutoSync] Sync already in progress, skipping");
    return;
  }
  
  const settings = await getSettings();
  
  if (settings.selected_calendar_ids.length === 0) {
    console.log("⚠️ [AutoSync] No calendars selected, skipping sync");
    return;
  }
  
  isRunning = true;
  console.log(`🔄 [AutoSync] Starting scheduled sync at ${new Date().toISOString()}`);
  
  try {
    
    const stats = { fetched: 0, staged: 0, updated: 0, excluded: 0, errors: [] as string[] };
    const now = new Date();
    const timeMin = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    console.log(`📅 [AutoSync] Syncing ${settings.selected_calendar_ids.length} calendar(s)`);
    
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
            
            const existing = await storage.getStagedEventByCalendarEventId(event.id);

            const clientEmail = extractClientEmail(event.description, event.location, event.attendeeEmails);

            if (existing) {
              if (existing.status === StagingStatus.IGNORED) {
                continue;
              }
              if (existing.status === StagingStatus.PROMOTED) {
                if (clientEmail && existing.promotedProjectId) {
                  const promotedProject = await storage.getProject(existing.promotedProjectId);
                  if (promotedProject && !promotedProject.clientEmail) {
                    await storage.updateProject(existing.promotedProjectId, { clientEmail });
                    console.log(`📅 [AutoSync] Backfilled email ${clientEmail} to promoted project "${event.title}"`);
                  }
                }
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
          } catch (eventError: any) {
            stats.errors.push(`Event: ${eventError.message}`);
          }
        }
      } catch (calendarError: any) {
        stats.errors.push(`Calendar ${calendarId}: ${calendarError.message}`);
      }
    }
    
    lastSyncTime = new Date();
    await saveLastSyncTime(settings);
    
    console.log(`✅ [AutoSync] Complete: ${stats.fetched} fetched, ${stats.staged} new, ${stats.updated} updated, ${stats.excluded} excluded`);
    
  } catch (error: any) {
    console.error(`❌ [AutoSync] Failed:`, error.message);
  } finally {
    isRunning = false;
  }
}

async function checkAndSync(): Promise<void> {
  try {
    const settings = await getSettings();
    
    if (!settings.auto_sync_enabled) {
      return;
    }
    
    const intervalMs = settings.auto_sync_interval_minutes * 60 * 1000;
    const now = new Date();
    
    if (settings.last_auto_sync_at) {
      const lastSync = new Date(settings.last_auto_sync_at);
      const timeSinceLastSync = now.getTime() - lastSync.getTime();
      
      if (timeSinceLastSync < intervalMs) {
        return;
      }
    }
    
    await performAutoSync();
    
  } catch (error: any) {
    console.error(`❌ [AutoSync] Check failed:`, error.message);
  }
}

export function startAutoSync(): void {
  if (checkIntervalId) {
    console.log("⚠️ [AutoSync] Already running");
    return;
  }
  
  console.log(`🚀 [AutoSync] Starting auto-sync scheduler (checks every ${CHECK_INTERVAL_MS / 1000} seconds)`);
  
  checkIntervalId = setInterval(async () => {
    try {
      await checkAndSync();
    } catch (error) {
      console.error("❌ [AutoSync] Unhandled error:", error);
    }
  }, CHECK_INTERVAL_MS);
  
  setTimeout(async () => {
    try {
      await checkAndSync();
    } catch (error) {
      console.error("❌ [AutoSync] Initial check failed:", error);
    }
  }, 5000);
}

export function stopAutoSync(): void {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
    console.log("🛑 [AutoSync] Stopped");
  }
}

export function getAutoSyncStatus(): { isRunning: boolean; lastSyncTime: Date | null } {
  return {
    isRunning,
    lastSyncTime,
  };
}

export async function triggerManualAutoSync(): Promise<void> {
  await performAutoSync();
}
