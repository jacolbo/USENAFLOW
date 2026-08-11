/**
 * My Day Grid — dashboard version of the Noël Retoucher Workspace day grid.
 * Shown on the dashboard (below the daily quote) for all retouchers.
 * Same visuals & behavior: horizontal day columns, photo-load headers,
 * today/deadline highlights, weekend/holiday off-day columns, drag-to-move
 * with the deadline-risk warning.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays,
  GripVertical,
  Camera,
  Hammer,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from "lucide-react";
import type { Project } from "@shared/schema";

const HARD_DEADLINE = new Date("2026-12-19");
const DAILY_PHOTO_TARGET = 30;
const WORKING_DAYS_TO_SHOW = 14;

const STATUS_COLORS: Record<string, string> = {
  ReadyForRetouching: "bg-teal-100 text-teal-800 border-teal-300",
  InProgress: "bg-purple-100 text-purple-800 border-purple-300",
  InQA: "bg-amber-100 text-amber-800 border-amber-300",
  Delivered: "bg-green-100 text-green-800 border-green-300",
  AwaitingPayment: "bg-red-100 text-red-800 border-red-300",
};

function isoDate(d: Date): string {
  // Local calendar date (not UTC) — avoids off-by-one-day bugs in UTC+2
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// SA public holidays during the campaign window (fixed list)
const PUBLIC_HOLIDAYS: Record<string, string> = {
  "2026-09-24": "Heritage Day",
  "2026-12-16": "Day of Reconciliation",
};
function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !PUBLIC_HOLIDAYS[isoDate(date)];
}
function offDayLabel(date: Date): string | null {
  const holiday = PUBLIC_HOLIDAYS[isoDate(date)];
  if (holiday) return holiday;
  const day = date.getDay();
  if (day === 0 || day === 6) return "Weekend";
  return null;
}
// All calendar days (including weekends/holidays) covering the next n working days
function nextNDaysWithOffDays(from: Date, workingDayCount: number): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  let working = 0;
  while (working < workingDayCount && cur <= HARD_DEADLINE) {
    days.push(new Date(cur));
    if (isWorkingDay(cur)) working++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

interface MovePreview {
  breaksDeadline: boolean;
  slipCalendarDays: number;
}

interface DayGridTableProps {
  userId: string;
  userName: string;
  userRole: string;
}

export function DayGridTable({ userId, userName, userRole }: DayGridTableProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ projectId: string; clientName: string; targetDate: string; preview: MovePreview } | null>(null);

  const headers = { "x-usena-role": userRole, "x-usena-user-id": userId };

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/campaign/projects", userId],
    queryFn: async () => {
      const res = await fetch("/api/campaign/projects", { headers });
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: string }) => {
      const res = await fetch(`/api/campaign/projects/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ newDate }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/campaign/projects"] });
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      setPendingMove(null);
      if (data.breaksDeadline) {
        toast({ title: "Work date moved — deadline risk", description: "The new work date is after the promised delivery date.", variant: "destructive" });
      } else {
        toast({ title: "Work date updated" });
      }
    },
    onError: (e: any) => toast({ title: "Move failed", description: e.message, variant: "destructive" }),
  });

  const todayIso = isoDate(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = nextNDaysWithOffDays(today, WORKING_DAYS_TO_SHOW);

  // Mine = assigned to me by id, or by name (legacy assignments use names)
  const mine = projects.filter((p: any) => {
    const rid = (p.assignedRetoucherId || "").toLowerCase();
    const at = (p.assignedTo || "").toLowerCase();
    return (
      p.status !== "Delivered" &&
      (rid === userId.toLowerCase() || at === userName.toLowerCase() || at === userId.toLowerCase())
    );
  });

  const handleDrop = async (e: React.DragEvent, targetDateIso: string) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain") || dragProjectId;
    setDragOverDay(null);
    setDragProjectId(null);
    if (!pid) return;
    const project = mine.find((p) => p.id === pid);
    if (!project) return;
    if (project.plannedWorkDate && isoDate(new Date(project.plannedWorkDate)) === targetDateIso) return;
    // Pre-save ripple preview — warn if the move breaks the client promise
    try {
      const res = await fetch(`/api/campaign/projects/${pid}/move/preview?newDate=${targetDateIso}`, { headers });
      if (res.ok) {
        const preview: MovePreview = await res.json();
        if (preview.breaksDeadline) {
          setPendingMove({ projectId: pid, clientName: project.clientName, targetDate: targetDateIso, preview });
          return;
        }
      }
    } catch {
      // preview is best-effort; fall through to direct move
    }
    moveMutation.mutate({ id: pid, newDate: targetDateIso });
  };

  // Pull a project forward to today (same preview-then-move flow as a drop)
  const pullForward = async (project: Project) => {
    const targetDateIso = todayIso;
    if (project.plannedWorkDate && isoDate(new Date(project.plannedWorkDate)) === targetDateIso) return;
    try {
      const res = await fetch(`/api/campaign/projects/${project.id}/move/preview?newDate=${targetDateIso}`, { headers });
      if (res.ok) {
        const preview: MovePreview = await res.json();
        if (preview.breaksDeadline) {
          setPendingMove({ projectId: project.id, clientName: project.clientName, targetDate: targetDateIso, preview });
          return;
        }
      }
    } catch {
      // preview is best-effort
    }
    moveMutation.mutate({ id: project.id, newDate: targetDateIso });
  };

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
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: `${days.length * 200}px` }}>
            {days.map((day) => {
              const dayIso = isoDate(day);
              const isDayOver = dragOverDay === dayIso;
              const isTodayCol = dayIso === todayIso;
              const isDeadline = dayIso === "2026-12-19";
              const offLabel = offDayLabel(day);
              const dayProjects = mine.filter(
                (p) =>
                  p.plannedWorkDate &&
                  isoDate(new Date(p.plannedWorkDate)) === dayIso
              );
              const dayPhotos = dayProjects.reduce(
                (s, p: any) => s + (p.selectedPhotoCount || p.selectedCount || 0),
                0
              );
              const overCapacity = dayPhotos > DAILY_PHOTO_TARGET;

              return (
                <div
                  key={dayIso}
                  className={`
                    flex-shrink-0 w-48 rounded-lg border-2 transition-colors
                    ${isTodayCol ? "border-blue-400 bg-blue-50/40 dark:bg-blue-950/20" : "border-border"}
                    ${isDeadline ? "border-red-400 bg-red-50/40 dark:bg-red-950/20" : ""}
                    ${offLabel && !isTodayCol && !isDeadline ? "border-dashed bg-muted/40 opacity-80" : ""}
                    ${isDayOver ? "border-primary bg-primary/5" : ""}
                  `}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverDay(dayIso);
                  }}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(e) => handleDrop(e, dayIso)}
                >
                  {/* Day column header */}
                  <div className={`p-2 rounded-t-lg border-b ${isTodayCol ? "bg-blue-100 dark:bg-blue-900/40" : isDeadline ? "bg-red-100 dark:bg-red-900/40" : offLabel ? "bg-muted/60" : "bg-muted/30"}`}>
                    <p className="text-xs font-semibold">
                      {day.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                      {offLabel && <span className="ml-1 font-normal text-muted-foreground">· {offLabel}</span>}
                    </p>
                    <p className={`text-[10px] ${overCapacity ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                      {dayPhotos}/{DAILY_PHOTO_TARGET} photos
                      {overCapacity && " ⚠️"}
                      {isTodayCol && " · Today"}
                      {isDeadline && " · DEADLINE"}
                    </p>
                  </div>

                  {/* Drop zone */}
                  <div className="p-2 space-y-2 min-h-[200px]">
                    {isDayOver && (
                      <div className="border-2 border-dashed border-primary rounded-lg p-2 text-center text-xs text-primary">
                        Drop here
                      </div>
                    )}
                    {dayProjects.length === 0 && !isDayOver && (
                      <p className="text-xs text-muted-foreground text-center py-4 opacity-50">
                        {offLabel ? "Off day — drag here to work it" : "Drag here"}
                      </p>
                    )}
                    {dayProjects.map((project) => (
                      <DayGridCard
                        key={project.id}
                        project={project}
                        isToday={isTodayCol}
                        onDragStart={(e) => {
                          setDragProjectId(project.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", project.id);
                        }}
                        onPullForward={
                          !isTodayCol ? () => pullForward(project) : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>

      {/* Deadline-risk warning dialog (same as the workspace day grid) */}
      <Dialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              This move breaks a client promise
            </DialogTitle>
            <DialogDescription>
              {pendingMove && (
                <>Moving <strong>{pendingMove.clientName}</strong> to {pendingMove.targetDate} puts the work date after the delivery date promised to the client
                {pendingMove.preview.slipCalendarDays > 0 && <> (about {pendingMove.preview.slipCalendarDays} day{pendingMove.preview.slipCalendarDays === 1 ? "" : "s"} late)</>}. Are you sure?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={moveMutation.isPending}
              onClick={() => pendingMove && moveMutation.mutate({ id: pendingMove.projectId, newDate: pendingMove.targetDate })}
            >
              Move anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─────────────────────── Project Card (same look as the workspace) ──────────

function DayGridCard({ project, isToday, onDragStart, onPullForward }: { project: Project; isToday: boolean; onDragStart: (e: React.DragEvent) => void; onPullForward?: () => void }) {
  const dueDate = project.promisedDeliveryDate || project.deliveryDueDate;
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
    : "—";
  const workDate = project.plannedWorkDate;
  const workDateStr = workDate
    ? new Date(workDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
    : "—";
  const statusKey = (project.status || "").replace(/\s/g, "");
  const statusClass = STATUS_COLORS[statusKey] || "bg-gray-100 text-gray-700";
  const photoCount = (project as any).selectedPhotoCount || project.selectedCount || 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = dueDate && new Date(dueDate) < today && project.status !== "Delivered";

  const workDays = dueDate
    ? (() => {
        let count = 0;
        const cur = new Date(today);
        cur.setDate(cur.getDate() + 1);
        const target = new Date(dueDate);
        while (cur <= target) {
          if (isWorkingDay(cur)) count++;
          cur.setDate(cur.getDate() + 1);
        }
        return count;
      })()
    : 99;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`
        bg-card border rounded-lg p-2.5 text-sm select-none
        cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow
        ${isOverdue ? "border-red-300 bg-red-50 dark:bg-red-950/20" : ""}
        ${isToday ? "ring-1 ring-blue-400" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate">{project.clientName}</span>
        </div>
        <Badge variant="outline" className={`text-[10px] border flex-shrink-0 ${statusClass}`}>
          {(project.status || "").replace(/([A-Z])/g, " $1").trim()}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1 mt-1.5">
        {photoCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Camera className="h-3 w-3" />{photoCount}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex gap-3 text-[10px] text-muted-foreground">
        {workDate && (
          <span className="flex items-center gap-0.5 text-purple-600">
            <Hammer className="h-3 w-3" />{workDateStr}
          </span>
        )}
        <span className={`flex items-center gap-0.5 ${isOverdue ? "text-red-600 font-bold" : workDays <= 5 ? "text-amber-600" : ""}`}>
          <Clock className="h-3 w-3" />
          {dueDateStr}
          {workDays <= 5 && workDays > 0 && <span className="ml-0.5">({workDays}wd)</span>}
          {isOverdue && <AlertTriangle className="h-3 w-3 ml-0.5" />}
        </span>
        {project.status === "Delivered" && <CheckCircle2 className="h-3 w-3 text-green-600" />}
      </div>

      {/* Pull-forward action (same as the workspace day grid) */}
      {onPullForward && project.status !== "Delivered" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-5 text-[10px] px-1 mt-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={(e) => {
            e.stopPropagation();
            onPullForward();
          }}
        >
          <Zap className="h-3 w-3 mr-0.5" />
          Pull to Today
        </Button>
      )}
    </div>
  );
}
