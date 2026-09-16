import { eq, isNull, or, and } from "drizzle-orm";
import { db } from "../db";
import { deliveryPhotos } from "@shared/schema";
import type { DeliveryPhoto } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
import { downloadFileBuffer } from "./googleDriveService";
import { renderPreview, renderThumb } from "../lib/imagePreview";

export {
  PREVIEW_EDGE,
  PREVIEW_QUALITY,
  THUMB_EDGE,
  THUMB_QUALITY,
  renderPreview,
  renderThumb,
} from "../lib/imagePreview";

/**
 * Preview orchestration: fetch the original from Drive, render both
 * derivatives, cache them, and record where they went.
 *
 * The rendering itself lives in ../lib/imagePreview.ts.
 */

/** An original larger than this is refused rather than allowed to exhaust memory. */
const MAX_SOURCE_BYTES = 200 * 1024 * 1024;

const objectStorage = new ObjectStorageService();

/**
 * Builds both derivatives for one photograph and caches them.
 *
 * The original is fetched once and used for both, because downloading a 25 MB
 * file twice to make two sizes of it would be silly.
 */
export async function buildDerivatives(photo: DeliveryPhoto): Promise<{ thumbKey: string; previewKey: string }> {
  const source = await downloadFileBuffer(photo.driveFileId, MAX_SOURCE_BYTES);

  const [thumb, preview] = await Promise.all([renderThumb(source), renderPreview(source)]);

  const [thumbKey, previewKey] = await Promise.all([
    objectStorage.uploadPrivateBuffer(thumb.buffer, thumb.contentType),
    objectStorage.uploadPrivateBuffer(preview.buffer, preview.contentType),
  ]);

  await db
    .update(deliveryPhotos)
    .set({ thumbKey, previewKey })
    .where(eq(deliveryPhotos.id, photo.id));

  return { thumbKey, previewKey };
}

/**
 * Builds every missing derivative in a gallery.
 *
 * Bounded concurrency, because each unit of work is "download tens of
 * megabytes from Drive, then decode and resample it". Running four hundred of
 * those at once would exhaust both memory and Drive's patience; running them
 * one at a time would take all afternoon.
 */
const CONCURRENCY = Number(process.env.DELIVERY_PREVIEW_CONCURRENCY || 3);

const running = new Map<string, { total: number; done: number; failed: number }>();

export function previewProgress(galleryId: string) {
  return running.get(galleryId) || null;
}

export async function buildGalleryPreviews(galleryId: string): Promise<{ total: number; done: number; failed: number }> {
  if (running.has(galleryId)) return running.get(galleryId)!;

  const pending = await db
    .select()
    .from(deliveryPhotos)
    .where(
      and(
        eq(deliveryPhotos.galleryId, galleryId),
        or(isNull(deliveryPhotos.previewKey), isNull(deliveryPhotos.thumbKey))
      )
    );

  const progress = { total: pending.length, done: 0, failed: 0 };
  running.set(galleryId, progress);

  try {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length || 1) }, async () => {
      for (;;) {
        const index = cursor++;
        if (index >= pending.length) return;
        try {
          await buildDerivatives(pending[index]);
          progress.done += 1;
        } catch (error) {
          progress.failed += 1;
          // One unreadable file must not stop the other three hundred.
          console.error(`[Preview] ${pending[index].filename} failed:`, error);
        }
      }
    });
    await Promise.all(workers);
  } finally {
    // Keep the final tally visible briefly so a poller sees the result.
    setTimeout(() => running.delete(galleryId), 60_000);
  }

  return progress;
}
