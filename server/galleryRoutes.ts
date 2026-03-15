// ============================================
// GALLERY ROUTES — Save as server/galleryRoutes.ts
// Then add to routes.ts:
//   import { registerGalleryRoutes } from "./galleryRoutes";
//   registerGalleryRoutes(app);  // Add near line 3075 next to registerShoottrackerRoutes
// ============================================

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  galleries, gallerySets, galleryPhotos, galleryFavLists,
  gallerySelections, galleryDownloads, galleryAuthTokens,
  projects, GalleryPermissions, GalleryStatus,
} from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { broadcastSSE } from "./routes";

const objectStorage = new ObjectStorageService();

// ============================================
// PERMISSION MIDDLEWARE
// ============================================

function hasGalleryAccess(role: string): boolean {
  return (
    GalleryPermissions.FULL.includes(role as any) ||
    GalleryPermissions.MANAGE.includes(role as any) ||
    GalleryPermissions.READ_ONLY.includes(role as any)
  );
}

function canManageGallery(role: string): boolean {
  return (
    GalleryPermissions.FULL.includes(role as any) ||
    GalleryPermissions.MANAGE.includes(role as any)
  );
}

function canDeleteGallery(role: string): boolean {
  return GalleryPermissions.FULL.includes(role as any);
}

function getUserFromRequest(req: Request): { userId: string; role: string } | null {
  const userId = req.headers["x-usena-user-id"] as string;
  const role = req.headers["x-usena-user-role"] as string;
  if (!userId || !role) return null;
  return { userId, role };
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 50);
}

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 6; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

// ============================================
// REGISTER ALL GALLERY ROUTES
// ============================================

