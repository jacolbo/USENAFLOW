import { type User, type InsertUser, type Project, type InsertProject, type UpdateProject, type ProjectNote, type InsertProjectNote, type UpdateProjectNote, type TradeOffer, type InsertTradeOffer, type UpdateTradeOffer, type WranglerCommission, type InsertWranglerCommission, type ProjectEvent, type InsertProjectEvent, type Complaint, type InsertComplaint, type ShoottrackerMeta, type InsertShoottrackerMeta, type UpdateShoottrackerMeta, type AppSetting, type CalendarEventStaging, type InsertCalendarEventStaging, type UpdateCalendarEventStaging, type ClientAuthToken, type InsertClientAuthToken, type ClientMessage, type InsertClientMessage, type DashboardPreferences, type InsertDashboardPreferences, type SneakPeek, type InsertSneakPeek, type Survey, type InsertSurvey, type Referral, type InsertReferral, type ClientProfile, type InsertClientProfile, type RewardClaim, type InsertRewardClaim, type EmailTemplate, type InsertEmailTemplate, type PushSubscription, type InsertPushSubscription, type StatusTransition, type InsertStatusTransition, type LeaveRequest, type InsertLeaveRequest, type AiTeamMessage, type InsertAiTeamMessage, type AiMemory, type InsertAiMemory, type AiAdminInstruction, type InsertAiAdminInstruction, ProjectStatus, TradeOfferStatus, StagingStatus, users, projects, projectNotes, tradeOffers, wranglerCommissions, projectEvents, complaints, shoottrackerMeta, appSettings, calendarEventsStaging, clientAuthTokens, clientMessages, dashboardPreferences, sneakPeeks, clientSurveys, referrals, clientProfiles, referralRewardClaims, emailTemplates, pushSubscriptions, chatEncryptionKeys, projectStatusTransitions, leaveRequests, aiTeamMessages, aiMemory, aiAdminInstructions } from "@shared/schema";
import { db } from "./db";
import { eq, sql, asc, and, ilike, isNotNull, isNull, lte, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<{username: string, password: string, role: string, name: string, abbreviation: string}>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  getAllProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: UpdateProject): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  getProjectNotes(projectId: string): Promise<ProjectNote[]>;
  createProjectNote(note: InsertProjectNote): Promise<ProjectNote>;
  updateProjectNote(id: string, updates: UpdateProjectNote): Promise<ProjectNote | undefined>;
  deleteProjectNote(id: string): Promise<boolean>;
  
  // Trade offer methods
  getAllTradeOffers(): Promise<TradeOffer[]>;
  getTradeOffer(id: string): Promise<TradeOffer | undefined>;
  getTradeOffersForUser(username: string): Promise<TradeOffer[]>;
  createTradeOffer(offer: InsertTradeOffer): Promise<TradeOffer>;
  updateTradeOffer(id: string, updates: UpdateTradeOffer): Promise<TradeOffer | undefined>;
  deleteTradeOffer(id: string): Promise<boolean>;
  executeTradeSwap(tradeOfferId: string): Promise<boolean>;
  
  // Wrangler commission methods
  getWranglerCommissions(wranglerUsername: string): Promise<WranglerCommission[]>;
  createWranglerCommission(commission: InsertWranglerCommission): Promise<WranglerCommission>;
  
  // Project event methods for rollover tracking
  getProjectEvents(projectId: string): Promise<ProjectEvent[]>;
  createProjectEvent(event: InsertProjectEvent): Promise<ProjectEvent>;
  
  // Complaints methods for Evans
  getAllComplaints(): Promise<(Complaint & { projectName: string })[]>;
  getComplaint(id: string): Promise<Complaint | undefined>;
  getComplaintsByStatus(status: string): Promise<(Complaint & { projectName: string })[]>;
  createComplaint(complaint: InsertComplaint): Promise<Complaint>;
  updateComplaint(id: string, updates: Partial<Complaint>): Promise<Complaint | undefined>;
  deleteComplaint(id: string): Promise<boolean>;
  
  // ShootTracker meta methods
  getShoottrackerMeta(projectId: string): Promise<ShoottrackerMeta | undefined>;
  createShoottrackerMeta(meta: InsertShoottrackerMeta): Promise<ShoottrackerMeta>;
  updateShoottrackerMeta(projectId: string, updates: UpdateShoottrackerMeta): Promise<ShoottrackerMeta | undefined>;
  deleteShoottrackerMeta(projectId: string): Promise<boolean>;
  
  // App settings methods
  getAppSetting(key: string): Promise<AppSetting | undefined>;
  setAppSetting(key: string, value: any): Promise<AppSetting>;
  deleteAppSetting(key: string): Promise<boolean>;
  
  // Get project by calendar event ID
  getProjectByCalendarEventId(calendarEventId: string): Promise<Project | undefined>;
  
  // Calendar events staging methods
  getStagedEvents(status?: string): Promise<CalendarEventStaging[]>;
  getStagedEventByCalendarEventId(calendarEventId: string): Promise<CalendarEventStaging | undefined>;
  createStagedEvent(event: InsertCalendarEventStaging): Promise<CalendarEventStaging>;
  updateStagedEvent(id: string, updates: UpdateCalendarEventStaging): Promise<CalendarEventStaging | undefined>;
  upsertStagedEvent(event: InsertCalendarEventStaging): Promise<CalendarEventStaging>;
  deleteStagedEvent(id: string): Promise<boolean>;
  
  // Client auth token methods
  createClientAuthToken(token: InsertClientAuthToken): Promise<ClientAuthToken>;
  getClientAuthTokenByToken(token: string): Promise<ClientAuthToken | undefined>;
  getClientAuthTokenByEmail(email: string): Promise<ClientAuthToken | undefined>;
  getClientAuthTokenByProjectId(projectId: string): Promise<ClientAuthToken | undefined>;
  deleteClientAuthToken(id: string): Promise<boolean>;
  
  // Chat encryption key methods
  getChatEncryptionKey(projectId: string): Promise<{ encryptionKey: string; createdBy: string } | undefined>;
  setChatEncryptionKey(projectId: string, encryptionKey: string, createdBy: string): Promise<void>;

  // Client messages methods
  getMessagesByProject(projectId: string): Promise<ClientMessage[]>;
  createClientMessage(message: InsertClientMessage): Promise<ClientMessage>;
  markMessagesAsRead(projectId: string, senderType: string): Promise<number>;
  getProjectsWithUnreadCounts(assignedTo?: string, archived?: boolean): Promise<Array<{ project: Project; unreadCount: number; lastMessageAt: Date | null; lastSenderType: string | null }>>;
  
  // Dashboard preferences methods
  getDashboardPreferences(userId: string): Promise<DashboardPreferences | undefined>;
  upsertDashboardPreferences(userId: string, prefs: Partial<InsertDashboardPreferences>): Promise<DashboardPreferences>;
  
  // Sneak peek methods
  getSneakPeeks(projectId: string): Promise<SneakPeek[]>;
  createSneakPeek(peek: InsertSneakPeek): Promise<SneakPeek>;
  deleteSneakPeek(id: string): Promise<boolean>;
  
  // Survey methods
  createSurvey(survey: InsertSurvey): Promise<Survey>;
  getSurveyByToken(token: string): Promise<Survey | undefined>;
  getSurveyByProjectId(projectId: string): Promise<Survey | undefined>;
  updateSurvey(id: string, updates: Partial<Survey>): Promise<Survey | undefined>;
  getAllSurveys(): Promise<Survey[]>;
  getSurveysAwaitingGooglePrompt(maxAgeMs: number): Promise<Survey[]>;
  getSurveysAwaitingReminder(): Promise<Survey[]>;
  markSurveyAlreadyReviewed(id: string, source: 'auto' | 'manual', matchedAuthor?: string | null): Promise<Survey | undefined>;
  clearSurveyAlreadyReviewed(id: string): Promise<Survey | undefined>;
  getGoogleReviewFunnelStats(windowDays: number): Promise<{
    windowDays: number;
    promptsSent: number;
    remindersSent: number;
    copyClicks: number;
    googleClicks: number;
    clickThroughRate: number;
  }>;
  
  // Referral methods
  createReferral(referral: InsertReferral): Promise<Referral>;
  getReferralByCode(code: string): Promise<Referral | undefined>;
  getReferralsByReferrer(email: string): Promise<Referral[]>;
  updateReferral(id: string, updates: Partial<Referral>): Promise<Referral | undefined>;
  getAllReferrals(): Promise<Referral[]>;
  getSubmittedReferralsByName(clientName: string): Promise<Referral[]>;
  getSubmittedReferralsByEmail(clientEmail: string): Promise<Referral[]>;

  // Client profile methods
  getClientProfile(email: string): Promise<ClientProfile | undefined>;
  getAllClientProfiles(): Promise<ClientProfile[]>;
  upsertClientProfile(profile: Partial<InsertClientProfile> & { clientEmail: string; clientName: string }): Promise<ClientProfile>;
  updateClientProfile(id: string, updates: Partial<ClientProfile>): Promise<ClientProfile | undefined>;
  deleteClientProfileByEmail(email: string): Promise<void>;

  createRewardClaim(claim: InsertRewardClaim): Promise<RewardClaim>;
  getRewardClaimsByProject(projectId: string): Promise<RewardClaim[]>;
  getRewardClaimsByClient(clientEmail: string): Promise<RewardClaim[]>;
  creditBonusPhotos(clientEmail: string, clientName: string, photos: number): Promise<ClientProfile>;
  applyBonusPhotos(clientEmail: string, projectId: string, clientName: string, photosToApply: number, appliedBy: string): Promise<{ claim: RewardClaim; profile: ClientProfile }>;

  getAllEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplateByKey(templateKey: string): Promise<EmailTemplate | undefined>;
  upsertEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate | undefined>;

  savePushSubscription(sub: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscriptionsByProject(projectId: string): Promise<PushSubscription[]>;
  deletePushSubscription(endpoint: string): Promise<void>;

  recordStatusTransition(projectId: string, fromStatus: string, toStatus: string, changedBy: string): Promise<StatusTransition>;
  getStatusTransitions(projectId: string): Promise<StatusTransition[]>;
  getRetoucherSpeedStats(username: string): Promise<{ avgMinutes: number; totalProjects: number; fastestMinutes: number; slowestMinutes: number }>;

  createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
  getLeaveRequests(username?: string, year?: number): Promise<LeaveRequest[]>;
  getLeaveRequestById(id: string): Promise<LeaveRequest | undefined>;
  updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<LeaveRequest | undefined>;
  getUsedLeaveDays(username: string, year: number): Promise<number>;

  createAiTeamMessage(msg: InsertAiTeamMessage): Promise<AiTeamMessage>;
  getAiTeamMessages(username: string, limit?: number): Promise<AiTeamMessage[]>;
  getRecentRetoucherExplanations(since: Date): Promise<AiTeamMessage[]>;

  // AI Memory methods
  createAiMemory(memory: InsertAiMemory): Promise<AiMemory>;
  getAiMemories(options?: { category?: string; retoucherName?: string; limit?: number }): Promise<AiMemory[]>;
  getAiMemoriesByCategory(category: string, limit?: number): Promise<AiMemory[]>;
  deleteAiMemory(id: string): Promise<boolean>;
  clearAiMemories(category?: string): Promise<number>;
  pruneExpiredMemories(): Promise<number>;

  // Admin Instructions methods
  createAdminInstruction(instruction: InsertAiAdminInstruction): Promise<AiAdminInstruction>;
  getAdminInstructions(options?: { category?: string; targetRetoucher?: string; activeOnly?: boolean }): Promise<AiAdminInstruction[]>;
  getActiveAdminInstructions(retoucherName?: string): Promise<AiAdminInstruction[]>;
  updateAdminInstruction(id: string, updates: Partial<AiAdminInstruction>): Promise<AiAdminInstruction | undefined>;
  deleteAdminInstruction(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private projectNotes: Map<string, ProjectNote>;
  private tradeOffers: Map<string, TradeOffer>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.projectNotes = new Map();
    this.tradeOffers = new Map();
    this.initializeData();
  }

  private initializeData() {
    // Initialize with sample projects
    const sampleProjects: Project[] = [
      {
        id: "1",
        clientName: "Alice",
        packageCount: 10,
        selectedCount: 12,
        extras: 2,
        extraPhotoPrice: 2500, // R25.00 per extra photo in cents
        dueDate: new Date(2025, 7, 7), // Aug 7, 2025
        status: ProjectStatus.AWAITING_PAYMENT,
        invoicePaid: false,
        assignedTo: null,
        rating: null,
        deliveredAt: null,
        createdAt: new Date(),
        toEditRemaining: 12,
        photosCompleted: 0,
        rolloverCount: 0,
        lastRolloverDate: null,
        originalProjectId: null,
        isRolloverShadow: false,
        originalDueDate: null,
        shootDate: null,
        deliveryDueDate: null,
        riskLevel: "SAFE",
        calendarEventId: null,
        lastSyncedAt: null,
        createdFrom: "MANUAL",
        isLinkSent: false,
        linkSentAt: null,
        clientEmail: null,
        extrasApproved: false,
        extrasApprovedAt: null,
        extrasApprovalToken: null,
        deliveryEstimateEmailSentAt: null,
        projectAddedEmailSentAt: null,
      },
      {
        id: "2",
        clientName: "Bob",
        packageCount: 5,
        selectedCount: 5,
        extras: 0,
        extraPhotoPrice: null,
        dueDate: new Date(2025, 7, 9), // Aug 9, 2025
        status: ProjectStatus.READY_FOR_RETOUCHING,
        invoicePaid: true,
        assignedTo: null,
        rating: null,
        deliveredAt: null,
        createdAt: new Date(),
        toEditRemaining: 5,
        photosCompleted: 0,
        rolloverCount: 0,
        lastRolloverDate: null,
        originalProjectId: null,
        isRolloverShadow: false,
        originalDueDate: null,
        shootDate: null,
        deliveryDueDate: null,
        riskLevel: "SAFE",
        calendarEventId: null,
        lastSyncedAt: null,
        createdFrom: "MANUAL",
        isLinkSent: false,
        linkSentAt: null,
        clientEmail: null,
        extrasApproved: false,
        extrasApprovedAt: null,
        extrasApprovalToken: null,
        deliveryEstimateEmailSentAt: null,
        projectAddedEmailSentAt: null,
      },
      {
        id: "3",
        clientName: "Charlie",
        packageCount: 8,
        selectedCount: 8,
        extras: 0,
        extraPhotoPrice: null,
        dueDate: new Date(2025, 7, 1), // Aug 1, 2025
        status: ProjectStatus.REVIEW,
        invoicePaid: true,
        assignedTo: "Retoucher 2",
        rating: null,
        deliveredAt: null,
        createdAt: new Date(),
        toEditRemaining: 8,
        photosCompleted: 0,
        rolloverCount: 0,
        lastRolloverDate: null,
        originalProjectId: null,
        isRolloverShadow: false,
        originalDueDate: null,
        shootDate: null,
        deliveryDueDate: null,
        riskLevel: "SAFE",
        calendarEventId: null,
        lastSyncedAt: null,
        createdFrom: "MANUAL",
        isLinkSent: false,
        linkSentAt: null,
        clientEmail: null,
        extrasApproved: false,
        extrasApprovedAt: null,
        extrasApprovalToken: null,
        deliveryEstimateEmailSentAt: null,
        projectAddedEmailSentAt: null,
      },
      {
        id: "4",
        clientName: "Daisy",
        packageCount: 7,
        selectedCount: 10,
        extras: 3,
        extraPhotoPrice: 3000, // R30.00 per extra photo in cents
        dueDate: new Date(2025, 7, 2), // Aug 2, 2025
        status: ProjectStatus.DELIVERED,
        invoicePaid: true,
        assignedTo: "Retoucher 1",
        rating: 5,
        deliveredAt: new Date(2025, 7, 3), // Aug 3, 2025
        createdAt: new Date(),
        toEditRemaining: 10,
        photosCompleted: 10,
        rolloverCount: 0,
        lastRolloverDate: null,
        originalProjectId: null,
        isRolloverShadow: false,
        originalDueDate: null,
        shootDate: null,
        deliveryDueDate: null,
        riskLevel: "SAFE",
        calendarEventId: null,
        lastSyncedAt: null,
        createdFrom: "MANUAL",
        isLinkSent: false,
        linkSentAt: null,
        clientEmail: null,
        extrasApproved: false,
        extrasApprovedAt: null,
        extrasApprovalToken: null,
        deliveryEstimateEmailSentAt: null,
        projectAddedEmailSentAt: null,
      },
      {
        id: "5",
        clientName: "Eve",
        packageCount: 4,
        selectedCount: 4,
        extras: 0,
        extraPhotoPrice: null,
        dueDate: new Date(2025, 7, 8), // Aug 8, 2025
        status: ProjectStatus.ASSIGNED,
        invoicePaid: true,
        assignedTo: "Retoucher 3",
        rating: null,
        deliveredAt: null,
        createdAt: new Date(),
        toEditRemaining: 4,
        photosCompleted: 0,
        rolloverCount: 0,
        lastRolloverDate: null,
        originalProjectId: null,
        isRolloverShadow: false,
        originalDueDate: null,
        shootDate: null,
        deliveryDueDate: null,
        riskLevel: "SAFE",
        calendarEventId: null,
        lastSyncedAt: null,
        createdFrom: "MANUAL",
        isLinkSent: false,
        linkSentAt: null,
        clientEmail: null,
        extrasApproved: false,
        extrasApprovedAt: null,
        extrasApprovalToken: null,
        deliveryEstimateEmailSentAt: null,
        projectAddedEmailSentAt: null,
      },
    ];

    sampleProjects.forEach(project => {
      this.projects.set(project.id, project);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: string, updates: Partial<{username: string, password: string, role: string, name: string, abbreviation: string}>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const extras = Math.max(0, (insertProject.toEditRemaining || insertProject.selectedCount) - insertProject.packageCount);
    const status = extras > 0 ? ProjectStatus.AWAITING_PAYMENT : ProjectStatus.READY_FOR_RETOUCHING;
    const invoicePaid = extras === 0;
    
    const project: Project = {
      ...insertProject,
      id,
      extras,
      status,
      invoicePaid,
      assignedTo: insertProject.assignedTo ?? null,
      rating: null,
      deliveredAt: null,
      createdAt: new Date(),
      extraPhotoPrice: insertProject.extraPhotoPrice ?? null,
      // Shadow project fields
      toEditRemaining: insertProject.toEditRemaining ?? insertProject.selectedCount,
      photosCompleted: insertProject.photosCompleted ?? 0,
      rolloverCount: insertProject.rolloverCount ?? 0,
      lastRolloverDate: insertProject.lastRolloverDate ?? null,
      originalProjectId: insertProject.originalProjectId ?? null,
      isRolloverShadow: insertProject.isRolloverShadow ?? false,
      originalDueDate: insertProject.originalDueDate ?? null,
      // ShootTracker fields
      shootDate: insertProject.shootDate ?? null,
      deliveryDueDate: insertProject.deliveryDueDate ?? null,
      riskLevel: insertProject.riskLevel ?? "SAFE",
      calendarEventId: insertProject.calendarEventId ?? null,
      lastSyncedAt: insertProject.lastSyncedAt ?? null,
      createdFrom: insertProject.createdFrom ?? "MANUAL",
      isLinkSent: insertProject.isLinkSent ?? false,
      linkSentAt: insertProject.linkSentAt ?? null,
      clientEmail: insertProject.clientEmail ?? null,
      extrasApproved: insertProject.extrasApproved ?? false,
      extrasApprovedAt: insertProject.extrasApprovedAt ?? null,
      extrasApprovalToken: insertProject.extrasApprovalToken ?? null,
      deliveryEstimateEmailSentAt: insertProject.deliveryEstimateEmailSentAt ?? null,
      projectAddedEmailSentAt: insertProject.projectAddedEmailSentAt ?? null,
    };
    
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: UpdateProject): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) {
      return undefined;
    }
    
    // Always recalculate extras if packageCount, toEditRemaining, or extras changed
    if (updates.packageCount !== undefined || updates.toEditRemaining !== undefined || updates.extras !== undefined) {
      const newPackageCount = updates.packageCount ?? project.packageCount;
      const newToEditRemaining = updates.toEditRemaining ?? project.toEditRemaining;
      
      // If extras is being directly updated, ensure toEditRemaining matches
      if (updates.extras !== undefined && updates.toEditRemaining === undefined) {
        updates.toEditRemaining = newPackageCount + updates.extras;
      } else {
        // Otherwise calculate extras from To Edit count
        updates.extras = Math.max(0, (updates.toEditRemaining ?? newToEditRemaining) - newPackageCount);
      }
    }
    
    const updatedProject = { ...project, ...updates };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Project Notes methods
  async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
    const notes = Array.from(this.projectNotes.values());
    return notes.filter(note => note.projectId === projectId);
  }

  async createProjectNote(note: InsertProjectNote): Promise<ProjectNote> {
    const newNote: ProjectNote = {
      id: randomUUID(),
      ...note,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projectNotes.set(newNote.id, newNote);
    return newNote;
  }

  async updateProjectNote(id: string, updates: UpdateProjectNote): Promise<ProjectNote | undefined> {
    const note = this.projectNotes.get(id);
    if (!note) return undefined;

    const updatedNote: ProjectNote = {
      ...note,
      ...updates,
      updatedAt: new Date(),
    };
    this.projectNotes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteProjectNote(id: string): Promise<boolean> {
    return this.projectNotes.delete(id);
  }

  // Trade offer methods
  async getAllTradeOffers(): Promise<TradeOffer[]> {
    return Array.from(this.tradeOffers.values());
  }

  async getTradeOffer(id: string): Promise<TradeOffer | undefined> {
    return this.tradeOffers.get(id);
  }

  async getTradeOffersForUser(username: string): Promise<TradeOffer[]> {
    return Array.from(this.tradeOffers.values()).filter(offer => 
      offer.offeringUser === username || 
      offer.targetUser === username || 
      offer.acceptedBy === username ||
      offer.targetUser === null // Open offers
    );
  }

  async createTradeOffer(insertOffer: InsertTradeOffer): Promise<TradeOffer> {
    const id = randomUUID();
    const offer: TradeOffer = { 
      ...insertOffer, 
      id,
      status: "pending",
      createdAt: new Date(),
      completedAt: null,
      acceptedBy: null,
      acceptedProjectId: null,
      message: insertOffer.message ?? null,
      targetUser: insertOffer.targetUser ?? null,
      requestedProjectId: insertOffer.requestedProjectId ?? null,
    };
    this.tradeOffers.set(id, offer);
    return offer;
  }

  async updateTradeOffer(id: string, updates: UpdateTradeOffer): Promise<TradeOffer | undefined> {
    const offer = this.tradeOffers.get(id);
    if (!offer) return undefined;
    
    const updatedOffer = { ...offer, ...updates };
    this.tradeOffers.set(id, updatedOffer);
    return updatedOffer;
  }

  async deleteTradeOffer(id: string): Promise<boolean> {
    return this.tradeOffers.delete(id);
  }

  async executeTradeSwap(tradeOfferId: string): Promise<boolean> {
    const offer = this.tradeOffers.get(tradeOfferId);
    if (!offer || offer.status !== TradeOfferStatus.ACCEPTED) {
      return false;
    }

    if (!offer.acceptedProjectId) {
      return false;
    }

    const offeringProject = this.projects.get(offer.offeringProjectId);
    const acceptedProject = this.projects.get(offer.acceptedProjectId);
    
    if (!offeringProject || !acceptedProject) {
      return false;
    }

    try {
      // Swap the assignments
      const offeringUserAssignment = offeringProject.assignedTo;
      const acceptedUserAssignment = acceptedProject.assignedTo;

      this.projects.set(offer.offeringProjectId, {
        ...offeringProject,
        assignedTo: acceptedUserAssignment,
      });

      this.projects.set(offer.acceptedProjectId, {
        ...acceptedProject,
        assignedTo: offeringUserAssignment,
      });

      // Mark trade as completed
      this.tradeOffers.set(tradeOfferId, {
        ...offer,
        status: TradeOfferStatus.COMPLETED,
        completedAt: new Date(),
      });

      return true;
    } catch (error) {
      console.error('Failed to execute trade swap:', error);
      return false;
    }
  }

  async getWranglerCommissions(wranglerUsername: string): Promise<WranglerCommission[]> {
    // Not implemented for MemStorage
    return [];
  }

  async createWranglerCommission(commission: InsertWranglerCommission): Promise<WranglerCommission> {
    // Not implemented for MemStorage
    throw new Error("Not implemented in MemStorage");
  }

  async getProjectEvents(projectId: string): Promise<ProjectEvent[]> {
    // Not implemented for MemStorage
    return [];
  }

  async createProjectEvent(event: InsertProjectEvent): Promise<ProjectEvent> {
    // Not implemented for MemStorage
    throw new Error("Not implemented in MemStorage");
  }

  // Complaints methods for Evans (Not implemented for MemStorage)
  async getAllComplaints(): Promise<(Complaint & { projectName: string })[]> {
    return [];
  }

  async getComplaint(id: string): Promise<Complaint | undefined> {
    return undefined;
  }

  async getComplaintsByStatus(status: string): Promise<(Complaint & { projectName: string })[]> {
    return [];
  }

  async createComplaint(complaint: InsertComplaint): Promise<Complaint> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateComplaint(id: string, updates: Partial<Complaint>): Promise<Complaint | undefined> {
    return undefined;
  }

  async deleteComplaint(id: string): Promise<boolean> {
    return false;
  }
  
  // ShootTracker meta methods (Not implemented for MemStorage)
  async getShoottrackerMeta(projectId: string): Promise<ShoottrackerMeta | undefined> {
    return undefined;
  }

  async createShoottrackerMeta(meta: InsertShoottrackerMeta): Promise<ShoottrackerMeta> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateShoottrackerMeta(projectId: string, updates: UpdateShoottrackerMeta): Promise<ShoottrackerMeta | undefined> {
    return undefined;
  }

  async deleteShoottrackerMeta(projectId: string): Promise<boolean> {
    return false;
  }
  
  // App settings methods (Not implemented for MemStorage)
  async getAppSetting(key: string): Promise<AppSetting | undefined> {
    return undefined;
  }

  async setAppSetting(key: string, value: any): Promise<AppSetting> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteAppSetting(key: string): Promise<boolean> {
    return false;
  }

  async getProjectByCalendarEventId(calendarEventId: string): Promise<Project | undefined> {
    const projectsArray = Array.from(this.projects.values());
    for (const project of projectsArray) {
      if (project.calendarEventId === calendarEventId) {
        return project;
      }
    }
    return undefined;
  }

  // Calendar events staging methods (Not implemented for MemStorage)
  async getStagedEvents(status?: string): Promise<CalendarEventStaging[]> {
    return [];
  }

  async getStagedEventByCalendarEventId(calendarEventId: string): Promise<CalendarEventStaging | undefined> {
    return undefined;
  }

  async createStagedEvent(event: InsertCalendarEventStaging): Promise<CalendarEventStaging> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateStagedEvent(id: string, updates: UpdateCalendarEventStaging): Promise<CalendarEventStaging | undefined> {
    return undefined;
  }

  async upsertStagedEvent(event: InsertCalendarEventStaging): Promise<CalendarEventStaging> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteStagedEvent(id: string): Promise<boolean> {
    return false;
  }

  // Client auth token methods (Not implemented for MemStorage)
  async createClientAuthToken(token: InsertClientAuthToken): Promise<ClientAuthToken> {
    throw new Error("Not implemented in MemStorage");
  }

  async getClientAuthTokenByToken(token: string): Promise<ClientAuthToken | undefined> {
    return undefined;
  }

  async getClientAuthTokenByEmail(email: string): Promise<ClientAuthToken | undefined> {
    return undefined;
  }
  
  async getClientAuthTokenByProjectId(projectId: string): Promise<ClientAuthToken | undefined> {
    return undefined;
  }

  async deleteClientAuthToken(id: string): Promise<boolean> {
    return false;
  }

  // Client messages methods (Not implemented for MemStorage)
  async getMessagesByProject(projectId: string): Promise<ClientMessage[]> {
    return [];
  }

  async createClientMessage(message: InsertClientMessage): Promise<ClientMessage> {
    throw new Error("Not implemented in MemStorage");
  }

  async markMessagesAsRead(projectId: string, senderType: string): Promise<number> {
    return 0;
  }
  
  async getProjectsWithUnreadCounts(assignedTo?: string): Promise<Array<{ project: Project; unreadCount: number; lastMessageAt: Date | null; lastSenderType: string | null }>> {
    return [];
  }
  
  async getDashboardPreferences(userId: string): Promise<DashboardPreferences | undefined> {
    return undefined;
  }
  
  async upsertDashboardPreferences(userId: string, prefs: Partial<InsertDashboardPreferences>): Promise<DashboardPreferences> {
    return {
      id: randomUUID(),
      userId,
      widgetOrder: prefs.widgetOrder || [],
      hiddenWidgets: prefs.hiddenWidgets || [],
      widgetSettings: prefs.widgetSettings || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getSneakPeeks(projectId: string): Promise<SneakPeek[]> {
    return [];
  }

  async createSneakPeek(peek: InsertSneakPeek): Promise<SneakPeek> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteSneakPeek(id: string): Promise<boolean> {
    return false;
  }

  async createSurvey(survey: InsertSurvey): Promise<Survey> {
    throw new Error("Not implemented in MemStorage");
  }
  async getSurveyByToken(token: string): Promise<Survey | undefined> {
    return undefined;
  }
  async getSurveyByProjectId(projectId: string): Promise<Survey | undefined> {
    return undefined;
  }
  async updateSurvey(id: string, updates: Partial<Survey>): Promise<Survey | undefined> {
    return undefined;
  }
  async getAllSurveys(): Promise<Survey[]> {
    return [];
  }
  async getSurveysAwaitingGooglePrompt(maxAgeMs: number): Promise<Survey[]> {
    return [];
  }
  async getSurveysAwaitingReminder(): Promise<Survey[]> {
    return [];
  }
  async markSurveyAlreadyReviewed(): Promise<Survey | undefined> {
    return undefined;
  }
  async clearSurveyAlreadyReviewed(): Promise<Survey | undefined> {
    return undefined;
  }
  async getGoogleReviewFunnelStats(windowDays: number) {
    return {
      windowDays,
      promptsSent: 0,
      remindersSent: 0,
      copyClicks: 0,
      googleClicks: 0,
      clickThroughRate: 0,
    };
  }
  async createReferral(referral: InsertReferral): Promise<Referral> {
    throw new Error("Not implemented in MemStorage");
  }
  async getReferralByCode(code: string): Promise<Referral | undefined> {
    return undefined;
  }
  async getReferralsByReferrer(email: string): Promise<Referral[]> {
    return [];
  }
  async updateReferral(id: string, updates: Partial<Referral>): Promise<Referral | undefined> {
    return undefined;
  }
  async getAllReferrals(): Promise<Referral[]> {
    return [];
  }
  async getSubmittedReferralsByName(clientName: string): Promise<Referral[]> {
    return [];
  }
  async getSubmittedReferralsByEmail(clientEmail: string): Promise<Referral[]> {
    return [];
  }
  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    return [];
  }
  async getEmailTemplateByKey(templateKey: string): Promise<EmailTemplate | undefined> {
    return undefined;
  }
  async upsertEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    throw new Error("Not implemented in MemStorage");
  }
  async updateEmailTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate | undefined> {
    return undefined;
  }
  async savePushSubscription(sub: InsertPushSubscription): Promise<PushSubscription> {
    throw new Error("Not implemented in MemStorage");
  }
  async getPushSubscriptionsByProject(projectId: string): Promise<PushSubscription[]> {
    return [];
  }
  async deletePushSubscription(endpoint: string): Promise<void> {}

  async getChatEncryptionKey(projectId: string): Promise<{ encryptionKey: string; createdBy: string } | undefined> {
    throw new Error("Not implemented in MemStorage");
  }
  async setChatEncryptionKey(projectId: string, encryptionKey: string, createdBy: string): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }

  async recordStatusTransition(projectId: string, fromStatus: string, toStatus: string, changedBy: string): Promise<StatusTransition> {
    throw new Error("Not implemented in MemStorage");
  }
  async getStatusTransitions(projectId: string): Promise<StatusTransition[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async getRetoucherSpeedStats(username: string): Promise<{ avgMinutes: number; totalProjects: number; fastestMinutes: number; slowestMinutes: number }> {
    throw new Error("Not implemented in MemStorage");
  }
  async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
    throw new Error("Not implemented in MemStorage");
  }
  async getLeaveRequests(username?: string, year?: number): Promise<LeaveRequest[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async getLeaveRequestById(id: string): Promise<LeaveRequest | undefined> {
    throw new Error("Not implemented in MemStorage");
  }
  async updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<LeaveRequest | undefined> {
    throw new Error("Not implemented in MemStorage");
  }
  async getUsedLeaveDays(username: string, year: number): Promise<number> {
    throw new Error("Not implemented in MemStorage");
  }
  async createAiTeamMessage(msg: InsertAiTeamMessage): Promise<AiTeamMessage> {
    throw new Error("Not implemented in MemStorage");
  }
  async getAiTeamMessages(username: string, limit?: number): Promise<AiTeamMessage[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async getRecentRetoucherExplanations(since: Date): Promise<AiTeamMessage[]> {
    throw new Error("Not implemented in MemStorage");
  }

  // AI Memory methods (MemStorage stubs)
  private aiMemories: Map<string, AiMemory> = new Map();

  async createAiMemory(memory: InsertAiMemory): Promise<AiMemory> {
    const id = randomUUID();
    const created: AiMemory = {
      ...memory,
      id,
      context: memory.context ?? null,
      retoucherName: memory.retoucherName ?? null,
      projectId: memory.projectId ?? null,
      importance: memory.importance ?? 5,
      expiresAt: memory.expiresAt ?? null,
      createdAt: new Date(),
    };
    this.aiMemories.set(id, created);
    return created;
  }

  async getAiMemories(options?: { category?: string; retoucherName?: string; limit?: number }): Promise<AiMemory[]> {
    let results = Array.from(this.aiMemories.values());
    if (options?.category) results = results.filter(m => m.category === options.category);
    if (options?.retoucherName) results = results.filter(m => m.retoucherName === options.retoucherName);
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return results.slice(0, options?.limit || 100);
  }

  async getAiMemoriesByCategory(category: string, limit: number = 50): Promise<AiMemory[]> {
    return Array.from(this.aiMemories.values())
      .filter(m => m.category === category)
      .sort((a, b) => (b.importance - a.importance) || (b.createdAt.getTime() - a.createdAt.getTime()))
      .slice(0, limit);
  }

  async deleteAiMemory(id: string): Promise<boolean> {
    return this.aiMemories.delete(id);
  }

  async clearAiMemories(category?: string): Promise<number> {
    if (category) {
      const toDelete = Array.from(this.aiMemories.entries()).filter(([, m]) => m.category === category);
      toDelete.forEach(([id]) => this.aiMemories.delete(id));
      return toDelete.length;
    }
    const count = this.aiMemories.size;
    this.aiMemories.clear();
    return count;
  }

  async pruneExpiredMemories(): Promise<number> {
    const now = new Date();
    const toDelete = Array.from(this.aiMemories.entries()).filter(([, m]) => m.expiresAt && m.expiresAt < now);
    toDelete.forEach(([id]) => this.aiMemories.delete(id));
    return toDelete.length;
  }

  // Admin Instructions methods (MemStorage stubs)
  private adminInstructions: Map<string, AiAdminInstruction> = new Map();

  async createAdminInstruction(instruction: InsertAiAdminInstruction): Promise<AiAdminInstruction> {
    const id = randomUUID();
    const now = new Date();
    const created: AiAdminInstruction = {
      ...instruction,
      id,
      category: instruction.category ?? "general",
      targetRetoucher: instruction.targetRetoucher ?? null,
      priority: instruction.priority ?? 5,
      isActive: instruction.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.adminInstructions.set(id, created);
    return created;
  }

  async getAdminInstructions(options?: { category?: string; targetRetoucher?: string; activeOnly?: boolean }): Promise<AiAdminInstruction[]> {
    let results = Array.from(this.adminInstructions.values());
    if (options?.category) results = results.filter(i => i.category === options.category);
    if (options?.targetRetoucher) results = results.filter(i => i.targetRetoucher === options.targetRetoucher);
    if (options?.activeOnly) results = results.filter(i => i.isActive);
    return results.sort((a, b) => (b.priority - a.priority) || (b.createdAt.getTime() - a.createdAt.getTime()));
  }

  async getActiveAdminInstructions(retoucherName?: string): Promise<AiAdminInstruction[]> {
    let results = Array.from(this.adminInstructions.values()).filter(i => i.isActive);
    if (retoucherName) {
      results = results.filter(i => i.targetRetoucher === null || i.targetRetoucher === retoucherName);
    }
    return results.sort((a, b) => b.priority - a.priority);
  }

  async updateAdminInstruction(id: string, updates: Partial<AiAdminInstruction>): Promise<AiAdminInstruction | undefined> {
    const existing = this.adminInstructions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.adminInstructions.set(id, updated);
    return updated;
  }

  async deleteAdminInstruction(id: string): Promise<boolean> {
    return this.adminInstructions.delete(id);
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, updates: Partial<{username: string, password: string, role: string, name: string, abbreviation: string}>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const extras = Math.max(0, (insertProject.toEditRemaining || insertProject.selectedCount) - insertProject.packageCount);
    const status = extras > 0 ? ProjectStatus.AWAITING_PAYMENT : ProjectStatus.READY_FOR_RETOUCHING;
    const invoicePaid = extras === 0;
    
    // Convert due date to Sunday of that week (only for original projects, not shadows)
    const getSundayOfWeek = (date: Date): Date => {
      const sunday = new Date(date);
      const day = date.getDay(); // 0 = Sunday
      sunday.setDate(date.getDate() - day); // Go back to Sunday
      sunday.setHours(0, 0, 0, 0); // Set to start of day
      return sunday;
    };
    
    // For shadow projects, use the exact due date provided, for original projects convert to Sunday
    const finalDueDate = insertProject.isRolloverShadow ? 
      new Date(insertProject.dueDate) : 
      getSundayOfWeek(new Date(insertProject.dueDate));
    
    const [project] = await db
      .insert(projects)
      .values({
        ...insertProject,
        dueDate: finalDueDate,
        extras,
        status,
        invoicePaid,
        assignedTo: insertProject.assignedTo || null,
        rating: null,
        extraPhotoPrice: insertProject.extraPhotoPrice ?? null,
        // Shadow project fields - explicitly include them
        toEditRemaining: insertProject.toEditRemaining || insertProject.selectedCount,
        photosCompleted: insertProject.photosCompleted || 0,
        rolloverCount: insertProject.rolloverCount || 0,
        lastRolloverDate: insertProject.lastRolloverDate || null,
        originalProjectId: insertProject.originalProjectId || null,
        isRolloverShadow: insertProject.isRolloverShadow || false,
        originalDueDate: insertProject.originalDueDate || null,
      })
      .returning();
    return project;
  }

  async updateProject(id: string, updates: UpdateProject): Promise<Project | undefined> {
    // Always recalculate extras if packageCount, toEditRemaining, or extras changed
    if (updates.packageCount !== undefined || updates.toEditRemaining !== undefined || updates.extras !== undefined) {
      const currentProject = await this.getProject(id);
      if (currentProject) {
        const newPackageCount = updates.packageCount ?? currentProject.packageCount;
        const newToEditRemaining = updates.toEditRemaining ?? currentProject.toEditRemaining;
        
        // If extras is being directly updated, ensure toEditRemaining matches
        if (updates.extras !== undefined && updates.toEditRemaining === undefined) {
          updates.toEditRemaining = newPackageCount + updates.extras;
        } else {
          // Otherwise calculate extras from To Edit count
          updates.extras = Math.max(0, (updates.toEditRemaining ?? newToEditRemaining) - newPackageCount);
        }
      }
    }

    const [project] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
    return await db.select().from(projectNotes).where(eq(projectNotes.projectId, projectId));
  }

  async createProjectNote(note: InsertProjectNote): Promise<ProjectNote> {
    const [projectNote] = await db
      .insert(projectNotes)
      .values(note)
      .returning();
    return projectNote;
  }

  async updateProjectNote(id: string, updates: UpdateProjectNote): Promise<ProjectNote | undefined> {
    const [projectNote] = await db
      .update(projectNotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projectNotes.id, id))
      .returning();
    return projectNote || undefined;
  }

  async deleteProjectNote(id: string): Promise<boolean> {
    const result = await db.delete(projectNotes).where(eq(projectNotes.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Trade offer methods
  async getAllTradeOffers(): Promise<TradeOffer[]> {
    return await db.select().from(tradeOffers);
  }

  async getTradeOffer(id: string): Promise<TradeOffer | undefined> {
    const [offer] = await db.select().from(tradeOffers).where(eq(tradeOffers.id, id));
    return offer || undefined;
  }

  async getTradeOffersForUser(username: string): Promise<TradeOffer[]> {
    return await db.select().from(tradeOffers).where(
      sql`${tradeOffers.offeringUser} = ${username} OR ${tradeOffers.targetUser} = ${username} OR ${tradeOffers.acceptedBy} = ${username} OR ${tradeOffers.targetUser} IS NULL`
    );
  }

  async createTradeOffer(insertOffer: InsertTradeOffer): Promise<TradeOffer> {
    const [offer] = await db
      .insert(tradeOffers)
      .values({
        ...insertOffer,
        id: randomUUID(),
      })
      .returning();
    return offer;
  }

  async updateTradeOffer(id: string, updates: UpdateTradeOffer): Promise<TradeOffer | undefined> {
    const [offer] = await db
      .update(tradeOffers)
      .set(updates)
      .where(eq(tradeOffers.id, id))
      .returning();
    return offer || undefined;
  }

  async deleteTradeOffer(id: string): Promise<boolean> {
    const result = await db.delete(tradeOffers).where(eq(tradeOffers.id, id));
    return (result.rowCount || 0) > 0;
  }

  async executeTradeSwap(tradeOfferId: string): Promise<boolean> {
    // Get the trade offer
    const offer = await this.getTradeOffer(tradeOfferId);
    if (!offer || offer.status !== TradeOfferStatus.ACCEPTED) {
      return false;
    }

    if (!offer.acceptedProjectId) {
      return false;
    }

    // Get both projects
    const offeringProject = await this.getProject(offer.offeringProjectId);
    const acceptedProject = await this.getProject(offer.acceptedProjectId);
    
    if (!offeringProject || !acceptedProject) {
      return false;
    }

    try {
      // Start transaction-like operations
      // Swap the assignments
      const offeringUserAssignment = offeringProject.assignedTo;
      const acceptedUserAssignment = acceptedProject.assignedTo;

      await this.updateProject(offer.offeringProjectId, {
        assignedTo: acceptedUserAssignment,
      });

      await this.updateProject(offer.acceptedProjectId, {
        assignedTo: offeringUserAssignment,
      });

      // Mark trade as completed
      await this.updateTradeOffer(tradeOfferId, {
        status: TradeOfferStatus.COMPLETED,
        completedAt: new Date(),
      });

      return true;
    } catch (error) {
      console.error('Failed to execute trade swap:', error);
      return false;
    }
  }

  async getWranglerCommissions(wranglerUsername: string): Promise<WranglerCommission[]> {
    return await db
      .select()
      .from(wranglerCommissions)
      .where(eq(wranglerCommissions.wranglerUsername, wranglerUsername));
  }

  async createWranglerCommission(commission: InsertWranglerCommission): Promise<WranglerCommission> {
    const [wranglerCommission] = await db
      .insert(wranglerCommissions)
      .values(commission)
      .returning();
    return wranglerCommission;
  }

  async getProjectEvents(projectId: string): Promise<ProjectEvent[]> {
    return await db
      .select()
      .from(projectEvents)
      .where(eq(projectEvents.projectId, projectId))
      .orderBy(asc(projectEvents.eventDate));
  }

  async createProjectEvent(event: InsertProjectEvent): Promise<ProjectEvent> {
    const [projectEvent] = await db
      .insert(projectEvents)
      .values(event)
      .returning();
    return projectEvent;
  }

  // Complaints methods for Evans
  async getAllComplaints(): Promise<(Complaint & { projectName: string })[]> {
    return await db
      .select({
        id: complaints.id,
        projectId: complaints.projectId,
        reportedBy: complaints.reportedBy,
        issueDescription: complaints.issueDescription,
        requestedDueDate: complaints.requestedDueDate,
        status: complaints.status,
        resolvedBy: complaints.resolvedBy,
        resolvedAt: complaints.resolvedAt,
        imageUrls: complaints.imageUrls,
        createdAt: complaints.createdAt,
        projectName: sql<string>`COALESCE(${projects.clientName}, 'Unknown Project')`,
      })
      .from(complaints)
      .leftJoin(projects, eq(complaints.projectId, projects.id))
      .orderBy(asc(complaints.createdAt));
  }

  async getComplaint(id: string): Promise<Complaint | undefined> {
    const [complaint] = await db.select().from(complaints).where(eq(complaints.id, id));
    return complaint || undefined;
  }

  async getComplaintsByStatus(status: string): Promise<(Complaint & { projectName: string })[]> {
    return await db
      .select({
        id: complaints.id,
        projectId: complaints.projectId,
        reportedBy: complaints.reportedBy,
        issueDescription: complaints.issueDescription,
        requestedDueDate: complaints.requestedDueDate,
        status: complaints.status,
        resolvedBy: complaints.resolvedBy,
        resolvedAt: complaints.resolvedAt,
        imageUrls: complaints.imageUrls,
        createdAt: complaints.createdAt,
        projectName: sql<string>`COALESCE(${projects.clientName}, 'Unknown Project')`,
      })
      .from(complaints)
      .leftJoin(projects, eq(complaints.projectId, projects.id))
      .where(eq(complaints.status, status))
      .orderBy(asc(complaints.createdAt));
  }

  async createComplaint(insertComplaint: InsertComplaint): Promise<Complaint> {
    const [complaint] = await db
      .insert(complaints)
      .values(insertComplaint)
      .returning();
    return complaint;
  }

  async updateComplaint(id: string, updates: Partial<Complaint>): Promise<Complaint | undefined> {
    const [complaint] = await db
      .update(complaints)
      .set(updates)
      .where(eq(complaints.id, id))
      .returning();
    return complaint || undefined;
  }

  async deleteComplaint(id: string): Promise<boolean> {
    const result = await db.delete(complaints).where(eq(complaints.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ShootTracker meta methods
  async getShoottrackerMeta(projectId: string): Promise<ShoottrackerMeta | undefined> {
    const [meta] = await db.select().from(shoottrackerMeta).where(eq(shoottrackerMeta.projectId, projectId));
    return meta || undefined;
  }

  async createShoottrackerMeta(insertMeta: InsertShoottrackerMeta): Promise<ShoottrackerMeta> {
    const [meta] = await db
      .insert(shoottrackerMeta)
      .values(insertMeta)
      .returning();
    return meta;
  }

  async updateShoottrackerMeta(projectId: string, updates: UpdateShoottrackerMeta): Promise<ShoottrackerMeta | undefined> {
    const [meta] = await db
      .update(shoottrackerMeta)
      .set(updates)
      .where(eq(shoottrackerMeta.projectId, projectId))
      .returning();
    return meta || undefined;
  }

  async deleteShoottrackerMeta(projectId: string): Promise<boolean> {
    const result = await db.delete(shoottrackerMeta).where(eq(shoottrackerMeta.projectId, projectId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // App settings methods
  async getAppSetting(key: string): Promise<AppSetting | undefined> {
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return setting || undefined;
  }

  async setAppSetting(key: string, value: any): Promise<AppSetting> {
    const existing = await this.getAppSetting(key);
    
    if (existing) {
      const [updated] = await db
        .update(appSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(appSettings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(appSettings)
        .values({ key, value, updatedAt: new Date() })
        .returning();
      return created;
    }
  }

  async deleteAppSetting(key: string): Promise<boolean> {
    const result = await db.delete(appSettings).where(eq(appSettings.key, key));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getProjectByCalendarEventId(calendarEventId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.calendarEventId, calendarEventId));
    return project || undefined;
  }

  // Calendar events staging methods
  async getStagedEvents(status?: string): Promise<CalendarEventStaging[]> {
    if (status) {
      return db.select().from(calendarEventsStaging).where(eq(calendarEventsStaging.status, status)).orderBy(asc(calendarEventsStaging.eventStart));
    }
    return db.select().from(calendarEventsStaging).orderBy(asc(calendarEventsStaging.eventStart));
  }

  async getStagedEventByCalendarEventId(calendarEventId: string): Promise<CalendarEventStaging | undefined> {
    const [event] = await db.select().from(calendarEventsStaging).where(eq(calendarEventsStaging.calendarEventId, calendarEventId));
    return event || undefined;
  }

  async createStagedEvent(event: InsertCalendarEventStaging): Promise<CalendarEventStaging> {
    const [created] = await db.insert(calendarEventsStaging).values(event).returning();
    return created;
  }

  async updateStagedEvent(id: string, updates: UpdateCalendarEventStaging): Promise<CalendarEventStaging | undefined> {
    const [updated] = await db.update(calendarEventsStaging).set(updates).where(eq(calendarEventsStaging.id, id)).returning();
    return updated || undefined;
  }

  async upsertStagedEvent(event: InsertCalendarEventStaging): Promise<CalendarEventStaging> {
    const existing = await this.getStagedEventByCalendarEventId(event.calendarEventId);
    if (existing) {
      const [updated] = await db.update(calendarEventsStaging).set({
        title: event.title,
        description: event.description,
        location: event.location,
        eventStart: event.eventStart,
        eventEnd: event.eventEnd,
        rawPayload: event.rawPayload,
        syncedAt: new Date(),
      }).where(eq(calendarEventsStaging.calendarEventId, event.calendarEventId)).returning();
      return updated;
    }
    return this.createStagedEvent(event);
  }

  async deleteStagedEvent(id: string): Promise<boolean> {
    const result = await db.delete(calendarEventsStaging).where(eq(calendarEventsStaging.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Client auth token methods
  async createClientAuthToken(token: InsertClientAuthToken): Promise<ClientAuthToken> {
    const [created] = await db.insert(clientAuthTokens).values(token).returning();
    return created;
  }

  async getClientAuthTokenByToken(token: string): Promise<ClientAuthToken | undefined> {
    const [found] = await db.select().from(clientAuthTokens).where(eq(clientAuthTokens.token, token));
    return found || undefined;
  }

  async getClientAuthTokenByEmail(email: string): Promise<ClientAuthToken | undefined> {
    const [found] = await db.select().from(clientAuthTokens).where(eq(clientAuthTokens.email, email.toLowerCase()));
    return found || undefined;
  }
  
  async getClientAuthTokenByProjectId(projectId: string): Promise<ClientAuthToken | undefined> {
    const [found] = await db.select().from(clientAuthTokens).where(eq(clientAuthTokens.projectId, projectId));
    return found || undefined;
  }

  async deleteClientAuthToken(id: string): Promise<boolean> {
    const result = await db.delete(clientAuthTokens).where(eq(clientAuthTokens.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Client messages methods
  async getMessagesByProject(projectId: string): Promise<ClientMessage[]> {
    return await db.select().from(clientMessages).where(eq(clientMessages.projectId, projectId)).orderBy(asc(clientMessages.createdAt));
  }

  async createClientMessage(message: InsertClientMessage): Promise<ClientMessage> {
    const [created] = await db.insert(clientMessages).values(message).returning();
    return created;
  }

  async markMessagesAsRead(projectId: string, senderType: string): Promise<number> {
    const result = await db.update(clientMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(sql`${clientMessages.projectId} = ${projectId} AND ${clientMessages.senderType} = ${senderType} AND ${clientMessages.isRead} = false`);
    return result.rowCount || 0;
  }
  
  async getProjectsWithUnreadCounts(assignedTo?: string, archived: boolean = false): Promise<Array<{ project: Project; unreadCount: number; lastMessageAt: Date | null; lastSenderType: string | null }>> {
    let assignedCondition;
    if (archived) {
      assignedCondition = assignedTo
        ? sql`p.client_email IS NOT NULL AND p.assigned_to = ${assignedTo} AND p.chat_archived = true`
        : sql`p.client_email IS NOT NULL AND p.chat_archived = true`;
    } else {
      assignedCondition = assignedTo
        ? sql`p.client_email IS NOT NULL AND p.assigned_to = ${assignedTo} AND p.chat_archived = false`
        : sql`p.client_email IS NOT NULL AND p.chat_archived = false`;
    }
    
    const aggregateQuery = await db.execute(sql`
      SELECT 
        p.*,
        COALESCE(SUM(CASE WHEN cm.sender_type = 'client' AND cm.is_read = false THEN 1 ELSE 0 END), 0)::int as unread_count,
        MAX(cm.created_at) as last_message_at,
        (SELECT sender_type FROM client_messages WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1) as last_sender_type
      FROM projects p
      LEFT JOIN client_messages cm ON p.id = cm.project_id
      WHERE ${assignedCondition}
      GROUP BY p.id
      ORDER BY last_message_at DESC NULLS LAST, unread_count DESC
    `);
    
    const result: Array<{ project: Project; unreadCount: number; lastMessageAt: Date | null; lastSenderType: string | null }> = [];
    
    for (const row of aggregateQuery.rows as any[]) {
      const project: Project = {
        id: row.id,
        clientName: row.client_name,
        packageCount: row.package_count,
        selectedCount: row.selected_count,
        extras: row.extras,
        extraPhotoPrice: row.extra_photo_price,
        dueDate: row.due_date,
        status: row.status,
        invoicePaid: row.invoice_paid,
        assignedTo: row.assigned_to,
        rating: row.rating,
        deliveredAt: row.delivered_at,
        createdAt: row.created_at,
        toEditRemaining: row.to_edit_remaining,
        photosCompleted: row.photos_completed,
        rolloverCount: row.rollover_count,
        lastRolloverDate: row.last_rollover_date,
        originalProjectId: row.original_project_id,
        isRolloverShadow: row.is_rollover_shadow,
        originalDueDate: row.original_due_date,
        shootDate: row.shoot_date,
        deliveryDueDate: row.delivery_due_date,
        riskLevel: row.risk_level,
        calendarEventId: row.calendar_event_id,
        lastSyncedAt: row.last_synced_at,
        createdFrom: row.created_from,
        isLinkSent: row.is_link_sent,
        linkSentAt: row.link_sent_at,
        clientEmail: row.client_email,
        extrasApproved: row.extras_approved,
        extrasApprovedAt: row.extras_approved_at,
        extrasApprovalToken: row.extras_approval_token,
        deliveryEstimateEmailSentAt: row.delivery_estimate_email_sent_at,
        projectAddedEmailSentAt: row.project_added_email_sent_at,
        galleryLink: row.gallery_link,
        galleryLinkAddedAt: row.gallery_link_added_at,
        galleryLinkAddedBy: row.gallery_link_added_by,
        deliveryApproved: row.delivery_approved,
        deliveryApprovedAt: row.delivery_approved_at,
        deliveryApprovedBy: row.delivery_approved_by,
        deliveryEmailSentAt: row.delivery_email_sent_at,
        driveFolderId: row.drive_folder_id,
        driveFolderName: row.drive_folder_name,
        driveBwFolderId: row.drive_bw_folder_id,
        drivePhotoCount: row.drive_photo_count,
        driveBwPhotoCount: row.drive_bw_photo_count,
        driveStorageBytes: row.drive_storage_bytes,
        driveGalleryLink: row.drive_gallery_link,
        driveBwSent: row.drive_bw_sent,
        driveBwSentAt: row.drive_bw_sent_at,
        driveDeliveryComplete: row.drive_delivery_complete,
        driveDeliveryCompletedAt: row.drive_delivery_completed_at,
        driveDeliveryEmailSent: row.drive_delivery_email_sent,
        driveDeliveryEmailSentAt: row.drive_delivery_email_sent_at,
        driveAccessGranted: row.drive_access_granted,
        driveAccessGrantedAt: row.drive_access_granted_at,
        driveLastCheckedAt: row.drive_last_checked_at,
        driveClientAccessedAt: row.drive_client_accessed_at,
        chatArchived: row.chat_archived,
        chatArchivedAt: row.chat_archived_at,
        chatArchivedBy: row.chat_archived_by,
        qualityGateScore: row.quality_gate_score,
        qualityGatePassed: row.quality_gate_passed,
        qualityGateAt: row.quality_gate_at,
        qualityGateOverride: row.quality_gate_override,
        qualityGateOverrideBy: row.quality_gate_override_by,
        qualityGateOverrideAt: row.quality_gate_override_at,
        qualityGateFeedback: row.quality_gate_feedback,
      };
      
      result.push({
        project,
        unreadCount: Number(row.unread_count || 0),
        lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
        lastSenderType: row.last_sender_type || null,
      });
    }
    
    return result;
  }
  
  // Dashboard preferences methods
  async getDashboardPreferences(userId: string): Promise<DashboardPreferences | undefined> {
    const results = await db.select().from(dashboardPreferences).where(eq(dashboardPreferences.userId, userId));
    return results[0];
  }
  
  async upsertDashboardPreferences(userId: string, prefs: Partial<InsertDashboardPreferences>): Promise<DashboardPreferences> {
    const existing = await this.getDashboardPreferences(userId);
    
    if (existing) {
      const [updated] = await db.update(dashboardPreferences)
        .set({
          ...prefs,
          updatedAt: new Date(),
        })
        .where(eq(dashboardPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(dashboardPreferences)
        .values({
          userId,
          widgetOrder: prefs.widgetOrder || [],
          hiddenWidgets: prefs.hiddenWidgets || [],
          widgetSettings: prefs.widgetSettings || {},
        })
        .returning();
      return created;
    }
  }

  // Sneak peek methods
  async getSneakPeeks(projectId: string): Promise<SneakPeek[]> {
    return await db.select().from(sneakPeeks).where(eq(sneakPeeks.projectId, projectId)).orderBy(asc(sneakPeeks.createdAt));
  }

  async createSneakPeek(peek: InsertSneakPeek): Promise<SneakPeek> {
    const [created] = await db.insert(sneakPeeks).values(peek).returning();
    return created;
  }

  async deleteSneakPeek(id: string): Promise<boolean> {
    const result = await db.delete(sneakPeeks).where(eq(sneakPeeks.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createSurvey(survey: InsertSurvey): Promise<Survey> {
    const [created] = await db.insert(clientSurveys).values(survey).returning();
    return created;
  }

  async getSurveyByToken(token: string): Promise<Survey | undefined> {
    const [found] = await db.select().from(clientSurveys).where(eq(clientSurveys.surveyToken, token));
    return found || undefined;
  }

  async getSurveyByProjectId(projectId: string): Promise<Survey | undefined> {
    const [found] = await db.select().from(clientSurveys).where(eq(clientSurveys.projectId, projectId));
    return found || undefined;
  }

  async updateSurvey(id: string, updates: Partial<Survey>): Promise<Survey | undefined> {
    const [updated] = await db.update(clientSurveys).set(updates).where(eq(clientSurveys.id, id)).returning();
    return updated || undefined;
  }

  async getAllSurveys(): Promise<Survey[]> {
    // Newest-first by completedAt for completed surveys; pending fall back to createdAt
    return await db.select().from(clientSurveys).orderBy(
      desc(clientSurveys.completedAt),
      desc(clientSurveys.createdAt),
    );
  }

  async getSurveysAwaitingGooglePrompt(maxAgeMs: number): Promise<Survey[]> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    return await db.select().from(clientSurveys).where(
      and(
        eq(clientSurveys.rating, 5),
        isNotNull(clientSurveys.completedAt),
        isNull(clientSurveys.googlePromptSentAt),
        isNull(clientSurveys.googleClickedAt),
        eq(clientSurveys.alreadyReviewedOnGoogle, false),
        lte(clientSurveys.completedAt, cutoff),
      )
    );
  }

  async getSurveysAwaitingReminder(): Promise<Survey[]> {
    return await db.select().from(clientSurveys).where(
      and(
        eq(clientSurveys.rating, 5),
        isNotNull(clientSurveys.googlePromptSentAt),
        isNull(clientSurveys.googleClickedAt),
        eq(clientSurveys.alreadyReviewedOnGoogle, false),
      )
    );
  }

  async markSurveyAlreadyReviewed(id: string, source: 'auto' | 'manual', matchedAuthor?: string | null): Promise<Survey | undefined> {
    const [updated] = await db.update(clientSurveys)
      .set({
        alreadyReviewedOnGoogle: true,
        alreadyReviewedAt: new Date(),
        alreadyReviewedSource: source,
        alreadyReviewedMatchedAuthor: matchedAuthor ?? null,
      })
      .where(eq(clientSurveys.id, id))
      .returning();
    return updated || undefined;
  }

  async clearSurveyAlreadyReviewed(id: string): Promise<Survey | undefined> {
    const [updated] = await db.update(clientSurveys)
      .set({
        alreadyReviewedOnGoogle: false,
        alreadyReviewedAt: null,
        alreadyReviewedSource: null,
        alreadyReviewedMatchedAuthor: null,
      })
      .where(eq(clientSurveys.id, id))
      .returning();
    return updated || undefined;
  }

  async getGoogleReviewFunnelStats(windowDays: number) {
    const safeWindow = Math.max(1, Math.min(365, Math.floor(windowDays)));
    const cutoff = new Date(Date.now() - safeWindow * 24 * 60 * 60 * 1000);
    const [row] = await db
      .select({
        promptsSent: sql<number>`COUNT(*) FILTER (WHERE ${clientSurveys.googlePromptSentAt} IS NOT NULL AND ${clientSurveys.googlePromptSentAt} >= ${cutoff} AND ${clientSurveys.alreadyReviewedOnGoogle} = false)`,
        remindersSent: sql<number>`COALESCE(SUM(${clientSurveys.googlePromptRemindersSent}) FILTER (WHERE ${clientSurveys.googlePromptSentAt} IS NOT NULL AND ${clientSurveys.googlePromptSentAt} >= ${cutoff} AND ${clientSurveys.alreadyReviewedOnGoogle} = false), 0)`,
        copyClicks: sql<number>`COUNT(*) FILTER (WHERE ${clientSurveys.copyClickedAt} IS NOT NULL AND ${clientSurveys.copyClickedAt} >= ${cutoff})`,
        googleClicks: sql<number>`COUNT(*) FILTER (WHERE ${clientSurveys.googleClickedAt} IS NOT NULL AND ${clientSurveys.googleClickedAt} >= ${cutoff})`,
      })
      .from(clientSurveys);
    const promptsSent = Number(row?.promptsSent ?? 0);
    const remindersSent = Number(row?.remindersSent ?? 0);
    const copyClicks = Number(row?.copyClicks ?? 0);
    const googleClicks = Number(row?.googleClicks ?? 0);
    const clickThroughRate = promptsSent > 0 ? googleClicks / promptsSent : 0;
    return {
      windowDays: safeWindow,
      promptsSent,
      remindersSent,
      copyClicks,
      googleClicks,
      clickThroughRate,
    };
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const [created] = await db.insert(referrals).values(referral).returning();
    return created;
  }

  async getReferralByCode(code: string): Promise<Referral | undefined> {
    const [found] = await db.select().from(referrals).where(eq(referrals.referralCode, code));
    return found || undefined;
  }

  async getReferralsByReferrer(email: string): Promise<Referral[]> {
    return await db.select().from(referrals).where(eq(referrals.referrerEmail, email));
  }

  async updateReferral(id: string, updates: Partial<Referral>): Promise<Referral | undefined> {
    const [updated] = await db.update(referrals).set(updates).where(eq(referrals.id, id)).returning();
    return updated || undefined;
  }

  async getAllReferrals(): Promise<Referral[]> {
    return await db.select().from(referrals).orderBy(asc(referrals.createdAt));
  }

  async getSubmittedReferralsByName(clientName: string): Promise<Referral[]> {
    const nameParts = clientName.trim().toLowerCase().split(/\s+/);
    const allSubmitted = await db.select().from(referrals).where(eq(referrals.status, "submitted"));
    return allSubmitted.filter(r => {
      if (!r.referredFirstName || !r.referredLastName) return false;
      const refFirst = r.referredFirstName.toLowerCase();
      const refLast = r.referredLastName.toLowerCase();
      const refFull = `${refFirst} ${refLast}`;
      const clientLower = clientName.trim().toLowerCase();
      if (refFull === clientLower) return true;
      if (nameParts.length >= 2) {
        return nameParts.some(p => p === refFirst) && nameParts.some(p => p === refLast);
      }
      return false;
    });
  }

  async getSubmittedReferralsByEmail(clientEmail: string): Promise<Referral[]> {
    return await db.select().from(referrals).where(
      and(eq(referrals.status, "submitted"), eq(referrals.referredEmail, clientEmail.trim().toLowerCase()))
    );
  }

  async getClientProfile(email: string): Promise<ClientProfile | undefined> {
    const [found] = await db.select().from(clientProfiles).where(eq(clientProfiles.clientEmail, email));
    return found || undefined;
  }

  async getAllClientProfiles(): Promise<ClientProfile[]> {
    return await db.select().from(clientProfiles).orderBy(asc(clientProfiles.clientName));
  }

  async upsertClientProfile(profile: Partial<InsertClientProfile> & { clientEmail: string; clientName: string }): Promise<ClientProfile> {
    const existing = await this.getClientProfile(profile.clientEmail);
    if (existing) {
      const [updated] = await db.update(clientProfiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(clientProfiles.clientEmail, profile.clientEmail))
        .returning();
      return updated;
    }
    const [created] = await db.insert(clientProfiles).values(profile).returning();
    return created;
  }

  async updateClientProfile(id: string, updates: Partial<ClientProfile>): Promise<ClientProfile | undefined> {
    const [updated] = await db.update(clientProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clientProfiles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteClientProfileByEmail(email: string): Promise<void> {
    await db.delete(clientProfiles).where(eq(clientProfiles.clientEmail, email));
  }

  async createRewardClaim(claim: InsertRewardClaim): Promise<RewardClaim> {
    const [created] = await db.insert(referralRewardClaims).values(claim).returning();
    return created;
  }

  async getRewardClaimsByProject(projectId: string): Promise<RewardClaim[]> {
    return await db.select().from(referralRewardClaims).where(eq(referralRewardClaims.projectId, projectId));
  }

  async getRewardClaimsByClient(clientEmail: string): Promise<RewardClaim[]> {
    return await db.select().from(referralRewardClaims).where(eq(referralRewardClaims.clientEmail, clientEmail));
  }

  async creditBonusPhotos(clientEmail: string, clientName: string, photos: number): Promise<ClientProfile> {
    const existing = await this.getClientProfile(clientEmail);
    if (existing) {
      const [updated] = await db.update(clientProfiles)
        .set({ bonusPhotos: (existing.bonusPhotos || 0) + photos, updatedAt: new Date() })
        .where(eq(clientProfiles.clientEmail, clientEmail))
        .returning();
      return updated;
    }
    const [created] = await db.insert(clientProfiles).values({
      clientEmail,
      clientName,
      bonusPhotos: photos,
    }).returning();
    return created;
  }

  async applyBonusPhotos(clientEmail: string, projectId: string, clientName: string, photosToApply: number, appliedBy: string): Promise<{ claim: RewardClaim; profile: ClientProfile }> {
    const profile = await this.getClientProfile(clientEmail);
    if (!profile) throw new Error("Client profile not found");
    const available = (profile.bonusPhotos || 0) - (profile.bonusPhotosUsed || 0);
    if (photosToApply > available) throw new Error(`Only ${available} bonus photos available`);
    
    const claim = await this.createRewardClaim({
      clientEmail,
      clientName,
      projectId,
      photosApplied: photosToApply,
      appliedBy,
    });
    
    const [updatedProfile] = await db.update(clientProfiles)
      .set({ bonusPhotosUsed: (profile.bonusPhotosUsed || 0) + photosToApply, updatedAt: new Date() })
      .where(eq(clientProfiles.clientEmail, clientEmail))
      .returning();
    
    return { claim, profile: updatedProfile };
  }

  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates);
  }

  async getEmailTemplateByKey(templateKey: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, templateKey));
    return template || undefined;
  }

  async upsertEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const existing = await this.getEmailTemplateByKey(template.templateKey);
    if (existing) {
      const [updated] = await db.update(emailTemplates)
        .set({ ...template, updatedAt: new Date() })
        .where(eq(emailTemplates.templateKey, template.templateKey))
        .returning();
      return updated;
    }
    const [created] = await db.insert(emailTemplates).values(template).returning();
    return created;
  }

  async updateEmailTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate | undefined> {
    const [updated] = await db.update(emailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async savePushSubscription(sub: InsertPushSubscription): Promise<PushSubscription> {
    const existing = await db.select().from(pushSubscriptions).where(
      and(
        eq(pushSubscriptions.endpoint, sub.endpoint),
        eq(pushSubscriptions.projectId, sub.projectId)
      )
    );
    if (existing.length > 0) {
      const [updated] = await db.update(pushSubscriptions)
        .set({ p256dh: sub.p256dh, auth: sub.auth })
        .where(eq(pushSubscriptions.endpoint, sub.endpoint))
        .returning();
      return updated;
    }
    const [created] = await db.insert(pushSubscriptions).values(sub).returning();
    return created;
  }

  async getPushSubscriptionsByProject(projectId: string): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.projectId, projectId));
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getChatEncryptionKey(projectId: string): Promise<{ encryptionKey: string; createdBy: string } | undefined> {
    const [result] = await db.select().from(chatEncryptionKeys).where(eq(chatEncryptionKeys.projectId, projectId));
    if (!result) return undefined;
    return { encryptionKey: result.encryptionKey, createdBy: result.createdBy };
  }

  async setChatEncryptionKey(projectId: string, encryptionKey: string, createdBy: string): Promise<void> {
    const existing = await db.select().from(chatEncryptionKeys).where(eq(chatEncryptionKeys.projectId, projectId));
    if (existing.length > 0) {
      await db.update(chatEncryptionKeys)
        .set({ encryptionKey, createdBy })
        .where(eq(chatEncryptionKeys.projectId, projectId));
    } else {
      await db.insert(chatEncryptionKeys).values({ projectId, encryptionKey, createdBy });
    }
  }

  async recordStatusTransition(projectId: string, fromStatus: string, toStatus: string, changedBy: string): Promise<StatusTransition> {
    const previousTransitions = await db
      .select()
      .from(projectStatusTransitions)
      .where(eq(projectStatusTransitions.projectId, projectId))
      .orderBy(sql`${projectStatusTransitions.transitionedAt} DESC`)
      .limit(1);

    let durationMinutes: number | null = null;
    if (previousTransitions.length > 0 && previousTransitions[0].transitionedAt) {
      const prev = new Date(previousTransitions[0].transitionedAt).getTime();
      const now = Date.now();
      durationMinutes = Math.round((now - prev) / 60000);
    }

    const [transition] = await db
      .insert(projectStatusTransitions)
      .values({ projectId, fromStatus, toStatus, changedBy, durationMinutes })
      .returning();
    return transition;
  }

  async getStatusTransitions(projectId: string): Promise<StatusTransition[]> {
    return await db
      .select()
      .from(projectStatusTransitions)
      .where(eq(projectStatusTransitions.projectId, projectId))
      .orderBy(asc(projectStatusTransitions.transitionedAt));
  }

  async getRetoucherSpeedStats(username: string): Promise<{ avgMinutes: number; totalProjects: number; fastestMinutes: number; slowestMinutes: number }> {
    const result = await db.execute(sql`
      SELECT 
        COALESCE(AVG(duration_minutes), 0)::int as avg_minutes,
        COUNT(DISTINCT project_id)::int as total_projects,
        COALESCE(MIN(duration_minutes), 0)::int as fastest_minutes,
        COALESCE(MAX(duration_minutes), 0)::int as slowest_minutes
      FROM project_status_transitions
      WHERE to_status = 'Delivered' AND changed_by = ${username} AND duration_minutes IS NOT NULL
    `);
    const row = result.rows[0] as any;
    return {
      avgMinutes: Number(row?.avg_minutes || 0),
      totalProjects: Number(row?.total_projects || 0),
      fastestMinutes: Number(row?.fastest_minutes || 0),
      slowestMinutes: Number(row?.slowest_minutes || 0),
    };
  }

  async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
    const [created] = await db.insert(leaveRequests).values(request).returning();
    return created;
  }

  async getLeaveRequests(username?: string, year?: number): Promise<LeaveRequest[]> {
    let conditions = [];
    if (username) conditions.push(eq(leaveRequests.username, username));
    if (year) conditions.push(eq(leaveRequests.year, year));

    if (conditions.length === 0) {
      return await db.select().from(leaveRequests).orderBy(sql`${leaveRequests.createdAt} DESC`);
    } else if (conditions.length === 1) {
      return await db.select().from(leaveRequests).where(conditions[0]).orderBy(sql`${leaveRequests.createdAt} DESC`);
    } else {
      return await db.select().from(leaveRequests).where(and(...conditions)).orderBy(sql`${leaveRequests.createdAt} DESC`);
    }
  }

  async getLeaveRequestById(id: string): Promise<LeaveRequest | undefined> {
    const [found] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return found || undefined;
  }

  async updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<LeaveRequest | undefined> {
    const [updated] = await db.update(leaveRequests).set(updates).where(eq(leaveRequests.id, id)).returning();
    return updated || undefined;
  }

  async getUsedLeaveDays(username: string, year: number): Promise<number> {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(weekdays_count), 0)::int as used_days
      FROM leave_requests
      WHERE username = ${username} AND year = ${year} AND status IN ('approved', 'pending')
    `);
    return Number((result.rows[0] as any)?.used_days || 0);
  }

  async createAiTeamMessage(msg: InsertAiTeamMessage): Promise<AiTeamMessage> {
    const [created] = await db.insert(aiTeamMessages).values(msg).returning();
    return created;
  }

  async getAiTeamMessages(username: string, limit: number = 50): Promise<AiTeamMessage[]> {
    const result = await db.execute(sql`
      SELECT * FROM ai_team_messages
      WHERE username = ${username}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `);
    return result.rows as AiTeamMessage[];
  }

  async getRecentRetoucherExplanations(since: Date): Promise<AiTeamMessage[]> {
    const result = await db.execute(sql`
      SELECT * FROM ai_team_messages
      WHERE sender_type = 'user'
        AND role NOT IN ('Admin', 'LeadRetoucher')
        AND metadata->>'type' = 'explanation'
        AND created_at >= ${since}
      ORDER BY created_at DESC
    `);
    return result.rows as AiTeamMessage[];
  }

  // AI Memory methods
  async createAiMemory(memory: InsertAiMemory): Promise<AiMemory> {
    const [created] = await db.insert(aiMemory).values(memory).returning();
    return created;
  }

  async getAiMemories(options?: { category?: string; retoucherName?: string; limit?: number }): Promise<AiMemory[]> {
    const conditions: any[] = [];
    if (options?.category) conditions.push(eq(aiMemory.category, options.category));
    if (options?.retoucherName) conditions.push(eq(aiMemory.retoucherName, options.retoucherName));
    
    const query = conditions.length > 0
      ? db.select().from(aiMemory).where(and(...conditions)).orderBy(sql`created_at DESC`).limit(options?.limit || 100)
      : db.select().from(aiMemory).orderBy(sql`created_at DESC`).limit(options?.limit || 100);
    
    return await query;
  }

  async getAiMemoriesByCategory(category: string, limit: number = 50): Promise<AiMemory[]> {
    return await db.select().from(aiMemory)
      .where(eq(aiMemory.category, category))
      .orderBy(sql`importance DESC, created_at DESC`)
      .limit(limit);
  }

  async deleteAiMemory(id: string): Promise<boolean> {
    const result = await db.delete(aiMemory).where(eq(aiMemory.id, id)).returning();
    return result.length > 0;
  }

  async clearAiMemories(category?: string): Promise<number> {
    if (category) {
      const result = await db.delete(aiMemory).where(eq(aiMemory.category, category)).returning();
      return result.length;
    }
    const result = await db.delete(aiMemory).returning();
    return result.length;
  }

  async pruneExpiredMemories(): Promise<number> {
    const result = await db.delete(aiMemory)
      .where(sql`expires_at IS NOT NULL AND expires_at < NOW()`)
      .returning();
    return result.length;
  }

  // Admin Instructions methods
  async createAdminInstruction(instruction: InsertAiAdminInstruction): Promise<AiAdminInstruction> {
    const [created] = await db.insert(aiAdminInstructions).values(instruction).returning();
    return created;
  }

  async getAdminInstructions(options?: { category?: string; targetRetoucher?: string; activeOnly?: boolean }): Promise<AiAdminInstruction[]> {
    const conditions: any[] = [];
    if (options?.category) conditions.push(eq(aiAdminInstructions.category, options.category));
    if (options?.targetRetoucher) conditions.push(eq(aiAdminInstructions.targetRetoucher, options.targetRetoucher));
    if (options?.activeOnly) conditions.push(eq(aiAdminInstructions.isActive, true));
    
    const query = conditions.length > 0
      ? db.select().from(aiAdminInstructions).where(and(...conditions)).orderBy(sql`priority DESC, created_at DESC`)
      : db.select().from(aiAdminInstructions).orderBy(sql`priority DESC, created_at DESC`);
    
    return await query;
  }

  async getActiveAdminInstructions(retoucherName?: string): Promise<AiAdminInstruction[]> {
    const conditions: any[] = [eq(aiAdminInstructions.isActive, true)];
    if (retoucherName) {
      const result = await db.select().from(aiAdminInstructions)
        .where(and(
          eq(aiAdminInstructions.isActive, true),
          sql`(target_retoucher IS NULL OR target_retoucher = ${retoucherName})`
        ))
        .orderBy(sql`priority DESC`);
      return result;
    }
    return await db.select().from(aiAdminInstructions)
      .where(eq(aiAdminInstructions.isActive, true))
      .orderBy(sql`priority DESC`);
  }

  async updateAdminInstruction(id: string, updates: Partial<AiAdminInstruction>): Promise<AiAdminInstruction | undefined> {
    const [updated] = await db.update(aiAdminInstructions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiAdminInstructions.id, id))
      .returning();
    return updated;
  }

  async deleteAdminInstruction(id: string): Promise<boolean> {
    const result = await db.delete(aiAdminInstructions).where(eq(aiAdminInstructions.id, id)).returning();
    return result.length > 0;
  }
}

// Use DatabaseStorage for persistent data across deployments
export const storage = new DatabaseStorage();
