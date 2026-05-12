import { registerGalleryRoutes } from "./galleryRoutes";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertProjectSchema, updateProjectSchema, insertProjectNoteSchema, updateProjectNoteSchema, insertTradeOfferSchema, updateTradeOfferSchema, ProjectStatus, TradeOfferStatus, insertUserSchema, loginUserSchema, insertSneakPeekSchema, sneakPeeks as sneakPeeksTable } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import type { Notification, WebSocketMessage } from "@shared/schema";
import { triggerManualRollover, performManualRolloverToNextWeek, performManualRollbackFromNextWeek } from "./rolloverScheduler";
import { registerShoottrackerRoutes } from "./shoottrackerRoutes";
import { sendChatLinkEmail, sendGalleryDeliveryEmail, sendSneakPeekEmail, sendSatisfactionSurveyEmail, sendSchedulingNotificationEmail, sendManualDelayNoticeEmail, generateToken, sendGoogleReviewPromptEmail } from "./services/emailService";
import { evaluateLeaveRequest, aiTeamChat, generateDailySummaryForAdmin } from "./services/aiService";
import { appSettings } from "@shared/schema";
import { insertLeaveRequestSchema } from "@shared/schema";
import { seedDefaultTemplates } from "./services/defaultEmailTemplates";
import { VipTier } from "@shared/schema";
import { sendStatusUpdateMessage } from './services/chatAutoResponder';
import { scheduleEmail } from './services/emailQueue';
import { verifyAdminRequest } from './middleware/adminAuth';

// Global WebSocket connections store
const wsConnections = new Map<string, { ws: WebSocket, userId?: string }>();

// Global SSE connections store
const sseConnections = new Map<string, { res: any; userId: string; username: string }>();

