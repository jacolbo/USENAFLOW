import { storage } from './storage';
import { listCalendars, fetchCalendarEvents } from './services/googleCalendar';

const NOEL_RE = /noe[lë]|christmas/i;

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

    let calendars: { id: string; summary: string }[] = [];
    try {
      calendars = await listCalendars();
    } catch (err: any) {
      console.warn('🎄 Noël sync: could not list calendars —', err.message);
      return result;
    }

    if (calendars.length === 0) {
      console.log('🎄 Noël sync: no calendars found');
      return result;
    }

    // Scan a wide window so we catch historical and future events
    const timeMin = new Date('2020-01-01T00:00:00Z');
    const timeMax = new Date('2028-12-31T23:59:59Z');

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
          if (!NOEL_RE.test(event.summary)) {
            result.skipped++;
            continue;
          }

          if (!event.start || isNaN(event.start.getTime())) {
            result.skipped++;
            continue;
          }

          const shootDate = event.start;
          // Multi-day event → delivery = end; single-day → delivery = shoot date
          const isMultiDay =
            event.end &&
            !isNaN(event.end.getTime()) &&
            event.end.getTime() - event.start.getTime() > 12 * 60 * 60 * 1000;
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

          // Sunday of shoot week — used as dueDate (required field)
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
          });

          result.created++;
          console.log(`🎄 Noël sync: created project "${event.summary}" (${shootDate.toISOString().slice(0, 10)})`);
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
