import { randomBytes } from "crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { deliveryGalleries, deliveryPhotos, projects } from "@shared/schema";
import type { DeliveryGallery, DeliveryPhoto } from "@shared/schema";
import { listFilesInFolder } from "./googleDriveService";

/**
 * Delivery galleries.
 *
 * A project's finished photographs live in Drive. This builds a client-facing
 * view onto that folder so the client opens our gallery instead of Drive's
 * interface — which is the entire point of the feature.
 *
 * What it deliberately does not do:
 *
 *   - copy the photographs anywhere. The originals stay in Drive. These rows
 *     are file ids and ordering, nothing more. Storage is not duplicated and a
 *     photo deleted in Drive stops being delivered, rather than leaving a
 *     stale copy going out as final.
 *
 *   - decide whether the client may download. That is `project.deliveryApproved`,
 *     which already exists and is already set by the approval flow. Delivery
 *     reads it; it never writes it.
 */

const IMAGE_PREFIX = "image/";

/** How many photographs one gallery will carry. Well past a wedding. */
const MAX_PHOTOS = 2000;

export function resolveBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://usena-flow.replit.app")
  );
}

export function deliveryUrl(token: string): string {
  return `${resolveBaseUrl()}/d/${token}`;
}

/**
 * The public address of a gallery.
 *
 * 32 bytes of randomness, base64url. This token is the only thing between a
 * stranger and a client's photographs, so it is never derived from the client's
 * name, the project id, or anything else guessable.
 */
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getGalleryByToken(token: string): Promise<DeliveryGallery | null> {
  if (!token || token.length < 20) return null;
  const [gallery] = await db
    .select()
    .from(deliveryGalleries)
    .where(eq(deliveryGalleries.token, token));
  return gallery || null;
}

export async function getGalleryByProject(projectId: string): Promise<DeliveryGallery | null> {
  const [gallery] = await db
    .select()
    .from(deliveryGalleries)
    .where(eq(deliveryGalleries.projectId, projectId));
  return gallery || null;
}

export async function listPhotos(galleryId: string): Promise<DeliveryPhoto[]> {
  return db
    .select()
    .from(deliveryPhotos)
    .where(eq(deliveryPhotos.galleryId, galleryId))
    .orderBy(asc(deliveryPhotos.sortOrder), asc(deliveryPhotos.filename));
}

export async function getPhoto(galleryId: string, photoId: string): Promise<DeliveryPhoto | null> {
  const [photo] = await db
    .select()
    .from(deliveryPhotos)
    .where(and(eq(deliveryPhotos.galleryId, galleryId), eq(deliveryPhotos.id, photoId)));
  return photo || null;
}

/**
 * Creates the gallery for a project, or returns the one that already exists.
 *
 * Idempotent on purpose: this is called from the delivery flow, and pressing
 * the button twice must not mint a second token and orphan the link that has
 * already gone out to a client.
 */
export async function ensureDeliveryGallery(projectId: string): Promise<DeliveryGallery> {
  const existing = await getGalleryByProject(projectId);
  if (existing) return existing;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) {
    throw Object.assign(new Error("Project not found"), { status: 404 });
  }
  if (!project.driveFolderId) {
    throw Object.assign(
      new Error("This project has no Drive folder yet, so there is nothing to deliver."),
      { status: 400 }
    );
  }

  const [gallery] = await db
    .insert(deliveryGalleries)
    .values({
      projectId,
      token: newToken(),
      title: project.clientName,
      // Snapshotted, not read live: if the project is later repointed at a
      // different Drive folder, a gallery already sent to a client must not
      // quietly start serving someone else's photographs.
      driveFolderId: project.driveFolderId,
    })
    .returning();

  await syncGallery(gallery.id);
  return (await getGalleryByProject(projectId))!;
}

/**
 * Reconciles the photo rows against what is actually in the Drive folder now.
 *
 * Additive and subtractive: new files appear, files removed from Drive stop
 * being delivered. Existing rows keep their ids so a cover photo chosen
 * earlier survives a re-sync.
 */
export async function syncGallery(galleryId: string): Promise<{ added: number; removed: number; total: number }> {
  const [gallery] = await db
    .select()
    .from(deliveryGalleries)
    .where(eq(deliveryGalleries.id, galleryId));
  if (!gallery) throw Object.assign(new Error("Gallery not found"), { status: 404 });

  const driveFiles = (await listFilesInFolder(gallery.driveFolderId))
    .filter((file) => file.mimeType.startsWith(IMAGE_PREFIX))
    // Exports are numbered, so name order is the order a photographer means.
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .slice(0, MAX_PHOTOS);

  const current = await listPhotos(galleryId);
  const currentByFileId = new Map(current.map((p) => [p.driveFileId, p]));
  const seen = new Set<string>();

  let added = 0;
  const toInsert: Array<typeof deliveryPhotos.$inferInsert> = [];

  driveFiles.forEach((file, index) => {
    seen.add(file.id);
    const existing = currentByFileId.get(file.id);
    if (existing) {
      // Only the ordering can drift; the bytes are Drive's problem.
      if (existing.sortOrder !== index) {
        void db
          .update(deliveryPhotos)
          .set({ sortOrder: index })
          .where(eq(deliveryPhotos.id, existing.id));
      }
      return;
    }
    added += 1;
    toInsert.push({
      galleryId,
      driveFileId: file.id,
      filename: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.size || 0,
      sortOrder: index,
    });
  });

  if (toInsert.length) {
    await db.insert(deliveryPhotos).values(toInsert);
  }

  const gone = current.filter((p) => !seen.has(p.driveFileId)).map((p) => p.id);
  if (gone.length) {
    await db.delete(deliveryPhotos).where(inArray(deliveryPhotos.id, gone));
  }

  const total = driveFiles.length;
  await db
    .update(deliveryGalleries)
    .set({ photoCount: total, lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(deliveryGalleries.id, galleryId));

  return { added, removed: gone.length, total };
}

/**
 * Points the project's client-facing link at this gallery.
 *
 * `project.galleryLink` is what the existing delivery email sends. Setting it
 * here is the whole integration: approval, the email itself, the referral and
 * the survey all carry on untouched — the client just lands somewhere better.
 */
export async function attachGalleryLink(projectId: string, actor: string): Promise<string> {
  const gallery = await ensureDeliveryGallery(projectId);
  const url = deliveryUrl(gallery.token);

  await db
    .update(projects)
    .set({
      galleryLink: url,
      galleryLinkAddedAt: new Date(),
      galleryLinkAddedBy: actor,
    })
    .where(eq(projects.id, projectId));

  return url;
}

/** Whether the studio has approved this project for delivery. */
export async function isApprovedForDownload(projectId: string): Promise<boolean> {
  const [project] = await db
    .select({ approved: projects.deliveryApproved })
    .from(projects)
    .where(eq(projects.id, projectId));
  return Boolean(project?.approved);
}

export async function recordView(galleryId: string, currentViews: number): Promise<void> {
  await db
    .update(deliveryGalleries)
    .set({ viewCount: currentViews + 1, lastViewedAt: new Date() })
    .where(eq(deliveryGalleries.id, galleryId));
}

export async function setPreviewKey(photoId: string, key: string): Promise<void> {
  await db
    .update(deliveryPhotos)
    .set({ previewKey: key })
    .where(eq(deliveryPhotos.id, photoId));
}