let forecastCache: { data: any; timestamp: number } | null = null;
let riskCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

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

  // --- AUTOMATION REGISTRY ROUTES ---
  app.get("/api/automations", async (_req, res) => {
    try {
      const { getAllAutomations, getStats } = await import('./services/automationRegistry');
      const automations = getAllAutomations();
      const stats = getStats();
      res.json({ automations, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/automations/stats", async (_req, res) => {
    try {
      const { getStats } = await import('./services/automationRegistry');
      res.json(getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/automations/activity", async (req, res) => {
    try {
      const { getActivityLog } = await import('./services/automationRegistry');
      const automationId = req.query.automationId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      res.json(getActivityLog(automationId, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/automations/:id/toggle", async (req, res) => {
    try {
      const { setEnabled, getAutomation } = await import('./services/automationRegistry');
      const { enabled } = req.body;
      const success = setEnabled(req.params.id, enabled);
      if (!success) return res.status(404).json({ error: "Automation not found" });
      res.json(getAutomation(req.params.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- AI ADMIN INSTRUCTIONS ROUTES (Admin-only) ---
  app.get("/api/ai/admin-instructions", verifyAdminRequest, async (_req, res) => {
    try {
      const instructions = await storage.getAdminInstructions();
      res.json({ instructions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/admin-instructions", verifyAdminRequest, async (req, res) => {
    try {
      const { instruction, category, targetRetoucher, priority, createdBy } = req.body;
      if (!instruction || !createdBy) {
        return res.status(400).json({ error: "instruction and createdBy are required" });
      }
      const created = await storage.createAdminInstruction({
        instruction,
        category: category || "general",
        targetRetoucher: targetRetoucher || null,
        priority: priority || 5,
        isActive: true,
        createdBy,
      });
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ai/admin-instructions/:id", verifyAdminRequest, async (req, res) => {
    try {
      const updated = await storage.updateAdminInstruction(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Instruction not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ai/admin-instructions/:id", verifyAdminRequest, async (req, res) => {
    try {
      const deleted = await storage.deleteAdminInstruction(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Instruction not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- AI MEMORY ROUTES (Admin-only) ---
  app.get("/api/ai/memory", verifyAdminRequest, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const retoucherName = req.query.retoucherName as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const memories = await storage.getAiMemories({ category, retoucherName, limit });
      res.json({ memories, total: memories.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ai/memory", verifyAdminRequest, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const count = await storage.clearAiMemories(category);
      res.json({ cleared: count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ai/memory/:id", verifyAdminRequest, async (req, res) => {
    try {
      const deleted = await storage.deleteAiMemory(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Memory not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/memory/prune", verifyAdminRequest, async (_req, res) => {
    try {
      const { pruneOldMemories } = await import("./services/aiMemoryService");
      await pruneOldMemories();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/data-scan", verifyAdminRequest, async (_req, res) => {
    try {
      const { runFullDataScan } = await import("./services/dataLearningService");
      const results = await runFullDataScan();
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/public/email-logo.png", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const file = await objectStorageService.searchPublicObject("jepson-myles-logo.png");
      if (!file) {
        return res.status(404).send("Logo not found");
      }
      await objectStorageService.downloadObject(file, res, 86400);
    } catch (error) {
      res.status(500).send("Error serving logo");
    }
  });

  app.get("/public/email-images/:filename", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const file = await objectStorageService.searchPublicObject(`email-images/${req.params.filename}`);
      if (!file) {
        return res.status(404).send("Image not found");
      }
      await objectStorageService.downloadObject(file, res, 86400);
    } catch (error) {
      res.status(500).send("Error serving image");
    }
  });

  app.post("/api/admin/upload-email-image", async (req, res) => {
    try {
      const { imageData, fileName, contentType } = req.body;
      if (!imageData || !fileName) {
        return res.status(400).json({ error: "imageData and fileName are required" });
      }

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const ext = fileName.split(".").pop() || "png";
      const uniqueName = `email-images/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const objectStorageService = new ObjectStorageService();
      await objectStorageService.uploadPublicBuffer(
        buffer,
        uniqueName,
        contentType || `image/${ext}`
      );

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const publicUrl = `${baseUrl}/public/${uniqueName}`;

      res.json({ success: true, url: publicUrl, fileName: uniqueName });
    } catch (error: any) {
      console.error("Error uploading email image:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

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

  app.get("/api/ai/insights", async (req, res) => {
    try {
      const allProjects = await storage.getAllProjects();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const statusBreakdown: Record<string, number> = {};
      let totalRating = 0;
      let ratedCount = 0;
      const retoucherStats: Record<string, { completed: number; totalRating: number; ratedCount: number }> = {};
      let thisWeekProjects = 0;
      let lastWeekProjects = 0;
      let overdueCount = 0;
      let recentDeliveries = 0;
      const clientTierBreakdown: Record<string, number> = {};

      for (const p of allProjects) {
        statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;

        if (p.rating) {
          totalRating += p.rating;
          ratedCount++;
        }

        if (p.assignedTo) {
          if (!retoucherStats[p.assignedTo]) {
            retoucherStats[p.assignedTo] = { completed: 0, totalRating: 0, ratedCount: 0 };
          }
          if (p.status === "Delivered" || p.status === "Done") {
            retoucherStats[p.assignedTo].completed++;
          }
          if (p.rating) {
            retoucherStats[p.assignedTo].totalRating += p.rating;
            retoucherStats[p.assignedTo].ratedCount++;
          }
        }

        const created = new Date(p.createdAt);
        if (created >= weekAgo) thisWeekProjects++;
        if (created >= twoWeeksAgo && created < weekAgo) lastWeekProjects++;

        if (p.riskLevel === "OVERDUE") overdueCount++;
        if (p.deliveredAt && new Date(p.deliveredAt) >= weekAgo) recentDeliveries++;

        const tier = (p as any).vipTier || "Standard";
        clientTierBreakdown[tier] = (clientTierBreakdown[tier] || 0) + 1;
      }

      const topRetouchers = Object.entries(retoucherStats)
        .map(([name, stats]) => ({
          name,
          completed: stats.completed,
          avgRating: stats.ratedCount > 0 ? Math.round((stats.totalRating / stats.ratedCount) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 5);

      const { generateProjectInsights } = await import("./services/aiService");
      const insights = await generateProjectInsights({
        totalProjects: allProjects.length,
        statusBreakdown,
        thisWeekProjects,
        lastWeekProjects,
        overdueCount,
        avgRating: ratedCount > 0 ? Math.round((totalRating / ratedCount) * 10) / 10 : null,
        topRetouchers,
        recentDeliveries,
        clientTierBreakdown,
      });

      res.json({ insights, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("Failed to generate insights:", error);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  app.get("/api/ai/retoucher-advice/:retoucherName", async (req, res) => {
    try {
      const { retoucherName } = req.params;
      const allProjects = await storage.getAllProjects();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const myProjects = allProjects.filter(
        (p) => p.assignedTo && p.assignedTo.toLowerCase() === retoucherName.toLowerCase()
      );

      const completedProjects = myProjects.filter(
        (p) => p.status === "Delivered" || p.status === "Done"
      ).length;
      const activeProjects = myProjects.filter(
        (p) => p.status === "Assigned" || p.status === "Review"
      ).length;
      const overdueProjects = myProjects.filter(
        (p) => p.riskLevel === "OVERDUE"
      ).length;

      const ratings = myProjects
        .filter((p) => p.rating)
        .map((p) => p.rating!);
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;
      const recentRatings = myProjects
        .filter((p) => p.rating && p.deliveredAt && new Date(p.deliveredAt) >= weekAgo)
        .map((p) => p.rating!);

      const turnarounds = myProjects
        .filter((p) => p.deliveredAt && p.createdAt)
        .map((p) => {
          const start = new Date(p.createdAt).getTime();
          const end = new Date(p.deliveredAt!).getTime();
          return (end - start) / (1000 * 60 * 60 * 24);
        });
      const avgTurnaroundDays = turnarounds.length > 0
        ? Math.round((turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) * 10) / 10
        : null;

      const { generateRetoucherAdvice } = await import("./services/aiService");
      const result = await generateRetoucherAdvice({
        name: retoucherName,
        completedProjects,
        activeProjects,
        overdueProjects,
        avgRating,
        recentRatings,
        avgTurnaroundDays,
      });

      res.json({ ...result, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("Failed to generate retoucher advice:", error);
      res.status(500).json({ error: "Failed to generate retoucher advice" });
    }
  });

  app.post("/api/ai/review-photos", async (req, res) => {
    try {
      const { projectId } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const driveFolderId = (project as any).driveFolderId;
      if (!driveFolderId) {
        return res.status(400).json({ error: "No Drive folder linked to this project" });
      }

      const { getImageThumbnails } = await import("./services/googleDriveService");
      const images = await getImageThumbnails(driveFolderId, 6);

      if (images.length === 0) {
        return res.status(400).json({ error: "No photos found in the project folder" });
      }

      const photos = images
        .filter((img) => img.thumbnailLink)
        .map((img) => ({
          name: img.name,
          thumbnailUrl: img.thumbnailLink!,
        }));

      if (photos.length === 0) {
        return res.status(400).json({ error: "No photo thumbnails available for review" });
      }

      const { reviewDrivePhotos } = await import("./services/aiService");
      const review = await reviewDrivePhotos(photos);

      res.json({
        ...review,
        projectName: project.clientName,
        photosReviewed: photos.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Failed to review photos:", error);
      res.status(500).json({ error: "Failed to review photos" });
    }
  });

  app.post("/api/ai/suggest-reply", async (req, res) => {
    try {
      const { clientName, projectName, recentMessages, draftMessage } = req.body;
      if (!clientName || !projectName || !recentMessages) {
        return res.status(400).json({ error: "clientName, projectName, and recentMessages are required" });
      }

      const { suggestChatReply } = await import("./services/aiService");
      const suggestion = await suggestChatReply({
        clientName,
        projectName,
        recentMessages,
        draftMessage,
      });

      res.json({ suggestion });
    } catch (error: any) {
      console.error("Failed to suggest reply:", error);
      res.status(500).json({ error: "Failed to suggest reply" });
    }
  });

  app.get("/api/ai/workload-forecast", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (forecastCache && Date.now() - forecastCache.timestamp < CACHE_TTL) {
        return res.json(forecastCache.data);
      }

      const allProjects = await storage.getAllProjects();
      const allUsers = await storage.getAllUsers();
      const shootSettings = await storage.getAppSetting("shoottracker_settings") as any;
      const leaveRequests = await storage.getLeaveRequests();

      const now = new Date();
      const sixWeeksOut = new Date(now.getTime() + 6 * 7 * 24 * 60 * 60 * 1000);

      const upcomingProjects = allProjects.filter((p) => {
        if (p.status === "Delivered" || p.status === "Cancelled") return false;
        const shootDate = p.shootDate ? new Date(p.shootDate) : null;
        const dueDate = p.deliveryDueDate ? new Date(p.deliveryDueDate) : p.dueDate ? new Date(p.dueDate) : null;
        if (shootDate && shootDate <= sixWeeksOut && shootDate >= now) return true;
        if (dueDate && dueDate <= sixWeeksOut && dueDate >= now) return true;
        return false;
      });

      const retoucherUsers = allUsers.filter((u) => u.role.startsWith("Retoucher") || u.role === "LeadRetoucher");
      const backlogByRetoucher = retoucherUsers.map((u) => {
        const active = allProjects.filter((p) => p.assignedTo === u.name && p.status !== "Delivered" && p.status !== "Cancelled");
        const overdue = active.filter((p) => p.riskLevel === "OVERDUE");
        return { name: u.name, active: active.length, overdue: overdue.length };
      });

      const weeklyBreakdown: { weekStart: string; projectsDue: number; newShoots: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const weekStart = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const projectsDue = allProjects.filter((p) => {
          const due = p.deliveryDueDate ? new Date(p.deliveryDueDate) : p.dueDate ? new Date(p.dueDate) : null;
          return due && due >= weekStart && due < weekEnd && p.status !== "Delivered" && p.status !== "Cancelled";
        }).length;
        const newShoots = allProjects.filter((p) => {
          const shoot = p.shootDate ? new Date(p.shootDate) : null;
          return shoot && shoot >= weekStart && shoot < weekEnd;
        }).length;
        weeklyBreakdown.push({ weekStart: weekStart.toISOString().split("T")[0], projectsDue, newShoots });
      }

      const approvedLeave = leaveRequests.filter((lr) => {
        if (lr.status !== "approved") return false;
        const start = new Date(lr.startDate);
        const end = new Date(lr.endDate);
        return end >= now && start <= sixWeeksOut;
      }).map((lr) => ({ username: lr.username, startDate: lr.startDate as unknown as string, endDate: lr.endDate as unknown as string }));

      const dailyCapacity = shootSettings?.value?.dailyCapacity || 10;

      const { generateWorkloadForecast } = await import("./services/aiService");
      const forecast = await generateWorkloadForecast({
        upcomingProjects: upcomingProjects.map((p) => ({
          clientName: p.clientName,
          shootDate: p.shootDate ? new Date(p.shootDate).toISOString() : "",
          deliveryDueDate: p.deliveryDueDate ? new Date(p.deliveryDueDate).toISOString() : p.dueDate ? new Date(p.dueDate).toISOString() : "",
          status: p.status,
          assignedTo: p.assignedTo,
        })),
        currentBacklog: { total: backlogByRetoucher.reduce((sum, r) => sum + r.active, 0), byRetoucher: backlogByRetoucher },
        teamCapacity: { dailyCapacity, totalRetouchers: retoucherUsers.length, retoucherNames: retoucherUsers.map((u) => u.name) },
        approvedLeave,
        weeklyBreakdown,
      });

      const responseData = { ...forecast, generatedAt: new Date().toISOString() };
      forecastCache = { data: responseData, timestamp: Date.now() };
      res.json(responseData);
    } catch (error: any) {
      console.error("Failed to generate workload forecast:", error);
      res.status(500).json({ error: "Failed to generate workload forecast" });
    }
  });

  app.get("/api/ai/predictive-risk", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (riskCache && Date.now() - riskCache.timestamp < CACHE_TTL) {
        return res.json(riskCache.data);
      }

      const allProjects = await storage.getAllProjects();
      const allUsers = await storage.getAllUsers();
      const now = new Date();

      const activeProjects = allProjects.filter((p) =>
        p.status === "Assigned" || p.status === "Review" || p.status === "Ready for Retouching"
      );

      const activeWithDays = activeProjects.map((p) => {
        const dueDate = p.deliveryDueDate ? new Date(p.deliveryDueDate) : p.dueDate ? new Date(p.dueDate) : now;
        const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: p.id,
          clientName: p.clientName,
          assignedTo: p.assignedTo,
          status: p.status,
          dueDate: p.dueDate ? new Date(p.dueDate).toISOString() : "",
          deliveryDueDate: p.deliveryDueDate ? new Date(p.deliveryDueDate).toISOString() : null,
          daysRemaining,
          selectedCount: p.selectedCount,
        };
      });

      const retoucherUsers = allUsers.filter((u) => u.role.startsWith("Retoucher") || u.role === "LeadRetoucher");
      const retoucherHistory = await Promise.all(
        retoucherUsers.map(async (u) => {
          const stats = await storage.getRetoucherSpeedStats(u.username);
          const retoucherActive = activeProjects.filter((p) => p.assignedTo === u.name);
          const retoucherOverdue = retoucherActive.filter((p) => p.riskLevel === "OVERDUE");
          return {
            name: u.name,
            avgTurnaroundDays: stats.avgMinutes > 0 ? Math.round((stats.avgMinutes / 60 / 24) * 10) / 10 : 0,
            completedCount: stats.totalProjects,
            overdueRate: retoucherActive.length > 0 ? Math.round((retoucherOverdue.length / retoucherActive.length) * 100) / 100 : 0,
            currentLoad: retoucherActive.length,
          };
        })
      );

      const deliveredProjects = allProjects.filter((p) => p.status === "Delivered" && p.deliveredAt && p.createdAt);
      const completionTimes = deliveredProjects.map((p) => {
        const start = new Date(p.createdAt).getTime();
        const end = new Date(p.deliveredAt!).getTime();
        return (end - start) / (1000 * 60 * 60 * 24);
      });
      const avgCompletionDays = completionTimes.length > 0 ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10 : 0;
      const overdueProjects = allProjects.filter((p) => p.riskLevel === "OVERDUE");
      const overduePercentage = allProjects.length > 0 ? Math.round((overdueProjects.length / allProjects.length) * 100) / 100 : 0;

      const { generatePredictiveRiskAlerts } = await import("./services/aiService");
      const alerts = await generatePredictiveRiskAlerts({
        activeProjects: activeWithDays,
        retoucherHistory,
        historicalPatterns: { avgCompletionDays, overduePercentage },
      });

      const responseData = { ...alerts, generatedAt: new Date().toISOString() };
      riskCache = { data: responseData, timestamp: Date.now() };
      res.json(responseData);
    } catch (error: any) {
      console.error("Failed to generate predictive risk alerts:", error);
      res.status(500).json({ error: "Failed to generate predictive risk alerts" });
    }
  });

  app.post("/api/ai/quality-gate", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin" && role !== "LeadRetoucher") {
        return res.status(403).json({ error: "Admin or LeadRetoucher access required" });
      }

      const { projectId } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const qualitySettings = await storage.getAppSetting("quality_gate_settings") as any;
      const threshold = qualitySettings?.threshold ?? 7;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const driveFolderId = (project as any).driveFolderId;
      if (!driveFolderId) {
        return res.status(400).json({ error: "No Drive folder linked to this project" });
      }

      const { getImageThumbnails } = await import("./services/googleDriveService");
      const images = await getImageThumbnails(driveFolderId, 6);

      const photos = images
        .filter((img) => img.thumbnailLink)
        .map((img) => ({
          name: img.name,
          thumbnailUrl: img.thumbnailLink!,
        }));

      if (photos.length === 0) {
        return res.status(400).json({ error: "No photo thumbnails available for quality review" });
      }

      let referenceUrls: string[] = [];
      try {
        const refSetting = await storage.getAppSetting("quality_reference_images") as any;
        if (refSetting && Array.isArray(refSetting)) {
          referenceUrls = refSetting;
        }
      } catch (e) {}

      const { evaluateQualityGate } = await import("./services/aiService");
      const result = await evaluateQualityGate({
        projectName: project.clientName,
        photos,
        threshold,
        referenceImageUrls: referenceUrls.length > 0 ? referenceUrls : undefined,
      });

      await storage.updateProject(projectId, {
        qualityGateScore: result.overallScore,
        qualityGatePassed: result.passed,
        qualityGateAt: new Date(),
        qualityGateFeedback: result,
      } as any);

      res.json({ ...result, projectName: project.clientName, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("Failed to evaluate quality gate:", error);
      res.status(500).json({ error: "Failed to evaluate quality gate" });
    }
  });

  app.post("/api/ai/quality-gate/override", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { projectId, overrideBy } = req.body;
      if (!projectId || !overrideBy) {
        return res.status(400).json({ error: "projectId and overrideBy are required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if ((project as any).qualityGatePassed === true) {
        return res.status(400).json({ error: "Quality gate has already passed, no override needed" });
      }

      if (!(project as any).qualityGateScore && (project as any).qualityGateScore !== 0) {
        return res.status(400).json({ error: "No quality gate result found for this project" });
      }

      const updatedProject = await storage.updateProject(projectId, {
        qualityGateOverride: true,
        qualityGateOverrideBy: overrideBy,
        qualityGateOverrideAt: new Date(),
      } as any);

      res.json(updatedProject);
    } catch (error: any) {
      console.error("Failed to override quality gate:", error);
      res.status(500).json({ error: "Failed to override quality gate" });
    }
  });

  app.get("/api/quality-reference-images", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const images = await storage.getAppSetting("quality_reference_images") as any;
      res.json({ images: Array.isArray(images) ? images : [] });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get reference images" });
    }
  });

  app.post("/api/quality-reference-images", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { urls } = req.body;
      if (!Array.isArray(urls)) {
        return res.status(400).json({ error: "urls must be an array of image URLs" });
      }
      await storage.setAppSetting("quality_reference_images", urls);
      res.json({ success: true, count: urls.length });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to save reference images" });
    }
  });

  app.post("/api/quality-reference-images/add", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url is required" });
      }
      const existing = await storage.getAppSetting("quality_reference_images") as any;
      const images = Array.isArray(existing) ? existing : [];
      if (!images.includes(url)) {
        images.push(url);
      }
      await storage.setAppSetting("quality_reference_images", images);
      res.json({ success: true, count: images.length });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add reference image" });
    }
  });

  app.delete("/api/quality-reference-images", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url is required" });
      }
      const existing = await storage.getAppSetting("quality_reference_images") as any;
      const images = Array.isArray(existing) ? existing : [];
      const filtered = images.filter((u: string) => u !== url);
      await storage.setAppSetting("quality_reference_images", filtered);
      res.json({ success: true, count: filtered.length });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove reference image" });
    }
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

      try {
        const { createDriveFolderForProject } = await import('./services/driveMonitorService');
        await createDriveFolderForProject(project.id);
        console.log(`📁 Auto-created Drive folder for ${project.clientName}`);
      } catch (driveErr: any) {
        console.error(`📁 Drive folder creation failed for ${project.clientName}: ${driveErr.message}`);
      }
      
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

      if (oldProject && oldProject.status !== project.status) {
        const changedBy = req.headers["x-usena-user-id"] as string || req.headers["x-usena-role"] as string || "unknown";
        try {
          await storage.recordStatusTransition(id, oldProject.status, project.status, changedBy);
        } catch (err: any) {
          console.error(`[Speed Tracking] Failed to record transition:`, err.message);
        }

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

        sendStatusUpdateMessage(project.id, oldProject.status, project.status);
      }

      // Check if project was just assigned to a retoucher (assignedTo changed from null/different to a new value)
      const wasJustAssigned = validatedData.assignedTo && 
        validatedData.assignedTo !== "__UNASSIGN__" && 
        oldProject && 
        oldProject.assignedTo !== validatedData.assignedTo;
      
      console.log(`[Assignment Check] wasJustAssigned=${wasJustAssigned}, newAssignedTo=${validatedData.assignedTo}, oldAssignedTo=${oldProject?.assignedTo}`);
      
      if (wasJustAssigned && oldProject?.clientEmail && validatedData.assignedTo) {
        const assignedToRetoucher = validatedData.assignedTo;
        const capturedClientEmail = oldProject.clientEmail;
        const capturedClientName = project.clientName;
        const capturedProjectId = project.id;
        console.log(`[Email] Project ${capturedClientName} assigned to ${assignedToRetoucher} — queuing chat link email (30 min delay)`);

        scheduleEmail(`${capturedProjectId}:chat-link`, 30 * 60 * 1000, async () => {
          try {
            const retoucherUser = await storage.getUserByUsername(assignedToRetoucher);
            const retoucherDisplayName = retoucherUser?.username || assignedToRetoucher;

            let chatToken: string;
            const existingToken = await storage.getClientAuthTokenByProjectId(capturedProjectId);

            if (existingToken && new Date(existingToken.expiresAt) > new Date()) {
              chatToken = existingToken.token;
              console.log(`[Email] Reusing existing chat token for project ${capturedProjectId}`);
            } else {
              chatToken = generateToken();
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30);
              await storage.createClientAuthToken({
                token: chatToken,
                projectId: capturedProjectId,
                email: capturedClientEmail,
                expiresAt,
              });
              console.log(`[Email] Created new chat token for project ${capturedProjectId}`);
            }

            console.log(`[Email] Sending deferred chat link email: client=${capturedClientName}, retoucher=${retoucherDisplayName}`);
            const emailResult = await sendChatLinkEmail(
              capturedClientEmail,
              capturedClientName,
              retoucherDisplayName,
              capturedProjectId,
              chatToken
            );
            if (emailResult.success) {
              console.log(`[Email] Successfully sent chat link email to ${capturedClientEmail}`);
            } else {
              console.error(`[Email] Failed to send chat link email: ${emailResult.error}`);
            }
          } catch (emailError) {
            console.error('[Email] Error sending deferred chat link email:', emailError);
          }
        });
      }

      // Check if dueDate was changed - send scheduling notification (30 min delay)
      if (validatedData.dueDate && oldProject && oldProject.clientEmail) {
        const oldDue = oldProject.dueDate ? new Date(oldProject.dueDate).toDateString() : null;
        const newDue = new Date(validatedData.dueDate).toDateString();
        if (oldDue !== newDue) {
          const capturedClientEmail = oldProject.clientEmail;
          const capturedClientName = project.clientName;
          const capturedProjectId = project.id;
          const dueDate = new Date(validatedData.dueDate);
          const weekStart = new Date(dueDate);
          weekStart.setDate(dueDate.getDate() - dueDate.getDay() + 1); // Monday
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 4); // Friday

          console.log(`[Email] Delivery week changed for ${capturedClientName} — queuing scheduling notification (30 min delay)`);

          scheduleEmail(`${capturedProjectId}:scheduling`, 30 * 60 * 1000, async () => {
            try {
              await sendSchedulingNotificationEmail(
                capturedClientEmail,
                capturedClientName,
                weekStart,
                weekEnd,
                capturedProjectId
              );
              console.log(`[Email] Deferred scheduling notification sent to ${capturedClientEmail} for project ${capturedClientName}`);
            } catch (emailError) {
              console.error('[Email] Error sending deferred scheduling notification:', emailError);
            }
          });
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
        
        // Queue welcome email to client with chat link (30 min delay)
        console.log(`[Email Debug] Checking email conditions: clientEmail=${project.clientEmail}, updatedProject=${!!updatedProject}`);
        if (project.clientEmail && updatedProject) {
          const capturedClientEmail = project.clientEmail;
          const capturedClientName = project.clientName;
          const capturedProjectId = project.id;
          const capturedAssignedTo = assignedTo;
          console.log(`[Email] Project ${capturedClientName} assigned to ${capturedAssignedTo} — queuing chat link email (30 min delay)`);

          scheduleEmail(`${capturedProjectId}:chat-link`, 30 * 60 * 1000, async () => {
            try {
              const retoucherUser = await storage.getUserByUsername(capturedAssignedTo);
              const retoucherDisplayName = retoucherUser?.username || capturedAssignedTo;
              console.log(`[Email Debug] Retoucher display name: ${retoucherDisplayName}`);

              let chatToken: string;
              const existingToken = await storage.getClientAuthTokenByProjectId(capturedProjectId);

              if (existingToken && new Date(existingToken.expiresAt) > new Date()) {
                chatToken = existingToken.token;
              } else {
                chatToken = generateToken();
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);
                await storage.createClientAuthToken({
                  token: chatToken,
                  projectId: capturedProjectId,
                  email: capturedClientEmail,
                  expiresAt,
                });
              }

              console.log(`[Email Debug] Sending deferred chat link email: email=${capturedClientEmail}, client=${capturedClientName}, retoucher=${retoucherDisplayName}`);
              const emailResult = await sendChatLinkEmail(
                capturedClientEmail,
                capturedClientName,
                retoucherDisplayName,
                capturedProjectId,
                chatToken
              );
              if (emailResult.success) {
                console.log(`[Email] Sent deferred chat link email to ${capturedClientEmail} for project ${capturedClientName} (retoucher: ${retoucherDisplayName})`);
              } else {
                console.error(`[Email] Failed to send deferred chat link email: ${emailResult.error}`);
              }
            } catch (emailError) {
              console.error('[Email] Failed to send deferred chat link email:', emailError);
            }
          });
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

      const qualitySettings = await storage.getAppSetting("quality_gate_settings") as any;
      const qualityGateEnabled = qualitySettings?.enabled !== false;
      if (qualityGateEnabled && (project as any).driveFolderId) {
        const hasPassedGate = (project as any).qualityGatePassed === true || (project as any).qualityGateOverride === true;
        if (!hasPassedGate) {
          return res.status(400).json({ error: "Quality gate has not been passed. Please run quality review first or request an admin override.", qualityGateRequired: true });
        }
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
      const { rating, communicationRating, feedback, wouldRecommend } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      if (communicationRating && (communicationRating < 1 || communicationRating > 5)) {
        return res.status(400).json({ error: "Communication rating must be between 1 and 5" });
      }
      const updated = await storage.updateSurvey(survey.id, {
        rating,
        communicationRating: communicationRating || null,
        feedback: feedback || null,
        wouldRecommend: wouldRecommend ?? null,
        completedAt: new Date(),
      });
      const googleReviewPrompt = rating === 5;

      try {
        const { storeMemory } = await import("./services/aiMemoryService");
        const project = await storage.getProject(survey.projectId);
        const assignedTo = project?.assignedTo || null;
        const feedbackSummary = feedback ? ` Feedback: "${feedback.substring(0, 150)}"` : "";
        const recommendNote = wouldRecommend === true ? " Would recommend." : wouldRecommend === false ? " Would NOT recommend." : "";
        await storeMemory({
          type: "feedback",
          category: "client_feedback",
          content: `Client ${survey.clientName} rated project ${rating}/5 (communication: ${communicationRating || "N/A"}/5).${feedbackSummary}${recommendNote}`,
          context: { source: "survey_submission" },
          retoucherName: assignedTo,
          projectId: survey.projectId,
          importance: rating <= 2 ? 9 : rating >= 4 ? 5 : 7,
          expiresAt: null,
        });
      } catch (memErr: any) {
        console.error("[AI Memory] Failed to store survey learning:", memErr.message);
      }

      res.json({ ...updated, googleReviewPrompt });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit survey" });
    }
  });

  // Click-tracking redirect for the Google review button (works in survey page + email)
  const GOOGLE_REVIEW_URL = "https://g.page/r/CZmxAdbD8i6uEAE/review";

  app.get("/r/google/:token", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (survey && !survey.googleClickedAt) {
        await storage.updateSurvey(survey.id, { googleClickedAt: new Date() });
      }
    } catch (err: any) {
      console.error("[ReviewTrack] google click error:", err.message);
    }
    res.redirect(302, GOOGLE_REVIEW_URL);
  });

  app.get("/r/copy/:token", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (!survey) {
        return res.status(404).send("<h1>Link expired</h1>");
      }
      if (!survey.copyClickedAt) {
        await storage.updateSurvey(survey.id, { copyClickedAt: new Date() });
      }
      // Safely encode feedback as a JS string literal AND neutralize </script> sequences
      const feedbackJson = JSON.stringify(survey.feedback || "")
        .replace(/</g, "\\u003C")
        .replace(/>/g, "\\u003E")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
      const googleUrlJson = JSON.stringify(GOOGLE_REVIEW_URL).replace(/</g, "\\u003C");
      const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Copying review…</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: Arial, sans-serif; background: #faf7f0; color: #2c2c2c; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
  .card { background: white; border-radius: 12px; padding: 32px; max-width: 460px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; }
  h1 { color: #2c2c2c; font-size: 22px; margin: 0 0 12px; }
  p { color: #555; line-height: 1.6; margin: 8px 0; }
  .feedback { background: #faf7f0; border-left: 4px solid #c9a961; padding: 14px 16px; margin: 16px 0; text-align: left; font-style: italic; border-radius: 6px; white-space: pre-wrap; }
  .btn { display: inline-block; background: #2563EB; color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; margin-top: 16px; }
  .ok { color: #4CAF7D; font-weight: 600; }
</style></head>
<body>
  <div class="card">
    <h1>Your review is copied! &#10003;</h1>
    <p class="ok">Now paste it on Google.</p>
    <div class="feedback" id="fb"></div>
    <p>If the copy didn't work, tap below to copy manually, then paste on Google.</p>
    <a class="btn" href="${GOOGLE_REVIEW_URL}" id="goBtn">Open Google review page</a>
  </div>
<script>
  var text = ${feedbackJson};
  var goUrl = ${googleUrlJson};
  document.getElementById('fb').textContent = '"' + text + '"';
  function doCopy() {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }
  doCopy().finally(function(){
    setTimeout(function(){ window.location.href = goUrl; }, 1800);
  });
</script>
</body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      console.error("[ReviewTrack] copy click error:", err.message);
      res.redirect(302, GOOGLE_REVIEW_URL);
    }
  });

  // Admin: list all surveys (completed + pending)
  app.get("/api/admin/surveys", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;
      if (!role || !userId) {
        return res.status(401).json({ error: "Unauthorized: Missing user identification" });
      }
      if (!["Admin", "Sales", "LeadRetoucher"].includes(role)) {
        return res.status(403).json({ error: "Forbidden: Admin, Sales, or Lead Retoucher access required" });
      }
      const surveys = await storage.getAllSurveys();
      const projectMap = new Map<string, any>();
      const allProjects = await storage.getAllProjects();
      for (const p of allProjects) projectMap.set(p.id, p);
      const enriched = surveys.map((s) => {
        const p = projectMap.get(s.projectId);
        return {
          ...s,
          projectName: p?.clientName || s.clientName,
          projectAssignedTo: p?.assignedTo || null,
          projectDeliveredAt: p?.deliveredAt || null,
        };
      });
      res.json(enriched);
    } catch (error: any) {
      console.error("[AdminSurveys]", error);
      res.status(500).json({ error: "Failed to load surveys" });
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

  // ==================== REWARDS SYSTEM ====================

  app.post("/api/rewards/sync", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { syncRewards } = await import('./services/rewardsEngine');
      const yearsBack = req.body?.yearsBack || 2;
      const result = await syncRewards(yearsBack);
      res.json(result);
    } catch (error: any) {
      console.error("Error syncing rewards:", error);
      res.status(500).json({ error: "Failed to sync rewards: " + error.message });
    }
  });

  app.get("/api/rewards/summary", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const { getRewardsSummary } = await import('./services/rewardsEngine');
      const summary = await getRewardsSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error getting rewards summary:", error);
      res.status(500).json({ error: "Failed to get rewards summary" });
    }
  });

  app.delete("/api/rewards/clients/:email", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const email = decodeURIComponent(req.params.email);
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      await storage.deleteClientProfileByEmail(email);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting reward client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  app.get("/api/rewards/clients", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const profiles = await storage.getAllClientProfiles();
      const rewardClients = profiles
        .map(p => ({
          id: p.id,
          clientName: p.clientName,
          clientEmail: p.clientEmail,
          totalBookings: p.totalBookings || 0,
          referralMatchCount: p.referralMatchCount || 0,
          rewardScore: p.rewardScore || 0,
          rewardTier: p.rewardTier || 'Bronze',
          vipTier: p.vipTier,
          bonusPhotos: p.bonusPhotos || 0,
          bonusPhotosUsed: p.bonusPhotosUsed || 0,
          totalDelivered: p.totalDelivered || 0,
          firstProjectAt: p.firstProjectAt,
          lastProjectAt: p.lastProjectAt,
          lastRewardSyncAt: p.lastRewardSyncAt,
        }))
        .sort((a, b) => b.rewardScore - a.rewardScore);
      res.json(rewardClients);
    } catch (error) {
      console.error("Error getting reward clients:", error);
      res.status(500).json({ error: "Failed to get reward clients" });
    }
  });

  app.post("/api/rewards/send-email", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (!role || !["Admin", "Sales"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { tier, subject, message, clientEmails } = req.body;
      if (!subject || !message) {
        return res.status(400).json({ error: "Subject and message are required" });
      }

      const { getResendClient } = await import('./services/emailService');
      const { client, fromEmail } = await getResendClient();

      const allProfiles = await storage.getAllClientProfiles();
      const emailToFirstName = new Map<string, string>();
      for (const p of allProfiles) {
        if (p.clientEmail && p.clientName) {
          const rawFirst = p.clientName.trim().split(/\s+/)[0] || '';
          const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
          emailToFirstName.set(p.clientEmail.toLowerCase(), firstName);
        }
      }

      let recipients: string[] = [];
      if (clientEmails && Array.isArray(clientEmails) && clientEmails.length > 0) {
        recipients = clientEmails.filter((e: string) => e && !e.includes('@unknown.pending'));
      } else if (tier) {
        recipients = allProfiles
          .filter(p => p.rewardTier === tier && p.clientEmail && !p.clientEmail.includes('@unknown.pending') && !p.unsubscribed && !p.clientEmail.startsWith('unsubscribed_'))
          .map(p => p.clientEmail);
      }

      if (recipients.length === 0) {
        return res.status(400).json({ error: "No valid email addresses found for the selected clients" });
      }

      const fs = await import('fs');
      const path = await import('path');
      const jmLogoPath = path.resolve('attached_assets/image_1770646812353.png');
      let jmLogoDataUri = '';
      try {
        const buf = fs.readFileSync(jmLogoPath);
        jmLogoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
      } catch {
        // fall back to text if file missing
      }
      const studioHeader = jmLogoDataUri
        ? `<img src="${jmLogoDataUri}" alt="Jepson Myles Studio" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />`
        : `<h1 style="color: #1a1a1a; font-size: 24px; margin: 0; font-family: Arial, sans-serif;">Jepson Myles Studio</h1>`;

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const email of recipients) {
        try {
          const unsubToken = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const unsubLink = `${baseUrl}/unsubscribe/${unsubToken}`;

          const firstName = emailToFirstName.get(email.toLowerCase()) || '';
          const greeting = firstName ? `Hi ${firstName},<br><br>` : `Hi there,<br><br>`;

          await client.emails.send({
            from: fromEmail,
            to: email,
            subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  ${studioHeader}
                </div>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
                  ${greeting}${message.replace(/\n/g, '<br>')}
                </div>
                <div style="text-align: center; color: #888; font-size: 12px; margin-top: 20px;">
                  <p>Jepson Myles Studio | Photography Excellence</p>
                  <p style="margin-top: 8px;"><a href="${unsubLink}" style="color: #888; text-decoration: underline;">Unsubscribe</a></p>
                </div>
              </div>
            `,
          });
          sent++;
        } catch (err: any) {
          failed++;
          errors.push(`${email}: ${err.message}`);
        }
      }

      res.json({ sent, failed, total: recipients.length, errors });
    } catch (error: any) {
      console.error("Error sending rewards email:", error);
      res.status(500).json({ error: error.message || "Failed to send emails" });
    }
  });

  app.get("/api/rewards/unsubscribe", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ error: "Invalid unsubscribe link" });
      }

      const paddedToken = token.replace(/-/g, '+').replace(/_/g, '/');
      const email = Buffer.from(paddedToken, 'base64').toString('utf-8').toLowerCase();
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Invalid unsubscribe link" });
      }

      const profile = await storage.getClientProfile(email);
      if (profile) {
        await storage.updateClientProfile(profile.id, {
          unsubscribed: true,
          unsubscribedAt: new Date(),
          clientEmail: `unsubscribed_${Date.now()}_${email}`,
        });
      }

      res.json({ success: true, message: "You have been unsubscribed successfully" });
    } catch (error: any) {
      console.error("Error processing unsubscribe:", error);
      res.status(500).json({ error: "Failed to process unsubscribe request" });
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
      const logoPath = "attached_assets/image_1770646812353.png";
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
  registerGalleryRoutes(app);

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

  // --- Email Template Admin Routes ---
  app.get("/api/admin/email-templates", async (req, res) => {
    try {
      const templates = await storage.getAllEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  app.get("/api/admin/email-templates/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const template = await storage.getEmailTemplateByKey(key);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Error fetching email template:", error);
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  app.put("/api/admin/email-templates/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const { subject, htmlBody } = req.body;
      const template = await storage.getEmailTemplateByKey(key);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      const updated = await storage.updateEmailTemplate(template.id, {
        subject: subject || template.subject,
        htmlBody: htmlBody || template.htmlBody,
        isCustomized: true,
      });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating email template:", error);
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  app.post("/api/admin/email-templates/:key/reset", async (req, res) => {
    try {
      const { key } = req.params;
      const template = await storage.getEmailTemplateByKey(key);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      const { DEFAULT_EMAIL_TEMPLATES } = await import('./services/defaultEmailTemplates');
      const defaultTemplate = DEFAULT_EMAIL_TEMPLATES.find(t => t.templateKey === key);
      if (!defaultTemplate) {
        return res.status(404).json({ error: "Default template not found" });
      }
      const updated = await storage.updateEmailTemplate(template.id, {
        subject: defaultTemplate.subject,
        htmlBody: defaultTemplate.htmlBody,
        isCustomized: false,
      });
      res.json(updated);
    } catch (error: any) {
      console.error("Error resetting email template:", error);
      res.status(500).json({ error: "Failed to reset email template" });
    }
  });

  // Seed default email templates
  seedDefaultTemplates(storage).catch(err => console.error('Failed to seed email templates:', err));

  // ============================================
  // Google Drive Integration Routes
  // ============================================

  // Test Drive connection
  app.get("/api/drive/test", verifyAdminRequest, async (req, res) => {
    try {
      const { testDriveConnection } = await import('./services/googleDriveService');
      const result = await testDriveConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ connected: false, error: error.message });
    }
  });

  app.post("/api/test-delivery-email", verifyAdminRequest, async (req, res) => {
    try {
      const { sendGalleryDeliveryEmail } = await import('./services/emailService');
      const testEmail = "jepsonmylesphotography@gmail.com";
      const testClientName = "Test Client";
      const testGalleryLink = "https://drive.google.com/drive/folders/test-gallery-link";
      const testProjectId = "test-delivery-email";

      const result = await sendGalleryDeliveryEmail(
        testEmail,
        testClientName,
        testGalleryLink,
        testProjectId
      );

      res.json({ success: result.success, message: `Test delivery email sent to ${testEmail}`, details: result });
    } catch (error: any) {
      console.error('Test delivery email error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test-drive-folder", verifyAdminRequest, async (req, res) => {
    try {
      const driveService = await import('./services/googleDriveService');
      const { sendGalleryDeliveryEmail } = await import('./services/emailService');
      const testEmail = "jepsonmylesphotography@gmail.com";
      const testClientName = "Test Client";

      const folder = await driveService.createFolder("USENA Test Delivery Folder");
      console.log(`📁 Test folder created: ${folder.id}`);

      const shareLink = await driveService.generateShareLink(folder.id);
      console.log(`🔗 Generated link for test folder (no access granted)`);

      const emailResult = await sendGalleryDeliveryEmail(
        testEmail,
        testClientName,
        shareLink,
        "test-drive-folder"
      );
      console.log(`📧 Sent branded delivery email to ${testEmail}`);

      res.json({
        success: true,
        message: `Test folder created (private, no access granted) and branded delivery email sent via Resend`,
        folder: {
          id: folder.id,
          name: folder.name,
          link: shareLink,
        },
        email: emailResult,
      });
    } catch (error: any) {
      console.error('Test Drive folder error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Drive folder for a project
  app.post("/api/drive/create-folder/:projectId", verifyAdminRequest, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { parentFolderId } = req.body || {};
      const { createDriveFolderForProject } = await import('./services/driveMonitorService');
      const result = await createDriveFolderForProject(projectId, parentFolderId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Drive folder creation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Drive folders for multiple projects
  app.post("/api/drive/create-folders-batch", verifyAdminRequest, async (req, res) => {
    try {
      const { projectIds, parentFolderId } = req.body;
      if (!Array.isArray(projectIds)) {
        return res.status(400).json({ error: "projectIds must be an array" });
      }
      const { createDriveFolderForProject } = await import('./services/driveMonitorService');
      const results: any[] = [];
      for (const projectId of projectIds) {
        try {
          const result = await createDriveFolderForProject(projectId, parentFolderId);
          results.push({ projectId, success: true, ...result });
        } catch (err: any) {
          results.push({ projectId, success: false, error: err.message });
        }
      }
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Manual scan of all project folders
  app.post("/api/drive/scan", verifyAdminRequest, async (req, res) => {
    try {
      const { scanAllProjectFolders } = await import('./services/driveMonitorService');
      const results = await scanAllProjectFolders();
      res.json({
        scanned: results.length,
        complete: results.filter(r => r.status === 'complete').length,
        incomplete: results.filter(r => r.status === 'incomplete').length,
        over: results.filter(r => r.status === 'over').length,
        deliveriesTriggered: results.filter(r => r.deliveryTriggered).length,
        bwEmailsTriggered: results.filter(r => r.bwEmailTriggered).length,
        results,
      });
    } catch (error: any) {
      console.error('Drive scan error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Scan a single project folder
  app.post("/api/drive/scan/:projectId", verifyAdminRequest, async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (!project.driveFolderId) return res.status(400).json({ error: "No Drive folder linked to this project" });

      const { scanProjectFolder } = await import('./services/driveMonitorService');
      const result = await scanProjectFolder(project);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Drive folder stats for a project
  app.get("/api/drive/stats/:projectId", verifyAdminRequest, async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (!project.driveFolderId) return res.json({ hasDriveFolder: false });

      const { getFolderStats, countImagesInFolder } = await import('./services/googleDriveService');
      const mainStats = await getFolderStats(project.driveFolderId);
      let bwStats = null;
      if (project.driveBwFolderId) {
        bwStats = await countImagesInFolder(project.driveBwFolderId);
      }

      res.json({
        hasDriveFolder: true,
        folderId: project.driveFolderId,
        folderName: project.driveFolderName,
        bwFolderId: project.driveBwFolderId,
        selectedCount: project.selectedCount,
        mainFolder: {
          imageCount: mainStats.imageCount,
          totalFiles: mainStats.totalFiles,
          totalSizeBytes: mainStats.totalSizeBytes,
        },
        bwFolder: bwStats ? {
          imageCount: bwStats.imageCount,
          totalFiles: bwStats.totalFiles,
          totalSizeBytes: bwStats.totalSizeBytes,
        } : null,
        driveDeliveryComplete: project.driveDeliveryComplete,
        driveGalleryLink: project.driveGalleryLink,
        driveBwSent: project.driveBwSent,
        driveLastCheckedAt: project.driveLastCheckedAt,
        driveClientAccessedAt: project.driveClientAccessedAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Drive overview for all projects (dashboard)
  app.get("/api/drive/overview", verifyAdminRequest, async (req, res) => {
    try {
      const allProjects = await storage.getAllProjects();
      const projectsWithDrive = allProjects.filter(p => p.driveFolderId);
      const projectsWithoutDrive = allProjects.filter(p => !p.driveFolderId && p.status !== 'Done' && p.status !== 'Delivered');

      const totalStorage = projectsWithDrive.reduce((sum, p) => sum + (p.driveStorageBytes || 0), 0);
      const completeCount = projectsWithDrive.filter(p => p.driveDeliveryComplete).length;
      const incompleteCount = projectsWithDrive.filter(p => !p.driveDeliveryComplete && p.drivePhotoCount < p.selectedCount).length;
      const overCount = projectsWithDrive.filter(p => p.drivePhotoCount > p.selectedCount).length;
      const bwSentCount = projectsWithDrive.filter(p => p.driveBwSent).length;

      res.json({
        totalProjects: allProjects.length,
        projectsWithDrive: projectsWithDrive.length,
        projectsNeedingFolders: projectsWithoutDrive.length,
        totalStorageBytes: totalStorage,
        deliveryComplete: completeCount,
        deliveryIncomplete: incompleteCount,
        overDelivered: overCount,
        bwPreviewsSent: bwSentCount,
        projects: projectsWithDrive.map(p => ({
          id: p.id,
          clientName: p.clientName,
          selectedCount: p.selectedCount,
          drivePhotoCount: p.drivePhotoCount,
          driveBwPhotoCount: p.driveBwPhotoCount || 0,
          driveStorageBytes: p.driveStorageBytes,
          driveDeliveryComplete: p.driveDeliveryComplete,
          driveGalleryLink: p.driveGalleryLink,
          driveBwSent: p.driveBwSent,
          driveFolderName: p.driveFolderName,
          driveLastCheckedAt: p.driveLastCheckedAt,
          status: p.status,
          dueDate: p.dueDate,
        })),
        needingFolders: projectsWithoutDrive.map(p => ({
          id: p.id,
          clientName: p.clientName,
          selectedCount: p.selectedCount,
          status: p.status,
          dueDate: p.dueDate,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start/stop Drive monitor
  app.post("/api/drive/monitor/start", verifyAdminRequest, async (req, res) => {
    try {
      const { startDriveMonitor } = await import('./services/driveMonitorService');
      startDriveMonitor();
      res.json({ success: true, message: "Drive monitor started" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drive/monitor/stop", verifyAdminRequest, async (req, res) => {
    try {
      const { stopDriveMonitor } = await import('./services/driveMonitorService');
      stopDriveMonitor();
      res.json({ success: true, message: "Drive monitor stopped" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate share link for a project folder
  app.post("/api/drive/share/:projectId", verifyAdminRequest, async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (!project.driveFolderId) return res.status(400).json({ error: "No Drive folder linked" });

      const { generateShareLink } = await import('./services/googleDriveService');
      const link = await generateShareLink(project.driveFolderId);

      await storage.updateProject(projectId, {
        driveGalleryLink: link,
        galleryLink: link,
        galleryLinkAddedAt: new Date(),
        galleryLinkAddedBy: 'Manual Drive Share',
      } as any);

      res.json({ success: true, galleryLink: link });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Link an existing Drive folder to a project
  app.post("/api/drive/link/:projectId", verifyAdminRequest, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { folderId } = req.body;
      if (!folderId) return res.status(400).json({ error: "folderId is required" });

      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const { checkFolderExists } = await import('./services/googleDriveService');
      const exists = await checkFolderExists(folderId);
      if (!exists) return res.status(400).json({ error: "Folder not found in Drive" });

      await storage.updateProject(projectId, {
        driveFolderId: folderId,
      } as any);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // E2EE Key Exchange Routes
  // ============================================
  app.get("/api/chat/encryption-key/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const result = await storage.getChatEncryptionKey(projectId);
      if (!result) {
        return res.status(404).json({ error: "No encryption key found" });
      }
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching encryption key:", error);
      res.status(500).json({ error: "Failed to fetch encryption key" });
    }
  });

  app.post("/api/chat/encryption-key/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { encryptionKey, createdBy } = req.body;
      if (!encryptionKey || !createdBy) {
        return res.status(400).json({ error: "encryptionKey and createdBy are required" });
      }
      await storage.setChatEncryptionKey(projectId, encryptionKey, createdBy);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error storing encryption key:", error);
      res.status(500).json({ error: "Failed to store encryption key" });
    }
  });

  // ============================================
  // WebRTC Voice Call Signaling Routes
  // ============================================
  const activeCalls = new Map<string, {
    offer?: any;
    answer?: any;
    callerType: string;
    iceCandidates: { client: any[]; retoucher: any[] };
    status: 'ringing' | 'connected' | 'ended';
    createdAt: number;
  }>();

  function cleanupOldCalls() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, call] of activeCalls) {
      if (call.createdAt < fiveMinutesAgo) {
        activeCalls.delete(key);
      }
    }
  }

  app.post("/api/chat/call/initiate/:projectId", async (req, res) => {
    try {
      cleanupOldCalls();
      const { projectId } = req.params;
      const { callerType, offer } = req.body;
      if (!callerType || !offer) {
        return res.status(400).json({ error: "callerType and offer are required" });
      }
      activeCalls.set(projectId, {
        offer,
        callerType,
        iceCandidates: { client: [], retoucher: [] },
        status: 'ringing',
        createdAt: Date.now(),
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to initiate call" });
    }
  });

  app.get("/api/chat/call/status/:projectId", async (req, res) => {
    try {
      cleanupOldCalls();
      const { projectId } = req.params;
      const call = activeCalls.get(projectId);
      if (!call || call.status === 'ended') {
        return res.json({ active: false });
      }
      res.json({
        active: true,
        status: call.status,
        callerType: call.callerType,
        offer: call.offer,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get call status" });
    }
  });

  app.post("/api/chat/call/answer/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { answer } = req.body;
      const call = activeCalls.get(projectId);
      if (!call) {
        return res.status(404).json({ error: "No active call" });
      }
      call.answer = answer;
      call.status = 'connected';
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to answer call" });
    }
  });

  app.get("/api/chat/call/answer/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const call = activeCalls.get(projectId);
      if (!call || !call.answer) {
        return res.json({ answered: false });
      }
      res.json({ answered: true, answer: call.answer });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get answer" });
    }
  });

  app.post("/api/chat/call/ice/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { candidate, from } = req.body;
      const call = activeCalls.get(projectId);
      if (!call) {
        return res.status(404).json({ error: "No active call" });
      }
      if (from === 'client') {
        call.iceCandidates.client.push(candidate);
      } else {
        call.iceCandidates.retoucher.push(candidate);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to send ICE candidate" });
    }
  });

  app.get("/api/chat/call/ice/:projectId/:role", async (req, res) => {
    try {
      const { projectId, role } = req.params;
      const call = activeCalls.get(projectId);
      if (!call) {
        return res.json({ candidates: [] });
      }
      const candidates = role === 'client' ? call.iceCandidates.retoucher : call.iceCandidates.client;
      res.json({ candidates });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get ICE candidates" });
    }
  });

  app.post("/api/chat/call/end/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const call = activeCalls.get(projectId);
      if (call) {
        call.status = 'ended';
      }
      activeCalls.delete(projectId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to end call" });
    }
  });

  // Speed stats API
  app.get("/api/speed-stats", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const allUsers = await storage.getAllUsers();
      const retouchers = allUsers.filter(u => ['Retoucher1', 'Retoucher2', 'Retoucher3'].includes(u.role));

      const stats = await Promise.all(
        retouchers.map(async (r) => ({
          username: r.name,
          role: r.role,
          ...(await storage.getRetoucherSpeedStats(r.name)),
        }))
      );

      res.json({ retoucherStats: stats });
    } catch (error: any) {
      console.error("[Speed Stats] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch speed stats" });
    }
  });

  // Leave Management API
  app.post("/api/leave/request", async (req, res) => {
    try {
      const username = req.headers["x-usena-user-id"] as string;
      if (!username) {
        return res.status(401).json({ error: "User not identified" });
      }

      const { startDate, endDate, weekdaysCount, reason, leaveType } = req.body;
      if (!startDate || !endDate || !weekdaysCount || !reason || !leaveType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const year = new Date(startDate).getFullYear();
      const usedDays = await storage.getUsedLeaveDays(username, year);

      const allProjects = await storage.getAllProjects();
      const userProjects = allProjects.filter(p => p.assignedTo === username);
      const overdueProjects = userProjects.filter(p => p.dueDate && new Date(p.dueDate) < new Date() && p.status !== 'Delivered').length;
      const pendingProjects = userProjects.filter(p => p.status !== 'Delivered').length;

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const upcomingDueCount = userProjects.filter(p => p.dueDate && new Date(p.dueDate) <= sevenDaysFromNow && p.status !== 'Delivered').length;

      const existingLeaves = await storage.getLeaveRequests(undefined, year);
      const reqStart = new Date(startDate);
      const reqEnd = new Date(endDate);
      const teamMembersOnLeave = existingLeaves
        .filter(l => l.username !== username && l.status === 'approved' &&
          new Date(l.startDate) <= reqEnd && new Date(l.endDate) >= reqStart)
        .map(l => l.username)
        .filter((v, i, a) => a.indexOf(v) === i);

      const aiResult = await evaluateLeaveRequest({
        username,
        startDate,
        endDate,
        weekdaysCount,
        reason,
        leaveType,
        usedDays,
        maxDays: 15,
        pendingProjects,
        overdueProjects,
        upcomingDueCount,
        teamMembersOnLeave,
      });

      const leaveRequest = await storage.createLeaveRequest({
        username,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        weekdaysCount,
        reason,
        leaveType,
        status: aiResult.decision === 'approved' ? 'approved' : aiResult.decision === 'denied' ? 'denied' : 'pending',
        year,
      });

      const updated = await storage.updateLeaveRequest(leaveRequest.id, {
        aiDecision: aiResult.decision,
        aiReason: aiResult.reason,
      });

      res.json(updated || leaveRequest);
    } catch (error: any) {
      console.error("[Leave] Error creating request:", error.message);
      res.status(500).json({ error: "Failed to create leave request" });
    }
  });

  app.get("/api/leave/requests", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      const username = req.headers["x-usena-user-id"] as string;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;

      if (role === "Admin") {
        const requests = await storage.getLeaveRequests(undefined, year);
        return res.json(requests);
      }

      if (!username) {
        return res.status(401).json({ error: "User not identified" });
      }

      const requests = await storage.getLeaveRequests(username, year);
      res.json(requests);
    } catch (error: any) {
      console.error("[Leave] Error fetching requests:", error.message);
      res.status(500).json({ error: "Failed to fetch leave requests" });
    }
  });

  app.post("/api/leave/:id/review", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { id } = req.params;
      const { status } = req.body;
      const reviewedBy = req.headers["x-usena-user-id"] as string || "Admin";

      if (!status || !['approved', 'denied'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'approved' or 'denied'" });
      }

      const updated = await storage.updateLeaveRequest(id, {
        status,
        reviewedBy,
        reviewedAt: new Date(),
      });

      if (!updated) {
        return res.status(404).json({ error: "Leave request not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[Leave] Error reviewing request:", error.message);
      res.status(500).json({ error: "Failed to review leave request" });
    }
  });

  // === AI TEAM CHAT ROUTES ===

  app.post("/api/ai-chat/message", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;
      const { message } = req.body;

      if (!userId || !role || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const history = await storage.getAiTeamMessages(userId, 20);
      const conversationHistory = history.map((m: any) => ({
        sender: m.sender_type || m.senderType,
        message: m.message,
      }));

      const allProjects = await storage.getAllProjects();
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const overdueProjects = allProjects
        .filter((p: any) => p.status !== "Delivered" && p.dueDate && new Date(p.dueDate) < now)
        .map((p: any) => ({
          id: p.id,
          clientName: p.clientName,
          assignedTo: p.assignedTo || "Unassigned",
          dueDate: p.dueDate,
          status: p.status,
        }));

      const yesterdayIncomplete = allProjects
        .filter((p: any) => {
          if (!p.dueDate || p.status === "Delivered") return false;
          const due = new Date(p.dueDate);
          return due >= yesterday && due <= yesterdayEnd;
        })
        .map((p: any) => ({
          id: p.id,
          clientName: p.clientName,
          assignedTo: p.assignedTo || "Unassigned",
          dueDate: p.dueDate,
          status: p.status,
        }));

      const users = await storage.getAllUsers();
      const retouchers = users.filter((u: any) => u.role === "Retoucher" || u.role === "SeniorRetoucher");

      const retoucherStats = [];
      const speedStats = [];
      for (const r of retouchers) {
        const userProjects = allProjects.filter((p: any) => p.assignedTo === r.username);
        const completed = userProjects.filter((p: any) => p.status === "Delivered").length;
        const active = userProjects.filter((p: any) => p.status !== "Delivered" && p.status !== "Cancelled").length;
        const overdue = userProjects.filter((p: any) => p.status !== "Delivered" && p.dueDate && new Date(p.dueDate) < now).length;
        const ratings = userProjects.filter((p: any) => p.qualityRating != null).map((p: any) => p.qualityRating);
        const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;
        retoucherStats.push({ name: r.username, completed, active, overdue, avgRating });

        try {
          const speed = await storage.getRetoucherSpeedStats(r.username);
          speedStats.push({ name: r.username, avgMinutes: speed.avgMinutes });
        } catch {
          speedStats.push({ name: r.username, avgMinutes: 0 });
        }
      }

      const activeLeaves = await storage.getLeaveRequests();
      const teamOnLeave = activeLeaves
        .filter((l: any) => l.status === "approved" && new Date(l.startDate) <= now && new Date(l.endDate) >= now)
        .map((l: any) => ({
          username: l.username,
          startDate: l.startDate,
          endDate: l.endDate,
        }));

      const guidelinesResult = await db.select().from(appSettings).where(eq(appSettings.key, "retouching_guidelines"));
      const retouchingGuidelines = String(guidelinesResult[0]?.value || "");

      const isExplanation = /late|delay|couldn'?t|sorry|behind|issue|problem|stuck/i.test(message);
      const metadata = isExplanation && role !== "Admin" && role !== "LeadRetoucher"
        ? { type: "explanation" }
        : undefined;

      await storage.createAiTeamMessage({
        username: userId,
        role,
        senderType: "user",
        message,
        metadata: metadata || undefined,
      });

      const activeProjects = allProjects
        .filter((p: any) => p.status !== "Delivered" && p.status !== "Cancelled")
        .map((p: any) => ({
          id: p.id,
          clientName: p.clientName,
          assignedTo: p.assignedTo || "Unassigned",
          dueDate: p.dueDate,
          status: p.status,
        }));

      const aiResult = await aiTeamChat({
        username: userId,
        role,
        message,
        conversationHistory,
        projectData: {
          totalProjects: allProjects.length,
          overdueProjects,
          yesterdayIncomplete,
          activeProjects,
          retoucherStats,
          speedStats,
          teamOnLeave,
        },
        retouchingGuidelines,
      });

      if (aiResult.actions.filter(a => a.type === "MESSAGE_RETOUCHER").length === 0 && (role === "Admin" || role === "LeadRetoucher")) {
        const messageIntent = /(?:send|message|follow up|check on|ask|reach out|contact).*(?:team|retoucher|member)/i.test(message);
        if (messageIntent) {
          const retoucherNames = retoucherStats.map((r: any) => r.name);
          const mentionedRetouchers: { name: string; context: string }[] = [];
          for (const name of retoucherNames) {
            const namePattern = new RegExp(`(?:to\\s+\\*{0,2}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*{0,2})[:\\s]*[""]([^""]+)[""]`, 'i');
            const match2 = namePattern.exec(aiResult.text);
            if (match2) {
              mentionedRetouchers.push({ name, context: match2[1] });
            }
          }
          for (const r of mentionedRetouchers) {
            aiResult.actions.push({
              type: "MESSAGE_RETOUCHER",
              projectId: "",
              projectName: "",
              targetUser: r.name,
              messageText: r.context,
            });
          }
          if (mentionedRetouchers.length > 0) {
            console.log(`[AI Action] Auto-detected ${mentionedRetouchers.length} message intents from AI response text`);
          }
        }
      }

      const executedActions: string[] = [];
      if (aiResult.actions.length > 0 && (role === "Admin" || role === "LeadRetoucher")) {
        for (const action of aiResult.actions) {
          if (action.type === "MARK_DONE") {
            try {
              await storage.updateProject(action.projectId, { status: "Delivered" });
              executedActions.push(`Marked "${action.projectName}" as Delivered`);
              console.log(`[AI Action] Marked project ${action.projectId} (${action.projectName}) as Delivered by ${userId}`);
            } catch (err: any) {
              console.error(`[AI Action] Failed to mark project ${action.projectId}:`, err.message);
              executedActions.push(`Failed to mark "${action.projectName}" — project not found`);
            }
          } else if (action.type === "MESSAGE_RETOUCHER" && action.targetUser && action.messageText) {
            try {
              await storage.createAiTeamMessage({
                username: action.targetUser,
                role: "AI",
                senderType: "ai",
                message: action.messageText,
              });
              executedActions.push(`📨 Sent message to **${action.targetUser}**: "${action.messageText.substring(0, 80)}${action.messageText.length > 80 ? '...' : ''}"`);
              console.log(`[AI Action] Sent message to retoucher ${action.targetUser} on behalf of admin ${userId}`);
            } catch (err: any) {
              console.error(`[AI Action] Failed to message ${action.targetUser}:`, err.message);
              executedActions.push(`Failed to message ${action.targetUser}`);
            }
          }
        }
      }

      const responseText = executedActions.length > 0
        ? `${aiResult.text}\n\n✅ **Actions completed:**\n${executedActions.map(a => `- ${a}`).join("\n")}`
        : aiResult.text;

      await storage.createAiTeamMessage({
        username: userId,
        role,
        senderType: "ai",
        message: responseText,
      });

      res.json({ response: responseText });
    } catch (error: any) {
      console.error("[AI Chat] Error:", error.message);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  app.get("/api/ai-chat/messages", async (req, res) => {
    try {
      const userId = req.headers["x-usena-user-id"] as string;
      if (!userId) return res.status(400).json({ error: "Missing user ID" });

      const limit = parseInt(req.query.limit as string) || 50;
      const messages = await storage.getAiTeamMessages(userId, limit);
      res.json(messages);
    } catch (error: any) {
      console.error("[AI Chat] Error fetching messages:", error.message);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/ai-chat/admin/summary", async (req, res) => {
    try {
      const role = req.headers["x-usena-role"] as string;
      if (role !== "Admin" && role !== "LeadRetoucher") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const allProjects = await storage.getAllProjects();
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const yesterdayIncomplete = allProjects
        .filter((p: any) => {
          if (!p.dueDate || p.status === "Delivered") return false;
          const due = new Date(p.dueDate);
          return due >= yesterday && due <= yesterdayEnd;
        })
        .map((p: any) => ({
          clientName: p.clientName,
          assignedTo: p.assignedTo || "Unassigned",
          dueDate: p.dueDate,
          status: p.status,
        }));

      const explanations = await storage.getRecentRetoucherExplanations(yesterday);
      const retoucherExplanations = explanations.map((e: any) => ({
        username: e.username,
        message: e.message,
        timestamp: e.created_at || e.createdAt,
      }));

      const users = await storage.getAllUsers();
      const retouchers = users.filter((u: any) => u.role === "Retoucher" || u.role === "SeniorRetoucher");
      const retoucherStats = retouchers.map((r: any) => {
        const userProjects = allProjects.filter((p: any) => p.assignedTo === r.username);
        return {
          name: r.username,
          completed: userProjects.filter((p: any) => p.status === "Delivered").length,
          active: userProjects.filter((p: any) => p.status !== "Delivered" && p.status !== "Cancelled").length,
          overdue: userProjects.filter((p: any) => p.status !== "Delivered" && p.dueDate && new Date(p.dueDate) < now).length,
        };
      });

      const summary = await generateDailySummaryForAdmin({
        yesterdayIncomplete,
        retoucherExplanations,
        retoucherStats,
      });

      res.json({ summary });
    } catch (error: any) {
      console.error("[AI Chat] Error generating summary:", error.message);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // AI Chat unread count (x-usena-user-id stores the user's name, not UUID)
  app.get("/api/ai-chat/unread-count", async (req, res) => {
    try {
      const username = req.headers["x-usena-user-id"] as string;
      if (!username) return res.json({ count: 0 });

      const lastSeenSetting = await storage.getAppSetting(`ai_chat_last_seen_${username}`) as any;
      const lastSeenValue = lastSeenSetting?.value || lastSeenSetting;
      const lastSeen = lastSeenValue && typeof lastSeenValue === 'string' ? new Date(lastSeenValue) : new Date(0);

      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM ai_team_messages
        WHERE username = ${username} AND sender_type = 'ai' AND created_at > ${lastSeen}
      `);
      const count = Number((result.rows[0] as any)?.count || 0);
      res.json({ count });
    } catch (error: any) {
      console.error("[AI Chat] Error fetching unread count:", error.message);
      res.json({ count: 0 });
    }
  });

  // AI Chat mark as seen
  app.post("/api/ai-chat/mark-seen", async (req, res) => {
    try {
      const username = req.headers["x-usena-user-id"] as string;
      if (!username) return res.status(400).json({ error: "Missing user ID" });

      await storage.setAppSetting(`ai_chat_last_seen_${username}`, new Date().toISOString());
      res.json({ success: true });
    } catch (error: any) {
      console.error("[AI Chat] Error marking seen:", error.message);
      res.status(500).json({ error: "Failed to mark seen" });
    }
  });

  // Start Drive monitor automatically
  try {
    const { startDriveMonitor } = await import('./services/driveMonitorService');
    startDriveMonitor();
    console.log('✅ Drive monitor started');
  } catch (err: any) {
    console.error('Failed to start Drive monitor:', err.message);
  }

  // Start 9 AM morning check scheduler
  try {
    const { startMorningCheckScheduler } = await import('./services/morningCheckScheduler');
    startMorningCheckScheduler();
    console.log('✅ Morning AI check scheduler started');
  } catch (err: any) {
    console.error('Failed to start morning check scheduler:', err.message);
  }

  return httpServer;
}
