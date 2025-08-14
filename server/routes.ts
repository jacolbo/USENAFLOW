import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertProjectSchema, updateProjectSchema, insertProjectNoteSchema, updateProjectNoteSchema, insertTeamTaskSchema, updateTeamTaskSchema, ProjectStatus } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import type { Notification, WebSocketMessage } from "@shared/schema";

// Global WebSocket connections store
const wsConnections = new Map<string, { ws: WebSocket, userId?: string }>();

// Global SSE connections store
let sseConnections: Map<string, { res: any; userId: string; username: string }>;

// Function to broadcast via SSE
function broadcastSSE(message: { type: string; payload?: any }, targetUserId?: string) {
  if (!sseConnections) return;

  for (const [connectionId, connection] of Array.from(sseConnections.entries())) {
    if (targetUserId && connection.userId !== targetUserId) {
      continue; // Skip if targeting specific user and this isn't them
    }

    try {
      connection.res.write(`data: ${JSON.stringify(message)}\n\n`);
    } catch (error) {
      console.error(`Failed to send SSE message to ${connectionId}:`, error);
      sseConnections.delete(connectionId);
    }
  }
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
  // Initialize SSE connections
  sseConnections = new Map();

  // Built-in user credentials for authentication
  const userCredentials = [
    { id: "admin", username: "admin", password: "admin123", role: "Admin", name: "Anesu's Pops", abbreviation: "AP" },
    { id: "sales", username: "sales", password: "sales123", role: "Sales", name: "sales", abbreviation: "SAL" },
    { id: "workflow", username: "workflow", password: "workflow123", role: "LeadRetoucher", name: "Workflow Manager", abbreviation: "WFM" },
    { id: "data", username: "data", password: "data123", role: "DataWrangler", name: "Data Wrangler", abbreviation: "DW" },
    { id: "earl", username: "earl", password: "earl123", role: "Retoucher", name: "Earl", abbreviation: "EC" },
    { id: "asa", username: "asa", password: "asa123", role: "Retoucher", name: "Dr Asa", abbreviation: "ASA" },
    { id: "lucky", username: "lucky", password: "lm123", role: "Retoucher", name: "Lucky", abbreviation: "LM" }
  ];

  // Authentication endpoints
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = userCredentials.find(u => u.username === username && u.password === password);
    
    if (user) {
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          abbreviation: user.abbreviation,
          value: user.role
        }
      });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  });

  app.get("/api/auth/status", (req, res) => {
    // For simplicity, just return success - in production would check session/JWT
    res.json({ authenticated: true });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
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
      
      // Broadcast project creation notification
      const notification: Notification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        type: 'project_created',
        title: 'New Project Created',
        message: `Project "${project.clientName}" has been created`,
        projectId: project.id,
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
            type: 'project_completed',
            title: 'Project Completed!',
            message: `Project "${project.clientName}" has been marked as delivered`,
            projectId: project.id,
            createdAt: new Date(),
            read: false
          };
        } else {
          notification = {
            id: `notif_${Date.now()}_${Math.random()}`,
            type: 'status_change',
            title: 'Project Status Updated',
            message: `Project "${project.clientName}" status changed from "${oldProject.status}" to "${project.status}"`,
            projectId: project.id,
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
          type: 'project_assigned',
          title: 'New Project Assignment',
          message: `You have been assigned to project "${project.clientName}"`,
          projectId: project.id,
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

  // Team Task endpoints
  // Get all team tasks
  app.get("/api/team-tasks", async (req, res) => {
    try {
      const tasks = await storage.getTeamTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team tasks" });
    }
  });

  // Get team tasks for a specific user
  app.get("/api/team-tasks/assigned/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const tasks = await storage.getTeamTasksForUser(userId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user tasks" });
    }
  });

  // Get team tasks created by a specific user
  app.get("/api/team-tasks/created/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const tasks = await storage.getTeamTasksCreatedBy(userId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch created tasks" });
    }
  });

  // Create a new team task
  app.post("/api/team-tasks", async (req, res) => {
    try {
      const validatedData = insertTeamTaskSchema.parse(req.body);
      const task = await storage.createTeamTask(validatedData);
      
      // Broadcast notification to assigned user
      if (task.assignedTo !== task.assignedBy) {
        const notification: Notification = {
          id: `task_${task.id}`,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `${task.assignedBy} assigned you a task: ${task.title}`,
          projectId: task.projectId,
          userId: task.assignedTo,
          createdAt: new Date(),
          read: false
        };
        broadcastNotification(notification, task.assignedTo);
      }

      // Broadcast task creation to all users for live log
      broadcastSSE({
        type: 'task_created',
        payload: task
      });

      res.status(201).json(task);
    } catch (error) {
      console.error('Create team task error:', error);
      res.status(400).json({ error: "Invalid task data" });
    }
  });

  // Update team task status
  app.patch("/api/team-tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateTeamTaskSchema.parse(req.body);
      const task = await storage.updateTeamTask(id, validatedData);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // If task is being marked as completed
      if (validatedData.status === 'completed') {
        // Notify the task creator
        const notification: Notification = {
          id: `task_completed_${task.id}`,
          type: 'task_completed',
          title: 'Task Completed',
          message: `${task.assignedTo} completed task: ${task.title}`,
          projectId: task.projectId,
          userId: task.assignedBy,
          createdAt: new Date(),
          read: false
        };
        broadcastNotification(notification, task.assignedBy);
      }

      // Broadcast task update to all users
      broadcastSSE({
        type: 'task_updated',
        payload: task
      });

      res.json(task);
    } catch (error) {
      res.status(400).json({ error: "Failed to update task" });
    }
  });

  // Delete a team task
  app.delete("/api/team-tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTeamTask(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Broadcast task deletion
      broadcastSSE({
        type: 'task_deleted',
        payload: { id }
      });

      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(400).json({ error: "Failed to delete task" });
    }
  });

  // Server-Sent Events for real-time notifications
  sseConnections = new Map<string, { res: any; userId: string; username: string }>();

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

  return httpServer;
}
