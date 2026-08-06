import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { campaignBus } from "./events";
import { verifyAdminOrLeadRequest, verifyAdminRequest } from "./middleware/adminAuth";
import { runPacingEngine, ensureNoelCampaign, calculateNoelDueDate } from "./services/campaignScheduler";
import { recordFired } from "./services/automationRegistry";
import {
  sendNoelDeliveryEstimateEmail,
  sendNoelPhotosReadyEmail,
  sendNoelSurveyEmail,
  sendNoelSelectionEmail,
} from "./services/emailService";
import { UserRoles } from "@shared/schema";
import { syncNoelCalendar, checkAndSendPhotosReadyEmail } from "./campaignCalendarSync";
import { createFolder, makeFolderPublic } from "./services/googleDriveService";

const CAMPAIGN_ROLES = [
  UserRoles.ADMIN,
  UserRoles.LEAD_RETOUCHER,
  UserRoles.DATA_WRANGLER,
  UserRoles.RETOUCHER_1,
  UserRoles.RETOUCHER_2,
  UserRoles.RETOUCHER_3,
];

// DataWrangler needs cockpit access for count entry + project listing.
// Assignment remains admin-only (verifyAdminRequest guards /assign separately).
const COCKPIT_ROLES = [UserRoles.ADMIN, UserRoles.LEAD_RETOUCHER, UserRoles.DATA_WRANGLER];
const RETOUCHER_ROLES = [UserRoles.RETOUCHER_1, UserRoles.RETOUCHER_2, UserRoles.RETOUCHER_3];

function verifyCampaignCockpit(req: Request, res: Response, next: Function) {
  const role = req.headers["x-usena-role"] as string;
  const userId = req.headers["x-usena-user-id"] as string;
  if (!role || !userId) return res.status(401).json({ error: "Unauthorized" });
  if (!COCKPIT_ROLES.includes(role as any)) return res.status(403).json({ error: "Cockpit access: Admin, Lead or Data Wrangler only" });
  next();
}

function verifyCampaignWorkspace(req: Request, res: Response, next: Function) {
  const role = req.headers["x-usena-role"] as string;
  const userId = req.headers["x-usena-user-id"] as string;
  if (!role || !userId) return res.status(401).json({ error: "Unauthorized" });
  if (!CAMPAIGN_ROLES.includes(role as any)) return res.status(403).json({ error: "Campaign workspace access required" });
  next();
}

