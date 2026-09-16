import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { deliveryGalleries, projects, GalleryPermissions } from "@shared/schema";
import type { DeliveryPhoto } from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { downloadFileBuffer, getThumbnailBuffer } from "./services/googleDriveService";
import { ZipWriter, safeEntryName, uniqueName } from "./lib/zip";
import {
  attachGalleryLink,
  deliveryUrl,
  ensureDeliveryGallery,
  getGalleryByProject,
  getGalleryByToken,
  getPhoto,
  isApprovedForDownload,
  listPhotos,
  recordView,
  setPreviewKey,
  syncGallery,
} from "./services/deliveryGalleryService";

/**
 * Client photo delivery.
 *
 * The client opens our gallery, not Drive's. Everything is served through this
 * server, which is not incidental: a Drive link that works in a browser works
 * for anyone who holds it, so handing one to the page would make the approval
 * gate decorative. No Drive URL and no Drive file id is ever sent to a browser.
 *
 * Two paths, with deliberately different costs:
 *
 *   browsing   cached preview from object storage. Drive is not called.
 *   download   the original, fetched from Drive, only once the studio has
 *              approved delivery on the project.
 */

const objectStorage = new ObjectStorageService();

/** One original, buffered to compute its zip CRC, so it needs a ceiling. */
const MAX_FILE_BYTES = 200 * 1024 * 1024;

/** Preview edge. These are finished retouched photographs; people zoom. */
const PREVIEW_EDGE = 2048;

function canManageDelivery(role: string): boolean {
  return ([...GalleryPermissions.FULL, ...GalleryPermissions.MANAGE] as readonly string[]).includes(role);
}

function getUserFromRequest(req: Request): { userId: string; role: string } | null {
  const userId = req.headers["x-usena-user-id"] as string;
  const role = (req.headers["x-usena-user-role"] || req.headers["x-usena-role"]) as string;
  if (!userId || !role) return null;
  return { userId, role };
}

/**
 * What the browser is allowed to know about a photograph.
 *
 * Note what is absent: driveFileId. The client addresses photos by our id and
 * nothing else, so there is no Drive identifier in the page for anyone to lift.
 */
function publicPhoto(photo: DeliveryPhoto, token: string) {
  return {
    id: photo.id,
    filename: photo.filename,
    previewUrl: `/api/d/${token}/preview/${photo.id}`,
  };
}

