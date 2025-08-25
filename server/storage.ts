import { type User, type InsertUser, type Project, type InsertProject, type UpdateProject, type ProjectNote, type InsertProjectNote, type UpdateProjectNote, type TradeOffer, type InsertTradeOffer, type UpdateTradeOffer, ProjectStatus, TradeOfferStatus, users, projects, projectNotes, tradeOffers } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
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
        dueDate: new Date(2025, 7, 7), // Aug 7, 2025
        status: ProjectStatus.AWAITING_PAYMENT,
        invoicePaid: false,
        assignedTo: null,
        rating: null,
        deliveredAt: null,
        createdAt: new Date(),
      },
      {
        id: "2",
        clientName: "Bob",
        packageCount: 5,
        selectedCount: 5,
        extras: 0,
        dueDate: new Date(2025, 7, 9), // Aug 9, 2025
        status: ProjectStatus.READY_FOR_RETOUCHING,
        invoicePaid: true,
        assignedTo: null,
        rating: null,
        deliveredAt: null,
        createdAt: new Date(),
      },
      {
        id: "3",
        clientName: "Charlie",
        packageCount: 8,
        selectedCount: 8,
        extras: 0,
        dueDate: new Date(2025, 7, 1), // Aug 1, 2025
        status: ProjectStatus.REVIEW,
        invoicePaid: true,
        assignedTo: "Retoucher 2",
        rating: null,
        deliveredAt: null,
        createdAt: new Date(),
      },
      {
        id: "4",
        clientName: "Daisy",
        packageCount: 7,
        selectedCount: 10,
        extras: 3,
        dueDate: new Date(2025, 7, 2), // Aug 2, 2025
        status: ProjectStatus.DELIVERED,
        invoicePaid: true,
        assignedTo: "Retoucher 1",
        rating: 5,
        deliveredAt: new Date(2025, 7, 3), // Aug 3, 2025
        createdAt: new Date(),
      },
      {
        id: "5",
        clientName: "Eve",
        packageCount: 4,
        selectedCount: 4,
        extras: 0,
        dueDate: new Date(2025, 7, 8), // Aug 8, 2025
        status: ProjectStatus.ASSIGNED,
        invoicePaid: true,
        assignedTo: "Retoucher 3",
        rating: null,
        deliveredAt: null,
        createdAt: new Date(),
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
    const extras = Math.max(0, insertProject.selectedCount - insertProject.packageCount);
    const status = extras > 0 ? ProjectStatus.AWAITING_PAYMENT : ProjectStatus.READY_FOR_RETOUCHING;
    const invoicePaid = extras === 0;
    
    const project: Project = {
      ...insertProject,
      id,
      extras,
      status,
      invoicePaid,
      assignedTo: null,
      rating: null,
      deliveredAt: null,
      createdAt: new Date(),
    };
    
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: UpdateProject): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) {
      return undefined;
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
    const extras = Math.max(0, insertProject.selectedCount - insertProject.packageCount);
    const status = extras > 0 ? ProjectStatus.AWAITING_PAYMENT : ProjectStatus.READY_FOR_RETOUCHING;
    const invoicePaid = extras === 0;
    
    // Convert due date to Sunday of that week
    const getSundayOfWeek = (date: Date): Date => {
      const sunday = new Date(date);
      const day = date.getDay(); // 0 = Sunday
      sunday.setDate(date.getDate() - day); // Go back to Sunday
      sunday.setHours(0, 0, 0, 0); // Set to start of day
      return sunday;
    };
    
    const sundayDueDate = getSundayOfWeek(new Date(insertProject.dueDate));
    
    const [project] = await db
      .insert(projects)
      .values({
        ...insertProject,
        dueDate: sundayDueDate,
        extras,
        status,
        invoicePaid,
        assignedTo: null,
        rating: null,
      })
      .returning();
    return project;
  }

  async updateProject(id: string, updates: UpdateProject): Promise<Project | undefined> {
    // Always recalculate extras if packageCount, selectedCount, or extras changed
    if (updates.packageCount !== undefined || updates.selectedCount !== undefined || updates.extras !== undefined) {
      const currentProject = await this.getProject(id);
      if (currentProject) {
        const newPackageCount = updates.packageCount ?? currentProject.packageCount;
        const newSelectedCount = updates.selectedCount ?? currentProject.selectedCount;
        
        // If extras is being directly updated, ensure selectedCount matches
        if (updates.extras !== undefined && updates.selectedCount === undefined) {
          updates.selectedCount = newPackageCount + updates.extras;
        } else {
          // Otherwise calculate extras from counts
          updates.extras = Math.max(0, (updates.selectedCount ?? newSelectedCount) - newPackageCount);
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
}

// Use DatabaseStorage for persistent data across deployments
export const storage = new DatabaseStorage();
