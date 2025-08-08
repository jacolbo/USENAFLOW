import { type User, type InsertUser, type Project, type InsertProject, type UpdateProject, ProjectStatus } from "@shared/schema";
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
  splitProject(projectId: string, selectedCount: number): Promise<{ originalProject: Project; remainingProject: Project | null }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
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
        totalPhotos: 16, // Total photos available
        extras: 2,
        dueDate: new Date(2025, 7, 7), // Aug 7, 2025
        status: ProjectStatus.AWAITING_PAYMENT,
        invoicePaid: false,
        assignedTo: null,
        rating: null,
        parentProjectId: null,
        projectGroup: "alice-group-1",
        createdAt: new Date(),
      },
      {
        id: "2",
        clientName: "Bob",
        packageCount: 5,
        selectedCount: 5,
        totalPhotos: 8, // Total photos available
        extras: 0,
        dueDate: new Date(2025, 7, 9), // Aug 9, 2025
        status: ProjectStatus.READY_FOR_RETOUCHING,
        invoicePaid: true,
        assignedTo: null,
        rating: null,
        parentProjectId: null,
        projectGroup: "bob-group-1",
        createdAt: new Date(),
      },
      {
        id: "3",
        clientName: "Charlie",
        packageCount: 8,
        selectedCount: 8,
        totalPhotos: 15, // Total photos available
        extras: 0,
        dueDate: new Date(2025, 7, 1), // Aug 1, 2025
        status: ProjectStatus.REVIEW,
        invoicePaid: true,
        assignedTo: "Retoucher 2",
        rating: null,
        parentProjectId: null,
        projectGroup: "charlie-group-1",
        createdAt: new Date(),
      },
      {
        id: "4",
        clientName: "Daisy",
        packageCount: 7,
        selectedCount: 10,
        totalPhotos: 14, // Total photos available
        extras: 3,
        dueDate: new Date(2025, 7, 2), // Aug 2, 2025
        status: ProjectStatus.DELIVERED,
        invoicePaid: true,
        assignedTo: "Retoucher 1",
        rating: 5,
        parentProjectId: null,
        projectGroup: "daisy-group-1",
        createdAt: new Date(),
      },
      {
        id: "5",
        clientName: "Eve",
        packageCount: 4,
        selectedCount: 4,
        totalPhotos: 10, // Total photos available
        extras: 0,
        dueDate: new Date(2025, 7, 8), // Aug 8, 2025
        status: ProjectStatus.ASSIGNED,
        invoicePaid: true,
        assignedTo: "Retoucher 3",
        rating: null,
        parentProjectId: null,
        projectGroup: "eve-group-1",
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
      parentProjectId: null,
      projectGroup: insertProject.projectGroup || `${insertProject.clientName.toLowerCase()}-group-${Date.now()}`,
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

  async splitProject(projectId: string, selectedCount: number): Promise<{ originalProject: Project; remainingProject: Project | null }> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Calculate remaining photos
    const remainingPhotos = project.totalPhotos - selectedCount;
    
    // Update original project with selected count
    const updatedProject = {
      ...project,
      selectedCount,
      extras: Math.max(0, selectedCount - project.packageCount)
    };
    this.projects.set(projectId, updatedProject);

    // Create new project for remaining photos if any
    let remainingProject: Project | null = null;
    if (remainingPhotos > 0) {
      const newId = randomUUID();
      remainingProject = {
        id: newId,
        clientName: project.clientName,
        packageCount: Math.min(project.packageCount, remainingPhotos), // Remaining package capacity
        selectedCount: 0, // Not yet selected for editing
        totalPhotos: remainingPhotos,
        extras: 0,
        dueDate: new Date(project.dueDate.getTime() + 7 * 24 * 60 * 60 * 1000), // Due 1 week later
        status: ProjectStatus.AWAITING_PAYMENT,
        invoicePaid: false,
        assignedTo: null,
        rating: null,
        parentProjectId: projectId,
        projectGroup: project.projectGroup,
        createdAt: new Date(),
      };
      this.projects.set(newId, remainingProject);
    }

    return { originalProject: updatedProject, remainingProject };
  }
}

export const storage = new MemStorage();
