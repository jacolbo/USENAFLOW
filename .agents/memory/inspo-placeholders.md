---
name: Inspo placeholder projects
description: How shoots-awaiting-promotion are kept off boards via isInspoPlaceholder and the getAllProjects visibility convention.
---

# Inspo placeholder projects

When a user opens an unlinked Google Calendar event on the Today's Shoots page to
attach inspos, the server creates a `projects` row just so inspos/notes have
something to hang on. That row is flagged `isInspoPlaceholder = true` and must NOT
appear on any week board, dashboard, task table, analytics, drive overview, AI
risk/forecast, rewards, or rollover surface until it is formally promoted in
ShootTracker ("Add to Due Week").

## Visibility convention (the rule)
- `storage.getAllProjects()` **excludes** placeholders (filtered in both MemStorage
  and DbStorage). This is the default for essentially every consumer.
- `storage.getAllProjectsIncludingPlaceholders()` returns everything. Use it in
  **only two** places:
  - the Today's Shoots GET route (placeholders must show so inspos stay attachable
    and the calendar event reads as already linked), and
  - calendar-event de-duplication in calendarSync (so an event that already has a
    placeholder isn't created a second time — `calendarEventId` is UNIQUE and would
    otherwise throw).

**Why:** filtering at one central method instead of per-endpoint prevents the
"placeholder leaks onto a dashboard widget" class of regression — there are ~20
`getAllProjects()` callers and new ones get the correct behavior for free.

**How to apply:** if you add a surface that should hide unpromoted shoots, just call
`getAllProjects()`. If you genuinely need the placeholders, call the Including
variant and justify it.

## Promotion
The ShootTracker promote route reuses the project already linked to the calendar
event (the placeholder) and sets `isInspoPlaceholder: false`, so promotion makes it
visible. Staging-event inspos are migrated into the project transactionally on
promote; inspos already on the placeholder project are preserved. Note: there is no
content-level dedupe between project inspos and migrated staging inspos, so a user
who attaches the *same* inspo in both places could see two copies (rare edge case).

## One shoot = one project (dedup / merge)
A real-world shoot can end up as two `projects` rows (a manual entry plus a
calendar-synced one), so inspos can land on the "wrong" row. The reconciliation
rules:
- **Fallback matcher** `matchProjectForShoot(projects, clientName, shootDate, calendarEventId?, dayWindow=2)`
  matches by case-insensitive client name + shoot date within ±2 days. It MUST
  never return a project already linked to a *different* `calendarEventId` — that
  is a separate shoot.
- The staged-events listing surfaces a computed `linkedProjectId`
  (promotedProjectId → project-by-calendarEventId → matcher) so the inspos button
  always reads from the row that actually holds the inspos. The promote route uses
  the same matcher as a fallback and links `calendarEventId` onto the reused row.
- `storage.mergeProjects(source, target, mergedBy)` moves inspos (re-sortOrder) +
  carries overall instructions if target empty, then **deletes** source.
  **Why the explicit re-point step matters:** most project FKs cascade/set-null,
  but `referrals.referredProjectId` and `referralRewardClaims.projectId` have NO
  onDelete, so they MUST be re-pointed to the survivor inside the txn before delete
  or the delete throws. Re-check this list if new project FKs are added.
- **Merge safety gates (both the link-project route and the cleanup script):**
  never merge/delete a source that has real work (packageCount>0, photosCompleted>0,
  assignedTo set, or status Delivered), and never merge two rows with *different*
  non-null `calendarEventId`. The cleanup script `scripts/merge-duplicate-shoots.ts`
  (idempotent, runs in post-merge.sh) groups by client+shoot-day and only collapses
  rows that pass these gates.
