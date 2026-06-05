import type { Project } from "@shared/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Find an existing project that represents the same real-world shoot as a
 * calendar / staged event, so callers can LINK to it instead of creating a
 * duplicate.
 *
 * Exact calendar-event-id matches should be resolved by the caller first (via
 * storage.getProjectByCalendarEventId). This helper is the fallback: same
 * client name (case-insensitive) AND shoot date within `dayWindow` days.
 *
 * Safety: a project that is already tied to a *different* calendar event belongs
 * to another shoot and is never matched here.
 */
export function matchProjectForShoot(
  projects: Project[],
  clientName: string,
  shootDate: Date | string | null | undefined,
  calendarEventId?: string | null,
  dayWindow = 2,
): Project | undefined {
  if (!shootDate) return undefined;
  const target = new Date(shootDate);
  if (isNaN(target.getTime())) return undefined;
  const name = (clientName || "").trim().toLowerCase();
  if (!name) return undefined;

  const candidates = projects.filter((p) => {
    // Never hijack a project already linked to a different shoot.
    if (p.calendarEventId) {
      if (!calendarEventId || p.calendarEventId !== calendarEventId) return false;
    }
    if (!p.shootDate) return false;
    if (p.clientName.trim().toLowerCase() !== name) return false;
    const diff = Math.abs(new Date(p.shootDate).getTime() - target.getTime());
    return diff <= dayWindow * DAY_MS;
  });

  // Deterministic pick: closest shoot date wins (then earliest created).
  candidates.sort((a, b) => {
    const da = Math.abs(new Date(a.shootDate!).getTime() - target.getTime());
    const db = Math.abs(new Date(b.shootDate!).getTime() - target.getTime());
    if (da !== db) return da - db;
    return new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime();
  });
  return candidates[0];
}
