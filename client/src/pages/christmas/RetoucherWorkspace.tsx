/**
 * Noël Set 2026 — Retoucher Workspace
 *
 * Features:
 *  - Today Queue: projects planned for today (personal)
 *  - Day Grid: working days as draggable columns, retouchers move projects between days
 *    - Pre-save ripple preview via GET /move/preview (shows deadline-break warning)
 *    - Pull-forward action (move project to today)
 *  - Personal pace metrics (photos done today vs daily target)
 *  - Team Lanes: admin/lead reassignment board (drag between retouchers)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  TreeDeciduous,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Hammer,
  GripVertical,
  ArrowLeft,
  CalendarDays,
  LayoutGrid,
  Zap,
} from "lucide-react";
import type { Project } from "@shared/schema";

// ─────────────────────── Helpers ────────────────────────

function getRole(): string {
  return localStorage.getItem("userRole") || "Retoucher1";
}
function getUserId(): string {
  return localStorage.getItem("userId") || "retoucher1";
}

async function workspaceFetch(method: string, url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-usena-role": getRole(),
      "x-usena-user-id": getUserId(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

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

// ─────────────────────── Constants ────────────────────────

const HARD_DEADLINE = new Date("2026-12-19");
const DAILY_PHOTO_TARGET = 30;

const STATUS_COLORS: Record<string, string> = {
  ReadyForRetouching: "bg-teal-100 text-teal-800 border-teal-300",
  InProgress: "bg-purple-100 text-purple-800 border-purple-300",
  InQA: "bg-amber-100 text-amber-800 border-amber-300",
  Delivered: "bg-green-100 text-green-800 border-green-300",
  AwaitingPayment: "bg-red-100 text-red-800 border-red-300",
};

const EDIT_PROFILE_COLORS: Record<string, string> = {
  light: "bg-sky-100 text-sky-700 border-sky-300",
  standard: "bg-indigo-100 text-indigo-700 border-indigo-300",
  complex: "bg-rose-100 text-rose-700 border-rose-300",
};

const ALL_RETOUCHERS = [
  { id: "Retoucher1", name: "Retoucher 1" },
  { id: "Retoucher2", name: "Retoucher 2" },
  { id: "Retoucher3", name: "Retoucher 3" },
];

const UNASSIGNED_LANE = "__unassigned__";

// ─────────────────────── Ripple Preview ─────────────────

interface MovePreview {
  projectId: string;
  currentWorkDate: string | null;
  proposedWorkDate: string;
  promisedDeliveryDate: string | null;
  breaksDeadline: boolean;
  slipCalendarDays: number;
  pullForwardAvailable: boolean;
  requiresClientNotification: boolean;
}

// ─────────────────────── Component ────────────────────────

export default function RetoucherWorkspace() {
  const myId = getUserId();
  const myRole = getRole();
  const isAdminLead = ["Admin", "LeadRetoucher", "DataWrangler"].includes(myRole);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"daygrid" | "lanes">(isAdminLead ? "lanes" : "daygrid");
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<string | null>(null);

  // Day-move warning dialog state
  const [pendingMove, setPendingMove] = useState<{ projectId: string; targetDate: string; preview: MovePreview } | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/campaign/projects"],
    queryFn: async () => {
      const res = await fetch("/api/campaign/projects", {
        headers: { "x-usena-role": getRole(), "x-usena-user-id": getUserId() },
      });
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, retoucherId }: { id: string; retoucherId: string }) => {
      const r = ALL_RETOUCHERS.find((x) => x.id === retoucherId);
      return workspaceFetch("PATCH", `/api/campaign/projects/${id}/assign`, {
        retoucherId,
        retoucherName: r?.name || retoucherId,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/campaign/projects"] });
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      toast({ title: `Project reassigned to ${vars.retoucherId}` });
    },
    onError: (e: any) => toast({ title: "Reassign failed", description: e.message, variant: "destructive" }),
  });

  const moveDayMutation = useMutation({
    mutationFn: ({ id, newDate }: { id: string; newDate: string }) =>
      workspaceFetch("PATCH", `/api/campaign/projects/${id}/move`, { newDate }),
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

  // ── Day-grid drag handlers (move between days) ──
  const handleDayDragStart = (e: React.DragEvent, projectId: string) => {
    setDragProjectId(projectId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", projectId);
  };

  const handleDayDragOver = (e: React.DragEvent, dayIso: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDay(dayIso);
  };

  const handleDayDrop = async (e: React.DragEvent, targetDateIso: string) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain") || dragProjectId;
    setDragOverDay(null);
    setDragProjectId(null);
    if (!pid) return;
    const project = projects.find((p) => p.id === pid);
    if (!project) return;
    // Don't move if already on this day
    if (project.plannedWorkDate && isoDate(new Date(project.plannedWorkDate)) === targetDateIso) return;
    // Pre-save ripple preview
    try {
      const preview: MovePreview = await workspaceFetch(
        "GET",
        `/api/campaign/projects/${pid}/move/preview?newDate=${targetDateIso}`
      );
      if (preview.breaksDeadline) {
        setPendingMove({ projectId: pid, targetDate: targetDateIso, preview });
      } else {
        moveDayMutation.mutate({ id: pid, newDate: targetDateIso });
      }
    } catch {
      moveDayMutation.mutate({ id: pid, newDate: targetDateIso });
    }
  };

  const handlePullForward = async (project: Project) => {
    const today = isoDate(new Date());
    try {
      const preview: MovePreview = await workspaceFetch(
        "GET",
        `/api/campaign/projects/${project.id}/move/preview?newDate=${today}`
      );
      if (preview.breaksDeadline) {
        setPendingMove({ projectId: project.id, targetDate: today, preview });
      } else {
        moveDayMutation.mutate({ id: project.id, newDate: today });
      }
    } catch {
      moveDayMutation.mutate({ id: project.id, newDate: today });
    }
  };

  // ── Lane drag handlers (reassign between retouchers) ──
  const handleLaneDragStart = (e: React.DragEvent, projectId: string) => {
    if (!isAdminLead) return;
    setDragProjectId(projectId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", projectId);
  };

  const handleLaneDragOver = (e: React.DragEvent, laneId: string) => {
    if (!isAdminLead) return;
    e.preventDefault();
    setDragOverLane(laneId);
  };

  const handleLaneDrop = (e: React.DragEvent, targetRetoucherId: string) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain") || dragProjectId;
    setDragOverLane(null);
    setDragProjectId(null);
    if (!pid || targetRetoucherId === UNASSIGNED_LANE) return;
    const project = projects.find((p) => p.id === pid);
    if (!project) return;
    if ((project.assignedRetoucherId || project.assignedTo) === targetRetoucherId) return;
    assignMutation.mutate({ id: pid, retoucherId: targetRetoucherId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <TreeDeciduous className="h-6 w-6 animate-pulse text-green-600" />
          <span>Loading Retoucher Workspace…</span>
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = isoDate(today);

  const myProjects = isAdminLead ? projects : projects.filter(
    (p) => p.assignedRetoucherId === myId || p.assignedTo === myId
  );

  // Today queue — projects planned for today
  const todayQueue = myProjects.filter(
    (p) =>
      p.status !== "Delivered" &&
      p.plannedWorkDate &&
      isoDate(new Date(p.plannedWorkDate)) === todayIso
  );

  // Personal pace metrics
  const photosDeliveredToday = myProjects
    .filter(
      (p) =>
        p.status === "Delivered" &&
        p.deliveredAt &&
        isoDate(new Date(p.deliveredAt)) === todayIso
    )
    .reduce((s, p) => s + (p.selectedPhotoCount || p.selectedCount || 0), 0);
  const todayTargetPhotos = todayQueue.reduce(
    (s, p) => s + (p.selectedPhotoCount || p.selectedCount || 0),
    0
  );
  const pacePercent = todayTargetPhotos > 0
    ? Math.min(100, Math.round((photosDeliveredToday / todayTargetPhotos) * 100))
    : photosDeliveredToday > 0 ? 100 : 0;

  const totalPhotos = myProjects.reduce((s, p) => s + (p.selectedPhotoCount || p.selectedCount || 0), 0);
  const completedProjects = myProjects.filter((p) => p.status === "Delivered").length;
  const workingDaysLeft = nextNWorkingDays(today, 99).filter((d) => d > today).length;

  const unassigned = myProjects.filter((p) => !p.assignedRetoucherId && !p.assignedTo);
  const retoucherLanes = isAdminLead
    ? ALL_RETOUCHERS.map((r) => ({
        ...r,
        projects: myProjects.filter((p) => p.assignedRetoucherId === r.id || p.assignedTo === r.id),
      }))
    : [{ id: myId, name: "My Projects", projects: myProjects }];

  const workingDays = nextNWorkingDays(today, 14);

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Deadline-break warning dialog */}
      <AlertDialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Work date breaks promised deadline
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Moving this project to <strong>{pendingMove?.targetDate}</strong> puts the work date{" "}
                <strong>{Math.abs(pendingMove?.preview.slipCalendarDays || 0)} days after</strong> the promised delivery date.
              </p>
              <p className="text-amber-700 font-medium">
                The client may not receive their photos on time. Consider asking Admin to reschedule or pull-forward instead.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                if (pendingMove) {
                  moveDayMutation.mutate({ id: pendingMove.projectId, newDate: pendingMove.targetDate });
                }
              }}
            >
              Move Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <TreeDeciduous className="h-8 w-8 text-green-600" />
        <div>
          <h1 className="text-2xl font-bold">Noël Set 2026 — Retoucher Workspace</h1>
          <p className="text-sm text-muted-foreground">
            {workingDaysLeft} working days to deadline · {completedProjects}/{myProjects.length} projects delivered
          </p>
        </div>
      </div>

      {/* Personal pace metrics */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Today Queue</p>
              <p className="text-xl font-bold">{todayQueue.length} projects</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Today Progress</p>
              <div className="flex items-center gap-2">
                <Progress value={pacePercent} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {photosDeliveredToday}/{todayTargetPhotos} photos
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Photos</p>
              <p className="text-xl font-bold">{totalPhotos}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Working Days Left</p>
              <p className={`text-xl font-bold ${workingDaysLeft < 10 ? "text-red-600" : workingDaysLeft < 20 ? "text-amber-600" : ""}`}>
                {workingDaysLeft}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today Queue */}
      {todayQueue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-blue-700">
            <Zap className="h-4 w-4" />
            Today's Queue — {todayQueue.length} projects · {todayTargetPhotos} photos
          </h2>
          <div className="flex flex-wrap gap-3">
            {todayQueue.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                draggable
                onDragStart={(e) => handleDayDragStart(e, p.id)}
                onPullForward={undefined}
                isToday
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={tab === "daygrid" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("daygrid")}
        >
          <CalendarDays className="h-4 w-4 mr-1" />
          Day Grid
        </Button>
        {isAdminLead && (
          <Button
            variant={tab === "lanes" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("lanes")}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Team Lanes
          </Button>
        )}
      </div>

      {/* Day Grid tab — horizontal scrollable day columns */}
      {tab === "daygrid" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: `${workingDays.length * 200}px` }}>
            {workingDays.map((day) => {
              const dayIso = isoDate(day);
              const isDayOver = dragOverDay === dayIso;
              const isTodayCol = dayIso === todayIso;
              const isDeadline = dayIso === "2026-12-19";
              const dayProjects = myProjects.filter(
                (p) =>
                  p.status !== "Delivered" &&
                  p.plannedWorkDate &&
                  isoDate(new Date(p.plannedWorkDate)) === dayIso
              );
              const dayPhotos = dayProjects.reduce(
                (s, p) => s + (p.selectedPhotoCount || p.selectedCount || 0),
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
                    ${isDayOver ? "border-primary bg-primary/5" : ""}
                  `}
                  onDragOver={(e) => handleDayDragOver(e, dayIso)}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(e) => handleDayDrop(e, dayIso)}
                >
                  {/* Day column header */}
                  <div className={`p-2 rounded-t-lg border-b ${isTodayCol ? "bg-blue-100 dark:bg-blue-900/40" : isDeadline ? "bg-red-100 dark:bg-red-900/40" : "bg-muted/30"}`}>
                    <p className="text-xs font-semibold">
                      {day.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
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
                        Drag here
                      </p>
                    )}
                    {dayProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        draggable
                        onDragStart={(e) => handleDayDragStart(e, project.id)}
                        onPullForward={
                          !isTodayCol && project.plannedWorkDate && isoDate(new Date(project.plannedWorkDate)) !== todayIso
                            ? () => handlePullForward(project)
                            : undefined
                        }
                        isToday={isTodayCol}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Lanes tab (admin/lead) — reassignment swim lanes */}
      {tab === "lanes" && (
        <div>
          {isAdminLead && unassigned.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <User className="h-4 w-4" /> Unassigned ({unassigned.length})
              </h2>
              <div className="flex flex-wrap gap-3">
                {unassigned.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    draggable={false}
                    onDragStart={() => {}}
                    onPullForward={undefined}
                    isToday={false}
                  />
                ))}
              </div>
            </div>
          )}

          <div className={`grid gap-4 ${isAdminLead ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"}`}>
            {retoucherLanes.map((lane) => {
              const laneProjects = [...lane.projects].sort((a, b) => {
                const da = a.plannedWorkDate || a.promisedDeliveryDate || a.deliveryDueDate;
                const db_ = b.plannedWorkDate || b.promisedDeliveryDate || b.deliveryDueDate;
                if (!da) return 1;
                if (!db_) return -1;
                return new Date(da).getTime() - new Date(db_).getTime();
              });

              const lanePhotos = laneProjects.reduce((s, p) => s + (p.selectedPhotoCount || p.selectedCount || 0), 0);
              const laneDelivered = laneProjects.filter((p) => p.status === "Delivered").length;
              const isDragOver = dragOverLane === lane.id;

              return (
                <div
                  key={lane.id}
                  className={`rounded-lg border-2 transition-colors ${isDragOver ? "border-primary bg-primary/5" : "border-border"}`}
                  onDragOver={(e) => handleLaneDragOver(e, lane.id)}
                  onDrop={(e) => handleLaneDrop(e, lane.id)}
                  onDragLeave={() => setDragOverLane(null)}
                >
                  <div className="p-3 border-b bg-muted/30 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{lane.name}</span>
                        <Badge variant="secondary" className="text-xs">{laneProjects.length}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Camera className="h-3 w-3 inline mr-1" />
                        {lanePhotos} · {laneDelivered}/{laneProjects.length} done
                      </div>
                    </div>
                    <LaneWorkDayStrip projects={laneProjects} />
                  </div>

                  <div className="p-3 space-y-2 min-h-[120px]">
                    {isDragOver && (
                      <div className="border-2 border-dashed border-primary rounded-lg p-3 text-center text-sm text-primary">
                        Drop here to assign to {lane.name}
                      </div>
                    )}
                    {laneProjects.length === 0 && !isDragOver && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {isAdminLead ? "Drag projects here to assign" : "No projects assigned"}
                      </p>
                    )}
                    {laneProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        draggable={isAdminLead}
                        onDragStart={(e) => handleLaneDragStart(e, project.id)}
                        onPullForward={undefined}
                        isToday={
                          !!project.plannedWorkDate &&
                          isoDate(new Date(project.plannedWorkDate)) === isoDate(today)
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────── Lane Work-Day Strip ────────────────────

function LaneWorkDayStrip({ projects }: { projects: Project[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const strip = nextNWorkingDays(today, 14).filter((d) => d <= HARD_DEADLINE);

  return (
    <div className="flex gap-0.5 mt-2 flex-wrap">
      {strip.map((day) => {
        const dayIso = isoDate(day);
        const isToday = dayIso === isoDate(today);
        const isDeadline = dayIso === "2026-12-19";
        const hasWork = projects.some(
          (p) =>
            (p.plannedWorkDate && isoDate(new Date(p.plannedWorkDate)) === dayIso) ||
            (p.promisedDeliveryDate && isoDate(new Date(p.promisedDeliveryDate)) === dayIso)
        );
        return (
          <div
            key={dayIso}
            title={`${day.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}${hasWork ? " — work scheduled" : ""}`}
            className={`
              w-5 h-5 rounded text-[8px] flex items-center justify-center font-mono
              ${isToday ? "ring-1 ring-blue-500 bg-blue-100 text-blue-700" : ""}
              ${isDeadline ? "bg-red-200 text-red-700" : ""}
              ${hasWork && !isToday && !isDeadline ? "bg-purple-200 text-purple-700" : ""}
              ${!hasWork && !isToday && !isDeadline ? "bg-muted text-muted-foreground" : ""}
            `}
          >
            {day.getDate()}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────── Project Card ──────────────────────────

interface ProjectCardProps {
  project: Project;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onPullForward: (() => void) | undefined;
  isToday: boolean;
}

function ProjectCard({ project, draggable, onDragStart, onPullForward, isToday }: ProjectCardProps) {
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
  const profileClass =
    EDIT_PROFILE_COLORS[project.editProfile || ""] || "bg-gray-100 text-gray-700 border-gray-300";
  const photoCount = project.selectedPhotoCount || project.selectedCount || 0;

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
      draggable={draggable}
      onDragStart={onDragStart}
      className={`
        bg-card border rounded-lg p-2.5 text-sm select-none
        ${draggable ? "cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow" : ""}
        ${isOverdue ? "border-red-300 bg-red-50 dark:bg-red-950/20" : ""}
        ${isToday ? "ring-1 ring-blue-400" : ""}
        ${project.status === "Delivered" ? "opacity-60" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          {draggable && <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
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
        {project.editProfile && (
          <Badge variant="outline" className={`text-[10px] border px-1 py-0 ${profileClass}`}>
            {project.editProfile}
          </Badge>
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

      {/* Pull-forward action */}
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
          <ArrowLeft className="h-2.5 w-2.5 mr-0.5" />
          Pull to Today
        </Button>
      )}
    </div>
  );
}
