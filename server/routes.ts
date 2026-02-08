import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertProjectSchema, updateProjectSchema, insertProjectNoteSchema, updateProjectNoteSchema, insertTradeOfferSchema, updateTradeOfferSchema, ProjectStatus, TradeOfferStatus, insertUserSchema, loginUserSchema, insertSneakPeekSchema, sneakPeeks as sneakPeeksTable } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import type { Notification, WebSocketMessage } from "@shared/schema";
import { triggerManualRollover, performManualRolloverToNextWeek, performManualRollbackFromNextWeek } from "./rolloverScheduler";
import { registerShoottrackerRoutes } from "./shoottrackerRoutes";
import { sendAssignmentWelcomeEmail, sendGalleryDeliveryEmail, sendSneakPeekEmail, sendSatisfactionSurveyEmail, sendSchedulingNotificationEmail, sendManualDelayNoticeEmail, generateToken } from "./services/emailService";
import { VipTier } from "@shared/schema";

// Global WebSocket connections store
const wsConnections = new Map<string, { ws: WebSocket, userId?: string }>();

// Global SSE connections store
const sseConnections = new Map<string, { res: any; userId: string; username: string }>();

// Function to broadcast via SSE
export function broadcastSSE(message: { type: string; payload?: any }, targetUserId?: string) {
  if (!sseConnections) return;

  console.log(`Broadcasting SSE message to ${sseConnections.size} connections:`, message.type, targetUserId ? `(target: ${targetUserId})` : '(all users)');

  sseConnections.forEach((connection, connectionId) => {
    if (targetUserId && connection.userId !== targetUserId) {
      return; // Skip if targeting specific user and this isn't them
    }

    try {
      connection.res.write(`data: ${JSON.stringify(message)}\n\n`);
      console.log(`Sent SSE message to ${connection.username} (${connection.userId})`);
    } catch (error) {
      console.error(`Failed to send SSE message to ${connectionId}:`, error);
      sseConnections.delete(connectionId);
    }
  });
}

// Helper function to broadcast notifications
function broadcastNotification(notification: Notification, targetUserId?: string) {
  // SSE broadcast
  broadcastSSE({
    type: 'notification',
    payload: notification
  }, targetUserId);

  // WebSocket broadcast (legacy)
  const message: WebSocketMessage = {
    type: 'NOTIFICATION',
    data: notification,
    timestamp: new Date()
  };

  wsConnections.forEach(({ ws, userId }, connectionId) => {
    if (ws.readyState === WebSocket.OPEN) {
      // Send to specific user or broadcast to all
      if (!targetUserId || userId === targetUserId) {
        ws.send(JSON.stringify(message));
      }
    } else {
      // Clean up dead connections
      wsConnections.delete(connectionId);
    }
  });
}

// VIP tier calculation helper
function calculateVipTier(totalDelivered: number): { vipTier: string; bonusPhotos: number; priorityTurnaround: boolean } {
  if (totalDelivered >= 10) {
    return { vipTier: VipTier.PLATINUM, bonusPhotos: 3, priorityTurnaround: true };
  } else if (totalDelivered >= 6) {
    return { vipTier: VipTier.GOLD, bonusPhotos: 2, priorityTurnaround: true };
  } else if (totalDelivered >= 3) {
    return { vipTier: VipTier.SILVER, bonusPhotos: 1, priorityTurnaround: false };
  }
  return { vipTier: VipTier.STANDARD, bonusPhotos: 0, priorityTurnaround: false };
}

// Helper function to broadcast project updates
function broadcastProjectUpdate(project: any) {
  // SSE broadcast
  broadcastSSE({
    type: 'project_update',
    payload: project
  });

  // WebSocket broadcast (legacy)
  const message: WebSocketMessage = {
    type: 'PROJECT_UPDATE',
    data: project,
    timestamp: new Date()
  };

  wsConnections.forEach(({ ws }, connectionId) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      wsConnections.delete(connectionId);
    }
  });
}

async function seedDefaultUsers() {
  const defaultUsers = [
    { id: "admin", username: "admin", password: "admin720", role: "Admin", name: "Anesu's Pops", abbreviation: "AP" },
    { id: "sales", username: "sales", password: "sales420", role: "Sales", name: "Sales", abbreviation: "SAL" },
    { id: "workflow", username: "workflow", password: "Chabs360", role: "LeadRetoucher", name: "Workflow Manager", abbreviation: "WFM" },
    { id: "data", username: "data", password: "Data360", role: "DataWrangler", name: "Data Wrangler", abbreviation: "DW" },
    { id: "earl", username: "earl", password: "earl123", role: "Retoucher1", name: "Earl", abbreviation: "EC" },
    { id: "asa", username: "asa", password: "asa123", role: "Retoucher2", name: "Dr Asa", abbreviation: "ASA" },
    { id: "lucky", username: "lucky", password: "lucky123", role: "Retoucher3", name: "Lucky", abbreviation: "LM" },
    { id: "evans", username: "evans", password: "evans123", role: "Evans", name: "Evans", abbreviation: "EV" },
  ];

  for (const userData of defaultUsers) {
    const existing = await storage.getUserByUsername(userData.username);
    if (!existing) {
      await storage.createUser({
        username: userData.username,
        password: userData.password,
        role: userData.role,
        name: userData.name,
        abbreviation: userData.abbreviation,
      });
      console.log(`Seeded user: ${userData.username}`);
    }
  }
  console.log("User seeding complete");
}