export function registerCampaignRoutes(app: Express): void {

  // GET /api/campaign — returns the active Noël campaign + summary (Cockpit only)
  app.get("/api/campaign", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getActiveCampaign();
      if (!campaign) return res.json({ campaign: null });
      const projects = await storage.getCampaignProjects(campaign.id);
      const assignments = await storage.getCampaignAssignments(campaign.id);
      const pacing = await runPacingEngine(campaign.id).catch(() => null);
      const snapshots = await storage.getVelocitySnapshots(campaign.id, 14);
      res.json({ campaign, projects, assignments, pacing, snapshots });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/campaign/projects — per-retoucher scoped project list
  // Admin/Lead/DataWrangler: all campaign projects
  // Retoucher roles: only their own projects, gated by campaignAssignments table
  app.get("/api/campaign/projects", verifyCampaignWorkspace, async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getActiveCampaign();
      if (!campaign) return res.json([]);

      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;

      const allProjects = await storage.getCampaignProjects(campaign.id);

      if (RETOUCHER_ROLES.includes(role as any)) {
        // Enforce campaignAssignments gating: only return projects for retouchers
        // who have an entry in the assignments table for this campaign
        const assignments = await storage.getCampaignAssignments(campaign.id);
        const isAssigned = assignments.some((a) => a.retoucherId === userId);
        if (!isAssigned) return res.json([]);
        // Return only this retoucher's assigned projects
        const myProjects = allProjects.filter(
          (p) => p.assignedRetoucherId === userId || p.assignedTo === userId
        );
        return res.json(myProjects);
      }

      res.json(allProjects);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/campaign/projects/:id/count — DataWrangler enters photo count
  app.patch("/api/campaign/projects/:id/count", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { selectedPhotoCount } = req.body;
      if (typeof selectedPhotoCount !== "number" || selectedPhotoCount < 0) {
        return res.status(400).json({ error: "selectedPhotoCount must be a non-negative number" });
      }
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });

      const updates: Record<string, any> = { selectedPhotoCount };

      // Auto-create Drive folder when photo count is entered for the first time
      if (selectedPhotoCount > 0 && !project.driveFolderId) {
        try {
          const folderName = `${project.clientName} – Noël 2026`;
          const folder = await createFolder(folderName);
          const shareLink = await makeFolderPublic(folder.id);
          updates.driveFolderId = folder.id;
          updates.driveFolderName = folderName;
          updates.driveGalleryLink = shareLink;
          console.log(`📁 Noël: Drive folder created for "${project.clientName}" → ${folder.id}`);
        } catch (driveErr: any) {
          console.error(`📁 Noël: Drive folder creation failed for "${project.clientName}":`, driveErr.message);
        }
      }

      const updated = await storage.updateProject(id, updates);
      campaignBus.emit("project.countEntered", { projectId: id, campaignId: project.campaignId!, photoCount: selectedPhotoCount });
      recordFired("noel_count_entry", `Photo count set to ${selectedPhotoCount} for project ${id}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaign/sync-calendar — manual Noël calendar sync trigger
  app.post("/api/campaign/sync-calendar", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const result = await syncNoelCalendar();
      recordFired("noel_calendar_sync", `Noël sync: ${result.created} created, ${result.updated} updated`);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/campaign/projects/:id/assign — admin-only: assign retoucher to a campaign project
  app.patch("/api/campaign/projects/:id/assign", verifyAdminRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { retoucherId, retoucherName } = req.body;
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });

      const updated = await storage.updateProject(id, {
        assignedRetoucherId: retoucherId,
        assignedTo: retoucherId,
      });

      await storage.upsertCampaignAssignment({
        campaignId: project.campaignId,
        retoucherId,
        retoucherName: retoucherName || retoucherId,
        totalAssigned: 1,
      });

      // Work-date rescheduling is handled by the nightly pacing cron (event-bus only
      // coordination — direct scheduler calls bypass automation toggle behavior).
      recordFired("noel_assignment", `Project ${id} assigned to ${retoucherId}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/campaign/projects/:id/move — move PLANNED WORK DATE (retoucher day-grid drag)
  // Does NOT change the promised delivery date communicated to the client.
  // Fires no client notifications; triggers reschedule only.
  app.patch("/api/campaign/projects/:id/move", verifyCampaignWorkspace, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newDate } = req.body;
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;

      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });

      // Ownership check — retouchers may only move their own projects (prevents IDOR)
      if (RETOUCHER_ROLES.includes(role as any)) {
        if (project.assignedRetoucherId !== userId && project.assignedTo !== userId) {
          return res.status(403).json({ error: "You can only manage your own assigned projects" });
        }
        const assignments = await storage.getCampaignAssignments(project.campaignId);
        if (!assignments.some((a) => a.retoucherId === userId)) {
          return res.status(403).json({ error: "Not assigned to this campaign" });
        }
      }

      const parsedDate = new Date(newDate);
      const hardDeadline = new Date("2026-12-19T23:59:59");
      if (parsedDate > hardDeadline) {
        return res.status(400).json({ error: "Cannot move work date past the hard deadline (19 Dec 2026)" });
      }
      const promisedDate = project.promisedDeliveryDate || project.deliveryDueDate;
      const breaksDeadline = promisedDate && parsedDate > new Date(promisedDate);

      const updated = await storage.updateProject(id, { plannedWorkDate: parsedDate });
      // Emit project.moved so noel_work_scheduler triggers a full reschedule
      campaignBus.emit("project.moved", {
        projectId: id,
        campaignId: project.campaignId,
        newDate: parsedDate,
        oldDate: project.plannedWorkDate ? new Date(project.plannedWorkDate) : parsedDate,
        slipDays: 0,
      });
      recordFired("noel_work_scheduler", `Work date moved for ${id} → ${parsedDate.toDateString()}`);
      res.json({ project: updated, breaksDeadline: !!breaksDeadline });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/campaign/projects/:id/move/preview — ripple preview (no DB write)
  app.get("/api/campaign/projects/:id/move/preview", verifyCampaignWorkspace, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newDate } = req.query as { newDate: string };
      const role = req.headers["x-usena-role"] as string;
      const userId = req.headers["x-usena-user-id"] as string;

      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });

      // Ownership check — retouchers may only preview their own projects (prevents IDOR)
      if (RETOUCHER_ROLES.includes(role as any)) {
        if (project.assignedRetoucherId !== userId && project.assignedTo !== userId) {
          return res.status(403).json({ error: "You can only preview your own assigned projects" });
        }
      }

      const parsedDate = new Date(newDate);
      const promisedDate = project.promisedDeliveryDate || project.deliveryDueDate;
      const currentWorkDate = project.plannedWorkDate;
      const currentDeadline = promisedDate ? new Date(promisedDate) : new Date("2026-12-19");
      const slipCalendarDays = promisedDate
        ? Math.round((parsedDate.getTime() - currentDeadline.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const breaksDeadline = parsedDate > currentDeadline;
      const pullForwardAvailable =
        parsedDate < (currentWorkDate ? new Date(currentWorkDate) : parsedDate);

      res.json({
        projectId: id,
        currentWorkDate,
        proposedWorkDate: parsedDate,
        promisedDeliveryDate: promisedDate,
        breaksDeadline,
        slipCalendarDays,
        pullForwardAvailable,
        requiresClientNotification: breaksDeadline,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/campaign/projects/:id/reschedule — change PROMISED DELIVERY DATE (Admin/Lead only)
  // This is the operation that triggers client notifications via the date-change debounce.
  app.patch("/api/campaign/projects/:id/reschedule", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newDate, changedBy } = req.body;
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });

      const parsedDate = new Date(newDate);
      const hardDeadline = new Date("2026-12-19T23:59:59");
      if (parsedDate > hardDeadline) {
        return res.status(400).json({ error: "Cannot reschedule past the hard deadline (19 Dec 2026)" });
      }

      const oldDate = project.promisedDeliveryDate;
      // No-op guard: if new date equals current promise, skip event emission
      if (oldDate && parsedDate.toISOString().slice(0, 10) === new Date(oldDate).toISOString().slice(0, 10)) {
        return res.json(project);
      }

      const history: any[] = (project.dueDateHistory as any[]) || [];
      history.push({
        date: oldDate,
        changedAt: new Date().toISOString(),
        changedBy: changedBy || "admin",
      });

      const updated = await storage.updateProject(id, {
        promisedDeliveryDate: parsedDate,
        dueDate: parsedDate,
        dueDateHistory: history,
      });

      if (oldDate) {
        const slipDays = Math.round((parsedDate.getTime() - new Date(oldDate).getTime()) / (1000 * 60 * 60 * 24));
        const payload = {
          projectId: id,
          campaignId: project.campaignId!,
          newDate: parsedDate,
          oldDate: new Date(oldDate),
          slipDays,
        };
        campaignBus.emit("project.dateChanged", payload);
        campaignBus.emit("project.moved", payload);
      }

      recordFired("noel_date_move", `Project ${id} rescheduled to ${parsedDate.toDateString()}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaign/projects/:id/mark-delivered — manual "Mark Delivered" fallback
  // Used when Drive auto-detection didn't fire or retoucher wants to manually complete.
  app.post("/api/campaign/projects/:id/mark-delivered", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });
      if (project.status === "Delivered") return res.json({ message: "Already delivered", project });

      const updated = await storage.updateProject(id, {
        status: "Delivered",
        deliveredAt: new Date(),
        deliveryApproved: true,
        deliveryApprovedAt: new Date(),
        deliveryApprovedBy: (req.headers["x-usena-user-id"] as string) || "admin",
      });

      // Trigger the same delivery chain as Drive would
      campaignBus.emit("project.driveComplete", { projectId: id, campaignId: project.campaignId! });
      recordFired("noel_delivery_chain", `Manual mark-delivered for ${project.clientName}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // POST /api/campaign/projects/:id/email/estimate — Email 1: delivery estimate (manual trigger)
  app.post("/api/campaign/projects/:id/email/estimate", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });
      if (!project.clientEmail) return res.status(400).json({ error: "No client email" });
      // Absolute chat link for external email recipients
      const tokenRecord = await storage.getClientAuthTokenByProjectId(project.id).catch(() => null);
      const base = process.env.APP_URL?.replace(/\/$/, "") ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://usena-flow.replit.app");
      const chatLink = tokenRecord?.token ? `${base}/client-chat/${tokenRecord.token}` : undefined;

      await sendNoelDeliveryEstimateEmail(project.id, project.clientName, project.clientEmail, project.promisedDeliveryDate || project.deliveryDueDate, chatLink);

      // lastCommunicatedDate = the PROMISED DELIVERY DATE we just communicated (not today)
      const promisedIso = project.promisedDeliveryDate
        ? new Date(project.promisedDeliveryDate).toISOString().slice(0, 10)
        : "2026-12-19";
      await storage.updateProject(id, {
        lastCommunicatedDate: promisedIso,
        lastCommunicatedAt: new Date(),
      });
      recordFired("noel_email_estimate", `Email 1 sent manually to ${project.clientEmail}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaign/projects/:id/email/ready — Email 2: photos ready (manual trigger)
  app.post("/api/campaign/projects/:id/email/ready", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });
      if (!project.clientEmail) return res.status(400).json({ error: "No client email" });
      await sendNoelPhotosReadyEmail(project.id, project.clientName, project.clientEmail, project.galleryLink || "");
      await storage.updateProject(id, {
        driveDeliveryEmailSent: true,
        driveDeliveryEmailSentAt: new Date(),
        deliveryEmailSentAt: new Date(),
      });
      recordFired("noel_email_ready", `Email 2 sent manually to ${project.clientEmail}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaign/projects/:id/email/survey — Email 3: post-delivery survey (manual trigger)
  app.post("/api/campaign/projects/:id/email/survey", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });
      if (!project.clientEmail) return res.status(400).json({ error: "No client email" });
      // Create/reuse persisted survey record for token-based survey + Google review URLs
      const { randomUUID } = await import("crypto");
      let surveyRecord = await storage.getSurveyByProjectId(project.id).catch(() => null);
      if (!surveyRecord) {
        surveyRecord = await storage.createSurvey({
          projectId: project.id,
          clientEmail: project.clientEmail,
          clientName: project.clientName,
          surveyToken: randomUUID(),
        });
      }
      await sendNoelSurveyEmail(project.id, project.clientName, project.clientEmail, surveyRecord.surveyToken);
      recordFired("noel_email_survey", `Email 3 sent manually to ${project.clientEmail}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/campaign/pacing — current pacing snapshot
  app.get("/api/campaign/pacing", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getActiveCampaign();
      if (!campaign) return res.json({ campaign: null });
      const pacing = await runPacingEngine(campaign.id);
      res.json(pacing);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/campaign/velocity — velocity snapshots for sparklines
  app.get("/api/campaign/velocity", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getActiveCampaign();
      if (!campaign) return res.json([]);
      const snapshots = await storage.getVelocitySnapshots(campaign.id, 30);
      res.json(snapshots);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/campaign/settings — update campaign settings (Admin/Lead only)
  app.put("/api/campaign/settings", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getActiveCampaign();
      if (!campaign) return res.status(404).json({ error: "No active campaign" });
      const { surveyDelayDays, reviewMode, keywords } = req.body;
      const updates: any = {};
      if (typeof surveyDelayDays === "number") updates.surveyDelayDays = surveyDelayDays;
      if (["full", "spot-check", "ai-gate-only"].includes(reviewMode)) updates.reviewMode = reviewMode;
      if (Array.isArray(keywords) && keywords.length > 0) {
        updates.keywords = keywords.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean);
      }
      const updated = await storage.updateCampaign(campaign.id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaign/archive-year — bulk-archive all shoots matching campaign keywords for a given year
  app.post("/api/campaign/archive-year", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const { year } = req.body;
      if (!year || typeof year !== "number" || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "year must be a valid 4-digit number" });
      }
      const actorId = req.headers["x-usena-user-id"] as string || "system";
      const campaign = await storage.getActiveCampaign();

      // Build keyword matcher — use campaign keywords if available, else fall back to hardcoded defaults
      const { CAMPAIGN_NOEL_KEYWORDS } = await import("@shared/schema");
      const rawKeywords: string[] = campaign?.keywords?.length ? campaign.keywords : CAMPAIGN_NOEL_KEYWORDS;
      const patterns = rawKeywords.map(kw =>
        kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      );
      const matchRegex = new RegExp(patterns.join("|"));
      const normalise = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

      // Fetch all projects (campaign and non-campaign) to scan
      const allProjects = await storage.getAllProjectsIncludingPlaceholders();
      // Also fetch campaign projects separately since getAllProjectsIncludingPlaceholders filters by campaignId
      const campaignProjects = campaign ? await storage.getCampaignProjects(campaign.id) : [];
      const combined = [...allProjects, ...campaignProjects].filter(
        (p, i, arr) => arr.findIndex(x => x.id === p.id) === i
      );

      // Filter: matches keywords + shoot or due date falls in the requested year
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);

      const toArchive = combined.filter(p => {
        if (p.chatArchived) return false; // already archived
        const dateToCheck = p.shootDate ? new Date(p.shootDate) : new Date(p.dueDate);
        if (dateToCheck < yearStart || dateToCheck >= yearEnd) return false;
        return matchRegex.test(normalise(p.clientName));
      });

      const now = new Date();
      let archived = 0;
      for (const p of toArchive) {
        await storage.updateProject(p.id, {
          chatArchived: true,
          chatArchivedAt: now,
          chatArchivedBy: actorId,
        });
        archived++;
      }

      console.log(`🎄 [Archive] Archived ${archived} Christmas ${year} shoots by ${actorId}`);
      res.json({ archived, year });
    } catch (err: any) {
      console.error("[Archive Year] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaign/ensure — creates the Noël 2026 campaign if it doesn't exist
  app.post("/api/campaign/ensure", verifyAdminOrLeadRequest, async (req: Request, res: Response) => {
    try {
      const campaign = await ensureNoelCampaign();
      res.json(campaign);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Noël Photo Selection Flow ───────────────────────────────────────────────

  // GET /api/noel-selection/:token — public: client fetches their selection page data
  app.get("/api/noel-selection/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const tokenRecord = await storage.getClientAuthTokenByToken(token);
      if (!tokenRecord) return res.status(404).json({ error: "Invalid or expired link" });
      const project = await storage.getProject(tokenRecord.projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const whatsappSetting = await storage.getAppSetting("whatsapp_admin_number").catch(() => null);
      const whatsappAdminNumber = (whatsappSetting?.value as string | undefined)?.replace(/^"|"$/g, "") || "27000000000";
      res.json({
        clientName: project.clientName,
        selectionAllowance: project.selectionAllowance ?? project.packageCount ?? 0,
        pixiesetLink: project.pixiesetLink ?? null,
        extraPhotoPrice: project.extraPhotoPrice ?? 0,
        whatsappAdminNumber,
        clientSelectionCount: project.clientSelectionCount ?? null,
        clientSelectionDoneAt: project.clientSelectionDoneAt ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/noel-selection/:token/submit — public: client submits their count
  app.post("/api/noel-selection/:token/submit", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { clientSelectionCount } = req.body;
      if (typeof clientSelectionCount !== "number" || clientSelectionCount < 0) {
        return res.status(400).json({ error: "clientSelectionCount must be a non-negative number" });
      }
      const tokenRecord = await storage.getClientAuthTokenByToken(token);
      if (!tokenRecord) return res.status(404).json({ error: "Invalid or expired link" });
      const project = await storage.getProject(tokenRecord.projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (project.clientSelectionDoneAt) {
        return res.status(409).json({ error: "Selection already submitted" });
      }
      await storage.updateProject(project.id, {
        clientSelectionCount,
        clientSelectionDoneAt: new Date(),
      });
      recordFired("noel_selection_submit", `Client ${project.clientName} submitted count ${clientSelectionCount}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/campaign/projects/:id/selection-fields — wrangler: save pixiesetLink, selectionAllowance, extraPhotoPrice
  app.patch("/api/campaign/projects/:id/selection-fields", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { pixiesetLink, selectionAllowance, extraPhotoPrice } = req.body;
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });
      const updates: Record<string, any> = {};
      if (typeof pixiesetLink === "string") updates.pixiesetLink = pixiesetLink;
      if (typeof selectionAllowance === "number") updates.selectionAllowance = selectionAllowance;
      if (typeof extraPhotoPrice === "number") updates.extraPhotoPrice = extraPhotoPrice;
      const updated = await storage.updateProject(id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaign/projects/:id/email/selection — wrangler: send selection invite email
  app.post("/api/campaign/projects/:id/email/selection", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });
      if (!project.clientEmail) return res.status(400).json({ error: "No client email on this project" });
      if (!project.pixiesetLink) return res.status(400).json({ error: "Set a Pixieset link before sending the selection email" });

      // Create or reuse client auth token
      const { randomUUID } = await import("crypto");
      const base = process.env.APP_URL?.replace(/\/$/, "") ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000");

      let tokenRecord = await storage.getClientAuthTokenByProjectId(project.id).catch(() => null);
      if (!tokenRecord) {
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
        tokenRecord = await storage.createClientAuthToken({
          email: project.clientEmail,
          projectId: project.id,
          token: randomUUID(),
          expiresAt,
        });
      }

      const selectionLink = `${base}/noel-select/${tokenRecord.token}`;
      const allowance = project.selectionAllowance ?? project.packageCount ?? 0;

      await sendNoelSelectionEmail(project.id, project.clientName, project.clientEmail, selectionLink, allowance);

      await storage.updateProject(id, {
        selectionEmailSentAt: new Date(),
        selectionReminderTier: 0,
      });

      recordFired("noel_selection_email", `Selection invite sent to ${project.clientEmail}`);
      res.json({ success: true, selectionLink });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaign/projects/:id/files-collected — wrangler: mark files collected to hard drive
  app.post("/api/campaign/projects/:id/files-collected", verifyCampaignCockpit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const collectedBy = (req.headers["x-usena-user-id"] as string) || "wrangler";
      const project = await storage.getProject(id);
      if (!project || !project.campaignId) return res.status(404).json({ error: "Campaign project not found" });

      const updated = await storage.updateProject(id, {
        filesCollected: true,
        filesCollectedAt: new Date(),
        filesCollectedBy: collectedBy,
      });

      // Trigger photos-ready email check (fires if conditions are met)
      checkAndSendPhotosReadyEmail(id).catch(err =>
        console.error("[FilesCollected] checkAndSendPhotosReadyEmail error:", err.message)
      );

      recordFired("noel_files_collected", `Files collected for ${project.clientName} by ${collectedBy}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
