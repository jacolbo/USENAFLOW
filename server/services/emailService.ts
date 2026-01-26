// Email service using Gmail and Resend integration
import { Resend } from 'resend';
import { db } from '../db';
import { emailLogs, projects, EmailType, type EmailTypeValue } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { formatDateYMD } from './shoottrackerEngine';
import { sendEmail as sendGmailEmail, getMyEmailAddress } from './gmailService';

let connectionSettings: any;

// Get the base URL for email links - uses APP_URL in production, falls back to dev domain
function getAppBaseUrl(): string {
  // First check for explicit APP_URL (recommended for production)
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  // Fall back to development domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // Default fallback
  return 'http://localhost:5000';
}

async function getCredentials() {
  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  
  console.log(`[Resend] Getting credentials (deployment: ${isDeployment})`);
  
  // First, check for direct RESEND_API_KEY secret (fallback for production)
  if (process.env.RESEND_API_KEY) {
    console.log('[Resend] Using RESEND_API_KEY environment variable');
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: 'Jepson Myles Studio <studio@email.jepsonmyles.co.za>'
    };
  }
  
  // Try connector API
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  console.log(`[Resend] Environment check:`);
  console.log(`  - REPLIT_DEPLOYMENT: ${process.env.REPLIT_DEPLOYMENT || 'not set'}`);
  console.log(`  - REPLIT_CONNECTORS_HOSTNAME: ${hostname || 'not set'}`);
  console.log(`  - REPL_IDENTITY exists: ${!!process.env.REPL_IDENTITY}`);
  console.log(`  - WEB_REPL_RENEWAL exists: ${!!process.env.WEB_REPL_RENEWAL}`);
  console.log(`  - Token type: ${xReplitToken ? xReplitToken.substring(0, 10) + '...' : 'none'}`);

  if (!xReplitToken) {
    throw new Error('[Resend] X_REPLIT_TOKEN not found - neither REPL_IDENTITY nor WEB_REPL_RENEWAL is set. Add RESEND_API_KEY secret as fallback.');
  }

  try {
    const url = `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`;
    console.log(`[Resend] Fetching credentials from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });
    
    console.log(`[Resend] Connector API response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Resend] Connector API error: ${errorText}`);
      throw new Error(`Connector API returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[Resend] Connector API response structure:`);
    console.log(`  - Has items array: ${!!data.items}`);
    console.log(`  - Items count: ${data.items?.length || 0}`);
    
    connectionSettings = data.items?.[0];
    
    if (connectionSettings) {
      console.log(`[Resend] First connection:`);
      console.log(`  - Has settings: ${!!connectionSettings.settings}`);
      console.log(`  - Has api_key: ${!!connectionSettings.settings?.api_key}`);
    }

    if (!connectionSettings || (!connectionSettings.settings?.api_key)) {
      console.error('[Resend] Connector returned no API key. Please add RESEND_API_KEY secret as fallback.');
      throw new Error('Resend connector returned no API key');
    }
    
    console.log('[Resend] Successfully retrieved credentials from connector');
    return {
      apiKey: connectionSettings.settings.api_key, 
      fromEmail: connectionSettings.settings.from_email
    };
  } catch (error: any) {
    console.error(`[Resend] Failed to get credentials from connector: ${error.message}`);
    throw new Error(`Resend not connected: ${error.message}. Add RESEND_API_KEY secret as fallback.`);
  }
}

// WARNING: Never cache this client - tokens expire
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  // Use verified domain email for sending (email.jepsonmyles.co.za)
  const verifiedFromEmail = 'Jepson Myles Studio <studio@email.jepsonmyles.co.za>';
  return {
    client: new Resend(apiKey),
    fromEmail: verifiedFromEmail
  };
}

// Generate project-specific reply-to address for Resend inbound emails
export function getProjectReplyToEmail(projectId: string): string {
  return `reply+${projectId}@email.jepsonmyles.co.za`;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function logEmail(
  projectId: string | null,
  emailType: EmailTypeValue,
  recipientEmail: string,
  subject: string,
  status: 'sent' | 'failed',
  messageId?: string,
  errorMessage?: string
) {
  try {
    await db.insert(emailLogs).values({
      projectId,
      emailType,
      recipientEmail,
      subject,
      status,
      resendMessageId: messageId,
      errorMessage,
    });
  } catch (error) {
    console.error('Failed to log email:', error);
  }
}

// Extract email from calendar event description
export function extractEmailFromDescription(description: string): string | null {
  if (!description) return null;
  
  // Common email patterns in calendar notes
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = description.match(emailPattern);
  
  if (matches && matches.length > 0) {
    // Return the first email found
    return matches[0].toLowerCase();
  }
  
  return null;
}

// Format date for display in emails
function formatDateForEmail(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-ZA', options);
}

// Get the logo URL for emails
function getLogoUrl(): string {
  // Use the app's public route to serve the logo (handles auth properly)
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/public/jepson-myles-logo.png`;
}

