import { storage } from '../storage';
import { RewardTier } from '@shared/schema';
import { getGoogleCalendarClient, parseClientNameFromEvent, type CalendarEvent } from './googleCalendar';

interface RewardCalculation {
  clientName: string;
  clientEmail: string;
  totalBookings: number;
  referralMatchCount: number;
  rewardScore: number;
  rewardTier: string;
}

function calculateRewardTier(rewardScore: number): string {
  if (rewardScore >= 25) return RewardTier.DIAMOND;
  if (rewardScore >= 15) return RewardTier.PLATINUM;
  if (rewardScore >= 10) return RewardTier.GOLD;
  if (rewardScore >= 5) return RewardTier.SILVER;
  return RewardTier.BRONZE;
}

function calculateRewardScore(totalBookings: number, referralMatchCount: number): number {
  return totalBookings + (referralMatchCount * 2);
}

async function fetchHistoricalCalendarBookings(yearsBack: number = 2): Promise<CalendarEvent[]> {
  try {
    const calendar = await getGoogleCalendarClient();

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setFullYear(timeMin.getFullYear() - yearsBack);

    console.log(`🎁 [Rewards] Fetching calendar events from ${timeMin.toISOString()} to ${now.toISOString()}`);

    const allEvents: any[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;

    do {
      pageCount++;
      const response: any = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: now.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
        pageToken: pageToken,
      });

      const events = response.data.items || [];
      allEvents.push(...events);
      pageToken = response.data.nextPageToken || undefined;

      console.log(`   🎁 Page ${pageCount}: fetched ${events.length} events (total: ${allEvents.length})`);
    } while (pageToken);

    console.log(`🎁 [Rewards] Total historical events fetched: ${allEvents.length}`);

    return allEvents.map((event: any) => ({
      id: event.id || '',
      summary: event.summary || '',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
    }));
  } catch (error: any) {
    console.error(`❌ [Rewards] Failed to fetch historical calendar data:`, error.message);
    throw error;
  }
}

function normalizeClientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildBookingCountsByClient(events: CalendarEvent[]): Map<string, { name: string; count: number; firstBooking: Date | null; lastBooking: Date | null }> {
  const clientBookings = new Map<string, { name: string; count: number; firstBooking: Date | null; lastBooking: Date | null }>();

  for (const event of events) {
    if (!event.start || isNaN(event.start.getTime())) continue;

    const clientName = parseClientNameFromEvent(event);
    if (!clientName) continue;

    const normalizedName = normalizeClientName(clientName);
    const existing = clientBookings.get(normalizedName);

    if (existing) {
      existing.count++;
      if (event.start && (!existing.firstBooking || event.start < existing.firstBooking)) {
        existing.firstBooking = event.start;
      }
      if (event.start && (!existing.lastBooking || event.start > existing.lastBooking)) {
        existing.lastBooking = event.start;
      }
    } else {
      clientBookings.set(normalizedName, {
        name: clientName,
        count: 1,
        firstBooking: event.start || null,
        lastBooking: event.start || null,
      });
    }
  }

  return clientBookings;
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

    const bookingsByClient = buildBookingCountsByClient(events);
    const referralsByEmail = countReferralMatchesByClient(allReferrals);

    console.log(`🎁 [Rewards] Found ${bookingsByClient.size} unique clients from calendar`);
    console.log(`🎁 [Rewards] Found ${referralsByEmail.size} clients with matched referrals`);

    const profilesByEmail = new Map(existingProfiles.map(p => [p.clientEmail.toLowerCase(), p]));
    const profilesByName = new Map(existingProfiles.map(p => [normalizeClientName(p.clientName), p]));

    const projectsByNormalizedName = new Map<string, string>();
    for (const proj of allProjects) {
      if (proj.clientEmail) {
        projectsByNormalizedName.set(normalizeClientName(proj.clientName), proj.clientEmail);
      }
    }

    for (const [normalizedName, booking] of Array.from(bookingsByClient.entries())) {
      try {
        let profile = profilesByName.get(normalizedName);

        let clientEmail = profile?.clientEmail || '';
        const clientName = profile?.clientName || booking.name;

        if (!clientEmail) {
          clientEmail = projectsByNormalizedName.get(normalizedName) || `${normalizedName.replace(/\s+/g, '.')}@unknown.pending`;
        }

        const referralMatches = referralsByEmail.get(clientEmail.toLowerCase()) || 0;
        const rewardScore = calculateRewardScore(booking.count, referralMatches);
        const rewardTier = calculateRewardTier(rewardScore);

        const calculation: RewardCalculation = {
          clientName,
          clientEmail,
          totalBookings: booking.count,
          referralMatchCount: referralMatches,
          rewardScore,
          rewardTier,
        };

        await storage.upsertClientProfile({
          clientEmail,
          clientName,
          totalBookings: booking.count,
          referralMatchCount: referralMatches,
          rewardScore,
          rewardTier,
          lastRewardSyncAt: new Date(),
          firstProjectAt: booking.firstBooking || undefined,
          lastProjectAt: booking.lastBooking || undefined,
        });

        result.results.push(calculation);
        result.synced++;
      } catch (err: any) {
        result.errors.push(`Client ${booking.name}: ${err.message}`);
      }
    }

    for (const [email, matchCount] of Array.from(referralsByEmail.entries())) {
      const alreadySynced = result.results.some(r => r.clientEmail.toLowerCase() === email);
      if (alreadySynced) continue;

      const profile = profilesByEmail.get(email);
      if (profile) {
        try {
          const rewardScore = calculateRewardScore(profile.totalBookings || 0, matchCount);
          const rewardTier = calculateRewardTier(rewardScore);

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
