import { type User, type InsertUser, type Project, type InsertProject, type UpdateProject, type ProjectNote, type InsertProjectNote, type UpdateProjectNote, type TradeOffer, type InsertTradeOffer, type UpdateTradeOffer, type WranglerCommission, type InsertWranglerCommission, type ProjectEvent, type InsertProjectEvent, type Complaint, type InsertComplaint, type CalendarSettings, type UpdateCalendarSettings, ProjectStatus, TradeOfferStatus, users, projects, projectNotes, tradeOffers, wranglerCommissions, projectEvents, complaints, calendarSettings } from "@shared/schema";
import { db } from "./db";
import { eq, sql, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  
  // Calendar settings methods for ShootTracker integration
  getCalendarSettings(): Promise<CalendarSettings | undefined>;
  updateCalendarSettings(updates: UpdateCalendarSettings): Promise<CalendarSettings>;
  getProjectByCalendarEventId(calendarEventId: string): Promise<Project | undefined>;
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
        calendarEventId: null,
        isLinkSent: false,
        linkSentAt: null,
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
        calendarEventId: null,
        isLinkSent: false,
        linkSentAt: null,
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
        calendarEventId: null,
        isLinkSent: false,
        linkSentAt: null,
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
        calendarEventId: null,
        isLinkSent: true,
        linkSentAt: new Date(2025, 7, 3),
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
        calendarEventId: null,
        isLinkSent: false,
        linkSentAt: null,
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
      shootDate: (insertProject as any).shootDate ?? null,
      calendarEventId: (insertProject as any).calendarEventId ?? null,
      isLinkSent: (insertProject as any).isLinkSent ?? false,
      linkSentAt: (insertProject as any).linkSentAt ?? null,
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

  // Calendar settings methods (Not implemented for MemStorage)
  async getCalendarSettings(): Promise<CalendarSettings | undefined> {
    return undefined;
  }

  async updateCalendarSettings(updates: UpdateCalendarSettings): Promise<CalendarSettings> {
    throw new Error("Not implemented in MemStorage");
  }

  async getProjectByCalendarEventId(calendarEventId: string): Promise<Project | undefined> {
    return Array.from(this.projects.values()).find(p => p.calendarEventId === calendarEventId);
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

  // Calendar settings methods for ShootTracker integration
  async getCalendarSettings(): Promise<CalendarSettings | undefined> {
    const [settings] = await db.select().from(calendarSettings).limit(1);
    return settings || undefined;
  }

  async updateCalendarSettings(updates: UpdateCalendarSettings): Promise<CalendarSettings> {
    const existing = await this.getCalendarSettings();
    
    if (existing) {
      const [updated] = await db
        .update(calendarSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(calendarSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(calendarSettings)
        .values({
          turnaroundDays: updates.turnaroundDays ?? 5,
          selectedCalendarIds: updates.selectedCalendarIds ?? "",
          exclusionKeywords: updates.exclusionKeywords ?? "FULL DAY,BLOCK,HOLD,OUT OF OFFICE",
          cancelKeywords: updates.cancelKeywords ?? "CANCEL,CANCELLED,DID NOT COME,NO SHOW,NOT COMING",
          defaultPackageCount: updates.defaultPackageCount ?? 5,
          autoImport: updates.autoImport ?? false,
        })
        .returning();
      return created;
    }
  }

  async getProjectByCalendarEventId(calendarEventId: string): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.calendarEventId, calendarEventId));
    return project || undefined;
  }
}

// Use DatabaseStorage for persistent data across deployments
export const storage = new DatabaseStorage();
