import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, updateProjectSchema, insertProjectNoteSchema, updateProjectNoteSchema, ProjectStatus } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

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
      const project = await storage.updateProject(id, validatedData);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
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
  return httpServer;
}
