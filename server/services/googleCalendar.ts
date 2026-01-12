import { google, calendar_v3 } from 'googleapis';
import { db } from '../db';
import { appSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
  : 'http://localhost:5000/api/auth/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

let pendingOAuthState: string | null = null;
const STATE_EXPIRY_MS = 10 * 60 * 1000;
let stateCreatedAt: number = 0;

function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthorizationUrl(): string {
  const oauth2Client = getOAuth2Client();
  pendingOAuthState = crypto.randomBytes(32).toString('hex');
  stateCreatedAt = Date.now();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: pendingOAuthState,
  });
}

export function validateOAuthState(state: string): boolean {
  if (!pendingOAuthState || !state) return false;
  if (Date.now() - stateCreatedAt > STATE_EXPIRY_MS) {
    pendingOAuthState = null;
    return false;
  }
  const isValid = state === pendingOAuthState;
  if (isValid) {
    pendingOAuthState = null;
  }
  return isValid;
}

export async function handleAuthCallback(code: string): Promise<void> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  
  await db.insert(appSettings)
    .values({
      key: 'google_oauth_tokens',
      value: tokens,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: tokens,
        updatedAt: new Date(),
      },
    });
}

async function getStoredTokens(): Promise<any | null> {
  const result = await db.select()
    .from(appSettings)
    .where(eq(appSettings.key, 'google_oauth_tokens'))
    .limit(1);
  
  return result[0]?.value || null;
}

export async function isGoogleConnected(): Promise<boolean> {
  try {
    const tokens = await getStoredTokens();
    return !!tokens?.refresh_token;
  } catch {
    return false;
  }
}

export async function getGoogleCalendarClient(): Promise<calendar_v3.Calendar> {
  const tokens = await getStoredTokens();
  
  if (!tokens) {
    throw new Error('Google Calendar not connected. Please authorize access first.');
  }
  
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  
  oauth2Client.on('tokens', async (newTokens) => {
    const currentTokens = await getStoredTokens();
    const updatedTokens = { ...currentTokens, ...newTokens };
    
    await db.insert(appSettings)
      .values({
        key: 'google_oauth_tokens',
        value: updatedTokens,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: updatedTokens,
          updatedAt: new Date(),
        },
      });
  });
  
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
}

export async function fetchCalendarEvents(
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date
): Promise<CalendarEvent[]> {
  try {
    const calendar = await getGoogleCalendarClient();
    
    const now = new Date();
    const defaultTimeMin = timeMin || now;
    const defaultTimeMax = timeMax || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    const response = await calendar.events.list({
      calendarId,
      timeMin: defaultTimeMin.toISOString(),
      timeMax: defaultTimeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const events = response.data.items || [];
    
    return events.map(event => ({
      id: event.id || '',
      summary: event.summary || '',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
    }));
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

export async function listCalendars(): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  try {
    const calendar = await getGoogleCalendarClient();
    const response = await calendar.calendarList.list();
    
    return (response.data.items || []).map(cal => ({
      id: cal.id || '',
      summary: cal.summary || '',
      primary: cal.primary || false,
    }));
  } catch (error) {
    console.error('Error listing calendars:', error);
    throw error;
  }
}

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
    if (match) {
      return (match[1] || match[2] || '').trim();
    }
  }
  
  return summary.trim();
}

export function calculateDeliveryDueDate(shootDate: Date, turnaroundDays: number = 14): Date {
  const deliveryDate = new Date(shootDate);
  deliveryDate.setDate(deliveryDate.getDate() + turnaroundDays);
  return deliveryDate;
}
