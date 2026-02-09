import { storage } from '../storage';

function isBusinessHours(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
}

const pendingAutoResponses = new Map<string, NodeJS.Timeout>();

export async function handleClientMessageAutoResponse(projectId: string): Promise<void> {
  clearPendingAutoResponse(projectId);
  
  if (!isBusinessHours()) {
    await sendSystemMessage(
      projectId,
      "Thanks for reaching out! Our team is available Monday–Friday, 9 AM – 4 PM. We'll get back to you first thing on the next business day. 😊"
    );
  } else {
    const timeout = setTimeout(async () => {
      try {
        const messages = await storage.getMessagesByProject(projectId);
        if (messages.length === 0) return;
        
        const nonSystemMessages = messages.filter(m => m.senderType !== 'system');
        if (nonSystemMessages.length === 0) return;
        
        const lastRealMessage = nonSystemMessages[nonSystemMessages.length - 1];
        
        if (lastRealMessage.senderType === 'client') {
          await sendSystemMessage(
            projectId,
            "We've received your message and our team is working on it. We'll get back to you shortly! 🙏"
          );
        }
      } catch (error) {
        console.error(`[AutoResponder] Error sending delayed response for project ${projectId}:`, error);
      } finally {
        pendingAutoResponses.delete(projectId);
      }
    }, 30 * 60 * 1000);
    
    pendingAutoResponses.set(projectId, timeout);
  }
}

export function clearPendingAutoResponse(projectId: string): void {
  const existing = pendingAutoResponses.get(projectId);
  if (existing) {
    clearTimeout(existing);
    pendingAutoResponses.delete(projectId);
  }
}

async function sendSystemMessage(projectId: string, messageText: string): Promise<void> {
  try {
    await storage.createClientMessage({
      projectId,
      senderType: 'system',
      senderEmail: 'system@jepsonmyles.com',
      message: messageText,
      isRead: true,
      attachmentUrl: null,
      attachmentType: null,
      attachmentName: null,
    });
    console.log(`[AutoResponder] Sent system message to project ${projectId}`);
  } catch (error) {
    console.error(`[AutoResponder] Failed to send system message:`, error);
  }
}

export async function sendStatusUpdateMessage(projectId: string, oldStatus: string, newStatus: string): Promise<void> {
  try {
    const chatToken = await storage.getClientAuthTokenByProjectId(projectId);
    if (!chatToken) return;
  } catch {
    return;
  }

  const statusMessages: Record<string, string> = {
    'Ready for Retouching': "Great news! Your project is now ready and queued for editing. We'll assign an editor shortly. ✨",
    'Assigned': "Your project has been assigned to an editor who will start working on your photos soon! 🎨",
    'Review': "Exciting update! Your photos are now in the review stage — almost there! 👀",
    'Delivered': "Your photos have been delivered! We hope you love them. 📸💕",
  };
  
  const message = statusMessages[newStatus];
  if (message) {
    await sendSystemMessage(projectId, message);
  }
}
