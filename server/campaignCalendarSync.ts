import { storage } from './storage';
import { listCalendars, fetchCalendarEvents } from './services/googleCalendar';

// Accent-insensitive keyword match: normalise NFD and strip combining marks,
// then test against plain ASCII patterns (handles NOEL / NOËL / Noël / NÖEL etc.)
function noelKeywordMatch(text: string): boolean {
  const normalised = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .toLowerCase();
  return /noel|christmas/.test(normalised);
}

export interface NoelSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function syncNoelCalendar(): Promise<NoelSyncResult> {
  const result: NoelSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const campaign = await storage.getActiveCampaign();
    if (!campaign) {
      console.log('🎄 Noël sync: no active campaign found, skipping');
      return result;
    }

    let calendars: Awaited<ReturnType<typeof listCalendars>> = [];
    try {
      calendars = await listCalendars();
    } catch (err: any) {
      console.warn('🎄 Noël sync: could not list calendars —', err.message);
      return result;
    }

    if (calendars.length === 0) {
      console.log('🎄 Noël sync: no calendars available');
      return result;
    }

    // Use an extreme window that covers all practical dates (the Google Calendar
    // API requires a time range; this is the closest approximation to "all dates").
    const timeMin = new Date(0);                          // 1970-01-01 (Unix epoch)
    const timeMax = new Date('2100-12-31T23:59:59Z');    // far future

    for (const cal of calendars) {
      let events: Awaited<ReturnType<typeof fetchCalendarEvents>> = [];
      try {
        events = await fetchCalendarEvents(cal.id, timeMin, timeMax);
      } catch (err: any) {
        console.warn(`🎄 Noël sync: error fetching calendar "${cal.summary}" — ${err.message}`);
        result.errors.push(`Calendar "${cal.summary}": ${err.message}`);
        continue;
      }

      for (const event of events) {
        try {
          // Accent-insensitive keyword filter
          if (!noelKeywordMatch(event.summary)) {
            result.skipped++;
            continue;
          }

          if (!event.start || isNaN(event.start.getTime())) {
            result.skipped++;
            continue;
          }

          const shootDate = event.start;

          // Google Calendar all-day events have an exclusive end date (end = last day + 1).
          // A single-day all-day event → end - start = exactly 24 h.
          // A multi-day all-day event → end - start ≥ 48 h.
          // Timed events rarely span > 12 h, so ≥ 48 h is the safe multi-day threshold.
          const durationMs =
            event.end && !isNaN(event.end.getTime())
              ? event.end.getTime() - event.start.getTime()
              : 0;
          const isMultiDay = durationMs >= 2 * 24 * 60 * 60 * 1000; // ≥ 48 h
          const promisedDeliveryDate = isMultiDay ? event.end : event.start;

          const existing = await storage.getProjectByCalendarEventId(event.id);

          if (existing) {
            await storage.updateProject(existing.id, {
              shootDate,
              promisedDeliveryDate,
              lastSyncedAt: new Date(),
            });
            result.updated++;
            continue;
          }

          // Sunday of shoot week — dueDate is a required field on projects
          const sunday = new Date(shootDate);
          sunday.setDate(sunday.getDate() - sunday.getDay());
          sunday.setHours(0, 0, 0, 0);

          await storage.createProject({
            clientName: event.summary,
            packageCount: 0,
            selectedCount: 0,
            dueDate: sunday,
            assignedTo: null,
            shootDate,
            deliveryDueDate: promisedDeliveryDate,
            promisedDeliveryDate,
            riskLevel: 'SAFE',
            calendarEventId: event.id,
            lastSyncedAt: new Date(),
            createdFrom: 'CALENDAR',
            campaignId: campaign.id,
            status: 'ShootDone',
          });

          result.created++;
          console.log(
            `🎄 Noël sync: created "${event.summary}" (shoot ${shootDate.toISOString().slice(0, 10)}, delivery ${promisedDeliveryDate.toISOString().slice(0, 10)})`
          );
        } catch (err: any) {
          result.errors.push(`Event "${event.summary}": ${err.message}`);
          console.error(`🎄 Noël sync error for event "${event.summary}":`, err.message);
        }
      }
    }

    console.log(
      `✅ Noël sync complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`
    );
  } catch (err: any) {
    console.error('❌ Noël sync failed:', err.message);
    result.errors.push(`Sync failed: ${err.message}`);
  }

  return result;
}