// Generate email header with logo
function getEmailHeader(subtitle: string = ''): string {
  const logoUrl = getLogoUrl();
  const baseUrl = getAppBaseUrl();
  
  if (logoUrl) {
    return `
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${baseUrl}" style="text-decoration: none;">
          <img src="${logoUrl}" alt="Jepson Myles Studio" style="max-width: 200px; height: auto; margin-bottom: 10px;" />
        </a>
        ${subtitle ? `<p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">${subtitle}</p>` : ''}
      </div>
    `;
  }
  
  // Fallback to text header if no logo
  return `
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="${baseUrl}" style="text-decoration: none;">
        <h1 style="color: #1a1a1a; margin: 0; font-size: 28px;">Jepson Myles Studio</h1>
      </a>
      ${subtitle ? `<p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">${subtitle}</p>` : ''}
    </div>
  `;
}

// Calculate delivery week text (e.g., "Week of January 20, 2025")
function getDeliveryWeekText(deliveryDueDate: Date): string {
  // Get start of week (Monday)
  const weekStart = new Date(deliveryDueDate);
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + diff);
  
  const options: Intl.DateTimeFormatOptions = { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  };
  
  return `Week of ${weekStart.toLocaleDateString('en-ZA', options)}`;
}

// Email 1: Delivery Estimate Email
// Sent when calendar event is synced - lets client know expected delivery week
export async function sendDeliveryEstimateEmail(
  clientEmail: string,
  clientName: string,
  shootDate: Date,
  deliveryDueDate: Date,
  projectId: string
): Promise<EmailResult> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const subject = `Your Photo Delivery Estimate - ${clientName}`;
    const deliveryWeek = getDeliveryWeekText(deliveryDueDate);
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${getEmailHeader('Photo Delivery Estimate')}
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Dear ${clientName},
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Thank you for your session with us on <strong>${formatDateForEmail(shootDate)}</strong>!
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We wanted to let you know that your beautifully retouched photos are scheduled to be ready during the <strong>${deliveryWeek}</strong>.
        </p>
        
        <div style="background: #f8f8f8; border-left: 4px solid #e91e63; padding: 15px 20px; margin: 25px 0;">
          <p style="color: #333; font-size: 14px; margin: 0;">
            <strong>Shoot Date:</strong> ${formatDateForEmail(shootDate)}<br>
            <strong>Expected Delivery:</strong> ${deliveryWeek}
          </p>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          This estimate accounts for 20 working days (excluding weekends and public holidays). If any changes occur, we'll keep you updated.
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We can't wait to share the final results with you!
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Warm regards,<br>
          <strong>The Jepson Myles Studio Team</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated message from Jepson Myles Studio.
        </p>
      </div>
    `;

    const replyTo = getProjectReplyToEmail(projectId);
    const response = await client.emails.send({
      from: fromEmail,
      replyTo: replyTo,
      to: clientEmail,
      subject,
      html: htmlContent,
    });

    if (response.data?.id) {
      await logEmail(projectId, EmailType.DELIVERY_ESTIMATE, clientEmail, subject, 'sent', response.data.id);
      
      // Update project to mark email as sent
      await db.update(projects)
        .set({ deliveryEstimateEmailSentAt: new Date() })
        .where(eq(projects.id, projectId));
      
      return { success: true, messageId: response.data.id };
    } else {
      const errorMsg = response.error?.message || 'Unknown error';
      await logEmail(projectId, EmailType.DELIVERY_ESTIMATE, clientEmail, subject, 'failed', undefined, errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (error: any) {
    const errorMsg = error.message || 'Failed to send email';
    const fallbackSubject = `Your Photo Delivery Estimate - ${clientName}`;
    await logEmail(projectId, EmailType.DELIVERY_ESTIMATE, clientEmail, fallbackSubject, 'failed', undefined, errorMsg);
    console.error('Failed to send delivery estimate email:', error);
    return { success: false, error: errorMsg };
  }
}

// Email 2: Project Added Email
// Sent when project is added to USENA Flow with package/selected count
export async function sendProjectAddedEmail(
  clientEmail: string,
  clientName: string,
  packageCount: number,
  selectedCount: number,
  extras: number,
  projectId: string,
  approvalToken: string
): Promise<EmailResult> {
  const subject = `Your Photo Selection Confirmation - ${clientName}`;
  
  try {
    const { client, fromEmail } = await getResendClient();
    
    const hasExtras = extras > 0;
    const baseUrl = getAppBaseUrl();
    
    const approvalUrl = `${baseUrl}/approve-extras/${approvalToken}`;
    
    let extrasSection = '';
    if (hasExtras) {
      extrasSection = `
        <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px 20px; margin: 25px 0;">
          <h3 style="color: #e65100; margin: 0 0 10px 0;">Additional Photos Selected!</h3>
          <p style="color: #333; font-size: 14px; margin: 0 0 15px 0;">
            You have selected <strong>${extras} extra photos</strong> beyond your package. To proceed with retouching these additional photos, please approve below:
          </p>
          <a href="${approvalUrl}" style="display: inline-block; background: #e91e63; color: white; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold;">
            Approve Extra Photos
          </a>
        </div>
      `;
    }
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${getEmailHeader('Photo Selection Confirmation')}
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Dear ${clientName},
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Your photo project has been added to our workflow system. Here are the details:
        </p>
        
        <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Package Photos:</td>
              <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${packageCount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Photos Selected:</td>
              <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${selectedCount}</td>
            </tr>
            ${hasExtras ? `
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 8px 0; color: #e65100; font-weight: bold;">Extra Photos:</td>
              <td style="padding: 8px 0; color: #e65100; font-weight: bold; text-align: right;">+${extras}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        ${extrasSection}
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Our talented retouchers will begin working on your photos shortly. You'll receive an update when they're ready for delivery.
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Warm regards,<br>
          <strong>The Jepson Myles Studio Team</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated message from Jepson Myles Studio.
        </p>
      </div>
    `;

    const replyTo = getProjectReplyToEmail(projectId);
    const response = await client.emails.send({
      from: fromEmail,
      replyTo: replyTo,
      to: clientEmail,
      subject,
      html: htmlContent,
    });

    if (response.data?.id) {
      await logEmail(projectId, EmailType.PROJECT_ADDED, clientEmail, subject, 'sent', response.data.id);
      
      // Update project to mark email as sent
      await db.update(projects)
        .set({ projectAddedEmailSentAt: new Date() })
        .where(eq(projects.id, projectId));
      
      return { success: true, messageId: response.data.id };
    } else {
      const errorMsg = response.error?.message || 'Unknown error';
      await logEmail(projectId, EmailType.PROJECT_ADDED, clientEmail, subject, 'failed', undefined, errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (error: any) {
    const errorMsg = error.message || 'Failed to send email';
    await logEmail(projectId, EmailType.PROJECT_ADDED, clientEmail, subject, 'failed', undefined, errorMsg);
    console.error('Failed to send project added email:', error);
    return { success: false, error: errorMsg };
  }
}

// Email 3: Chat Link Email
// Sent to give client access to chat with their assigned retoucher
export async function sendChatLinkEmail(
  clientEmail: string,
  clientName: string,
  retoucherName: string,
  projectId: string,
  chatToken: string
): Promise<EmailResult> {
  const subject = `Connect with Your Retoucher - ${clientName}`;
  
  try {
    const { client, fromEmail } = await getResendClient();
    
    const baseUrl = getAppBaseUrl();
    
    const chatUrl = `${baseUrl}/client-chat/${chatToken}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${getEmailHeader('Direct Communication')}
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Dear ${clientName},
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          You now have a direct line to communicate with <strong>${retoucherName}</strong>, the talented retoucher assigned to your project!
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Use the link below to chat about your photos, provide feedback, or ask questions:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${chatUrl}" style="display: inline-block; background: #25d366; color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">
            Chat with your retoucher
          </a>
        </div>
        
        <div style="background: #f0f0f0; border-radius: 8px; padding: 15px 20px; margin: 25px 0;">
          <p style="color: #666; font-size: 14px; margin: 0;">
            <strong>How it works:</strong><br>
            Simply enter your email address (${clientEmail}) to verify your identity and start chatting.
          </p>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We're excited to collaborate with you on creating the perfect final images!
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Warm regards,<br>
          <strong>The Jepson Myles Studio Team</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated message from Jepson Myles Studio.
        </p>
      </div>
    `;

    const replyTo = getProjectReplyToEmail(projectId);
    const response = await client.emails.send({
      from: fromEmail,
      replyTo: replyTo,
      to: clientEmail,
      subject,
      html: htmlContent,
    });

    if (response.data?.id) {
      await logEmail(projectId, EmailType.CHAT_LINK, clientEmail, subject, 'sent', response.data.id);
      return { success: true, messageId: response.data.id };
    } else {
      const errorMsg = response.error?.message || 'Unknown error';
      await logEmail(projectId, EmailType.CHAT_LINK, clientEmail, subject, 'failed', undefined, errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (error: any) {
    const errorMsg = error.message || 'Failed to send email';
    await logEmail(projectId, EmailType.CHAT_LINK, clientEmail, subject, 'failed', undefined, errorMsg);
    console.error('Failed to send chat link email:', error);
    return { success: false, error: errorMsg };
  }
}

// Message type for conversation thread
interface ThreadMessage {
  content: string;
  senderType: 'editor' | 'client';
  sentAt: Date;
  senderName?: string;
}

// Email 4: New Message Notification with Conversation Thread
// Sent to client when retoucher sends them a message - includes full conversation history
// Uses Resend API for sending
export async function sendMessageNotificationEmail(
  clientEmail: string,
  clientName: string,
  retoucherName: string,
  projectId: string,
  newMessage: string,
  chatToken: string,
  conversationThread: ThreadMessage[] = []
): Promise<EmailResult> {
  const subject = `New Message from ${retoucherName} - Jepson Myles Studio`;
  
  try {
    // Get Resend client
    const { client, fromEmail } = await getResendClient();
    
    const baseUrl = getAppBaseUrl();
    
    const chatUrl = `${baseUrl}/client-chat/${chatToken}`;
    
    // Format date/time for messages
    const formatMessageTime = (date: Date): string => {
      return new Date(date).toLocaleString('en-ZA', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };
    
    // Build conversation thread HTML (oldest to newest, excluding the newest message which is shown separately)
    let threadHtml = '';
    if (conversationThread.length > 1) {
      // Exclude the last message (it's the new one we're notifying about)
      const previousMessages = conversationThread.slice(0, -1);
      
      if (previousMessages.length > 0) {
        threadHtml = `
          <div style="margin: 25px 0; padding: 15px; background: #fafafa; border-radius: 8px;">
            <p style="color: #666; font-size: 12px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px;">Previous Messages</p>
            ${previousMessages.map(msg => {
              const isEditor = msg.senderType === 'editor';
              const senderLabel = isEditor ? (msg.senderName || retoucherName) : clientName;
              const bgColor = isEditor ? '#e8f5e9' : '#e3f2fd';
              const borderColor = isEditor ? '#4caf50' : '#2196f3';
              
              return `
                <div style="margin-bottom: 12px; padding: 12px 15px; background: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: 0 6px 6px 0;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-weight: bold; color: #333; font-size: 13px;">${senderLabel}</span>
                    <span style="color: #999; font-size: 11px;">${formatMessageTime(msg.sentAt)}</span>
                  </div>
                  <p style="color: #333; font-size: 14px; line-height: 1.5; margin: 0;">${msg.content}</p>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${getEmailHeader('New Message')}
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi ${clientName},
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          <strong>${retoucherName}</strong> has sent you a new message about your project:
        </p>
        
        <div style="background: #e8f5e9; border-left: 4px solid #25d366; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <div style="margin-bottom: 8px;">
            <span style="font-weight: bold; color: #333; font-size: 14px;">${retoucherName}</span>
            <span style="color: #999; font-size: 12px; margin-left: 10px;">Just now</span>
          </div>
          <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0;">
            ${newMessage}
          </p>
        </div>
        
        ${threadHtml}
        
        <div style="background: #f0f7ff; border-radius: 8px; padding: 15px 20px; margin: 25px 0;">
          <p style="color: #333; font-size: 14px; margin: 0 0 10px 0;">
            <strong>How to reply:</strong>
          </p>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0;">
            Reply to this email - Your message will be delivered directly<br>
            Use the button below - Open the chat for a real-time conversation
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${chatUrl}" style="display: inline-block; background: #25d366; color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">
            Chat with your retoucher
          </a>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Best,<br>
          <strong>The Jepson Myles Studio Team</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated message from Jepson Myles Studio.
        </p>
      </div>
    `;

    // Send via Resend API with project-specific reply-to address
    const replyTo = getProjectReplyToEmail(projectId);
    const response = await client.emails.send({
      from: fromEmail,
      replyTo: replyTo,
      to: clientEmail,
      subject,
      html: htmlContent,
    });

    if (response.data?.id) {
      await logEmail(projectId, EmailType.MESSAGE_NOTIFICATION, clientEmail, subject, 'sent', response.data.id);
      console.log(`[Resend] Message notification sent to ${clientEmail} with ${conversationThread.length} messages in thread`);
      return { success: true, messageId: response.data.id };
    } else {
      const errorMsg = response.error?.message || 'Unknown error';
      await logEmail(projectId, EmailType.MESSAGE_NOTIFICATION, clientEmail, subject, 'failed', undefined, errorMsg);
      return { success: false, error: errorMsg };
    }

  } catch (error: any) {
    console.error(`[Email] Failed to send message notification:`, error);
    await logEmail(projectId, EmailType.MESSAGE_NOTIFICATION, clientEmail, subject, 'failed', undefined, error.message);
    return { success: false, error: error.message };
  }
}

// Generate a secure random token
export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Email 5: Project Assignment Welcome Email
// Sent automatically when a project is assigned to a retoucher - includes photos/extras and chat link
export async function sendAssignmentWelcomeEmail(
  clientEmail: string,
  clientName: string,
  retoucherName: string,
  photosSelected: number,
  extras: number,
  projectId: string,
  chatToken: string
): Promise<EmailResult> {
  const subject = `Your Photo Project is Now in Progress! - ${clientName}`;
  
  try {
    const { client, fromEmail } = await getResendClient();
    
    const baseUrl = getAppBaseUrl();
    
    const chatUrl = `${baseUrl}/client-chat/${chatToken}`;
    
    const hasExtras = extras > 0;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${getEmailHeader('Your Project is In Progress')}
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hi ${clientName}!
        </p>
        
        <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 12px; padding: 25px; margin: 25px 0;">
          <p style="color: #2e7d32; font-size: 18px; line-height: 1.6; margin: 0;">
            I'm <strong>${retoucherName}</strong> and I'll be handling your photo project!
          </p>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Your project has been assigned and I'm excited to start working on your photos. Here are your project details:
        </p>
        
        <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #666; font-size: 15px;">Photos Selected:</td>
              <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; font-size: 18px;">${photosSelected}</td>
            </tr>
            ${hasExtras ? `
            <tr style="border-top: 1px solid #e0e0e0;">
              <td style="padding: 10px 0; color: #e65100; font-size: 15px;">Extra Photos:</td>
              <td style="padding: 10px 0; color: #e65100; font-weight: bold; text-align: right; font-size: 18px;">+${extras}</td>
            </tr>
            <tr style="border-top: 1px solid #e0e0e0; background: #fff3e0;">
              <td style="padding: 10px 0; color: #333; font-weight: bold; font-size: 15px;">Total Photos:</td>
              <td style="padding: 10px 0; color: #333; font-weight: bold; text-align: right; font-size: 18px;">${photosSelected + extras}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          If you have any questions, want to provide additional notes, or need to share reference images, you can chat with me directly using the button below:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${chatUrl}" style="display: inline-block; background: #25d366; color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">
            Chat with ${retoucherName}
          </a>
        </div>
        
        <div style="background: #f0f7ff; border-radius: 8px; padding: 15px 20px; margin: 25px 0;">
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong>Tip:</strong> You can send text messages, images, voice notes, and files through the chat. It's the fastest way to communicate with your retoucher!
          </p>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Looking forward to delivering beautiful photos for you!
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Best regards,<br>
          <strong>${retoucherName}</strong><br>
          <span style="color: #666;">Jepson Myles Studio</span>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated message from Jepson Myles Studio.
        </p>
      </div>
    `;

    // Send via Resend API with project-specific reply-to for inbound email handling
    const replyTo = getProjectReplyToEmail(projectId);
    const response = await client.emails.send({
      from: fromEmail,
      replyTo: replyTo,
      to: clientEmail,
      subject,
      html: htmlContent,
    });

    if (response.data?.id) {
      await logEmail(projectId, EmailType.PROJECT_ASSIGNED, clientEmail, subject, 'sent', response.data.id);
      console.log(`[Resend] Assignment welcome email sent to ${clientEmail} for retoucher ${retoucherName} (reply-to: ${replyTo})`);
      return { success: true, messageId: response.data.id };
    } else {
      const errorMsg = response.error?.message || 'Unknown error';
      await logEmail(projectId, EmailType.PROJECT_ASSIGNED, clientEmail, subject, 'failed', undefined, errorMsg);
      return { success: false, error: errorMsg };
    }

  } catch (error: any) {
    console.error(`[Email] Failed to send assignment welcome email:`, error);
    const fallbackSubject = `Your Photo Project is Now in Progress! - ${clientName}`;
    await logEmail(projectId, EmailType.PROJECT_ASSIGNED, clientEmail, fallbackSubject, 'failed', undefined, error.message);
    return { success: false, error: error.message };
  }
}
