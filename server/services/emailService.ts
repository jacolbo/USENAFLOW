// Email service using Resend integration
import { Resend } from 'resend';
import { db } from '../db';
import { emailLogs, projects, EmailType, type EmailTypeValue } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { formatDateYMD } from './shoottrackerEngine';

let connectionSettings: any;

async function getCredentials() {
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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client - tokens expire
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
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
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a1a; margin: 0;">Jepson Myles Studio</h1>
          <p style="color: #666; margin: 5px 0 0 0;">Photo Delivery Estimate</p>
        </div>
        
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

    const response = await client.emails.send({
      from: fromEmail,
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
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : 'https://usenaflow.replit.app';
    
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
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a1a; margin: 0;">Jepson Myles Studio</h1>
          <p style="color: #666; margin: 5px 0 0 0;">Photo Selection Confirmation</p>
        </div>
        
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

    const response = await client.emails.send({
      from: fromEmail,
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
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : 'https://usenaflow.replit.app';
    
    const chatUrl = `${baseUrl}/client-chat/${chatToken}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a1a; margin: 0;">Jepson Myles Studio</h1>
          <p style="color: #666; margin: 5px 0 0 0;">Direct Communication</p>
        </div>
        
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
            💬 Open Chat
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

    const response = await client.emails.send({
      from: fromEmail,
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

// Generate a secure random token
export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
