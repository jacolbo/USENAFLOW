import { ReplitConnectors } from '@replit/connectors-sdk';
import { hasOwnGoogleCredentials, googleApiGet } from './googleAuth';

// Google Calendar integration.
//
// With first-party OAuth configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
// GOOGLE_REFRESH_TOKEN) this talks to the Calendar REST API directly. Without
// it, the original @replit/connectors-sdk proxy is used unchanged, so
// behaviour on Replit is identical until those variables are set.

// ─── Proxy helper ─────────────────────────────────────────────────────────────

async function calendarProxy(path: string): Promise<any> {
  if (hasOwnGoogleCredentials()) {
    return googleApiGet('google-calendar', path);
  }

  // Replit connector fallback. Do NOT cache the connectors instance; the SDK
  // injects and refreshes the OAuth token per call.
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy('google-calendar', path, { method: 'GET' });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Google Calendar API error ${response.status}: ${body}`);
  }
  return response.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendeeEmails?: string[];
}

export interface CalendarListItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
}

// ─── listCalendars ────────────────────────────────────────────────────────────

export async function listCalendars(): Promise<CalendarListItem[]> {
  try {
    const data = await calendarProxy('/calendar/v3/users/me/calendarList');
    const calendars: any[] = data.items || [];

    console.log(`📋 Found ${calendars.length} calendars:`);
    calendars.forEach(cal => {
      console.log(
        `   - ${cal.summary} (${cal.id})${cal.primary ? ' [PRIMARY]' : ''} accessRole: ${cal.accessRole}`
      );
    });

    return calendars.map(cal => ({
      id: cal.id || '',
      summary: cal.summary || 'Untitled Calendar',
      description: cal.description || undefined,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor || undefined,
    }));
  } catch (error: any) {
    console.error('Error listing calendars:', error.message);
    throw new Error(`Google Calendar not connected`);
  }
}

// ─── fetchCalendarEvents ──────────────────────────────────────────────────────

export async function fetchCalendarEvents(
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date
): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const tMin = (timeMin || now).toISOString();
    const tMax = (timeMax || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)).toISOString();

    console.log(`📅 Fetching events from calendar: ${calendarId}`);
    console.log(`   Time range: ${tMin} to ${tMax}`);

    const encodedId = encodeURIComponent(calendarId);
    const allEvents: any[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      const qs = new URLSearchParams({
        timeMin: tMin,
        timeMax: tMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '2500',
        ...(pageToken ? { pageToken } : {}),
      });

      const data = await calendarProxy(`/calendar/v3/calendars/${encodedId}/events?${qs}`);
      const events: any[] = data.items || [];
      allEvents.push(...events);
      pageToken = data.nextPageToken || undefined;

      console.log(`   Page ${pageCount}: fetched ${events.length} events (total: ${allEvents.length})`);
    } while (pageToken);

    console.log(`   Total: ${allEvents.length} events from ${calendarId}`);
    if (allEvents.length > 0) {
      console.log(`   Sample events: ${allEvents.slice(0, 3).map(e => e.summary).join(', ')}`);
    }

    return allEvents.map(event => ({
      id: event.id || '',
      summary: event.summary || '',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
      attendeeEmails: (event.attendees || [])
        .map((a: any) => a.email?.toLowerCase())
        .filter(
          (e: string | undefined) =>
            e && !e.includes('calendar.google.com') && !e.includes('group.calendar')
        ),
    }));
  } catch (error: any) {
    console.error(`❌ Error fetching calendar ${calendarId}:`, error.message);
    throw error;
  }
}

// ─── Utility exports (unchanged — used by ShootTracker and calendarSync) ──────

export function parseClientNameFromEvent(event: CalendarEvent): string | null {
  const summary = event.summary;
  if (!summary) return null;

  const patterns = [
    /^(.+?)\s*[-–—]\s*(shoot|session|portrait|wedding|event)/i,
    /^(shoot|session|client|booking)[:]\s*(.+)/i,
    /^(.+?)\s+(shoot|session|portrait|wedding|event)/i,
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) return (match[1] || match[2] || '').trim();
  }

  return summary.trim();
}

export function calculateDeliveryDueDate(shootDate: Date, turnaroundDays: number = 14): Date {
  const deliveryDate = new Date(shootDate);
  deliveryDate.setDate(deliveryDate.getDate() + turnaroundDays);
  return deliveryDate;
}

// ─── Legacy export — kept for any callers that imported getGoogleCalendarClient ─

export async function getGoogleCalendarClient() {
  throw new Error(
    'getGoogleCalendarClient() is deprecated — use listCalendars() or fetchCalendarEvents() directly'
  );
}