export function registerDeliveryRoutes(app: Express) {
  // ---- studio side ------------------------------------------------------

  /**
   * Builds the gallery for a project and points project.galleryLink at it.
   *
   * This is the whole integration. The existing approval flow then emails that
   * link exactly as it always has — it simply no longer leads to Drive.
   */
  app.post("/api/projects/:id/delivery-gallery", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageDelivery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const url = await attachGalleryLink(req.params.id, user.userId);
      const gallery = await getGalleryByProject(req.params.id);
      res.json({ url, gallery });
    } catch (error: any) {
      console.error("[Delivery]", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to build the gallery" });
    }
  });

  /** Re-reads the Drive folder: new photos appear, deleted ones stop being delivered. */
  app.post("/api/projects/:id/delivery-gallery/sync", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user || !canManageDelivery(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const gallery = await ensureDeliveryGallery(req.params.id);
      const result = await syncGallery(gallery.id);
      res.json(result);
    } catch (error: any) {
      console.error("[Delivery]", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to sync" });
    }
  });

  app.get("/api/projects/:id/delivery-gallery", async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) return res.status(403).json({ error: "Access denied" });

      const gallery = await getGalleryByProject(req.params.id);
      if (!gallery) return res.json({ gallery: null });

      res.json({
        gallery,
        url: deliveryUrl(gallery.token),
        approved: await isApprovedForDownload(req.params.id),
      });
    } catch (error: any) {
      console.error("[Delivery]", error);
      res.status(500).json({ error: "Failed to read delivery status" });
    }
  });

  // ---- client side ------------------------------------------------------
  //
  // The token in the URL is the credential. There is no sign-in: a client
  // should not need an account to look at photographs they paid for.

  app.get("/api/d/:token", async (req: Request, res: Response) => {
    try {
      const gallery = await getGalleryByToken(req.params.token);
      if (!gallery) return res.status(404).json({ error: "Gallery not found" });

      const [project] = await db
        .select({
          clientName: projects.clientName,
          approved: projects.deliveryApproved,
        })
        .from(projects)
        .where(eq(projects.id, gallery.projectId));

      const photos = await listPhotos(gallery.id);
      void recordView(gallery.id, gallery.viewCount);

      res.json({
        title: gallery.title,
        clientName: project?.clientName || "",
        photoCount: photos.length,
        // Drives the button's state in the page. It is a courtesy, not the
        // gate — the download routes check the project again for themselves.
        canDownload: Boolean(project?.approved),
        coverPhotoId: gallery.coverPhotoId,
        photos: photos.map((p) => publicPhoto(p, req.params.token)),
      });
    } catch (error: any) {
      console.error("[Delivery]", error);
      res.status(500).json({ error: "Failed to open the gallery" });
    }
  });

  /**
   * A preview, proxied.
   *
   * Google already renders thumbnails for everything in Drive, which spares us
   * a server-side image library. The first request for a photo caches the
   * result in object storage; every later request — and every other client
   * looking at the same gallery — is served from there without touching Drive.
   */
  app.get("/api/d/:token/preview/:photoId", async (req: Request, res: Response) => {
    try {
      const gallery = await getGalleryByToken(req.params.token);
      if (!gallery) return res.status(404).json({ error: "Not found" });

      const photo = await getPhoto(gallery.id, req.params.photoId);
      if (!photo) return res.status(404).json({ error: "Not found" });

      if (photo.previewKey) {
        try {
          const cached = await objectStorage.getObjectEntityFile(photo.previewKey);
          return await objectStorage.downloadObject(cached, res, 86400);
        } catch {
          // The cache entry has gone; fall through and rebuild it rather than
          // showing the client a broken photograph.
        }
      }

      const thumb = await getThumbnailBuffer(photo.driveFileId, PREVIEW_EDGE);
      if (!thumb) {
        return res.status(404).json({ error: "No preview available for this file" });
      }

      // Cache for next time, but never fail the request over a cache write:
      // the client is waiting for a photograph, not for our bookkeeping.
      objectStorage
        .uploadPrivateBuffer(thumb.buffer, thumb.contentType)
        .then((key) => setPreviewKey(photo.id, key))
        .catch((err) => console.error("[Delivery] preview cache failed", err));

      res.setHeader("Content-Type", thumb.contentType);
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(thumb.buffer);
    } catch (error: any) {
      console.error("[Delivery]", error);
      res.status(500).json({ error: "Failed to load the preview" });
    }
  });

  /** One full-resolution original. Approval is checked here, not trusted from the page. */
  app.get("/api/d/:token/download/:photoId", async (req: Request, res: Response) => {
    try {
      const gallery = await getGalleryByToken(req.params.token);
      if (!gallery) return res.status(404).json({ error: "Not found" });

      if (!(await isApprovedForDownload(gallery.projectId))) {
        return res.status(403).json({ error: "These photos have not been released yet." });
      }

      const photo = await getPhoto(gallery.id, req.params.photoId);
      if (!photo) return res.status(404).json({ error: "Not found" });

      const body = await downloadFileBuffer(photo.driveFileId, MAX_FILE_BYTES);
      res.setHeader("Content-Type", photo.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeEntryName(photo.filename, `${photo.id}.jpg`)}"`
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(body);
    } catch (error: any) {
      console.error("[Delivery]", error);
      res.status(error.status || 500).json({ error: error.message || "Failed to download" });
    }
  });

  /** The whole gallery as one archive. */
  app.get("/api/d/:token/download.zip", async (req: Request, res: Response) => {
    try {
      const gallery = await getGalleryByToken(req.params.token);
      if (!gallery) return res.status(404).json({ error: "Not found" });

      if (!(await isApprovedForDownload(gallery.projectId))) {
        return res.status(403).json({ error: "These photos have not been released yet." });
      }

      const photos = await listPhotos(gallery.id);
      if (!photos.length) return res.status(404).json({ error: "This gallery is empty" });

      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeEntryName(gallery.title, "gallery")}.zip"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });

      const zip = new ZipWriter(res);
      const taken = new Set<string>();
      for (const photo of photos) {
        const fallback = `${photo.id}.jpg`;
        const name = uniqueName(safeEntryName(photo.filename, fallback), taken);
        const body = await downloadFileBuffer(photo.driveFileId, MAX_FILE_BYTES);
        await zip.addBuffer(body, name, photo.createdAt);
      }
      await zip.finish();
    } catch (error: any) {
      console.error("[Delivery]", error);
      // Past the header there is no honest way to report this but to break the
      // connection: a client must see a failed download, never a tidy zip that
      // is quietly missing photographs.
      if (res.headersSent) return res.destroy();
      res.status(error.status || 500).json({ error: error.message || "Failed to build the archive" });
    }
  });
}
