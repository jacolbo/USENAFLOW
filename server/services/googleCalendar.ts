import { google } from 'googleapis';

// Google Calendar integration - uses Replit Connectors
let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    console.log('📅 Using cached access token');
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  
  console.log('📅 [DEBUG] Environment check:');
  console.log(`   - REPLIT_DEPLOYMENT: ${process.env.REPLIT_DEPLOYMENT || 'not set'}`);
  console.log(`   - Is Production: ${isProduction}`);
  console.log(`   - REPLIT_CONNECTORS_HOSTNAME: ${hostname || 'not set'}`);
  console.log(`   - REPL_IDENTITY exists: ${!!process.env.REPL_IDENTITY}`);
  console.log(`   - WEB_REPL_RENEWAL exists: ${!!process.env.WEB_REPL_RENEWAL}`);
  
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    console.error('📅 [ERROR] Neither REPL_IDENTITY nor WEB_REPL_RENEWAL found');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  console.log(`📅 Fetching fresh access token from Replit connector (token type: ${xReplitToken.substring(0, 4)}...)...`);
  
  const url = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar';
  console.log(`📅 [DEBUG] Connector API URL: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });
  
  console.log(`📅 [DEBUG] Connector API response status: ${response.status} ${response.statusText}`);
  
  const data = await response.json();
  
  console.log(`📅 [DEBUG] Connector API response structure:`);
  console.log(`   - Has items array: ${!!data.items}`);
  console.log(`   - Items count: ${data.items?.length || 0}`);
  
  if (data.items && data.items.length > 0) {
    console.log(`📅 [DEBUG] First connection:`);
    console.log(`   - Has settings: ${!!data.items[0]?.settings}`);
    console.log(`   - Has access_token: ${!!data.items[0]?.settings?.access_token}`);
    console.log(`   - Has oauth.credentials: ${!!data.items[0]?.settings?.oauth?.credentials}`);
  } else {
    console.log(`📅 [DEBUG] Raw response (first 500 chars): ${JSON.stringify(data).substring(0, 500)}`);
  }
  
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    console.error('📅 No connection found or no access token');
    console.error('📅 [DEBUG] This typically means:');
    console.error('   1. Google Calendar connector is not set up for this environment');
    console.error('   2. For production: Check Deployment > Advanced settings > Connectors');
    console.error('   3. The connector authorization may have expired');
    throw new Error('Google Calendar not connected');
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
    
    const allEvents: any[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    
    do {
      pageCount++;
      const response: any = await calendar.events.list({
        calendarId,
        timeMin: defaultTimeMin.toISOString(),
        timeMax: defaultTimeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
        pageToken: pageToken,
      });

      const events = response.data.items || [];
      allEvents.push(...events);
      pageToken = response.data.nextPageToken || undefined;
      
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
