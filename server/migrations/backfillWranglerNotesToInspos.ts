import { db } from "../db";
import { projectInspos, projectWranglerNotes } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * One-shot backfill: copy every legacy project_wrangler_notes row into
 * project_inspos. Idempotent: skips rows whose (projectId, createdAt) pair
 * already exists in inspos. Does NOT delete the source table.
 */
export async function backfillWranglerNotesToInspos(): Promise<void> {
  try {
    const tableCheck = await db.execute(sql`SELECT to_regclass('public.project_wrangler_notes') as exists`);
    const exists = (tableCheck.rows?.[0] as any)?.exists;
    if (!exists) {
      console.log("[backfill] project_wrangler_notes table not present, skipping");
      return;
    }

    const wnRows = await db.select().from(projectWranglerNotes);
    if (wnRows.length === 0) {
      console.log("[backfill] no wrangler notes to migrate");
      return;
    }

    const existingInspos = await db.select({
      projectId: projectInspos.projectId,
      createdAt: projectInspos.createdAt,
    }).from(projectInspos);
    const existingKeys = new Set(
      existingInspos.map(i => `${i.projectId}|${i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt}`)
    );

    let copied = 0;
    let skipped = 0;
    for (const wn of wnRows) {
      const ts = wn.createdAt instanceof Date ? wn.createdAt.toISOString() : String(wn.createdAt);
      const key = `${wn.projectId}|${ts}`;
      if (existingKeys.has(key)) { skipped++; continue; }
      await db.insert(projectInspos).values({
        projectId: wn.projectId,
        kind: wn.kind,
        storageKey: wn.storageKey,
        caption: wn.caption,
        body: wn.body,
        sortOrder: wn.sortOrder,
        uploadedBy: wn.createdBy,
        createdAt: wn.createdAt,
      });
      copied++;
    }
    console.log(`[backfill] wrangler-notes -> inspos: copied=${copied} skipped=${skipped} total=${wnRows.length}`);
  } catch (err: any) {
    console.error("[backfill] failed:", err.message || err);
  }
}
