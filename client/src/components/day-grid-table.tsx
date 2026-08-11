/**
 * Day Grid Table — compact table version of the Retoucher Workspace day grid.
 * Shown on the dashboard (below the daily quote) for all retouchers.
 * Rows = upcoming working days; shows the retoucher's planned shoots + photo load per day.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import type { Project } from "@shared/schema";

const HARD_DEADLINE = new Date("2026-12-19");
const DAYS_TO_SHOW = 10;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}
function nextNWorkingDays(from: Date, n: number): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  while (days.length < n && cur <= HARD_DEADLINE) {
    if (isWorkingDay(cur)) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

interface DayGridTableProps {
  userId: string;
  userName: string;
  userRole: string;
}

export function DayGridTable({ userId, userName, userRole }: DayGridTableProps) {
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/campaign/projects"],
    queryFn: async () => {
      const res = await fetch("/api/campaign/projects", {
        headers: { "x-usena-role": userRole, "x-usena-user-id": userId },
      });
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
  });

  const todayIso = isoDate(new Date());
  const days = nextNWorkingDays(new Date(), DAYS_TO_SHOW);

  // Mine = assigned to me by id, or by name (legacy assignments use names)
  const mine = projects.filter((p: any) => {
    const rid = (p.assignedRetoucherId || "").toLowerCase();
    const at = (p.assignedTo || "").toLowerCase();
    return (
      p.status !== "Delivered" &&
      (rid === userId.toLowerCase() || at === userName.toLowerCase() || at === userId.toLowerCase())
    );
  });

  const byDay = new Map<string, Project[]>();
  for (const p of mine) {
    if (!p.plannedWorkDate) continue;
    const key = isoDate(new Date(p.plannedWorkDate));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(p);
  }

  if (mine.length === 0) return null;

  return (
    <Card data-testid="day-grid-table">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          My Day Grid
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-1.5 pr-2 font-medium">Day</th>
              <th className="py-1.5 pr-2 font-medium">Shoots</th>
              <th className="py-1.5 text-right font-medium">Photos</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const key = isoDate(d);
              const dayProjects = byDay.get(key) || [];
              const photos = dayProjects.reduce((s, p: any) => s + (p.selectedCount || 0), 0);
              const isToday = key === todayIso;
              return (
                <tr key={key} className={`border-b last:border-0 ${isToday ? "bg-emerald-50" : ""}`}>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {dayLabel(d)}
                    {isToday && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">Today</Badge>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    {dayProjects.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      dayProjects.map((p: any) => p.clientName.split(" ")[0]).join(", ")
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {photos > 0 ? `${photos} photos` : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
