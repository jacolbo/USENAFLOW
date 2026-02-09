import { storage } from '../storage';
import { RewardTier, DEFAULT_SHOOTTRACKER_SETTINGS, shoottrackerSettingsSchema } from '@shared/schema';
import { getGoogleCalendarClient, parseClientNameFromEvent, listCalendars, type CalendarEvent } from './googleCalendar';

interface RewardCalculation {
  clientName: string;
  clientEmail: string;
  totalBookings: number;
  referralMatchCount: number;
  rewardScore: number;
  rewardTier: string;
}

function calculateRewardTier(totalBookings: number): string {
  if (totalBookings >= 9) return RewardTier.DIAMOND;
  if (totalBookings >= 6) return RewardTier.PLATINUM;
  if (totalBookings >= 3) return RewardTier.GOLD;
  if (totalBookings >= 2) return RewardTier.SILVER;
  return RewardTier.BRONZE;
}

function calculateRewardScore(totalBookings: number, referralMatchCount: number): number {
  return totalBookings + (referralMatchCount * 2);
}

async function getCalendarIds(): Promise<string[]> {
  try {
    const setting = await storage.getAppSetting("shoottracker_settings");
    if (setting && typeof setting.value === 'object') {
      const merged = { ...DEFAULT_SHOOTTRACKER_SETTINGS, ...setting.value };
      const parsed = shoottrackerSettingsSchema.parse(merged);
      if (parsed.selected_calendar_ids && parsed.selected_calendar_ids.length > 0) {
        console.log(`🎁 [Rewards] Using ${parsed.selected_calendar_ids.length} calendar(s) from ShootTracker settings`);
        return parsed.selected_calendar_ids;
      }
    }
  } catch (e) {
    console.log(`🎁 [Rewards] Could not read ShootTracker settings, will discover calendars`);
  }

  try {
    const calendars = await listCalendars();
    if (calendars.length > 0) {
      const ids = calendars.map(c => c.id);
      console.log(`🎁 [Rewards] Discovered ${ids.length} calendar(s): ${calendars.map(c => c.summary).join(', ')}`);
      return ids;
    }
  } catch (e) {
    console.log(`🎁 [Rewards] Could not list calendars, falling back to 'primary'`);
  }

  return ['primary'];
}

async function fetchMonthChunk(
  calendar: any,
  calendarId: string,
  chunkStart: Date,
  chunkEnd: Date
): Promise<any[]> {
  const events: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response: any = await calendar.events.list({
      calendarId,
      timeMin: chunkStart.toISOString(),
      timeMax: chunkEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken: pageToken,
    });

    const items = response.data.items || [];
    events.push(...items);
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return events;
}

async function fetchHistoricalCalendarBookings(yearsBack: number = 2): Promise<CalendarEvent[]> {
  try {
    const calendar = await getGoogleCalendarClient();
    const calendarIds = await getCalendarIds();

    const now = new Date();
    const startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - yearsBack);

    const months: { start: Date; end: Date }[] = [];
    let cursor = new Date(startDate);
    while (cursor < now) {
      const chunkEnd = new Date(cursor);
      chunkEnd.setMonth(chunkEnd.getMonth() + 1);
      if (chunkEnd > now) chunkEnd.setTime(now.getTime());
      months.push({ start: new Date(cursor), end: new Date(chunkEnd) });
      cursor = new Date(chunkEnd);
    }

    console.log(`🎁 [Rewards] Fetching events from ${calendarIds.length} calendar(s) across ${months.length} month chunks`);
    console.log(`🎁 [Rewards] Date range: ${startDate.toISOString()} to ${now.toISOString()}`);

    const allEvents: any[] = [];
    const seenEventIds = new Set<string>();

    for (const calId of calendarIds) {
      let calendarTotal = 0;
      console.log(`🎁 [Rewards] Fetching from calendar: ${calId}`);

      for (let i = 0; i < months.length; i++) {
        const { start, end } = months[i];
        try {
          const events = await fetchMonthChunk(calendar, calId, start, end);
          for (const evt of events) {
            if (evt.id && !seenEventIds.has(evt.id)) {
              seenEventIds.add(evt.id);
              allEvents.push(evt);
              calendarTotal++;
            }
          }
          if (events.length > 0) {
            console.log(`   🎁 Month ${i + 1}/${months.length} (${start.toISOString().slice(0, 7)}): ${events.length} events`);
          }
        } catch (error: any) {
          console.warn(`   ⚠️ [Rewards] Error fetching month ${start.toISOString().slice(0, 7)} from ${calId}: ${error.message}`);
        }
      }
      console.log(`🎁 [Rewards] Calendar ${calId}: ${calendarTotal} unique events`);
    }

    console.log(`🎁 [Rewards] Total historical events fetched: ${allEvents.length} (from ${calendarIds.length} calendar(s))`);

    return allEvents.map((event: any) => ({
      id: event.id || '',
      summary: event.summary || '',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
      attendeeEmails: (event.attendees || [])
        .map((a: any) => a.email?.toLowerCase())
        .filter((e: string | undefined) => e && !e.includes('calendar.google.com') && !e.includes('group.calendar')),
    }));
  } catch (error: any) {
    console.error(`❌ [Rewards] Failed to fetch historical calendar data:`, error.message);
    throw error;
  }
}

