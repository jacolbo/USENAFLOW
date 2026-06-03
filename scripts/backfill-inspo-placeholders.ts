import { pool } from "../server/db";

// Idempotent backfill: hide legacy auto-created calendar projects that only ever
// existed so inspos could be attached before deliberate ShootTracker promotion.
// Safe to run on every merge/deploy — it only flips rows that still look like
// untouched, never-promoted placeholders and are not already flagged.
async function main() {
  const result = await pool.query(`
    UPDATE projects p
    SET is_inspo_placeholder = true
    WHERE p.created_from = 'CALENDAR'
      AND p.package_count = 0
      AND p.selected_count = 0
      AND p.photos_completed = 0
      AND p.assigned_to IS NULL
      AND p.status = 'Ready for Retouching'
      AND p.is_inspo_placeholder = false
      AND NOT EXISTS (SELECT 1 FROM shoottracker_meta m WHERE m.project_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM calendar_events_staging s
        WHERE s.promoted_project_id = p.id AND s.status = 'promoted'
      )
    RETURNING id;
  `);
  console.log(`[backfill-inspo-placeholders] hid ${result.rowCount ?? 0} legacy placeholder project(s)`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-inspo-placeholders] failed:", err);
    pool.end().finally(() => process.exit(1));
  });
