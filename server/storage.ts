import { type User, type InsertUser, type Project, type InsertProject, type UpdateProject, type ProjectNote, type InsertProjectNote, type UpdateProjectNote, type TradeOffer, type InsertTradeOffer, type UpdateTradeOffer, type WranglerCommission, type InsertWranglerCommission, type ProjectEvent, type InsertProjectEvent, type Complaint, type InsertComplaint, type ShoottrackerMeta, type InsertShoottrackerMeta, type UpdateShoottrackerMeta, type AppSetting, type CalendarEventStaging, type InsertCalendarEventStaging, type UpdateCalendarEventStaging, type ClientAuthToken, type InsertClientAuthToken, type ClientMessage, type InsertClientMessage, type DashboardPreferences, type InsertDashboardPreferences, type SneakPeek, type InsertSneakPeek, type Survey, type InsertSurvey, type Referral, type InsertReferral, type ClientProfile, type InsertClientProfile, ProjectStatus, TradeOfferStatus, StagingStatus, users, projects, projectNotes, tradeOffers, wranglerCommissions, projectEvents, complaints, shoottrackerMeta, appSettings, calendarEventsStaging, clientAuthTokens, clientMessages, dashboardPreferences, sneakPeeks, clientSurveys, referrals, clientProfiles } from "@shared/schema";
import { db } from "./db";
import { eq, sql, asc } from "drizzle-orm";
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
  
  // Client messages methods
  getMessagesByProject(projectId: string): Promise<ClientMessage[]>;
  createClientMessage(message: InsertClientMessage): Promise<ClientMessage>;
  markMessagesAsRead(projectId: string, senderType: string): Promise<number>;
  getProjectsWithUnreadCounts(assignedTo?: string): Promise<Array<{ project: Project; unreadCount: number; lastMessageAt: Date | null }>>;
  
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
  
  // Referral methods
  createReferral(referral: InsertReferral): Promise<Referral>;
  getReferralByCode(code: string): Promise<Referral | undefined>;
  getReferralsByReferrer(email: string): Promise<Referral[]>;
  updateReferral(id: string, updates: Partial<Referral>): Promise<Referral | undefined>;
  getAllReferrals(): Promise<Referral[]>;

  // Client profile methods
  getClientProfile(email: string): Promise<ClientProfile | undefined>;
  getAllClientProfiles(): Promise<ClientProfile[]>;
  upsertClientProfile(profile: Partial<InsertClientProfile> & { clientEmail: string; clientName: string }): Promise<ClientProfile>;
  updateClientProfile(id: string, updates: Partial<ClientProfile>): Promise<ClientProfile | undefined>;
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
  
  async getProjectsWithUnreadCounts(assignedTo?: string): Promise<Array<{ project: Project; unreadCount: number; lastMessageAt: Date | null }>> {
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
      .set({ isRead: true })
      .where(sql`${clientMessages.projectId} = ${projectId} AND ${clientMessages.senderType} = ${senderType}`);
    return result.rowCount || 0;
  }
  
  async getProjectsWithUnreadCounts(assignedTo?: string): Promise<Array<{ project: Project; unreadCount: number; lastMessageAt: Date | null }>> {
    // Build the query condition using raw SQL with table alias 'p'
    // Only show projects that are NOT delivered (status != 'Delivered' and delivered_at IS NULL)
    const assignedCondition = assignedTo 
      ? sql`p.client_email IS NOT NULL AND p.assigned_to = ${assignedTo} AND p.status != 'Delivered' AND p.delivered_at IS NULL`
      : sql`p.client_email IS NOT NULL AND p.status != 'Delivered' AND p.delivered_at IS NULL`;
    
    // Single aggregate query with LEFT JOIN to get all data at once
    const aggregateQuery = await db.execute(sql`
      SELECT 
        p.*,
        COALESCE(SUM(CASE WHEN cm.sender_type = 'client' AND cm.is_read = false THEN 1 ELSE 0 END), 0)::int as unread_count,
        MAX(cm.created_at) as last_message_at
      FROM projects p
      LEFT JOIN client_messages cm ON p.id = cm.project_id
      WHERE ${assignedCondition}
      GROUP BY p.id
      ORDER BY last_message_at DESC NULLS LAST, unread_count DESC
    `);
    
    // Map the raw results to the expected format
    const result: Array<{ project: Project; unreadCount: number; lastMessageAt: Date | null }> = [];
    
    for (const row of aggregateQuery.rows as any[]) {
      // Reconstruct the project object from the row (using SQL column names from schema)
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
      };
      
      result.push({
        project,
        unreadCount: Number(row.unread_count || 0),
        lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
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
}

// Use DatabaseStorage for persistent data across deployments
export const storage = new DatabaseStorage();
