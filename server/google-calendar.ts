// Google Calendar integration using Replit connector
// Integration: connection:conn_google-calendar_01KB4AWJ8DWK9TMN9F231ZR5S7

import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  const calendar = await getUncachableGoogleCalendarClient();
  const response = await calendar.calendarList.list();
  
  return (response.data.items || []).map(cal => ({
    id: cal.id || '',
    summary: cal.summary || 'Unnamed Calendar',
    description: cal.description,
    primary: cal.primary,
  }));
}

export async function getEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  timeZone: string = 'Africa/Johannesburg'
): Promise<CalendarEvent[]> {
  const calendar = await getUncachableGoogleCalendarClient();
  
  const allEvents: any[] = [];
  let pageToken: string | undefined;
  
  do {
    const response = await calendar.events.list({
      calendarId,
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      timeZone,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken,
    });
    
    if (response.data.items) {
      allEvents.push(...response.data.items);
    }
    
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  
  return allEvents.map(event => ({
    id: event.id || '',
    title: event.summary || 'Untitled Event',
    startTime: event.start?.dateTime || event.start?.date || '',
    endTime: event.end?.dateTime || event.end?.date || '',
    description: event.description || '',
  }));
}

export async function getEventsFromMultipleCalendars(
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
  timeZone: string = 'Africa/Johannesburg'
): Promise<CalendarEvent[]> {
  const allEvents: CalendarEvent[] = [];
  
  for (const calendarId of calendarIds) {
    try {
      const events = await getEvents(calendarId, timeMin, timeMax, timeZone);
      allEvents.push(...events);
    } catch (error) {
      console.error(`Error fetching events from calendar ${calendarId}:`, error);
    }
  }
  
  // Sort by start time
  allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  
  return allEvents;
}

export function filterEvents(
  events: CalendarEvent[],
  exclusionKeywords: string[],
  cancelKeywords: string[]
): { validEvents: CalendarEvent[]; cancelledEvents: CalendarEvent[] } {
  const validEvents: CalendarEvent[] = [];
  const cancelledEvents: CalendarEvent[] = [];
  
  for (const event of events) {
    const titleUpper = event.title.toUpperCase();
    
    // Check if event should be excluded entirely
    if (exclusionKeywords.some(keyword => titleUpper.includes(keyword.toUpperCase()))) {
      continue;
    }
    
    // Check if event is marked as cancelled
    if (cancelKeywords.some(keyword => titleUpper.includes(keyword.toUpperCase()))) {
      cancelledEvents.push(event);
      continue;
    }
    
    validEvents.push(event);
  }
  
  return { validEvents, cancelledEvents };
}

export function calculateDueDate(shootDate: Date, turnaroundDays: number): Date {
  const dueDate = new Date(shootDate);
  let daysAdded = 0;
  
  while (daysAdded < turnaroundDays) {
    dueDate.setDate(dueDate.getDate() + 1);
    const dayOfWeek = dueDate.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  return dueDate;
}