function normalizeClientName(name: string): string {
  let cleaned = name.replace(/\s*\(.*$/, '');
  return cleaned.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+\.]/g, '').replace(/^0+/, '');
}

function extractPhoneNumbers(text: string): string[] {
  if (!text) return [];
  const phoneRegex = /(?:\+?\d{1,3}[\s\-\.]?)?\(?\d{2,4}\)?[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4}/g;
  const matches = text.match(phoneRegex) || [];
  return matches
    .map(m => normalizePhone(m))
    .filter(p => p.length >= 7 && p.length <= 15);
}

function extractEmailAddresses(text: string): string[] {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  return matches
    .map(e => e.toLowerCase().trim())
    .filter(e => !e.includes('calendar.google.com') && !e.includes('group.calendar'));
}

class UnionFind {
  private parent: Map<string, string> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    const keys = Array.from(this.parent.keys());
    for (const key of keys) {
      const root = this.find(key);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(key);
    }
    return groups;
  }
}

interface EventBooking {
  name: string;
  emails: string[];
  phones: string[];
  start: Date;
}

function extractBookingsFromEvents(events: CalendarEvent[]): EventBooking[] {
  const bookings: EventBooking[] = [];

  for (const event of events) {
    if (!event.start || isNaN(event.start.getTime())) continue;

    const clientName = parseClientNameFromEvent(event);
    if (!clientName) continue;

    const normalizedName = normalizeClientName(clientName);
    const skipNames = ['off', 'closed', 'holiday', 'public holiday', 'lunch', 'break', 'meeting', 'staff', 'maintenance', 'no bookings', 'blocked', 'unavailable'];
    if (skipNames.includes(normalizedName)) continue;

    const emails: string[] = [...(event.attendeeEmails || []).filter(Boolean)];
    if (event.description) emails.push(...extractEmailAddresses(event.description));
    if (event.location) emails.push(...extractEmailAddresses(event.location));
    const uniqueEmails = Array.from(new Set(emails));

    const phones: string[] = [];
    if (event.description) phones.push(...extractPhoneNumbers(event.description));
    if (event.location) phones.push(...extractPhoneNumbers(event.location));
    if (event.summary) phones.push(...extractPhoneNumbers(event.summary));
    const uniquePhones = Array.from(new Set(phones));

    bookings.push({
      name: clientName,
      emails: uniqueEmails,
      phones: uniquePhones,
      start: event.start,
    });
  }

  return bookings;
}

interface MergedClient {
  names: string[];
  emails: Set<string>;
  phones: Set<string>;
  count: number;
  firstBooking: Date | null;
  lastBooking: Date | null;
}

