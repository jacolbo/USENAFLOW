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

export async function listCalendars() {
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
) {
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
