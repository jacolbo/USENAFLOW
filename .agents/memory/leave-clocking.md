---
name: Leave is clocking-only
description: Leave requests are logged (no approval); clocked leave is stored as status 'approved' for consumer compatibility.
---

# Leave Management is clocking-only

Leave requests are NOT approved/denied. Submitting leave simply logs that the person
will be away. There is no AI evaluation and no admin approve/deny/override path.

Clocked leave is stored with `status: "approved"`.

**Why:** Capacity/forecast consumers filter leave by `status === "approved"`
(workload forecast and AI team-chat "who is on leave"). Storing clocked leave as
`approved` keeps those consumers counting the person as away without touching every
call site.

**How to apply:** If you ever introduce a distinct status (e.g. `logged`) for leave,
you must update ALL consumers that filter on `status === "approved"` in lockstep, or
on-leave/capacity calculations will silently drop the new records. The
`aiDecision`/`aiReason`/`reviewedBy`/`reviewedAt` columns on `leave_requests` are now
legacy/unused.
