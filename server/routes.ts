import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertProjectSchema, updateProjectSchema, insertProjectNoteSchema, updateProjectNoteSchema, insertTradeOfferSchema, updateTradeOfferSchema, ProjectStatus, TradeOfferStatus } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import type { Notification, WebSocketMessage } from "@shared/schema";
import { triggerManualRollover, performManualRolloverToNextWeek, performManualRollbackFromNextWeek } from "./rolloverScheduler";

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

export async function registerRoutes(app: Express): Promise<Server> {
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

      // Send assignment notification
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
      
      const updatedProject = await storage.updateProject(id, {
        status: ProjectStatus.DONE,
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
        details: "Project marked as complete",
        createdBy: "system"
      });
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to mark project as done" });
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
      
      // Calculate new due date (tomorrow, same retoucher)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const updatedProject = await storage.updateProject(id, {
        toEditRemaining: newRemaining,
        rolloverCount: (project.rolloverCount || 0) + 1,
        lastRolloverDate: new Date(),
        dueDate: tomorrow,
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Log rollover event
      await storage.createProjectEvent({
        projectId: id,
        eventType: "rollover",
        eventDate: new Date(),
        photosCompleted: photosCompleted,
        photosRemaining: newRemaining,
        details: `${photosCompleted} photos completed, ${newRemaining} photos rolled over to next day`,
        createdBy: "system" // You might want to get this from the user session
      });
      
      res.json({
        project: updatedProject,
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

  return httpServer;
}
