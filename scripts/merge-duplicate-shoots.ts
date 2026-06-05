import { pool } from "../server/db";
import { storage } from "../server/storage";

// Idempotent cleanup: collapse duplicate project rows that describe the SAME
// real-world shoot (same client name, same shoot day) into one survivor, moving
// any inspos onto the survivor first. Safe to run on every merge/deploy — it
// only ever removes a duplicate that has NO real work on it (no package, no
// completed photos, unassigned, not delivered). The survivor always keeps the
// richest record.
//
// Why per-day grouping: one shoot can be entered manually AND synced from the
// calendar, producing two rows. We never want to lose the photographer's inspos
// in the merge — mergeProjects() moves them before deleting the duplicate.

type Row = {
  id: string;
  client_name: string;
  shoot_date: Date | null;
  due_date: Date | null;
  calendar_event_id: string | null;
  package_count: number;
  photos_completed: number;
  assigned_to: string | null;
  status: string;
  is_inspo_placeholder: boolean;
  inspo_count: number;
};

function dayKey(d: Date | null): string {
  if (!d) return "none";
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${dt.getUTCMonth()}-${dt.getUTCDate()}`;
}

// A duplicate is only removable if nothing real has happened on it. Inspos are
// NOT a blocker — they get moved to the survivor before deletion.
function isSafeToRemove(r: Row): boolean {
  return (
    r.package_count === 0 &&
    r.photos_completed === 0 &&
    r.assigned_to === null &&
    r.status !== "Delivered"
  );
}

async function main() {
  const { rows } = await pool.query<Row>(`
    SELECT p.id, p.client_name, p.shoot_date, p.due_date, p.calendar_event_id,
           p.package_count, p.photos_completed, p.assigned_to, p.status,
           p.is_inspo_placeholder,
           (SELECT COUNT(*)::int FROM project_inspos i WHERE i.project_id = p.id) AS inspo_count
    FROM projects p
    WHERE p.is_inspo_placeholder = false
  `);

  // Group by client name (case-insensitive) + shoot day.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const dateForKey = r.shoot_date || r.due_date;
    const key = `${r.client_name.trim().toLowerCase()}|${dayKey(dateForKey)}`;
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }

  let mergedCount = 0;
  let movedInspos = 0;

  for (const [key, members] of Array.from(groups.entries())) {
    if (members.length < 2) continue;
    if (key.endsWith("|none")) continue; // never collapse undated rows

    // Choose the survivor: prefer a calendar-linked anchor, then most inspos,
    // then the earliest-created (lowest id is unreliable, so use most inspos
    // then first with real work, then first in list).
    const survivor =
      members.find((m) => m.calendar_event_id) ||
      [...members].sort((a, b) => b.inspo_count - a.inspo_count)[0];

    for (const dup of members) {
      if (dup.id === survivor.id) continue;
      if (!isSafeToRemove(dup)) {
        console.log(`[merge-duplicate-shoots] skip ${dup.id} (${dup.client_name}) — has real work`);
        continue;
      }
      // Never collapse two rows that are linked to DIFFERENT calendar events —
      // those are genuinely separate shoots, not duplicates.
      if (
        dup.calendar_event_id &&
        survivor.calendar_event_id &&
        dup.calendar_event_id !== survivor.calendar_event_id
      ) {
        console.log(`[merge-duplicate-shoots] skip ${dup.id} (${dup.client_name}) — different calendar event`);
        continue;
      }
      // Don't delete a calendar-linked row in favour of a non-linked one.
      if (dup.calendar_event_id && !survivor.calendar_event_id) continue;

      const { moved } = await storage.mergeProjects(dup.id, survivor.id, "merge-duplicate-shoots");
      mergedCount += 1;
      movedInspos += moved;
      console.log(`[merge-duplicate-shoots] merged ${dup.id} → ${survivor.id} (${dup.client_name}, ${moved} inspos moved)`);
    }
  }

  console.log(`[merge-duplicate-shoots] done — removed ${mergedCount} duplicate(s), moved ${movedInspos} inspo(s)`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[merge-duplicate-shoots] failed:", err);
    pool.end().finally(() => process.exit(1));
  });