function buildMergedClients(
  bookings: EventBooking[],
  projectEmailMap: Map<string, string>,
): MergedClient[] {
  const uf = new UnionFind();
  const nameToKey = new Map<string, string>();
  const emailToKey = new Map<string, string>();
  const phoneToKey = new Map<string, string>();

  for (const booking of bookings) {
    const normName = normalizeClientName(booking.name);
    const nameKey = `name:${normName}`;

    if (!nameToKey.has(normName)) {
      nameToKey.set(normName, nameKey);
    }
    uf.find(nameKey);

    const projectEmail = projectEmailMap.get(normName);
    const allEmails = [...booking.emails];
    if (projectEmail) allEmails.push(projectEmail.toLowerCase());

    for (const email of allEmails) {
      const emailKey = `email:${email}`;
      if (!emailToKey.has(email)) {
        emailToKey.set(email, emailKey);
      }
      uf.find(emailKey);
      uf.union(nameKey, emailKey);
    }

    for (const phone of booking.phones) {
      if (!phone) continue;
      const phoneKey = `phone:${phone}`;
      if (!phoneToKey.has(phone)) {
        phoneToKey.set(phone, phoneKey);
      }
      uf.find(phoneKey);
      uf.union(nameKey, phoneKey);
    }
  }

  const groups = uf.getGroups();

  const clientGroups = new Map<string, MergedClient>();
  for (const booking of bookings) {
    const normName = normalizeClientName(booking.name);
    const nameKey = `name:${normName}`;
    const root = uf.find(nameKey);

    if (!clientGroups.has(root)) {
      clientGroups.set(root, {
        names: [],
        emails: new Set(),
        phones: new Set(),
        count: 0,
        firstBooking: null,
        lastBooking: null,
      });
    }

    const group = clientGroups.get(root)!;
    group.count++;
    if (!group.names.includes(booking.name)) group.names.push(booking.name);
    booking.emails.forEach(e => group.emails.add(e));
    booking.phones.forEach(p => group.phones.add(p));

    const projectEmail = projectEmailMap.get(normName);
    if (projectEmail) group.emails.add(projectEmail.toLowerCase());

    if (booking.start) {
      if (!group.firstBooking || booking.start < group.firstBooking) group.firstBooking = booking.start;
      if (!group.lastBooking || booking.start > group.lastBooking) group.lastBooking = booking.start;
    }
  }

  return Array.from(clientGroups.values());
}

function countReferralMatchesByClient(allReferrals: Array<{ referrerEmail: string; referrerName: string; status: string }>): Map<string, number> {
  const referralCounts = new Map<string, number>();

  for (const ref of allReferrals) {
    if (ref.status === 'completed' || ref.status === 'matched') {
      const key = ref.referrerEmail.toLowerCase();
      referralCounts.set(key, (referralCounts.get(key) || 0) + 1);
    }
  }

  return referralCounts;
}

