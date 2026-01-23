// Gmail Integration Service
// Connected via Replit's Google Mail connector

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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Get list of emails with optional query filter
export async function listEmails(query?: string, maxResults: number = 20) {
  try {
    const gmail = await getGmailClient();
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults
    });
    
    return response.data.messages || [];
  } catch (error) {
    console.error('[Gmail] Error listing emails:', error);
    throw error;
  }
}

// Get full email details by ID
export async function getEmail(messageId: string) {
  try {
    const gmail = await getGmailClient();
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    return response.data;
  } catch (error) {
    console.error('[Gmail] Error getting email:', error);
    throw error;
  }
}

// Parse email headers to get subject, from, to, date
export function parseEmailHeaders(message: any) {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  
  return {
    id: message.id,
    threadId: message.threadId,
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: getHeader('To'),
    date: getHeader('Date'),
    snippet: message.snippet
  };
}

// Get email body (plain text or HTML)
export function getEmailBody(message: any): { plain?: string; html?: string } {
  const payload = message.payload;
  
  if (!payload) return {};
  
  // Simple message with body directly
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    return payload.mimeType === 'text/html' ? { html: decoded } : { plain: decoded };
  }
  
  // Multipart message
  const parts = payload.parts || [];
  let plain: string | undefined;
  let html: string | undefined;
  
  function processParts(parts: any[]) {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plain = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        processParts(part.parts);
      }
    }
  }
  
  processParts(parts);
  return { plain, html };
}

// Get recent emails with parsed content
export async function getRecentEmails(query?: string, maxResults: number = 20) {
  const messages = await listEmails(query, maxResults);
  const emails = [];
  
  for (const msg of messages) {
    const fullMessage = await getEmail(msg.id!);
    const headers = parseEmailHeaders(fullMessage);
    const body = getEmailBody(fullMessage);
    
    emails.push({
      ...headers,
      body
    });
  }
  
  return emails;
}

// Get emails from a specific sender
export async function getEmailsFrom(senderEmail: string, maxResults: number = 20) {
  return getRecentEmails(`from:${senderEmail}`, maxResults);
}

// Get unread emails
export async function getUnreadEmails(maxResults: number = 20) {
  return getRecentEmails('is:unread', maxResults);
}

// Get the authenticated user's email address
export async function getMyEmailAddress(): Promise<string> {
  try {
    const gmail = await getGmailClient();
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return profile.data.emailAddress || '';
  } catch (error) {
    console.error('[Gmail] Error getting email address:', error);
    throw error;
  }
}

// Create a raw email message for Gmail API
function createRawEmail(options: {
  to: string;
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}): string {
  const boundary = `boundary_${Date.now()}`;
  
  let emailLines = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  
  if (options.replyTo) {
    emailLines.push(`Reply-To: ${options.replyTo}`);
  }
  
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      emailLines.push(`${key}: ${value}`);
    }
  }
  
  emailLines.push('');
  emailLines.push(`--${boundary}`);
  emailLines.push('Content-Type: text/html; charset="UTF-8"');
  emailLines.push('Content-Transfer-Encoding: quoted-printable');
  emailLines.push('');
  emailLines.push(options.html);
  emailLines.push(`--${boundary}--`);
  
  const rawEmail = emailLines.join('\r\n');
  
  // Base64url encode the email
  return Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Send an email via Gmail API
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = await getGmailClient();
    const fromEmail = await getMyEmailAddress();
    
    const raw = createRawEmail({
      to: options.to,
      from: `Jepson Myles Studio <${fromEmail}>`,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
      headers: options.headers
    });
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw
      }
    });
    
    console.log(`[Gmail] Email sent successfully to ${options.to}, messageId: ${response.data.id}`);
    return { success: true, messageId: response.data.id || undefined };
  } catch (error: any) {
    console.error('[Gmail] Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Mark an email as read
export async function markAsRead(messageId: string) {
  try {
    const gmail = await getGmailClient();
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });
    console.log(`[Gmail] Marked message ${messageId} as read`);
  } catch (error) {
    console.error('[Gmail] Error marking as read:', error);
    throw error;
  }
}
