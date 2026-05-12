// Gmail Reply Monitor
// Polls Gmail for incoming client replies and syncs them to the chat system

import { db } from '../db';
import { clientMessages, projects } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { 
  getGmailClient, 
  listEmails, 
  getEmail, 
  parseEmailHeaders, 
  getEmailBody,
  markAsRead 
} from './gmailService';
import { wasGoogleReviewThanksRecentlySent } from './emailService';

// Track processed email IDs to avoid duplicates
const processedEmails = new Set<string>();

// Last sync timestamp
let lastSyncTime: Date | null = null;

// Extract project ID from email subject or thread
// Subject format: "Re: New Message from [Retoucher] - Jepson Myles Studio"
function extractProjectFromEmail(emailData: any): { clientEmail: string; content: string } | null {
  const headers = parseEmailHeaders(emailData);
  const body = getEmailBody(emailData);
  
  // Get the sender email (client replying)
  const fromMatch = headers.from.match(/<([^>]+)>/) || [null, headers.from];
  const clientEmail = fromMatch[1]?.toLowerCase() || headers.from.toLowerCase();
  
  // Get the message content (prefer plain text, strip quoted replies)
  let content = body.plain || '';
  
  if (!content && body.html) {
    // Strip HTML tags for basic text extraction
    content = body.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  // Remove quoted reply content (text after "On ... wrote:")
  const quotedReplyPattern = /On .+wrote:/i;
  const quotedIndex = content.search(quotedReplyPattern);
  if (quotedIndex > 0) {
    content = content.substring(0, quotedIndex).trim();
  }
  
  // Also remove lines starting with ">"
  content = content.split('\n')
    .filter(line => !line.trim().startsWith('>'))
    .join('\n')
    .trim();
  
  if (!content || !clientEmail) {
    return null;
  }
  
  return { clientEmail, content };
}

// Find the project that this email reply belongs to
async function findProjectByClientEmail(clientEmail: string): Promise<string | null> {
  try {
    // Look for recent messages sent to this client email
    const recentMessages = await db
      .select()
      .from(clientMessages)
      .where(eq(clientMessages.senderType, 'editor'))
      .orderBy(desc(clientMessages.createdAt))
      .limit(100);
    
    // Find messages to projects with this client
    for (const msg of recentMessages) {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, msg.projectId))
        .limit(1);
      
      if (project.length > 0) {
        const projectEmail = project[0].clientEmail?.toLowerCase();
        if (projectEmail === clientEmail) {
          return project[0].id;
        }
      }
    }
    
    // Also search projects directly by client email
    const projectsByEmail = await db
      .select()
      .from(projects)
      .limit(100);
    
    for (const p of projectsByEmail) {
      if (p.clientEmail?.toLowerCase() === clientEmail) {
        // Check if there's an active conversation
        const hasMessages = await db
          .select()
          .from(clientMessages)
          .where(eq(clientMessages.projectId, p.id))
          .limit(1);
        
        if (hasMessages.length > 0) {
          return p.id;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[GmailMonitor] Error finding project:', error);
    return null;
  }
}

// Process a single email reply
async function processEmailReply(emailId: string): Promise<boolean> {
  if (processedEmails.has(emailId)) {
    return false;
  }
  
  try {
    const emailData = await getEmail(emailId);
    const parsed = extractProjectFromEmail(emailData);
    
    if (!parsed) {
      console.log(`[GmailMonitor] Could not parse email ${emailId}`);
      processedEmails.add(emailId);
      return false;
    }
    
    // Find the project this reply belongs to
    const projectId = await findProjectByClientEmail(parsed.clientEmail);
    
    if (!projectId) {
      console.log(`[GmailMonitor] No project found for client ${parsed.clientEmail}`);
      processedEmails.add(emailId);
      return false;
    }
    
    // Check if this message already exists (by content similarity)
    const existingMessages = await db
      .select()
      .from(clientMessages)
      .where(
        and(
          eq(clientMessages.projectId, projectId),
          eq(clientMessages.senderType, 'client')
        )
      )
      .orderBy(desc(clientMessages.createdAt))
      .limit(10);
    
    // Simple duplicate check - exact content match
    const isDuplicate = existingMessages.some(
      msg => msg.message.trim() === parsed.content.trim()
    );
    
    if (isDuplicate) {
      console.log(`[GmailMonitor] Duplicate message detected, skipping`);
      processedEmails.add(emailId);
      return false;
    }
    
    // Tag replies that arrive shortly after a Google review thank-you email,
    // so admins can spot warm leads in the inbox.
    const isPostReviewReply = await wasGoogleReviewThanksRecentlySent(projectId);

    // Add the message to the chat
    await db.insert(clientMessages).values({
      projectId,
      message: parsed.content,
      senderType: 'client',
      senderEmail: parsed.clientEmail,
      tag: isPostReviewReply ? 'post_review_reply' : null,
    });
    
    console.log(`[GmailMonitor] Added client reply to project ${projectId}: "${parsed.content.substring(0, 50)}..."`);
    
    // Mark email as read
    await markAsRead(emailId);
    
    processedEmails.add(emailId);
    return true;
  } catch (error) {
    console.error(`[GmailMonitor] Error processing email ${emailId}:`, error);
    processedEmails.add(emailId);
    return false;
  }
}

// Check for new email replies
export async function checkForReplies(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  
  try {
    // Search for unread emails that look like replies to our notifications
    // Filter: unread, in inbox, subject contains "Jepson Myles"
    const query = 'is:unread in:inbox subject:"Jepson Myles"';
    
    const messages = await listEmails(query, 20);
    
    if (messages.length === 0) {
      return { processed: 0, errors: 0 };
    }
    
    console.log(`[GmailMonitor] Found ${messages.length} potential reply emails`);
    
    for (const msg of messages) {
      if (!msg.id) continue;
      
      try {
        const success = await processEmailReply(msg.id);
        if (success) processed++;
      } catch (err) {
        errors++;
        console.error(`[GmailMonitor] Error processing message:`, err);
      }
    }
    
    lastSyncTime = new Date();
    
  } catch (error) {
    console.error('[GmailMonitor] Error checking for replies:', error);
    errors++;
  }
  
  return { processed, errors };
}

// Get the last sync time
export function getLastSyncTime(): Date | null {
  return lastSyncTime;
}

// Start the reply monitor with periodic polling
let monitorInterval: NodeJS.Timeout | null = null;

export function startReplyMonitor(intervalSeconds: number = 30) {
  if (monitorInterval) {
    console.log('[GmailMonitor] Monitor already running');
    return;
  }
  
  console.log(`[GmailMonitor] Starting reply monitor (checking every ${intervalSeconds}s)`);
  
  // Run immediately on start
  checkForReplies().then(result => {
    if (result.processed > 0) {
      console.log(`[GmailMonitor] Initial check: processed ${result.processed} replies`);
    }
  });
  
  // Then run periodically
  monitorInterval = setInterval(async () => {
    const result = await checkForReplies();
    if (result.processed > 0 || result.errors > 0) {
      console.log(`[GmailMonitor] Check complete: ${result.processed} processed, ${result.errors} errors`);
    }
  }, intervalSeconds * 1000);
}

export function stopReplyMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[GmailMonitor] Reply monitor stopped');
  }
}