export function registerGalleryRoutes(app: Express) {

  // ==========================================
  // ADMIN ROUTES — Gallery CRUD
  // ==========================================

  // List all galleries
  app.get("/api/galleries", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !hasGalleryAccess(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const allGalleries = await db
        .select()
        .from(galleries)
        .orderBy(desc(galleries.createdAt));

      // For each gallery, get photo count and fav activity count
      const enriched = await Promise.all(
        allGalleries.map(async (gallery) => {
          const [photoCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(galleryPhotos)
            .where(eq(galleryPhotos.galleryId, gallery.id));

          const [favCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(galleryFavLists)
            .where(eq(galleryFavLists.galleryId, gallery.id));

          return {
            ...gallery,
            photoCount: photoCount?.count || 0,
            favListCount: favCount?.count || 0,
          };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      console.error("[Gallery] Error listing galleries:", error.message);
      res.status(500).json({ error: "Failed to list galleries" });
    }
  });

  // Create new gallery
  app.post("/api/galleries", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { name, projectId } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });

      let slug = generateSlug(name);

      // Ensure slug is unique
      const existing = await db.select().from(galleries).where(eq(galleries.slug, slug));
      if (existing.length > 0) {
        slug = slug + Math.floor(Math.random() * 9999);
      }

      const [gallery] = await db
        .insert(galleries)
        .values({
          name,
          slug,
          projectId: projectId || null,
          password: generatePassword(),
          downloadPin: generatePin(),
          createdBy: user.userId,
        })
        .returning();

      // Auto-create a default "Highlights" set
      await db.insert(gallerySets).values({
        galleryId: gallery.id,
        name: "Highlights",
        sortOrder: 0,
      });

      // If linked to a project, update the project's gallery link
      if (projectId) {
        await db
          .update(projects)
          .set({
            galleryLink: `/g/${gallery.slug}`,
            galleryLinkAddedAt: new Date(),
            galleryLinkAddedBy: user.userId,
          })
          .where(eq(projects.id, projectId));
      }

      res.json(gallery);
    } catch (error: any) {
      console.error("[Gallery] Error creating gallery:", error.message);
      res.status(500).json({ error: "Failed to create gallery" });
    }
  });

  // Get single gallery with sets and photo counts
  app.get("/api/galleries/:id", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !hasGalleryAccess(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [gallery] = await db
        .select()
        .from(galleries)
        .where(eq(galleries.id, req.params.id));

      if (!gallery) return res.status(404).json({ error: "Gallery not found" });

      // Get sets with photo counts
      const sets = await db
        .select()
        .from(gallerySets)
        .where(eq(gallerySets.galleryId, gallery.id))
        .orderBy(asc(gallerySets.sortOrder));

      const setsWithCounts = await Promise.all(
        sets.map(async (set) => {
          const [count] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(galleryPhotos)
            .where(eq(galleryPhotos.setId, set.id));
          return { ...set, photoCount: count?.count || 0 };
        })
      );

      // Get total photo count
      const [totalPhotos] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(galleryPhotos)
        .where(eq(galleryPhotos.galleryId, gallery.id));

      res.json({
        ...gallery,
        sets: setsWithCounts,
        totalPhotos: totalPhotos?.count || 0,
      });
    } catch (error: any) {
      console.error("[Gallery] Error getting gallery:", error.message);
      res.status(500).json({ error: "Failed to get gallery" });
    }
  });

  // Update gallery settings
  app.patch("/api/galleries/:id", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [updated] = await db
        .update(galleries)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(galleries.id, req.params.id))
        .returning();

      if (!updated) return res.status(404).json({ error: "Gallery not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("[Gallery] Error updating gallery:", error.message);
      res.status(500).json({ error: "Failed to update gallery" });
    }
  });

  // Publish / unpublish gallery
  app.patch("/api/galleries/:id/publish", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { publish } = req.body; // true or false

      const [updated] = await db
        .update(galleries)
        .set({
          status: publish ? GalleryStatus.PUBLISHED : GalleryStatus.HIDDEN,
          publishedAt: publish ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(galleries.id, req.params.id))
        .returning();

      if (!updated) return res.status(404).json({ error: "Gallery not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("[Gallery] Error publishing gallery:", error.message);
      res.status(500).json({ error: "Failed to publish gallery" });
    }
  });

  // Delete gallery
  app.delete("/api/galleries/:id", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canDeleteGallery(user.role)) {
        return res.status(403).json({ error: "Only Admin, Evans, Retoucher, or Wrangler can delete galleries" });
      }

      const [deleted] = await db
        .delete(galleries)
        .where(eq(galleries.id, req.params.id))
        .returning();

      if (!deleted) return res.status(404).json({ error: "Gallery not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Gallery] Error deleting gallery:", error.message);
      res.status(500).json({ error: "Failed to delete gallery" });
    }
  });

  // Get share info (link + PIN)
  app.get("/api/galleries/:id/share", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [gallery] = await db
        .select()
        .from(galleries)
        .where(eq(galleries.id, req.params.id));

      if (!gallery) return res.status(404).json({ error: "Gallery not found" });

      res.json({
        galleryUrl: `/g/${gallery.slug}`,
        password: gallery.password,
        downloadPin: gallery.downloadPin,
        status: gallery.status,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get share info" });
    }
  });

  // ==========================================
  // ADMIN ROUTES — Sets
  // ==========================================

  // Create set
  app.post("/api/galleries/:id/sets", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Set name is required" });

      // Get next sort order
      const [maxOrder] = await db
        .select({ max: sql<number>`coalesce(max(sort_order), -1)::int` })
        .from(gallerySets)
        .where(eq(gallerySets.galleryId, req.params.id));

      const [set] = await db
        .insert(gallerySets)
        .values({
          galleryId: req.params.id,
          name,
          sortOrder: (maxOrder?.max || 0) + 1,
        })
        .returning();

      res.json(set);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create set" });
    }
  });

  // Update set
  app.patch("/api/galleries/:id/sets/:setId", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [updated] = await db
        .update(gallerySets)
        .set(req.body)
        .where(eq(gallerySets.id, req.params.setId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update set" });
    }
  });

  // Delete set
  app.delete("/api/galleries/:id/sets/:setId", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canDeleteGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.delete(gallerySets).where(eq(gallerySets.id, req.params.setId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete set" });
    }
  });

  // ==========================================
  // ADMIN ROUTES — Photos
  // ==========================================

  // Get upload URL (uses existing ObjectStorageService)
  app.post("/api/galleries/:id/photos/upload-url", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { count = 1 } = req.body;
      const urls: { uploadUrl: string; storageKey: string }[] = [];

      for (let i = 0; i < Math.min(count, 50); i++) {
        const uploadUrl = await objectStorage.getObjectEntityUploadURL();
        // Extract the storage key from the signed URL path
        const url = new URL(uploadUrl);
        const storageKey = objectStorage.normalizeObjectEntityPath(uploadUrl);
        urls.push({ uploadUrl, storageKey });
      }

      res.json({ urls });
    } catch (error: any) {
      console.error("[Gallery] Error generating upload URLs:", error.message);
      res.status(500).json({ error: "Failed to generate upload URLs" });
    }
  });

  // Register uploaded photo (called after client-side upload completes)
  app.post("/api/galleries/:id/photos", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { setId, filename, storageKey, width, height, fileSize } = req.body;

      if (!setId || !filename || !storageKey) {
        return res.status(400).json({ error: "Missing required fields: setId, filename, storageKey" });
      }

      // Get next sort order
      const [maxOrder] = await db
        .select({ max: sql<number>`coalesce(max(sort_order), -1)::int` })
        .from(galleryPhotos)
        .where(eq(galleryPhotos.setId, setId));

      const [photo] = await db
        .insert(galleryPhotos)
        .values({
          setId,
          galleryId: req.params.id,
          filename,
          storageKey,
          width: width || null,
          height: height || null,
          fileSize: fileSize || null,
          sortOrder: (maxOrder?.max || 0) + 1,
        })
        .returning();

      res.json(photo);
    } catch (error: any) {
      console.error("[Gallery] Error registering photo:", error.message);
      res.status(500).json({ error: "Failed to register photo" });
    }
  });

  // Batch register photos (for multi-upload)
  app.post("/api/galleries/:id/photos/batch", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { photos } = req.body; // Array of { setId, filename, storageKey, width?, height?, fileSize? }
      if (!photos || !Array.isArray(photos) || photos.length === 0) {
        return res.status(400).json({ error: "No photos provided" });
      }

      const inserted = await db
        .insert(galleryPhotos)
        .values(
          photos.map((p: any, i: number) => ({
            setId: p.setId,
            galleryId: req.params.id,
            filename: p.filename,
            storageKey: p.storageKey,
            width: p.width || null,
            height: p.height || null,
            fileSize: p.fileSize || null,
            sortOrder: i,
          }))
        )
        .returning();

      res.json(inserted);
    } catch (error: any) {
      console.error("[Gallery] Error batch registering photos:", error.message);
      res.status(500).json({ error: "Failed to register photos" });
    }
  });

  // Get all photos in a gallery (admin view)
  app.get("/api/galleries/:id/photos", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !hasGalleryAccess(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const photos = await db
        .select()
        .from(galleryPhotos)
        .where(eq(galleryPhotos.galleryId, req.params.id))
        .orderBy(asc(galleryPhotos.sortOrder));

      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get photos" });
    }
  });

  // Delete photo
  app.delete("/api/galleries/:id/photos/:photoId", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageGallery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // TODO: Also delete from object storage
      await db.delete(galleryPhotos).where(eq(galleryPhotos.id, req.params.photoId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete photo" });
    }
  });

  // ==========================================
  // ADMIN ROUTES — Favourite Activity
  // ==========================================

  // Get all favourite activity for a gallery
  app.get("/api/galleries/:id/activity/favorites", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !hasGalleryAccess(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const favLists = await db
        .select()
        .from(galleryFavLists)
        .where(eq(galleryFavLists.galleryId, req.params.id))
        .orderBy(desc(galleryFavLists.updatedAt));

      // Get selection count for each list
      const enriched = await Promise.all(
        favLists.map(async (list) => {
          const [count] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(gallerySelections)
            .where(eq(gallerySelections.favListId, list.id));
          return { ...list, selectionCount: count?.count || 0 };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get favourite activity" });
    }
  });

  // Get specific favourite list with filenames (the key view for matching in Capture One)
  app.get("/api/galleries/:id/activity/favorites/:listId", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !hasGalleryAccess(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [favList] = await db
        .select()
        .from(galleryFavLists)
        .where(eq(galleryFavLists.id, req.params.listId));

      if (!favList) return res.status(404).json({ error: "List not found" });

      // Get selections with photo details (filenames!)
      const selections = await db
        .select({
          selectionId: gallerySelections.id,
          note: gallerySelections.note,
          selectedAt: gallerySelections.createdAt,
          photoId: galleryPhotos.id,
          filename: galleryPhotos.filename,
          storageKey: galleryPhotos.storageKey,
          setId: galleryPhotos.setId,
        })
        .from(gallerySelections)
        .innerJoin(galleryPhotos, eq(gallerySelections.photoId, galleryPhotos.id))
        .where(eq(gallerySelections.favListId, req.params.listId))
        .orderBy(asc(galleryPhotos.filename));

      // Get set names for context
      const setIds = [...new Set(selections.map((s) => s.setId))];
      let setNames: Record<string, string> = {};
      if (setIds.length > 0) {
        const sets = await db
          .select({ id: gallerySets.id, name: gallerySets.name })
          .from(gallerySets)
          .where(inArray(gallerySets.id, setIds));
        setNames = Object.fromEntries(sets.map((s) => [s.id, s.name]));
      }

      res.json({
        ...favList,
        selectionCount: selections.length,
        selections: selections.map((s) => ({
          ...s,
          setName: setNames[s.setId] || "Unknown",
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get favourite list details" });
    }
  });

  // Export favourite list as CSV (filenames for Capture One)
  app.get("/api/galleries/:id/activity/favorites/:listId/export", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !hasGalleryAccess(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const selections = await db
        .select({
          filename: galleryPhotos.filename,
          setName: gallerySets.name,
          selectedAt: gallerySelections.createdAt,
          note: gallerySelections.note,
        })
        .from(gallerySelections)
        .innerJoin(galleryPhotos, eq(gallerySelections.photoId, galleryPhotos.id))
        .innerJoin(gallerySets, eq(galleryPhotos.setId, gallerySets.id))
        .where(eq(gallerySelections.favListId, req.params.listId))
        .orderBy(asc(galleryPhotos.filename));

      const csv = [
        "Filename,Set,Selected At,Note",
        ...selections.map(
          (s) =>
            `"${s.filename}","${s.setName}","${s.selectedAt?.toISOString() || ""}","${(s.note || "").replace(/"/g, '""')}"`
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="selections-${req.params.listId}.csv"`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to export" });
    }
  });

  // Get download activity
  app.get("/api/galleries/:id/activity/downloads", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !hasGalleryAccess(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const downloads = await db
        .select()
        .from(galleryDownloads)
        .where(eq(galleryDownloads.galleryId, req.params.id))
        .orderBy(desc(galleryDownloads.createdAt));

      res.json(downloads);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get download activity" });
    }
  });

  // ==========================================
  // CLIENT ROUTES — Public gallery access
  // ==========================================

  // Get gallery info by slug (for the cover page / password gate)
  app.get("/api/g/:slug", async (req: Request, res: Response) => {
    try {
      const [gallery] = await db
        .select()
        .from(galleries)
        .where(eq(galleries.slug, req.params.slug));

      if (!gallery || gallery.status === GalleryStatus.DRAFT) {
        return res.status(404).json({ error: "Gallery not found" });
      }

      if (gallery.status === GalleryStatus.EXPIRED) {
        return res.status(410).json({ error: "This gallery has expired" });
      }

      // Check if expired by date
      if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date()) {
        return res.status(410).json({ error: "This gallery has expired" });
      }

      // Return minimal info (don't expose photos before auth)
      res.json({
        id: gallery.id,
        name: gallery.name,
        slug: gallery.slug,
        hasPassword: !!gallery.password,
        coverImageKey: gallery.coverImageKey,
        settings: gallery.settings,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load gallery" });
    }
  });

  // Authenticate with gallery password
  app.post("/api/g/:slug/auth", async (req: Request, res: Response) => {
    try {
      const { password } = req.body;

      const [gallery] = await db
        .select()
        .from(galleries)
        .where(eq(galleries.slug, req.params.slug));

      if (!gallery || gallery.status !== GalleryStatus.PUBLISHED) {
        return res.status(404).json({ error: "Gallery not found" });
      }

      // If no password set, grant access directly
      if (!gallery.password) {
        const token = randomUUID();
        await db.insert(galleryAuthTokens).values({
          galleryId: gallery.id,
          clientEmail: "anonymous",
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
        return res.json({ success: true, token, galleryId: gallery.id });
      }

      // Verify password
      if (password !== gallery.password) {
        return res.status(401).json({ error: "Incorrect password" });
      }

      const token = randomUUID();
      await db.insert(galleryAuthTokens).values({
        galleryId: gallery.id,
        clientEmail: "authenticated",
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      res.json({ success: true, token, galleryId: gallery.id });
    } catch (error: any) {
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Middleware to verify gallery auth token
  async function verifyGalleryToken(req: Request, res: Response, next: Function) {
    const token = req.headers["x-gallery-token"] as string;
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const [authToken] = await db
      .select()
      .from(galleryAuthTokens)
      .where(eq(galleryAuthTokens.token, token));

    if (!authToken || new Date(authToken.expiresAt) < new Date()) {
      return res.status(401).json({ error: "Token expired or invalid" });
    }

    // Attach gallery info to request
    (req as any).galleryId = authToken.galleryId;
    (req as any).clientEmail = authToken.clientEmail;
    next();
  }

  // Get all photos in a gallery (client view — requires auth token)
  app.get("/api/g/:slug/photos", verifyGalleryToken as any, async (req: Request, res: Response) => {
    try {
      const galleryId = (req as any).galleryId;

      const sets = await db
        .select()
        .from(gallerySets)
        .where(eq(gallerySets.galleryId, galleryId))
        .orderBy(asc(gallerySets.sortOrder));

      const photos = await db
        .select()
        .from(galleryPhotos)
        .where(eq(galleryPhotos.galleryId, galleryId))
        .orderBy(asc(galleryPhotos.sortOrder));

      // Get gallery settings for filename display
      const [gallery] = await db
        .select({ settings: galleries.settings })
        .from(galleries)
        .where(eq(galleries.id, galleryId));

      res.json({ sets, photos, settings: gallery?.settings });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load photos" });
    }
  });

  // Sign in to favourites (email-based, like Pixieset)
  app.post("/api/g/:slug/favorites/signin", verifyGalleryToken as any, async (req: Request, res: Response) => {
    try {
      const galleryId = (req as any).galleryId;
      const { email } = req.body;

      if (!email) return res.status(400).json({ error: "Email is required" });

      // Check if client already has a fav list
      let [favList] = await db
        .select()
        .from(galleryFavLists)
        .where(and(
          eq(galleryFavLists.galleryId, galleryId),
          eq(galleryFavLists.clientEmail, email)
        ));

      // Create if not exists
      if (!favList) {
        [favList] = await db
          .insert(galleryFavLists)
          .values({
            galleryId,
            clientEmail: email,
            name: "My Favorites",
          })
          .returning();
      }

      // Update the auth token with the email
      const token = req.headers["x-gallery-token"] as string;
      await db
        .update(galleryAuthTokens)
        .set({ clientEmail: email })
        .where(eq(galleryAuthTokens.token, token));

      res.json({ favList });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to sign in" });
    }
  });

  // Get client's favourite lists
  app.get("/api/g/:slug/favorites", verifyGalleryToken as any, async (req: Request, res: Response) => {
    try {
      const galleryId = (req as any).galleryId;
      const clientEmail = (req as any).clientEmail;

      if (!clientEmail || clientEmail === "anonymous" || clientEmail === "authenticated") {
        return res.json({ lists: [], signedIn: false });
      }

      const lists = await db
        .select()
        .from(galleryFavLists)
        .where(and(
          eq(galleryFavLists.galleryId, galleryId),
          eq(galleryFavLists.clientEmail, clientEmail)
        ));

      // Get selections for each list
      const enriched = await Promise.all(
        lists.map(async (list) => {
          const selections = await db
            .select({ photoId: gallerySelections.photoId })
            .from(gallerySelections)
            .where(eq(gallerySelections.favListId, list.id));
          return {
            ...list,
            selectedPhotoIds: selections.map((s) => s.photoId),
            selectionCount: selections.length,
          };
        })
      );

      res.json({ lists: enriched, signedIn: true, email: clientEmail });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get favorites" });
    }
  });

  // Toggle photo favourite (add or remove)
  app.post("/api/g/:slug/favorites/:listId/toggle", verifyGalleryToken as any, async (req: Request, res: Response) => {
    try {
      const { photoId } = req.body;
      if (!photoId) return res.status(400).json({ error: "photoId required" });

      // Check if already favourited
      const [existing] = await db
        .select()
        .from(gallerySelections)
        .where(and(
          eq(gallerySelections.favListId, req.params.listId),
          eq(gallerySelections.photoId, photoId)
        ));

      if (existing) {
        // Remove
        await db.delete(gallerySelections).where(eq(gallerySelections.id, existing.id));

        // Update the fav list timestamp
        await db
          .update(galleryFavLists)
          .set({ updatedAt: new Date() })
          .where(eq(galleryFavLists.id, req.params.listId));

        return res.json({ action: "removed", photoId });
      }

      // Check selection limit
      const [favList] = await db
        .select()
        .from(galleryFavLists)
        .where(eq(galleryFavLists.id, req.params.listId));

      if (favList?.selectionLimit) {
        const [count] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(gallerySelections)
          .where(eq(gallerySelections.favListId, req.params.listId));

        if ((count?.count || 0) >= favList.selectionLimit) {
          return res.status(400).json({
            error: `Selection limit reached (${favList.selectionLimit} photos)`,
          });
        }
      }

      // Add
      const [selection] = await db
        .insert(gallerySelections)
        .values({ favListId: req.params.listId, photoId })
        .returning();

      // Update the fav list timestamp
      await db
        .update(galleryFavLists)
        .set({ updatedAt: new Date() })
        .where(eq(galleryFavLists.id, req.params.listId));

      res.json({ action: "added", photoId, selection });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to toggle favourite" });
    }
  });

  // Add note to a favourited photo
  app.post("/api/g/:slug/favorites/:listId/note", verifyGalleryToken as any, async (req: Request, res: Response) => {
    try {
      const { photoId, note } = req.body;

      const [updated] = await db
        .update(gallerySelections)
        .set({ note })
        .where(and(
          eq(gallerySelections.favListId, req.params.listId),
          eq(gallerySelections.photoId, photoId)
        ))
        .returning();

      if (!updated) return res.status(404).json({ error: "Selection not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add note" });
    }
  });

  // Submit selections to photographer ("Send to Photographer")
  app.post("/api/g/:slug/favorites/:listId/submit", verifyGalleryToken as any, async (req: Request, res: Response) => {
    try {
      const clientEmail = (req as any).clientEmail;
      const { message } = req.body;

      // Mark list as submitted
      const [favList] = await db
        .update(galleryFavLists)
        .set({
          isSubmitted: true,
          submittedAt: new Date(),
          submittedMessage: message || "I am done picking my favorites!",
          updatedAt: new Date(),
        })
        .where(eq(galleryFavLists.id, req.params.listId))
        .returning();

      if (!favList) return res.status(404).json({ error: "List not found" });

      // Get selection count
      const [count] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(gallerySelections)
        .where(eq(gallerySelections.favListId, req.params.listId));

      // Get gallery info for notification
      const [gallery] = await db
        .select()
        .from(galleries)
        .where(eq(galleries.id, favList.galleryId));

      // Broadcast real-time notification to team via SSE
      broadcastSSE({
        type: "gallery_selection_submitted",
        payload: {
          galleryId: favList.galleryId,
          galleryName: gallery?.name || "Unknown",
          clientEmail,
          listName: favList.name,
          selectionCount: count?.count || 0,
          message: favList.submittedMessage,
          submittedAt: favList.submittedAt,
        },
      });

      // TODO: Send email notification via emailService

      res.json({
        success: true,
        message: "Selections submitted to photographer",
        selectionCount: count?.count || 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to submit selections" });
    }
  });

  // Verify download PIN
  app.post("/api/g/:slug/download/verify-pin", verifyGalleryToken as any, async (req: Request, res: Response) => {
    try {
      const galleryId = (req as any).galleryId;
      const { pin, email } = req.body;

      const [gallery] = await db
        .select()
        .from(galleries)
        .where(eq(galleries.id, galleryId));

      if (!gallery) return res.status(404).json({ error: "Gallery not found" });

      // Check if downloads are enabled
      const settings = gallery.settings as any;
      if (!settings?.downloadEnabled) {
        return res.status(403).json({ error: "Downloads are not enabled for this gallery" });
      }

      // If no PIN required, grant access
      if (!gallery.downloadPin) {
        return res.json({ success: true });
      }

      if (pin !== gallery.downloadPin) {
        return res.status(401).json({ error: "Incorrect PIN" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to verify PIN" });
    }
  });

  // Serve gallery image (proxied through server for access control)
  app.get("/api/g/:slug/image/:photoId", verifyGalleryToken as any, async (req: Request, res: Response) => {
    try {
      const [photo] = await db
        .select()
        .from(galleryPhotos)
        .where(eq(galleryPhotos.id, req.params.photoId));

      if (!photo) return res.status(404).json({ error: "Photo not found" });

      // Serve from object storage
      const file = await objectStorage.getObjectEntityFile(photo.storageKey);
      await objectStorage.downloadObject(file, res, 86400); // 24hr cache
    } catch (error: any) {
      console.error("[Gallery] Error serving image:", error.message);
      res.status(500).json({ error: "Failed to serve image" });
    }
  });

  console.log("✅ Gallery routes registered");
}