export async function registerRoutes(app: Express): Promise<Server> {
  await seedDefaultUsers();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginUserSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithoutPasswords = allUsers.map(({ password, ...rest }) => rest);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const existing = await storage.getUserByUsername(validatedData.username);
      if (existing) {
        return res.status(409).json({ error: "Username already exists" });
      }
      const user = await storage.createUser(validatedData);
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Email configuration diagnostic endpoint
  app.get("/api/admin/email-diagnostics", async (req, res) => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT || 'not set',
        APP_URL: process.env.APP_URL || 'not set',
        REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN ? 'set' : 'not set',
        RESEND_API_KEY: process.env.RESEND_API_KEY ? 'set (hidden)' : 'NOT SET - THIS IS THE PROBLEM',
        REPLIT_CONNECTORS_HOSTNAME: process.env.REPLIT_CONNECTORS_HOSTNAME ? 'set' : 'not set',
        REPL_IDENTITY: process.env.REPL_IDENTITY ? 'set' : 'not set',
        WEB_REPL_RENEWAL: process.env.WEB_REPL_RENEWAL ? 'set' : 'not set',
      },
      canSendEmails: !!process.env.RESEND_API_KEY,
      message: process.env.RESEND_API_KEY 
        ? 'Email service should work - RESEND_API_KEY is available'
        : 'Email service CANNOT work - RESEND_API_KEY secret is missing. Check your Secrets tab in Replit.'
    };
    res.json(diagnostics);
  });

  // Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Create a new project
  app.post("/api/projects", async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedData);
      
      // If there's an extraPhotoPrice, create a commission record for the wrangler
      if (project.extraPhotoPrice && project.extras > 0) {
        const commissionAmount = Math.round(project.extraPhotoPrice * 0.03); // 3% commission in cents
        await storage.createWranglerCommission({
          wranglerUsername: "Data Wrangler", // Default wrangler name
          projectId: project.id,
          extraCount: project.extras,
          extraPhotoPrice: project.extraPhotoPrice,
          totalAmount: project.extraPhotoPrice,
          commissionAmount,
        });
      }
      
      // Broadcast project creation notification
      const notification: Notification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        type: 'PROJECT_CREATED',
        title: 'New Project Created',
        message: `Project "${project.clientName}" has been created`,
        projectId: project.id,
        projectName: project.clientName,
        createdAt: new Date(),
        read: false
      };
      broadcastNotification(notification);
      broadcastProjectUpdate(project);
      
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  // Update a project
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateProjectSchema.parse(req.body);
      const oldProject = await storage.getProject(id);
      const project = await storage.updateProject(id, validatedData);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check for status changes and send notifications
      if (oldProject && oldProject.status !== project.status) {
        let notification: Notification | null = null;

        if (project.status === ProjectStatus.DELIVERED) {
          notification = {
            id: `notif_${Date.now()}_${Math.random()}`,
            type: 'PROJECT_COMPLETED',
            title: 'Project Completed!',
            message: `Project "${project.clientName}" has been marked as delivered`,
            projectId: project.id,
            projectName: project.clientName,
            createdAt: new Date(),
            read: false
          };
        } else {
          notification = {
            id: `notif_${Date.now()}_${Math.random()}`,
            type: 'PROJECT_STATUS_CHANGED',
            title: 'Project Status Updated',
            message: `Project "${project.clientName}" status changed from "${oldProject.status}" to "${project.status}"`,
            projectId: project.id,
            projectName: project.clientName,
            createdAt: new Date(),
            read: false
          };
        }

        if (notification) {
          broadcastNotification(notification);
        }
      }

      // Check if project was just assigned to a retoucher (assignedTo changed from null/different to a new value)
      const wasJustAssigned = validatedData.assignedTo && 
        validatedData.assignedTo !== "__UNASSIGN__" && 
        oldProject && 
        oldProject.assignedTo !== validatedData.assignedTo;
      
      console.log(`[Assignment Check] wasJustAssigned=${wasJustAssigned}, newAssignedTo=${validatedData.assignedTo}, oldAssignedTo=${oldProject?.assignedTo}`);
      
      if (wasJustAssigned && oldProject?.clientEmail && validatedData.assignedTo) {
        const assignedToRetoucher = validatedData.assignedTo;
        console.log(`[Email] Project ${project.clientName} was just assigned to ${assignedToRetoucher}, sending welcome email to ${oldProject.clientEmail}`);
        
        try {
          // Get the retoucher's display name
          const retoucherUser = await storage.getUserByUsername(assignedToRetoucher);
          const retoucherDisplayName = retoucherUser?.username || assignedToRetoucher;
          
          // Check for existing valid token, reuse if available
          let chatToken: string;
          const existingToken = await storage.getClientAuthTokenByProjectId(project.id);
          
          if (existingToken && new Date(existingToken.expiresAt) > new Date()) {
            chatToken = existingToken.token;
            console.log(`[Email] Reusing existing chat token for project ${project.id}`);
          } else {
            chatToken = generateToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            
            await storage.createClientAuthToken({
              token: chatToken,
              projectId: project.id,
              email: oldProject.clientEmail,
              expiresAt,
            });
            console.log(`[Email] Created new chat token for project ${project.id}`);
          }
          
          // Send the assignment welcome email
          const photosSelected = project.selectedCount || 0;
          const extras = project.extras || 0;
          
          console.log(`[Email] Sending assignment email: client=${project.clientName}, retoucher=${retoucherDisplayName}, photos=${photosSelected}, extras=${extras}`);
          
          const emailResult = await sendAssignmentWelcomeEmail(
            oldProject.clientEmail,
            project.clientName,
            retoucherDisplayName,
            photosSelected,
            extras,
            project.id,
            chatToken
          );
          
          if (emailResult.success) {
            console.log(`[Email] Successfully sent assignment welcome email to ${oldProject.clientEmail}`);
          } else {
            console.error(`[Email] Failed to send assignment welcome email: ${emailResult.error}`);
          }
        } catch (emailError) {
          console.error('[Email] Error sending assignment welcome email:', emailError);
        }
      }

      // Check if dueDate was changed - send scheduling notification
      if (validatedData.dueDate && oldProject && oldProject.clientEmail) {
        const oldDue = oldProject.dueDate ? new Date(oldProject.dueDate).toDateString() : null;
        const newDue = new Date(validatedData.dueDate).toDateString();
        if (oldDue !== newDue) {
          try {
            const dueDate = new Date(validatedData.dueDate);
            const weekStart = new Date(dueDate);
            weekStart.setDate(dueDate.getDate() - dueDate.getDay() + 1); // Monday
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 4); // Friday

            await sendSchedulingNotificationEmail(
              oldProject.clientEmail,
              project.clientName,
              weekStart,
              weekEnd,
              project.id
            );
            console.log(`[Email] Scheduling notification sent to ${oldProject.clientEmail} for project ${project.clientName}`);
          } catch (emailError) {
            console.error('[Email] Error sending scheduling notification:', emailError);
          }
        }
      }

      console.log('Broadcasting project update for:', project.clientName);
      broadcastProjectUpdate(project);
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  // Assign project to retoucher
  app.patch("/api/projects/:id/assign", async (req, res) => {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Always set status to ASSIGNED when assigning to someone, or READY_FOR_RETOUCHING when unassigning
      const status = assignedTo && assignedTo !== "__UNASSIGN__" 
        ? ProjectStatus.ASSIGNED 
        : ProjectStatus.READY_FOR_RETOUCHING;
      
      console.log(`Updating project ${project.clientName}: assignedTo=${assignedTo}, status: ${project.status} -> ${status}`);
      
      const updatedProject = await storage.updateProject(id, {
        assignedTo: assignedTo === "__UNASSIGN__" ? null : assignedTo,
        status,
      });

      // Send assignment notification to retoucher
      if (assignedTo && assignedTo !== "__UNASSIGN__") {
        const notification: Notification = {
          id: `notif_${Date.now()}_${Math.random()}`,
          type: 'PROJECT_ASSIGNED',
          title: 'New Project Assignment',
          message: `You have been assigned to project "${project.clientName}"`,
          projectId: project.id,
          projectName: project.clientName,
          userId: assignedTo,
          createdAt: new Date(),
          read: false
        };
        broadcastNotification(notification, assignedTo);
        
        // Send welcome email to client with chat link (if client has email)
        console.log(`[Email Debug] Checking email conditions: clientEmail=${project.clientEmail}, updatedProject=${!!updatedProject}`);
        if (project.clientEmail && updatedProject) {
          console.log(`[Email Debug] Conditions met, attempting to send welcome email to ${project.clientEmail}`);
          try {
            // Get the retoucher's name (username is the display name in this system)
            const retoucherUser = await storage.getUserByUsername(assignedTo);
            const retoucherDisplayName = retoucherUser?.username || assignedTo;
            console.log(`[Email Debug] Retoucher display name: ${retoucherDisplayName}`);
            
            // Check for existing valid token, reuse if available
            let chatToken: string;
            const existingToken = await storage.getClientAuthTokenByProjectId(project.id);
            
            if (existingToken && new Date(existingToken.expiresAt) > new Date()) {
              // Reuse existing valid token
              chatToken = existingToken.token;
            } else {
              // Generate new chat token
              chatToken = generateToken();
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry
              
              // Store the chat token
              await storage.createClientAuthToken({
                token: chatToken,
                projectId: project.id,
                email: project.clientEmail,
                expiresAt,
              });
            }
            
            // Send the assignment welcome email
            const photosSelected = updatedProject.selectedCount || 0;
            const extras = updatedProject.extras || 0;
            
            console.log(`[Email Debug] Calling sendAssignmentWelcomeEmail with: email=${project.clientEmail}, client=${project.clientName}, retoucher=${retoucherDisplayName}, photos=${photosSelected}, extras=${extras}`);
            
            const emailResult = await sendAssignmentWelcomeEmail(
              project.clientEmail,
              project.clientName,
              retoucherDisplayName,
              photosSelected,
              extras,
              project.id,
              chatToken
            );
            
            console.log(`[Email Debug] sendAssignmentWelcomeEmail result:`, JSON.stringify(emailResult));
            
            if (emailResult.success) {
              console.log(`[Email] Sent assignment welcome email to ${project.clientEmail} for project ${project.clientName} (retoucher: ${retoucherDisplayName})`);
            } else {
              console.error(`[Email] Failed to send assignment welcome email: ${emailResult.error}`);
            }
          } catch (emailError) {
            console.error('[Email] Failed to send assignment welcome email:', emailError);
            // Don't fail the assignment if email fails
          }
        }
      }

      if (updatedProject) {
        console.log('Broadcasting assignment update for:', updatedProject.clientName);
        broadcastProjectUpdate(updatedProject);
        res.json(updatedProject);
      } else {
        res.status(500).json({ error: "Failed to update project" });
      }
    } catch (error) {
      res.status(400).json({ error: "Failed to assign project" });
    }
  });

  // Mark invoice as paid
  app.patch("/api/projects/:id/mark-paid", async (req, res) => {
    try {
      const { id } = req.params;
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const status = project.assignedTo ? ProjectStatus.ASSIGNED : ProjectStatus.READY_FOR_RETOUCHING;
      
      const updatedProject = await storage.updateProject(id, {
        invoicePaid: true,
        status,
      });
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to mark invoice as paid" });
    }
  });

  // Mark project as done (retoucher action)
  app.patch("/api/projects/:id/mark-done", async (req, res) => {
    try {
      const { id } = req.params;
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // If this is a shadow project, also mark the original for review (but don't update its completion count)
      if (project.isRolloverShadow && project.originalProjectId) {
        await storage.updateProject(project.originalProjectId, {
          status: ProjectStatus.REVIEW,
        });
      }
      
      const updatedProject = await storage.updateProject(id, {
        status: ProjectStatus.REVIEW, // Send to Review for sales approval, not directly to Done
        photosCompleted: project.toEditRemaining || project.selectedCount || 0, // Mark all photos as completed
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Log completion event
      await storage.createProjectEvent({
        projectId: id,
        eventType: "completed",
        eventDate: new Date(),
        photosCompleted: project.toEditRemaining || project.selectedCount,
        photosRemaining: 0,
        details: project.isRolloverShadow ? "Shadow project sent to review" : "Project sent to review",
        createdBy: "system"
      });
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to mark project as done" });
    }
  });

  // Rollback project from "Rolled Over" status
  app.patch("/api/projects/:id/rollback", async (req, res) => {
    try {
      const { id } = req.params;
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (project.status !== ProjectStatus.ROLLED_OVER) {
        return res.status(400).json({ error: "Project is not in 'Rolled Over' status" });
      }
      
      // Find and delete any shadow projects created from this original project
      const allProjects = await storage.getAllProjects();
      const shadowProjects = allProjects.filter(p => p.originalProjectId === id);
      
      for (const shadowProject of shadowProjects) {
        await storage.deleteProject(shadowProject.id);
      }
      
      // Restore the original project to "Assigned" status, keeping the same assignee
      const updatedProject = await storage.updateProject(id, {
        status: ProjectStatus.ASSIGNED,
        // Keep the original assignedTo - don't change it
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Log rollback event
      await storage.createProjectEvent({
        projectId: id,
        eventType: "rollback",
        eventDate: new Date(),
        photosCompleted: 0,
        photosRemaining: project.toEditRemaining || project.selectedCount,
        details: "Project rolled back from 'Rolled Over' status",
        createdBy: "system"
      });
      
      res.json({
        project: updatedProject,
        message: "Project has been rolled back successfully."
      });
    } catch (error) {
      console.error('Rollback error:', error);
      res.status(400).json({ error: "Failed to rollback project" });
    }
  });

  // Rollover project (retoucher action)
  app.patch("/api/projects/:id/rollover", async (req, res) => {
    try {
      const { id } = req.params;
      const { photosCompleted } = req.body;
      
      if (typeof photosCompleted !== 'number' || photosCompleted < 0) {
        return res.status(400).json({ error: "Number can't be negative." });
      }
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const currentRemaining = project.toEditRemaining || project.selectedCount;
      
      if (photosCompleted > currentRemaining) {
        return res.status(400).json({ error: "You can't complete more than remaining." });
      }
      
      const newRemaining = currentRemaining - photosCompleted;
      
      if (newRemaining <= 0) {
        return res.json({ 
          allComplete: true,
          message: "All photos are complete. Please press Mark Done to close this project.",
          project: project
        });
      }
      
      // Special case: If 0 photos completed, just move due date to tomorrow (no rollover shadow)
      if (photosCompleted === 0) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Simply update the project's due date to tomorrow
        const updatedProject = await storage.updateProject(id, {
          dueDate: tomorrow,
        });
        
        if (!updatedProject) {
          return res.status(404).json({ error: "Project not found" });
        }
        
        // Log the postponement event
        await storage.createProjectEvent({
          projectId: id,
          eventType: "postponed",
          eventDate: new Date(),
          photosCompleted: 0,
          photosRemaining: currentRemaining,
          details: `Project postponed to tomorrow due to no work completed`,
          createdBy: "system"
        });
        
        return res.json({
          project: updatedProject,
          message: `No photos were completed today. Project moved to tomorrow (${tomorrow.toDateString()}).`
        });
      }
      
      // Calculate new due date (tomorrow, same retoucher)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Update original project to "Rolled Over" status and record completed photos
      const updatedOriginal = await storage.updateProject(id, {
        status: ProjectStatus.ROLLED_OVER,
        rolloverCount: (project.rolloverCount || 0) + 1,
        lastRolloverDate: new Date(),
        photosCompleted: photosCompleted, // Record how many photos were completed on this project
      });
      
      if (!updatedOriginal) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Create shadow project for rollover date
      const shadowProject = await storage.createProject({
        clientName: project.clientName,
        packageCount: project.packageCount,
        selectedCount: project.selectedCount,
        extraPhotoPrice: project.extraPhotoPrice || undefined,
        dueDate: tomorrow,
        assignedTo: project.assignedTo, // Keep assigned to same user
        toEditRemaining: newRemaining,
        rolloverCount: (project.rolloverCount || 0) + 1,
        originalProjectId: id, // Link back to original
        isRolloverShadow: true,
        originalDueDate: project.dueDate,
      });
      
      // Log rollover event for both original and shadow
      await Promise.all([
        storage.createProjectEvent({
          projectId: id,
          eventType: "rollover",
          eventDate: new Date(),
          photosCompleted: photosCompleted,
          photosRemaining: newRemaining,
          details: `${photosCompleted} photos completed, ${newRemaining} photos rolled over to next day`,
          createdBy: "system"
        }),
        storage.createProjectEvent({
          projectId: shadowProject.id,
          eventType: "rollover",
          eventDate: new Date(),
          photosCompleted: 0, // Shadow starts with 0 completed
          photosRemaining: newRemaining,
          details: `Shadow project created for rollover from ${project.dueDate.toDateString()}`,
          createdBy: "system"
        })
      ]);
      
      res.json({
        originalProject: updatedOriginal,
        shadowProject: shadowProject,
        message: `You marked ${photosCompleted} photos done today. ${newRemaining} will roll over to tomorrow.`
      });
    } catch (error) {
      console.error('Rollover error:', error);
      res.status(400).json({ error: "Failed to rollover project" });
    }
  });

  // Request revision (admin action)
  app.patch("/api/projects/:id/request-revision", async (req, res) => {
    try {
      const { id } = req.params;
      
      const updatedProject = await storage.updateProject(id, {
        status: ProjectStatus.ASSIGNED,
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to request revision" });
    }
  });

  // Request corrections endpoint
  app.patch("/api/projects/:id/request-corrections", async (req, res) => {
    try {
      const { id } = req.params;
      
      const updatedProject = await storage.updateProject(id, {
        status: "Corrections",
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to request corrections" });
    }
  });

  // Deliver project (admin action)
  app.patch("/api/projects/:id/deliver", async (req, res) => {
    try {
      const { id } = req.params;
      
      const updatedProject = await storage.updateProject(id, {
        status: ProjectStatus.DELIVERED,
        deliveredAt: new Date(),
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to deliver project" });
    }
  });

  // General project update endpoint
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = updateProjectSchema.parse(req.body);
      
      const updatedProject = await storage.updateProject(id, updateData);
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to update project" });
    }
  });

  // Set project rating (admin action)
  app.patch("/api/projects/:id/rating", async (req, res) => {
    try {
      const { id } = req.params;
      const { rating } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      
      const updatedProject = await storage.updateProject(id, {
        rating: parseInt(rating, 10),
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to set rating" });
    }
  });

  // Update photos completed count (retoucher action)
  app.patch("/api/projects/:id/photos-completed", async (req, res) => {
    try {
      const { id } = req.params;
      const { photosCompleted } = req.body;
      
      if (photosCompleted < 0) {
        return res.status(400).json({ error: "Photos completed cannot be negative" });
      }

      // Get the project to validate against toEditRemaining
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const maxPhotos = project.toEditRemaining || project.selectedCount || 0;
      if (photosCompleted > maxPhotos) {
        return res.status(400).json({ error: `Cannot complete more photos than available (${maxPhotos})` });
      }
      
      const updatedProject = await storage.updateProject(id, {
        photosCompleted: parseInt(photosCompleted, 10),
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to update photos completed" });
    }
  });

  // Duplicate project (admin/sales/data wrangler action)
  app.post("/api/projects/:id/duplicate", async (req, res) => {
    try {
      const { id } = req.params;
      const originalProject = await storage.getProject(id);
      
      if (!originalProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Create a new project with copied data but reset status and assignments
      const duplicatedProject = await storage.createProject({
        clientName: `${originalProject.clientName} (Copy)`,
        packageCount: originalProject.packageCount,
        selectedCount: originalProject.selectedCount,
        dueDate: originalProject.dueDate,
      });
      
      res.status(201).json(duplicatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to duplicate project" });
    }
  });

  // Delete project (admin/lead retoucher action)
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProject(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete project" });
    }
  });

  // Notes endpoints
  // Get notes for a project
  app.get("/api/projects/:projectId/notes", async (req, res) => {
    try {
      const { projectId } = req.params;
      const notes = await storage.getProjectNotes(projectId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // Create a new note
  app.post("/api/projects/:projectId/notes", async (req, res) => {
    try {
      const { projectId } = req.params;
      const noteData = { ...req.body, projectId };
      const validatedData = insertProjectNoteSchema.parse(noteData);
      const note = await storage.createProjectNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  // Update a note
  app.patch("/api/projects/:projectId/notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateProjectNoteSchema.parse(req.body);
      const note = await storage.updateProjectNote(id, validatedData);
      
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json(note);
    } catch (error) {
      res.status(400).json({ error: "Failed to update note" });
    }
  });

  // Delete a note
  app.delete("/api/projects/:projectId/notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProjectNote(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete note" });
    }
  });

  // Object storage endpoints for images
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/note-images", async (req, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.imageURL);

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting note image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Gallery Link - Add/update gallery link for a project (Retoucher action)
  app.patch("/api/projects/:id/gallery-link", async (req, res) => {
    try {
      const { id } = req.params;
      const { galleryLink, addedBy } = req.body;

      if (!galleryLink || !addedBy) {
        return res.status(400).json({ error: "galleryLink and addedBy are required" });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const updatedProject = await storage.updateProject(id, {
        galleryLink,
        galleryLinkAddedAt: new Date(),
        galleryLinkAddedBy: addedBy,
      });

      if (updatedProject) {
        broadcastProjectUpdate(updatedProject);
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error adding gallery link:", error);
      res.status(500).json({ error: "Failed to add gallery link" });
    }
  });

  // Approve Delivery - Sales approves gallery delivery and sends email to client
  app.post("/api/projects/:id/approve-delivery", async (req, res) => {
    try {
      const { id } = req.params;
      const { approvedBy } = req.body;

      if (!approvedBy) {
        return res.status(400).json({ error: "approvedBy is required" });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.galleryLink) {
        return res.status(400).json({ error: "Project has no gallery link to deliver" });
      }

      if (project.deliveryApproved) {
        return res.status(400).json({ error: "Delivery has already been approved" });
      }

      const updateData: any = {
        deliveryApproved: true,
        deliveryApprovedAt: new Date(),
        deliveryApprovedBy: approvedBy,
        status: ProjectStatus.DELIVERED,
        deliveredAt: new Date(),
      };

      let referralCode: string | undefined;
      
      // Create referral for the client
      if (project.clientEmail) {
        try {
          referralCode = generateToken();
          await storage.createReferral({
            referrerEmail: project.clientEmail,
            referrerName: project.clientName,
            referralCode,
            status: "pending",
          });
          console.log(`[Referral] Created referral code ${referralCode} for ${project.clientName}`);
        } catch (refError) {
          console.error('[Referral] Error creating referral:', refError);
        }
      }

      // Send delivery email if client has an email
      if (project.clientEmail && project.galleryLink) {
        try {
          const emailResult = await sendGalleryDeliveryEmail(
            project.clientEmail,
            project.clientName,
            project.galleryLink,
            project.id,
            referralCode
          );

          if (emailResult.success) {
            updateData.deliveryEmailSentAt = new Date();
            console.log(`[Email] Gallery delivery email sent to ${project.clientEmail} for project ${project.clientName}`);
          } else {
            console.error(`[Email] Failed to send gallery delivery email: ${emailResult.error}`);
          }
        } catch (emailError) {
          console.error('[Email] Error sending gallery delivery email:', emailError);
        }

        // Create survey and send survey email
        try {
          const surveyToken = generateToken();
          await storage.createSurvey({
            projectId: project.id,
            clientEmail: project.clientEmail,
            clientName: project.clientName,
            surveyToken,
          });
          await sendSatisfactionSurveyEmail(
            project.clientEmail,
            project.clientName,
            surveyToken,
            project.id
          );
          console.log(`[Survey] Survey created and email sent for project ${project.clientName}`);
        } catch (surveyError) {
          console.error('[Survey] Error creating survey:', surveyError);
        }
      }

      const updatedProject = await storage.updateProject(id, updateData);

      // Update VIP client profile after delivery
      if (project.clientEmail) {
        try {
          const existingProfile = await storage.getClientProfile(project.clientEmail);
          const newDelivered = (existingProfile?.totalDelivered || 0) + 1;
          const newProjects = (existingProfile?.totalProjects || 0) + (existingProfile ? 0 : 1);
          const tierInfo = calculateVipTier(newDelivered);

          await storage.upsertClientProfile({
            clientEmail: project.clientEmail,
            clientName: project.clientName,
            totalDelivered: newDelivered,
            totalProjects: newProjects,
            ...tierInfo,
            lastProjectAt: new Date(),
            firstProjectAt: existingProfile?.firstProjectAt || new Date(),
          });
          console.log(`[VIP] Updated client profile for ${project.clientEmail}: tier=${tierInfo.vipTier}, delivered=${newDelivered}`);
        } catch (vipError) {
          console.error('[VIP] Error updating client profile:', vipError);
        }
      }

      if (updatedProject) {
        const notification: Notification = {
          id: `notif_${Date.now()}_${Math.random()}`,
          type: 'PROJECT_COMPLETED',
          title: 'Project Delivered!',
          message: `Project "${project.clientName}" has been delivered to the client`,
          projectId: project.id,
          projectName: project.clientName,
          createdAt: new Date(),
          read: false
        };
        broadcastNotification(notification);
        broadcastProjectUpdate(updatedProject);
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error approving delivery:", error);
      res.status(500).json({ error: "Failed to approve delivery" });
    }
  });

  // Survey endpoints (public)
  app.get("/api/survey/:token", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (!survey) {
        return res.status(404).json({ error: "Survey not found" });
      }
      res.json(survey);
    } catch (error) {
      res.status(500).json({ error: "Failed to get survey" });
    }
  });

  app.post("/api/survey/:token", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (!survey) {
        return res.status(404).json({ error: "Survey not found" });
      }
      if (survey.completedAt) {
        return res.status(400).json({ error: "Survey already completed" });
      }
      const { rating, feedback, wouldRecommend } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      const updated = await storage.updateSurvey(survey.id, {
        rating,
        feedback: feedback || null,
        wouldRecommend: wouldRecommend ?? null,
        completedAt: new Date(),
      });
      const googleReviewPrompt = rating >= 4;
      res.json({ ...updated, googleReviewPrompt });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit survey" });
    }
  });

  // Referral endpoints
  app.get("/api/referrals", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const allReferrals = await storage.getAllReferrals();
      res.json(allReferrals);
    } catch (error) {
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  app.get("/api/referral/:code", async (req, res) => {
    try {
      const referral = await storage.getReferralByCode(req.params.code);
      if (!referral) {
        return res.status(404).json({ error: "Referral not found" });
      }
      res.json({ referrerName: referral.referrerName, referralCode: referral.referralCode });
    } catch (error) {
      res.status(500).json({ error: "Failed to get referral" });
    }
  });

  app.post("/api/referrals", async (req, res) => {
    try {
      const { referrerEmail, referrerName } = req.body;
      if (!referrerEmail || !referrerName) {
        return res.status(400).json({ error: "referrerEmail and referrerName are required" });
      }
      const referralCode = generateToken();
      const referral = await storage.createReferral({
        referrerEmail,
        referrerName,
        referralCode,
        status: "pending",
      });
      res.json(referral);
    } catch (error) {
      res.status(500).json({ error: "Failed to create referral" });
    }
  });

  app.patch("/api/referrals/:id", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const updates: any = {};
      if (req.body.status) updates.status = req.body.status;
      if (req.body.rewardNote) updates.rewardNote = req.body.rewardNote;
      if (req.body.referredEmail) updates.referredEmail = req.body.referredEmail;
      if (req.body.referredName) updates.referredName = req.body.referredName;
      if (req.body.status === "completed" || req.body.status === "rewarded") {
        updates.completedAt = new Date();
      }
      const updated = await storage.updateReferral(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Referral not found" });
      }
      if (req.body.status === "completed" && updated.referrerEmail) {
        try {
          await storage.creditBonusPhotos(updated.referrerEmail, updated.referrerName, 5);
          console.log(`[Referral] Credited 5 bonus photos to ${updated.referrerEmail} for referral ${updated.referralCode}`);
        } catch (creditError) {
          console.error('[Referral] Error crediting bonus photos:', creditError);
        }
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update referral" });
    }
  });

  // Referral submission from landing page (public)
  app.post("/api/referral/:code/submit", async (req, res) => {
    try {
      const referral = await storage.getReferralByCode(req.params.code);
      if (!referral) {
        return res.status(404).json({ error: "Referral not found" });
      }
      const firstName = (req.body.firstName || "").trim();
      const lastName = (req.body.lastName || "").trim();
      const email = (req.body.email || "").trim().toLowerCase();
      if (!firstName || !lastName) {
        return res.status(400).json({ error: "First name and last name are required" });
      }
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }
      const fullName = `${firstName} ${lastName}`;
      const updated = await storage.updateReferral(referral.id, {
        referredFirstName: firstName,
        referredLastName: lastName,
        referredName: fullName,
        referredEmail: email,
        status: "submitted",
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit referral" });
    }
  });

  app.get("/api/client-bonus/:email", async (req, res) => {
    try {
      const profile = await storage.getClientProfile(decodeURIComponent(req.params.email));
      if (!profile) {
        return res.json({ bonusPhotos: 0, bonusPhotosUsed: 0, available: 0 });
      }
      res.json({
        bonusPhotos: profile.bonusPhotos || 0,
        bonusPhotosUsed: profile.bonusPhotosUsed || 0,
        available: (profile.bonusPhotos || 0) - (profile.bonusPhotosUsed || 0),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get bonus photos" });
    }
  });

  app.post("/api/projects/:id/apply-bonus-photos", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales", "DataWrangler"].includes(role)) {
        return res.status(403).json({ error: "Only Admin, Sales, or Data Wrangler can apply bonus photos" });
      }
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (!project.clientEmail) {
        return res.status(400).json({ error: "Project has no client email" });
      }
      const { photos } = req.body;
      if (!photos || photos < 1) {
        return res.status(400).json({ error: "Must apply at least 1 bonus photo" });
      }
      const appliedBy = req.headers["x-usena-user-id"] as string || "unknown";
      const result = await storage.applyBonusPhotos(
        project.clientEmail,
        project.id,
        project.clientName,
        photos,
        appliedBy
      );
      res.json({
        success: true,
        claim: result.claim,
        remaining: (result.profile.bonusPhotos || 0) - (result.profile.bonusPhotosUsed || 0),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to apply bonus photos" });
    }
  });

  app.get("/api/projects/:id/reward-claims", async (req, res) => {
    try {
      const claims = await storage.getRewardClaimsByProject(req.params.id);
      res.json(claims);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reward claims" });
    }
  });

  // Server-Sent Events for real-time notifications

  app.get('/api/events', (req, res) => {
    const userId = req.query.userId as string;
    const username = req.query.username as string;

    if (!userId || !username) {
      return res.status(400).json({ error: 'userId and username are required' });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const connectionId = `sse_${Date.now()}_${Math.random()}`;
    sseConnections.set(connectionId, { res, userId, username });

    console.log(`SSE connection established: ${username} (${userId}) - ${connectionId}`);

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`);

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date() })}\n\n`);
      } catch (error) {
        clearInterval(pingInterval);
        sseConnections.delete(connectionId);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`SSE connection closed: ${connectionId}`);
      clearInterval(pingInterval);
      sseConnections.delete(connectionId);
    });

    req.on('error', (error) => {
      console.error(`SSE connection error: ${connectionId}`, error);
      clearInterval(pingInterval);
      sseConnections.delete(connectionId);
    });
  });

  const httpServer = createServer(app);

  // Set up WebSocket server for live sync and notifications (keeping for backward compatibility)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const connectionId = `conn_${Date.now()}_${Math.random()}`;
    console.log(`WebSocket connection established: ${connectionId}`);
    
    // Store connection (userId will be set when client identifies itself)
    wsConnections.set(connectionId, { ws });

    ws.on('message', (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'SYNC_REQUEST':
            console.log('Sync request received from client');
            break;
          case 'USER_IDENTIFY':
            // Client sends their user info to identify themselves
            const userData = message.data as { userId: string, username: string };
            if (userData?.userId) {
              wsConnections.set(connectionId, { ws, userId: userData.userId });
              console.log(`User identified: ${userData.username} (${userData.userId}) on connection ${connectionId}`);
            }
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket connection closed: ${connectionId}`);
      wsConnections.delete(connectionId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${connectionId}:`, error);
      wsConnections.delete(connectionId);
    });

    // Send a simple connection confirmation
    ws.send(JSON.stringify({
      type: 'SYNC_REQUEST',
      data: { status: 'connected' },
      timestamp: new Date()
    }));
  });

  // TRADE OFFER ENDPOINTS

  // Get all trade offers for the current user
  app.get("/api/trade-offers", async (req, res) => {
    try {
      const username = req.query.username as string;
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }
      
      const offers = await storage.getTradeOffersForUser(username);
      res.json(offers);
    } catch (error) {
      console.error("Error fetching trade offers:", error);
      res.status(500).json({ error: "Failed to fetch trade offers" });
    }
  });

  // Get all trade offers for admin visibility
  app.get("/api/admin/trade-offers", async (req, res) => {
    try {
      const offers = await storage.getAllTradeOffers();
      res.json(offers);
    } catch (error) {
      console.error("Error fetching all trade offers:", error);
      res.status(500).json({ error: "Failed to fetch trade offers" });
    }
  });

  // Create a new trade offer
  app.post("/api/trade-offers", async (req, res) => {
    try {
      const validatedData = insertTradeOfferSchema.parse(req.body);
      const offer = await storage.createTradeOffer(validatedData);
      
      // Send notification to target user (if specified) or broadcast to all eligible users
      const notification: Notification = {
        id: `trade-offer-${offer.id}`,
        type: 'TRADE_OFFER_RECEIVED',
        title: 'New Trade Offer',
        message: `${offer.offeringUser} wants to trade their project${offer.message ? ': ' + offer.message : ''}`,
        projectId: offer.offeringProjectId,
        projectName: `Trade Offer from ${offer.offeringUser}`,
        tradeOfferId: offer.id,
        createdAt: new Date(),
        read: false
      };

      if (offer.targetUser) {
        broadcastNotification(notification, offer.targetUser);
      } else {
        broadcastNotification(notification); // Broadcast to all users
      }

      res.status(201).json(offer);
    } catch (error) {
      console.error("Error creating trade offer:", error);
      res.status(400).json({ error: "Failed to create trade offer" });
    }
  });

  // Accept a trade offer
  app.post("/api/trade-offers/:id/accept", async (req, res) => {
    try {
      const { id } = req.params;
      const { acceptedBy, acceptedProjectId } = req.body;
      
      if (!acceptedBy || !acceptedProjectId) {
        return res.status(400).json({ error: "acceptedBy and acceptedProjectId are required" });
      }

      const updatedOffer = await storage.updateTradeOffer(id, {
        status: TradeOfferStatus.ACCEPTED,
        acceptedBy,
        acceptedProjectId,
      });

      if (!updatedOffer) {
        return res.status(404).json({ error: "Trade offer not found" });
      }

      // Execute the trade swap
      const swapSuccess = await storage.executeTradeSwap(id);
      
      if (!swapSuccess) {
        // Roll back the acceptance if swap failed
        await storage.updateTradeOffer(id, {
          status: TradeOfferStatus.PENDING,
          acceptedBy: null,
          acceptedProjectId: null,
        });
        return res.status(500).json({ error: "Failed to execute trade swap" });
      }

      // Send notifications to both parties
      const acceptedNotification: Notification = {
        id: `trade-accepted-${updatedOffer.id}`,
        type: 'TRADE_OFFER_ACCEPTED',
        title: 'Trade Offer Accepted',
        message: `${acceptedBy} accepted your trade offer`,
        projectId: updatedOffer.offeringProjectId,
        projectName: `Trade with ${acceptedBy}`,
        tradeOfferId: updatedOffer.id,
        createdAt: new Date(),
        read: false
      };

      const completedNotification: Notification = {
        id: `trade-completed-${updatedOffer.id}`,
        type: 'TRADE_COMPLETED',
        title: 'Trade Completed',
        message: `Project trade with ${updatedOffer.offeringUser} has been completed`,
        projectId: updatedOffer.acceptedProjectId || "",
        projectName: `Trade with ${updatedOffer.offeringUser}`,
        tradeOfferId: updatedOffer.id,
        createdAt: new Date(),
        read: false
      };

      // Send to offering user
      broadcastNotification(acceptedNotification, updatedOffer.offeringUser);
      // Send to accepting user
      broadcastNotification(completedNotification, acceptedBy);

      // Broadcast project updates
      broadcastSSE({ type: 'trade_completed', payload: { tradeId: id, projects: [updatedOffer.offeringProjectId, updatedOffer.acceptedProjectId] } });

      res.json(updatedOffer);
    } catch (error) {
      console.error("Error accepting trade offer:", error);
      res.status(500).json({ error: "Failed to accept trade offer" });
    }
  });

  // Decline a trade offer
  app.post("/api/trade-offers/:id/decline", async (req, res) => {
    try {
      const { id } = req.params;
      const { declinedBy } = req.body;

      const updatedOffer = await storage.updateTradeOffer(id, {
        status: TradeOfferStatus.DECLINED,
      });

      if (!updatedOffer) {
        return res.status(404).json({ error: "Trade offer not found" });
      }

      // Send notification to offering user
      const notification: Notification = {
        id: `trade-declined-${updatedOffer.id}`,
        type: 'TRADE_OFFER_ACCEPTED', // Reusing type for simplicity
        title: 'Trade Offer Declined',
        message: `${declinedBy || 'Someone'} declined your trade offer`,
        projectId: updatedOffer.offeringProjectId,
        projectName: `Trade declined by ${declinedBy || 'user'}`,
        tradeOfferId: updatedOffer.id,
        createdAt: new Date(),
        read: false
      };

      broadcastNotification(notification, updatedOffer.offeringUser);

      res.json(updatedOffer);
    } catch (error) {
      console.error("Error declining trade offer:", error);
      res.status(500).json({ error: "Failed to decline trade offer" });
    }
  });

  // Cancel a trade offer (by the offering user)
  app.delete("/api/trade-offers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTradeOffer(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Trade offer not found" });
      }

      res.json({ message: "Trade offer cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling trade offer:", error);
      res.status(500).json({ error: "Failed to cancel trade offer" });
    }
  });

  // VIP Client Admin Endpoints
  app.get("/api/admin/clients", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const profiles = await storage.getAllClientProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching client profiles:", error);
      res.status(500).json({ error: "Failed to fetch client profiles" });
    }
  });

  app.get("/api/admin/clients/:email", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const profile = await storage.getClientProfile(decodeURIComponent(req.params.email));
      if (!profile) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client profile" });
    }
  });

  app.patch("/api/admin/clients/:id", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const updates: any = {};
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.vipTier) updates.vipTier = req.body.vipTier;
      if (req.body.bonusPhotos !== undefined) updates.bonusPhotos = req.body.bonusPhotos;
      if (req.body.priorityTurnaround !== undefined) updates.priorityTurnaround = req.body.priorityTurnaround;

      const updated = await storage.updateClientProfile(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Client profile not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client profile" });
    }
  });

  app.post("/api/admin/clients/recalculate", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const allProjects = await storage.getAllProjects();
      const deliveredProjects = allProjects.filter(p => p.status === ProjectStatus.DELIVERED && p.clientEmail);

      const clientMap = new Map<string, { email: string; name: string; delivered: number; lastAt: Date | null; firstAt: Date | null }>();
      for (const project of deliveredProjects) {
        const email = project.clientEmail!;
        const existing = clientMap.get(email);
        const projectDate = project.deliveredAt ? new Date(project.deliveredAt) : new Date(project.createdAt);
        if (existing) {
          existing.delivered += 1;
          existing.name = project.clientName;
          if (!existing.lastAt || projectDate > existing.lastAt) existing.lastAt = projectDate;
          if (!existing.firstAt || projectDate < existing.firstAt) existing.firstAt = projectDate;
        } else {
          clientMap.set(email, {
            email,
            name: project.clientName,
            delivered: 1,
            lastAt: projectDate,
            firstAt: projectDate,
          });
        }
      }

      const results = [];
      for (const [email, data] of clientMap) {
        const tierInfo = calculateVipTier(data.delivered);
        const profile = await storage.upsertClientProfile({
          clientEmail: email,
          clientName: data.name,
          totalDelivered: data.delivered,
          totalProjects: data.delivered,
          ...tierInfo,
          lastProjectAt: data.lastAt,
          firstProjectAt: data.firstAt,
        });
        results.push(profile);
      }

      res.json({ recalculated: results.length, profiles: results });
    } catch (error) {
      console.error("Error recalculating VIP tiers:", error);
      res.status(500).json({ error: "Failed to recalculate VIP tiers" });
    }
  });

  // Send delay notice endpoint for Data Wrangler
  app.post("/api/projects/:id/send-delay-notice", async (req, res) => {
    try {
      const { id } = req.params;
      const { targetWeekStart, sentBy } = req.body;

      if (!targetWeekStart || !sentBy) {
        return res.status(400).json({ error: "targetWeekStart and sentBy are required" });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.clientEmail) {
        return res.status(400).json({ error: "Project has no client email" });
      }

      const weekStart = new Date(targetWeekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 4); // Friday

      const emailResult = await sendManualDelayNoticeEmail(
        project.clientEmail,
        project.clientName,
        weekStart,
        weekEnd,
        project.id
      );

      if (emailResult.success) {
        console.log(`[Email] Manual delay notice sent by ${sentBy} to ${project.clientEmail} for project ${project.clientName}`);
        res.json({ success: true, messageId: emailResult.messageId });
      } else {
        res.status(500).json({ error: emailResult.error || "Failed to send delay notice" });
      }
    } catch (error) {
      console.error("Error sending delay notice:", error);
      res.status(500).json({ error: "Failed to send delay notice" });
    }
  });

  // Manual rollover endpoint for testing
  app.post("/api/rollover", async (req, res) => {
    try {
      await triggerManualRollover();
      res.json({ success: true, message: "Manual rollover completed" });
    } catch (error) {
      console.error("Manual rollover error:", error);
      res.status(500).json({ success: false, error: "Rollover failed" });
    }
  });

  // Manual rollover to next week endpoint for admin
  app.post("/api/rollover-next-week", async (req, res) => {
    try {
      await performManualRolloverToNextWeek();
      res.json({ success: true, message: "Manual rollover to next week completed" });
    } catch (error) {
      console.error("Manual rollover to next week error:", error);
      res.status(500).json({ success: false, error: "Rollover to next week failed" });
    }
  });

  // Manual rollback from next week endpoint for admin
  app.post("/api/rollback-from-next-week", async (req, res) => {
    try {
      await performManualRollbackFromNextWeek();
      res.json({ success: true, message: "Manual rollback from next week completed" });
    } catch (error) {
      console.error("Manual rollback from next week error:", error);
      res.status(500).json({ success: false, error: "Rollback from next week failed" });
    }
  });

  // Get wrangler commissions
  app.get("/api/commissions/:wrangler", async (req, res) => {
    try {
      const { wrangler } = req.params;
      const commissions = await storage.getWranglerCommissions(wrangler);
      res.json(commissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch commissions" });
    }
  });

  // Get project events (rollover history)
  app.get("/api/projects/:id/events", async (req, res) => {
    try {
      const { id } = req.params;
      const events = await storage.getProjectEvents(id);
      res.json(events);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch project events" });
    }
  });

  // Complaints API endpoints for Evans
  app.get("/api/complaints", async (req, res) => {
    try {
      const { status } = req.query;
      const complaints = status ? 
        await storage.getComplaintsByStatus(status as string) : 
        await storage.getAllComplaints();
      res.json(complaints);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch complaints" });
    }
  });

  app.post("/api/complaints", async (req, res) => {
    try {
      const { insertComplaintSchema } = await import("@shared/schema");
      const validatedData = insertComplaintSchema.parse(req.body);
      const complaint = await storage.createComplaint(validatedData);
      res.status(201).json(complaint);
    } catch (error) {
      res.status(400).json({ error: "Failed to create complaint" });
    }
  });

  app.patch("/api/complaints/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const complaint = await storage.updateComplaint(id, updates);
      if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
      }
      res.json(complaint);
    } catch (error) {
      res.status(400).json({ error: "Failed to update complaint" });
    }
  });

  app.delete("/api/complaints/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteComplaint(id);
      if (!success) {
        return res.status(404).json({ error: "Complaint not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete complaint" });
    }
  });

  // Object storage endpoints for photo uploads
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // ============================================
  // ShootTracker Engine Routes
  // ============================================
  
  // Sync calendar events to projects (Admin only)
  app.post("/api/admin/sync-calendar", async (req, res) => {
    try {
      const { syncCalendarToProjects } = await import("./services/calendarSync");
      const { calendarId = 'primary', turnaroundDays = 14 } = req.body;
      
      const result = await syncCalendarToProjects(calendarId, turnaroundDays);
      
      // Broadcast update to all clients
      broadcastSSE({ type: 'calendar_sync_complete', payload: result });
      
      res.json({ 
        success: true, 
        message: `Calendar sync complete: ${result.created} created, ${result.updated} updated`,
        result 
      });
    } catch (error: any) {
      console.error("Calendar sync error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Calendar sync failed" 
      });
    }
  });
  
  // Get at-risk projects
  app.get("/api/projects/at-risk", async (req, res) => {
    try {
      const { getAtRiskProjects, getRiskDetails } = await import("./services/riskCalculator");
      const { RiskLevel } = await import("@shared/schema");
      
      const minLevel = (req.query.minLevel as string) || RiskLevel.AT_RISK;
      const projects = await storage.getAllProjects();
      const atRiskProjects = getAtRiskProjects(projects, minLevel as any);
      
      // Add risk details to each project
      const projectsWithDetails = atRiskProjects.map(project => ({
        ...project,
        riskDetails: getRiskDetails(project),
      }));
      
      res.json(projectsWithDetails);
    } catch (error: any) {
      console.error("Error fetching at-risk projects:", error);
      res.status(500).json({ error: "Failed to fetch at-risk projects" });
    }
  });
  
  // Get upcoming shoots
  app.get("/api/shoots/upcoming", async (req, res) => {
    try {
      const { getUpcomingShoots } = await import("./services/calendarSync");
      const daysAhead = parseInt(req.query.days as string) || 14;
      
      const upcomingShoots = await getUpcomingShoots(daysAhead);
      res.json(upcomingShoots);
    } catch (error: any) {
      console.error("Error fetching upcoming shoots:", error);
      res.status(500).json({ error: "Failed to fetch upcoming shoots" });
    }
  });
  
  // Update risk levels for all projects (Admin only)
  app.post("/api/admin/update-risk-levels", async (req, res) => {
    try {
      const { updateAllRiskLevels } = await import("./services/calendarSync");
      const updated = await updateAllRiskLevels();
      
      res.json({ 
        success: true, 
        message: `Updated risk levels for ${updated} projects`,
        updated 
      });
    } catch (error: any) {
      console.error("Error updating risk levels:", error);
      res.status(500).json({ error: "Failed to update risk levels" });
    }
  });

  // Upload logo to public storage (Admin only)
  app.post("/api/admin/upload-logo", async (req, res) => {
    try {
      const logoPath = "attached_assets/USENA-FLOW_1754522507856.png";
      const fs = await import("fs");
      
      if (!fs.existsSync(logoPath)) {
        return res.status(404).json({ error: "Logo file not found" });
      }
      
      const logoUploadService = new ObjectStorageService();
      const publicUrl = await logoUploadService.uploadPublicFile(
        logoPath,
        "jepson-myles-logo.png",
        "image/png"
      );
      
      console.log(`[Logo] Uploaded logo to: ${publicUrl}`);
      res.json({ success: true, logoUrl: publicUrl });
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ error: error.message || "Failed to upload logo" });
    }
  });

  // Register ShootTracker routes (settings, sync, forecast, toggles)
  registerShoottrackerRoutes(app);

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // Dashboard preferences API
  app.get("/api/dashboard/preferences/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const prefs = await storage.getDashboardPreferences(userId);
      res.json(prefs || null);
    } catch (error: any) {
      console.error("Error getting dashboard preferences:", error);
      res.status(500).json({ error: "Failed to get dashboard preferences" });
    }
  });

  app.put("/api/dashboard/preferences/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { widgetOrder, hiddenWidgets, widgetSettings } = req.body;
      
      const prefs = await storage.upsertDashboardPreferences(userId, {
        widgetOrder,
        hiddenWidgets,
        widgetSettings,
      });
      
      res.json(prefs);
    } catch (error: any) {
      console.error("Error updating dashboard preferences:", error);
      res.status(500).json({ error: "Failed to update dashboard preferences" });
    }
  });

  // Sneak Peek endpoints
  app.get("/api/projects/:id/sneak-peeks", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const peeks = await storage.getSneakPeeks(id);
      res.json(peeks);
    } catch (error: any) {
      console.error("Error getting sneak peeks:", error);
      res.status(500).json({ error: "Failed to get sneak peeks" });
    }
  });

  app.post("/api/projects/:id/sneak-peeks", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const existingPeeks = await storage.getSneakPeeks(id);
      if (existingPeeks.length >= 3) {
        return res.status(400).json({ error: "Maximum of 3 sneak peeks per project" });
      }
      const { imageUrl, caption, sentBy } = req.body;
      if (!imageUrl || !sentBy) {
        return res.status(400).json({ error: "imageUrl and sentBy are required" });
      }
      const peek = await storage.createSneakPeek({
        projectId: id,
        imageUrl,
        caption: caption || null,
        sentBy,
      });
      res.json(peek);
    } catch (error: any) {
      console.error("Error creating sneak peek:", error);
      res.status(500).json({ error: "Failed to create sneak peek" });
    }
  });

  app.post("/api/projects/:id/sneak-peeks/:peekId/send", async (req, res) => {
    try {
      const { id, peekId } = req.params;
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      if (!project.clientEmail) {
        return res.status(400).json({ error: "Project does not have a client email" });
      }
      const peeks = await storage.getSneakPeeks(id);
      const peek = peeks.find(p => p.id === peekId);
      if (!peek) {
        return res.status(404).json({ error: "Sneak peek not found" });
      }
      const result = await sendSneakPeekEmail(
        project.clientEmail,
        project.clientName,
        peek.imageUrl,
        peek.caption,
        id
      );
      if (result.success) {
        await storage.deleteSneakPeek(peekId);
        const updatedPeek = await storage.createSneakPeek({
          projectId: id,
          imageUrl: peek.imageUrl,
          caption: peek.caption,
          sentBy: peek.sentBy,
        });
        await db.update(sneakPeeksTable).set({ sentAt: new Date() }).where(eq(sneakPeeksTable.id, updatedPeek.id));
        const finalPeeks = await storage.getSneakPeeks(id);
        res.json({ success: true, messageId: result.messageId, peeks: finalPeeks });
      } else {
        res.status(500).json({ error: result.error || "Failed to send email" });
      }
    } catch (error: any) {
      console.error("Error sending sneak peek:", error);
      res.status(500).json({ error: "Failed to send sneak peek" });
    }
  });

  app.delete("/api/projects/:id/sneak-peeks/:peekId", async (req, res) => {
    try {
      const { peekId } = req.params;
      const deleted = await storage.deleteSneakPeek(peekId);
      if (!deleted) {
        return res.status(404).json({ error: "Sneak peek not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting sneak peek:", error);
      res.status(500).json({ error: "Failed to delete sneak peek" });
    }
  });

  return httpServer;
}
