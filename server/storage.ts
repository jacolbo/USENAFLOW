import { type User, type InsertUser, type Project, type InsertProject, type UpdateProject, type ProjectNote, type InsertProjectNote, type UpdateProjectNote, ProjectStatus } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private projectNotes: Map<string, ProjectNote>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.projectNotes = new Map();
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
}

export const storage = new MemStorage();
