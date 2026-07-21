import { storage } from './storage';
import { listCalendars, fetchCalendarEvents } from './services/googleCalendar';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Accent-insensitive keyword match via Unicode NFD normalisation + diacritic strip.
 * Handles NOEL / NOËL / Noël / NÖEL / CHRISTMAS / christmas, etc.
 */
function isNoelEvent(text: string): boolean {
  const plain = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /noel|christmas/.test(plain);
}

/** Local-timezone ISO date string (avoids UTC midnight shift in non-UTC zones). */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoelSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ─── Main sync ────────────────────────────────────────────────────────────────

export async function syncNoelCalendar(): Promise<NoelSyncResult> {
  const result: NoelSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const campaign = await storage.getActiveCampaign();
    if (!campaign) {
      console.log('🎄 Noël sync: no active campaign found, skipping');
      return result;
    }

    // ── 1. Fetch all connected calendars ─────────────────────────────────────
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

    // ── 2. Build campaign-scoped dedup lookups (load once, campaign only) ─────
    //
    // Dedup is intentionally scoped to Noël campaign projects only.
    // ShootTracker projects (or any other pipeline) are never queried for dedup
    // and are never mutated — the pipelines are completely independent.
    //
    // Primary key:   calendarEventId (present when created without cross-pipeline collision)
    // Secondary key: "<clientName>|<localShootDate>" (fallback for projects created without
    //                calendarEventId due to a DB unique-constraint collision with ShootTracker)
    //
    const campaignProjects = await storage.getCampaignProjects(campaign.id);

    const campaignByEventId = new Map<string, (typeof campaignProjects)[0]>();
    const campaignCompoundKeys = new Set<string>();

    for (const p of campaignProjects) {
      if (p.calendarEventId) {
        campaignByEventId.set(p.calendarEventId, p);
      }
      const shootDateKey = p.shootDate ? localDateStr(new Date(p.shootDate)) : 'nodate';
      campaignCompoundKeys.add(`${p.clientName}|${shootDateKey}`);
    }

    // ── 3. Broad date window — the closest to "all dates" the API allows ──────
    const timeMin = new Date(0);                       // 1970-01-01 (Unix epoch)
    const timeMax = new Date('2100-12-31T23:59:59Z'); // far future

    // ── 4. Scan every calendar ────────────────────────────────────────────────
    for (const cal of calendars) {
      let events: Awaited<ReturnType<typeof fetchCalendarEvents>> = [];
      try {
        events = await fetchCalendarEvents(cal.id, timeMin, timeMax);
      } catch (err: any) {
        const msg = `Calendar "${cal.summary}": ${err.message}`;
        console.warn(`🎄 Noël sync: ${msg}`);
        result.errors.push(msg);
        continue;
      }

      for (const event of events) {
        try {
          // Filter to Noël / Christmas events only
          if (!isNoelEvent(event.summary)) {
            result.skipped++;
            continue;
          }
          if (!event.start || isNaN(event.start.getTime())) {
            result.skipped++;
            continue;
          }

          const shootDate = event.start;

          // All-day single-day events: Google sets end = start + 24 h (exclusive).
          // Use ≥ 48 h as multi-day threshold to avoid misclassifying them.
          const durationMs =
            event.end && !isNaN(event.end.getTime())
              ? event.end.getTime() - event.start.getTime()
              : 0;
          const isMultiDay = durationMs >= 2 * 24 * 60 * 60 * 1000;
          const promisedDeliveryDate = isMultiDay ? event.end : event.start;

          // ── Dedup: campaign-scoped primary key (calendarEventId) ─────────────
          const existingByCampaignEventId = campaignByEventId.get(event.id);
          if (existingByCampaignEventId) {
            // Already a Noël campaign project — refresh dates only
            await storage.updateProject(existingByCampaignEventId.id, {
              shootDate,
              promisedDeliveryDate,
              lastSyncedAt: new Date(),
            });
            result.updated++;
            continue;
          }

          // ── Dedup: campaign-scoped secondary key (clientName + shootDate) ────
          const compoundKey = `${event.summary}|${localDateStr(shootDate)}`;
          if (campaignCompoundKeys.has(compoundKey)) {
            // Already a Noël campaign project (created without calendarEventId) — skip
            result.skipped++;
            continue;
          }

          // ── Not in campaign — create new Noël campaign project ───────────────
          //
          // calendarEventId is UNIQUE table-wide.  If a non-campaign (ShootTracker)
          // project already owns this ID, we create the campaign project without it
          // (null) to avoid a constraint violation.  ShootTracker is left untouched.
          //
          const nonCampaignHolder = await storage.getProjectByCalendarEventId(event.id);
          const calendarEventId = nonCampaignHolder ? null : event.id;

          if (nonCampaignHolder) {
            console.log(
              `🎄 Noël sync: "${event.summary}" calendarEventId owned by another pipeline — ` +
                `creating Noël project without it`
            );
          }

          // dueDate (Sunday of the shoot week) is required by the projects schema
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
            calendarEventId,
            lastSyncedAt: new Date(),
            createdFrom: 'CALENDAR',
            campaignId: campaign.id,
            status: 'ShootDone',
          });

          // Update in-memory lookups so subsequent events in this sync run won't duplicate
          if (calendarEventId) {
            campaignByEventId.set(calendarEventId, { calendarEventId } as any);
          }
          campaignCompoundKeys.add(compoundKey);

          result.created++;
          console.log(
            `🎄 Noël sync: created "${event.summary}" ` +
              `(shoot ${localDateStr(shootDate)}, delivery ${localDateStr(promisedDeliveryDate!)})`
          );
        } catch (err: any) {
          const msg = `Event "${event.summary}": ${err.message}`;
          result.errors.push(msg);
          console.error('🎄 Noël sync error —', msg);
        }
      }
    }

    console.log(
      `✅ Noël sync complete: ${result.created} created, ${result.updated} updated, ` +
        `${result.skipped} skipped, ${result.errors.length} errors`
    );
  } catch (err: any) {
    console.error('❌ Noël sync failed:', err.message);
    result.errors.push(`Sync failed: ${err.message}`);
  }

  return result;
}
