import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertProjectSchema, updateProjectSchema, insertProjectNoteSchema, updateProjectNoteSchema, ProjectStatus } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import type { Notification, WebSocketMessage } from "@shared/schema";

// Global WebSocket connections store
const wsConnections = new Map<string, { ws: WebSocket, userId?: string }>();

// Helper function to broadcast notifications
function broadcastNotification(notification: Notification, targetUserId?: string) {
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
      
      const status = project.status === ProjectStatus.READY_FOR_RETOUCHING ? ProjectStatus.ASSIGNED : project.status;
      
      const updatedProject = await storage.updateProject(id, {
        assignedTo,
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

      broadcastProjectUpdate(updatedProject);
      res.json(updatedProject);
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
      
      const updatedProject = await storage.updateProject(id, {
        status: ProjectStatus.REVIEW,
      });
      
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ error: "Failed to mark project as done" });
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

  const httpServer = createServer(app);

  // Set up WebSocket server for live sync and notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const connectionId = `conn_${Date.now()}_${Math.random()}`;
    console.log(`WebSocket connection established: ${connectionId}`);
    
    // Store connection
    wsConnections.set(connectionId, { ws });

    ws.on('message', (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'SYNC_REQUEST':
            // Client requesting full sync - could send all projects here if needed
            console.log('Sync request received from client');
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

    // Send welcome message
    const welcomeMessage: WebSocketMessage = {
      type: 'NOTIFICATION',
      data: {
        id: `welcome_${connectionId}`,
        type: 'PROJECT_STATUS_CHANGED',
        title: 'Live Sync Connected',
        message: 'You are now connected to live updates',
        projectId: '',
        projectName: '',
        createdAt: new Date(),
        read: false
      },
      timestamp: new Date()
    };
    ws.send(JSON.stringify(welcomeMessage));
  });

  return httpServer;
}
