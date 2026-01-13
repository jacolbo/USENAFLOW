import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    console.log('📅 Using cached access token');
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!token) {
    throw new Error('Replit token not found - ensure REPL_IDENTITY is set');
  }

  console.log('📅 Fetching fresh access token from Replit connector...');
  
  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': token
      }
    }
  );
  
  const data = await response.json();
  console.log('📅 Connector response keys:', Object.keys(data));
  
  // Try different response structures
  connectionSettings = data.connections?.[0] || data.items?.[0] || data[0];
  
  if (!connectionSettings) {
    console.error('📅 No connection found in response:', JSON.stringify(data).slice(0, 500));
    throw new Error('Google Calendar not connected - no connection found');
  }
  
  console.log('📅 Connection settings keys:', Object.keys(connectionSettings));
  console.log('📅 Settings keys:', connectionSettings.settings ? Object.keys(connectionSettings.settings) : 'no settings');

  const accessToken = connectionSettings.settings?.access_token || 
                      connectionSettings.settings?.oauth?.credentials?.access_token ||
                      connectionSettings.access_token;

  if (!accessToken) {
    console.error('📅 No access token found in settings');
    throw new Error('Google Calendar not connected - no access token');
  }
  
  console.log('📅 Access token retrieved successfully');
  return accessToken;
}

export async function getGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
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
    const defaultTimeMax = timeMax || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days ahead
    
    console.log(`📅 Fetching events from calendar: ${calendarId}`);
    console.log(`   Time range: ${defaultTimeMin.toISOString()} to ${defaultTimeMax.toISOString()}`);
    
    const response = await calendar.events.list({
      calendarId,
      timeMin: defaultTimeMin.toISOString(),
      timeMax: defaultTimeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const events = response.data.items || [];
    console.log(`   Found ${events.length} events in ${calendarId}`);
    
    if (events.length > 0) {
      console.log(`   Sample events: ${events.slice(0, 3).map(e => e.summary).join(', ')}`);
    }
    
    return events.map(event => ({
      id: event.id || '',
      summary: event.summary || '',
      description: event.description || undefined,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location || undefined,
    }));
  } catch (error: any) {
    console.error(`❌ Error fetching calendar ${calendarId}:`, error.message);
    if (error.response?.data) {
      console.error('   API Error:', JSON.stringify(error.response.data));
    }
    throw error;
  }
}

export function parseClientNameFromEvent(event: CalendarEvent): string | null {
  const summary = event.summary;
  if (!summary) return null;
  
  // Common patterns for photography shoots:
  // "John Smith - Wedding Shoot"
  // "Smith Family Portrait"
  // "Shoot: Jane Doe"
  // "Client: ABC Company"
  
  // Try to extract client name from summary
  const patterns = [
    /^(.+?)\s*[-–—]\s*(shoot|session|portrait|wedding|event)/i,
    /^(shoot|session|client|booking)[:]\s*(.+)/i,
    /^(.+?)\s+(shoot|session|portrait|wedding|event)/i,
  ];
  
  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) {
      // Return the client name part (group 1 or 2 depending on pattern)
      return (match[1] || match[2] || '').trim();
    }
  }
  
  // If no pattern matches, return the whole summary as potential client name
  return summary.trim();
}

export function calculateDeliveryDueDate(shootDate: Date, turnaroundDays: number = 14): Date {
  const deliveryDate = new Date(shootDate);
  deliveryDate.setDate(deliveryDate.getDate() + turnaroundDays);
  return deliveryDate;
}

export interface CalendarListItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
}

export async function listCalendars(): Promise<CalendarListItem[]> {
  try {
    const calendar = await getGoogleCalendarClient();
    const response = await calendar.calendarList.list();
    
    const calendars = response.data.items || [];
    
    console.log(`📋 Found ${calendars.length} calendars:`);
    calendars.forEach(cal => {
      console.log(`   - ${cal.summary} (${cal.id})${cal.primary ? ' [PRIMARY]' : ''} accessRole: ${cal.accessRole}`);
    });
    
    return calendars.map(cal => ({
      id: cal.id || '',
      summary: cal.summary || 'Untitled Calendar',
      description: cal.description || undefined,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor || undefined,
    }));
  } catch (error) {
    console.error('Error listing calendars:', error);
    throw error;
  }
}