export async function syncRewards(yearsBack: number = 2): Promise<{
  synced: number;
  errors: string[];
  results: RewardCalculation[];
}> {
  const result = { synced: 0, errors: [] as string[], results: [] as RewardCalculation[] };

  try {
    console.log(`🎁 [Rewards] Starting independent rewards sync (${yearsBack} years back)...`);

    const [events, allReferrals, existingProfiles, allProjects] = await Promise.all([
      fetchHistoricalCalendarBookings(yearsBack),
      storage.getAllReferrals(),
      storage.getAllClientProfiles(),
      storage.getAllProjects(),
    ]);

    const bookings = extractBookingsFromEvents(events);
    const referralsByEmail = countReferralMatchesByClient(allReferrals);

    const projectEmailMap = new Map<string, string>();
    for (const proj of allProjects) {
      const normName = normalizeClientName(proj.clientName);
      if (proj.clientEmail) {
        projectEmailMap.set(normName, proj.clientEmail);
      }
    }

    console.log(`🎁 [Rewards] Extracted ${bookings.length} bookings from ${events.length} events`);
    console.log(`🎁 [Rewards] Found ${referralsByEmail.size} clients with matched referrals`);

    const mergedClients = buildMergedClients(bookings, projectEmailMap);

    console.log(`🎁 [Rewards] Merged into ${mergedClients.length} unique clients (from ${bookings.length} bookings)`);
    const mergesSaved = bookings.length - mergedClients.length;
    if (mergesSaved > 0) {
      console.log(`🎁 [Rewards] Client merging identified ${mergesSaved} duplicate bookings across name/email/phone matches`);
    }

    const profilesByEmail = new Map(existingProfiles.map(p => [p.clientEmail.toLowerCase(), p]));

    const unsubscribedEmails = new Set<string>();
    for (const p of existingProfiles) {
      if (p.unsubscribed && p.clientEmail) {
        const originalEmail = p.clientEmail.replace(/^unsubscribed_\d+_/, '');
        unsubscribedEmails.add(originalEmail.toLowerCase());
      }
    }
    if (unsubscribedEmails.size > 0) {
      console.log(`🎁 [Rewards] Skipping ${unsubscribedEmails.size} unsubscribed email(s)`);
    }

    const processedEmails = new Set<string>();

    for (const client of mergedClients) {
      try {
        const primaryName = client.names[0].replace(/\s*\(.*$/, '').trim();
        const emailArray = Array.from(client.emails);
        const realEmail = emailArray.find(e => !e.includes('@unknown.pending')) || '';
        const normName = normalizeClientName(primaryName);
        const pendingEmail = `${normName.replace(/\s+/g, '.')}@unknown.pending`;

        let clientEmail = realEmail || pendingEmail;

        if (realEmail && unsubscribedEmails.has(realEmail.toLowerCase())) {
          clientEmail = pendingEmail;
        }

        if (realEmail) {
          const existingPending = profilesByEmail.get(pendingEmail);
          if (existingPending) {
            await storage.deleteClientProfileByEmail(pendingEmail);
          }
        }

        if (processedEmails.has(clientEmail.toLowerCase())) continue;
        processedEmails.add(clientEmail.toLowerCase());

        let totalReferralMatches = 0;
        for (const email of emailArray) {
          totalReferralMatches += referralsByEmail.get(email) || 0;
        }

        const rewardScore = calculateRewardScore(client.count, totalReferralMatches);
        const rewardTier = calculateRewardTier(client.count);

        const calculation: RewardCalculation = {
          clientName: primaryName,
          clientEmail,
          totalBookings: client.count,
          referralMatchCount: totalReferralMatches,
          rewardScore,
          rewardTier,
        };

        await storage.upsertClientProfile({
          clientEmail,
          clientName: primaryName,
          totalBookings: client.count,
          referralMatchCount: totalReferralMatches,
          rewardScore,
          rewardTier,
          lastRewardSyncAt: new Date(),
          firstProjectAt: client.firstBooking || undefined,
          lastProjectAt: client.lastBooking || undefined,
        });

        result.results.push(calculation);
        result.synced++;
      } catch (err: any) {
        result.errors.push(`Client ${client.names[0]}: ${err.message}`);
      }
    }

    for (const [email, matchCount] of Array.from(referralsByEmail.entries())) {
      const alreadySynced = result.results.some(r => r.clientEmail.toLowerCase() === email);
      if (alreadySynced) continue;

      const profile = profilesByEmail.get(email);
      if (profile) {
        try {
          const rewardScore = calculateRewardScore(profile.totalBookings || 0, matchCount);
          const rewardTier = calculateRewardTier(profile.totalBookings || 0);

          await storage.upsertClientProfile({
            clientEmail: profile.clientEmail,
            clientName: profile.clientName,
            referralMatchCount: matchCount,
            rewardScore,
            rewardTier,
            lastRewardSyncAt: new Date(),
          });

          result.results.push({
            clientName: profile.clientName,
            clientEmail: profile.clientEmail,
            totalBookings: profile.totalBookings || 0,
            referralMatchCount: matchCount,
            rewardScore,
            rewardTier,
          });
          result.synced++;
        } catch (err: any) {
          result.errors.push(`Referral client ${email}: ${err.message}`);
        }
      }
    }

    console.log(`🎁 [Rewards] Sync complete: ${result.synced} clients updated, ${result.errors.length} errors`);

  } catch (error: any) {
    console.error(`❌ [Rewards] Sync failed:`, error.message);
    result.errors.push(`Sync failed: ${error.message}`);
  }

  return result;
}

export async function getRewardsSummary(): Promise<{
  totalClients: number;
  tierBreakdown: Record<string, number>;
  topClients: Array<{ clientName: string; clientEmail: string; totalBookings: number; referralMatchCount: number; rewardScore: number; rewardTier: string }>;
}> {
  const profiles = await storage.getAllClientProfiles();

  const tierBreakdown: Record<string, number> = {
    [RewardTier.BRONZE]: 0,
    [RewardTier.SILVER]: 0,
    [RewardTier.GOLD]: 0,
    [RewardTier.PLATINUM]: 0,
    [RewardTier.DIAMOND]: 0,
  };

  for (const p of profiles) {
    const tier = p.rewardTier || RewardTier.BRONZE;
    tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1;
  }

  const topClients = profiles
    .filter(p => (p.rewardScore || 0) > 0)
    .sort((a, b) => (b.rewardScore || 0) - (a.rewardScore || 0))
    .slice(0, 20)
    .map(p => ({
      clientName: p.clientName,
      clientEmail: p.clientEmail,
      totalBookings: p.totalBookings || 0,
      referralMatchCount: p.referralMatchCount || 0,
      rewardScore: p.rewardScore || 0,
      rewardTier: p.rewardTier || RewardTier.BRONZE,
    }));

  return {
    totalClients: profiles.length,
    tierBreakdown,
    topClients,
  };
}
