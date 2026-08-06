import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TreeDeciduous,
  AlertTriangle,
  CheckCircle2,
  Mail,
  CalendarDays,
  Users,
  Camera,
  Clock,
  TrendingUp,
  Send,
  Edit3,
  RefreshCw,
  Settings2,
  Table2,
  Hammer,
  PackageCheck,
  LayoutGrid,
  GripVertical,
  FolderOpen,
  FolderX,
  ChevronDown,
  ChevronRight,
  Image,
  HardDrive,
  MessageCircle,
} from "lucide-react";
import type { Project, Campaign } from "@shared/schema";
import { CAMPAIGN_NOEL_KEYWORDS } from "@shared/schema";

// ─────────────────────── Auth helpers ────────────────────────

async function campaignFetch(method: string, url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-usena-role": localStorage.getItem("userRole") || "Admin",
      "x-usena-user-id": localStorage.getItem("userId") || "admin",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function getUserId(): string {
  return localStorage.getItem("userId") || "admin";
}

// ─────────────────────── Constants ────────────────────────

const HARD_DEADLINE = new Date("2026-12-19");

const STATUS_COLORS: Record<string, string> = {
  ReadyForRetouching: "bg-teal-100 text-teal-800 border-teal-300",
  InProgress: "bg-purple-100 text-purple-800 border-purple-300",
  InQA: "bg-amber-100 text-amber-800 border-amber-300",
  Delivered: "bg-green-100 text-green-800 border-green-300",
  AwaitingPayment: "bg-red-100 text-red-800 border-red-300",
};

const RETOUCHERS = [
  { id: "Retoucher1", name: "Retoucher 1" },
  { id: "Retoucher2", name: "Retoucher 2" },
  { id: "Retoucher3", name: "Retoucher 3" },
];

// ─────────────────────── Date utils ────────────────────────

function isWorkingDay(date: Date): boolean {
  const d = date.getDay();
  return d !== 0 && d !== 6;
}

function getWorkingDaysUntil(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  if (t <= today) return 0;
  let count = 0;
  const cur = new Date(today);
  cur.setDate(cur.getDate() + 1);
  while (cur <= t) {
    if (isWorkingDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function weekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday start
  return d.toISOString().slice(0, 10);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Local-timezone date key — avoids UTC midnight shift in non-UTC zones (e.g. Africa/Johannesburg)
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─────────────────────── Types ────────────────────────

interface PacingData {
  photosCompleted: number;
  photosRemaining: number;
  requiredDailyRate: number;
  forecastFinishDate: string | null;
  actualDailyRate: number;
  isOnTrack: boolean;
  warningMessage: string | null;
}

interface CampaignData {
  campaign: Campaign | null;
  projects: Project[];
  assignments: any[];
  pacing: PacingData | null;
  snapshots: any[];
}

// ─────────────────────── Component ────────────────────────

export default function CampaignCockpit() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [moveProjectId, setMoveProjectId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [assignProjectId, setAssignProjectId] = useState<string | null>(null);
  const [assignRetoucher, setAssignRetoucher] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState("spot-check");
  const [surveyDelayDays, setSurveyDelayDays] = useState(3);
  const [keywords, setKeywords] = useState<string[]>([...CAMPAIGN_NOEL_KEYWORDS]);
  const [newKeyword, setNewKeyword] = useState("");
  // Archive confirmation: { year, message }
  const [archiveConfirm, setArchiveConfirm] = useState<{ year: number } | null>(null);
  // Lane drag state
  const [laneDragProjectId, setLaneDragProjectId] = useState<string | null>(null);
  const [laneDragOverId, setLaneDragOverId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<CampaignData>({
    queryKey: ["/api/campaign"],
    queryFn: () => campaignFetch("GET", "/api/campaign"),
  });

  const countMutation = useMutation({
    mutationFn: ({ id, count }: { id: string; count: number }) =>
      campaignFetch("PATCH", `/api/campaign/projects/${id}/count`, { selectedPhotoCount: count }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      toast({ title: "Photo count saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, retoucherId }: { id: string; retoucherId: string }) => {
      const r = RETOUCHERS.find((x) => x.id === retoucherId);
      return campaignFetch("PATCH", `/api/campaign/projects/${id}/assign`, { retoucherId, retoucherName: r?.name || retoucherId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      setAssignProjectId(null);
      toast({ title: "Retoucher assigned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      campaignFetch("PATCH", `/api/campaign/projects/${id}/reschedule`, { newDate: date, changedBy: getUserId() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      setMoveProjectId(null);
      toast({ title: "Delivery date rescheduled", description: "Client will be notified and work dates rescheduled automatically." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const emailMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "estimate" | "ready" | "survey" }) =>
      campaignFetch("POST", `/api/campaign/projects/${id}/email/${type}`, {}),
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = { estimate: "Email 1 (Estimate)", ready: "Email 2 (Photos Ready)", survey: "Email 3 (Survey)" };
      toast({ title: `${labels[vars.type]} sent` });
    },
    onError: (e: any) => toast({ title: "Email failed", description: e.message, variant: "destructive" }),
  });


  const settingsMutation = useMutation({
    mutationFn: () => campaignFetch("PUT", "/api/campaign/settings", { surveyDelayDays, reviewMode, keywords }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      setSettingsOpen(false);
      toast({ title: "Campaign settings saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: (year: number) => campaignFetch("POST", "/api/campaign/archive-year", { year }),
    onSuccess: (data: any) => {
      setArchiveConfirm(null);
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      toast({ title: `${data.archived} shoot${data.archived !== 1 ? "s" : ""} archived`, description: `All Christmas ${data.year} shoots moved to archive.` });
    },
    onError: (e: any) => toast({ title: "Archive failed", description: e.message, variant: "destructive" }),
  });

  const deliverMutation = useMutation({
    mutationFn: (id: string) => campaignFetch("POST", `/api/campaign/projects/${id}/mark-delivered`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      toast({ title: "Project marked delivered", description: "Delivery chain triggered." });
    },
    onError: (e: any) => toast({ title: "Mark Delivered failed", description: e.message, variant: "destructive" }),
  });

  const ensureMutation = useMutation({
    mutationFn: () => campaignFetch("POST", "/api/campaign/ensure", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      toast({ title: "🎄 Noël 2026 campaign activated!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <TreeDeciduous className="h-6 w-6 animate-pulse text-green-600" />
          <span>Loading Noël Campaign Cockpit…</span>
        </div>
      </div>
    );
  }

  if (!data?.campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <TreeDeciduous className="h-16 w-16 text-green-600" />
        <h1 className="text-2xl font-bold">Noël Set 2026</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          No active campaign found. Click below to create the Noël Set 2026 campaign.
        </p>
        <Button onClick={() => ensureMutation.mutate()} disabled={ensureMutation.isPending}>
          <TreeDeciduous className="mr-2 h-4 w-4" />
          {ensureMutation.isPending ? "Creating…" : "Create Noël 2026 Campaign"}
        </Button>
      </div>
    );
  }

  const { campaign, projects, pacing } = data;
  const totalPhotos = projects.reduce((s, p) => s + (p.selectedPhotoCount || p.selectedCount || 0), 0);
  const completedPhotos = pacing?.photosCompleted || 0;
  const progressPct = totalPhotos > 0 ? Math.round((completedPhotos / totalPhotos) * 100) : 0;
  const today = new Date();
  const daysLeft = Math.ceil((HARD_DEADLINE.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const workingDaysLeft = getWorkingDaysUntil(HARD_DEADLINE);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TreeDeciduous className="h-8 w-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold">{campaign.name} — Campaign Cockpit</h1>
              <p className="text-sm text-muted-foreground">
                Hard deadline: 19 December 2026 · {daysLeft} days ({workingDaysLeft} working days) remaining
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchiveConfirm({ year: (campaign.year ?? new Date().getFullYear()) - 1 })}
            >
              <FolderX className="h-4 w-4 mr-1" /> Archive {(campaign.year ?? new Date().getFullYear()) - 1}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReviewMode(campaign.reviewMode || "spot-check");
                setSurveyDelayDays(campaign.surveyDelayDays || 3);
                setKeywords(campaign.keywords?.length ? [...campaign.keywords] : [...CAMPAIGN_NOEL_KEYWORDS]);
                setSettingsOpen(true);
              }}
            >
              <Settings2 className="h-4 w-4 mr-1" /> Settings
            </Button>
          </div>
        </div>

        {/* Pacing Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Photos</span>
              </div>
              <p className="text-2xl font-bold">{totalPhotos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{completedPhotos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Req. Daily</span>
              </div>
              <p className="text-2xl font-bold">{pacing?.requiredDailyRate || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">Actual Daily</span>
              </div>
              <p className="text-2xl font-bold">{pacing?.actualDailyRate || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Working Days</span>
              </div>
              <p className={`text-2xl font-bold ${workingDaysLeft < 10 ? "text-red-600" : workingDaysLeft < 20 ? "text-amber-600" : ""}`}>
                {workingDaysLeft}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress bar */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Campaign Progress</span>
              <span className="text-muted-foreground">{completedPhotos} / {totalPhotos} photos · {progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>
                {pacing?.isOnTrack ? (
                  <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3 inline" /> On track</span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3 inline" /> Behind schedule</span>
                )}
              </span>
              {pacing?.forecastFinishDate && (
                <span>Forecast finish: {new Date(pacing.forecastFinishDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</span>
              )}
            </div>
            {pacing?.warningMessage && (
              <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {pacing.warningMessage}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Working-day chips to deadline */}
        <WorkingDayChips deadline={HARD_DEADLINE} projects={projects} />

        {/* Main tabs */}
        <Tabs defaultValue="table" className="mt-6">
          <TabsList>
            <TabsTrigger value="table"><Table2 className="h-4 w-4 mr-1" />Project Table</TabsTrigger>
            <TabsTrigger value="lanes"><LayoutGrid className="h-4 w-4 mr-1" />Retoucher Lanes</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4 mr-1" />Calendar Grid</TabsTrigger>
          </TabsList>

          {/* Table view */}
          <TabsContent value="table">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Campaign Projects ({projects.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">Client</th>
                        <th className="text-left py-2 px-3">Shoot</th>
                        <th className="text-left py-2 px-3">Work Date</th>
                        <th className="text-left py-2 px-3">Due</th>
                        <th className="text-left py-2 px-3">Photos</th>
                        <th className="text-left py-2 px-3">Retoucher</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Drive</th>
                        <th className="text-left py-2 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-muted-foreground">
                            No projects yet. Promote Noël-tagged ShootTracker events to populate this list.
                          </td>
                        </tr>
                      ) : (
                        projects.map((project) => (
                          <ProjectRow
                            key={project.id}
                            project={project}
                            onCount={(id, count) => countMutation.mutate({ id, count })}
                            onAssign={(id) => {
                              setAssignProjectId(id);
                              setAssignRetoucher(project.assignedRetoucherId || "");
                            }}
                            onMove={(id) => {
                              setMoveProjectId(id);
                              const d = project.promisedDeliveryDate || project.deliveryDueDate;
                              setMoveDate(d ? new Date(d).toISOString().slice(0, 10) : "2026-12-19");
                            }}
                            onEmail={(id, type) => emailMutation.mutate({ id, type })}
                            onMarkDelivered={(id) => deliverMutation.mutate(id)}
                            isPending={countMutation.isPending || emailMutation.isPending || deliverMutation.isPending}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Retoucher Lanes tab — admin drag-to-reassign */}
          <TabsContent value="lanes">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              {/* Unassigned lane */}
              {(() => {
                const unassigned = projects.filter((p) => !p.assignedRetoucherId && !p.assignedTo && p.status !== "Delivered");
                return (
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20">
                    <div className="p-3 border-b bg-muted/30 rounded-t-lg">
                      <p className="font-semibold text-sm text-muted-foreground">Unassigned ({unassigned.length})</p>
                    </div>
                    <div className="p-3 space-y-2 min-h-[200px]">
                      {unassigned.map((p) => (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => {
                            setLaneDragProjectId(p.id);
                            e.dataTransfer.setData("text/plain", p.id);
                          }}
                          className="bg-card border rounded-lg p-2 text-xs cursor-grab active:cursor-grabbing hover:shadow-md"
                        >
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium truncate">{p.clientName}</span>
                          </div>
                          <p className="text-muted-foreground mt-1">
                            <Camera className="h-3 w-3 inline mr-0.5" />{p.selectedPhotoCount || 0} photos
                          </p>
                        </div>
                      ))}
                      {unassigned.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4 opacity-50">All assigned ✓</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* One lane per retoucher */}
              {RETOUCHERS.map((r) => {
                const laneProjects = projects.filter(
                  (p) => (p.assignedRetoucherId === r.id || p.assignedTo === r.id) && p.status !== "Delivered"
                );
                const lanePhotos = laneProjects.reduce((s, p) => s + (p.selectedPhotoCount || 0), 0);
                const isDragOver = laneDragOverId === r.id;

                return (
                  <div
                    key={r.id}
                    className={`rounded-lg border-2 transition-colors ${isDragOver ? "border-primary bg-primary/5" : "border-border"}`}
                    onDragOver={(e) => { e.preventDefault(); setLaneDragOverId(r.id); }}
                    onDragLeave={() => setLaneDragOverId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const pid = e.dataTransfer.getData("text/plain") || laneDragProjectId;
                      setLaneDragOverId(null);
                      setLaneDragProjectId(null);
                      if (!pid) return;
                      const proj = projects.find((p) => p.id === pid);
                      if (!proj) return;
                      if (proj.assignedRetoucherId === r.id || proj.assignedTo === r.id) return;
                      assignMutation.mutate({ id: pid, retoucherId: r.id });
                    }}
                  >
                    <div className="p-3 border-b bg-muted/30 rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{r.name}</span>
                        <span className="text-xs text-muted-foreground">
                          <Camera className="h-3 w-3 inline mr-0.5" />{lanePhotos} · {laneProjects.length} proj
                        </span>
                      </div>
                    </div>
                    <div className="p-3 space-y-2 min-h-[200px]">
                      {isDragOver && (
                        <div className="border-2 border-dashed border-primary rounded-lg p-2 text-center text-xs text-primary">
                          Drop to assign to {r.name}
                        </div>
                      )}
                      {laneProjects.map((p) => {
                        const dueDate = p.promisedDeliveryDate || p.deliveryDueDate;
                        const workDays = dueDate ? getWorkingDaysUntil(new Date(dueDate)) : 99;
                        return (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={(e) => {
                              setLaneDragProjectId(p.id);
                              e.dataTransfer.setData("text/plain", p.id);
                            }}
                            className="bg-card border rounded-lg p-2 text-xs cursor-grab active:cursor-grabbing hover:shadow-md"
                          >
                            <div className="flex items-center gap-1 mb-1">
                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium truncate">{p.clientName}</span>
                            </div>
                            <div className="flex gap-2 text-muted-foreground">
                              <span><Camera className="h-3 w-3 inline" /> {p.selectedPhotoCount || 0}</span>
                              {dueDate && (
                                <span className={workDays <= 5 ? "text-amber-600" : ""}>
                                  <Clock className="h-3 w-3 inline" /> {new Date(dueDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {laneProjects.length === 0 && !isDragOver && (
                        <p className="text-xs text-muted-foreground text-center py-4 opacity-50">Drag projects here</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Calendar grid view */}
          <TabsContent value="calendar">
            <CalendarGrid projects={projects} />
          </TabsContent>
        </Tabs>

        {/* Move Date Dialog */}
        <Dialog open={!!moveProjectId} onOpenChange={(o) => !o && setMoveProjectId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Move Delivery Date</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select a new delivery date. Cannot exceed 19 December 2026.
                Changing the date will automatically reschedule planned work dates for all retouchers.
              </p>
              <Input
                type="date"
                value={moveDate}
                min={new Date().toISOString().slice(0, 10)}
                max="2026-12-19"
                onChange={(e) => setMoveDate(e.target.value)}
              />
              {moveDate && moveProjectId && (
                <MoveRipplePreview
                  newDate={moveDate}
                  project={projects.find((p) => p.id === moveProjectId)}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveProjectId(null)}>Cancel</Button>
              <Button
                onClick={() => moveProjectId && moveMutation.mutate({ id: moveProjectId, date: moveDate })}
                disabled={moveMutation.isPending || !moveDate}
              >
                {moveMutation.isPending ? "Saving…" : "Move Date"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Retoucher Dialog */}
        <Dialog open={!!assignProjectId} onOpenChange={(o) => !o && setAssignProjectId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Retoucher</DialogTitle>
            </DialogHeader>
            <Select value={assignRetoucher} onValueChange={setAssignRetoucher}>
              <SelectTrigger>
                <SelectValue placeholder="Select retoucher…" />
              </SelectTrigger>
              <SelectContent>
                {RETOUCHERS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignProjectId(null)}>Cancel</Button>
              <Button
                onClick={() => assignProjectId && assignMutation.mutate({ id: assignProjectId, retoucherId: assignRetoucher })}
                disabled={assignMutation.isPending || !assignRetoucher}
              >
                {assignMutation.isPending ? "Saving…" : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Campaign Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Review Mode</label>
                <Select value={reviewMode} onValueChange={setReviewMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Review</SelectItem>
                    <SelectItem value="spot-check">Spot-Check</SelectItem>
                    <SelectItem value="ai-gate-only">AI Gate Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Survey Delay (days after delivery)</label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={surveyDelayDays}
                  onChange={(e) => setSurveyDelayDays(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Christmas Shoot Keywords</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Calendar events whose title contains any of these words are pulled into this campaign.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-2 border rounded-md bg-muted/30">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="gap-1 text-xs pr-1">
                      {kw}
                      <button
                        type="button"
                        className="ml-0.5 hover:text-destructive leading-none"
                        onClick={() => setKeywords(keywords.filter(k => k !== kw))}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  {keywords.length === 0 && (
                    <span className="text-xs text-muted-foreground">No keywords — add one below</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. xmas, festive, holiday shoot"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const kw = newKeyword.trim().toLowerCase();
                        if (kw && !keywords.includes(kw)) setKeywords([...keywords, kw]);
                        setNewKeyword("");
                      }
                    }}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const kw = newKeyword.trim().toLowerCase();
                      if (kw && !keywords.includes(kw)) setKeywords([...keywords, kw]);
                      setNewKeyword("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending || keywords.length === 0}>
                {settingsMutation.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Archive Year Confirmation Dialog */}
        <Dialog open={!!archiveConfirm} onOpenChange={(open) => { if (!open) setArchiveConfirm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive {archiveConfirm?.year} Shoots</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                This will archive all Christmas <strong>{archiveConfirm?.year}</strong> shoots — any project whose
                name matches the campaign keywords and whose shoot date falls in {archiveConfirm?.year}.
              </p>
              <p className="text-muted-foreground">
                Archived projects are hidden from all active views. You can still find them by toggling the archive
                view on the main project list. No data is deleted.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setArchiveConfirm(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => archiveConfirm && archiveMutation.mutate(archiveConfirm.year)}
                disabled={archiveMutation.isPending}
              >
                {archiveMutation.isPending ? "Archiving…" : `Archive ${archiveConfirm?.year} Shoots`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ─────────────────────── Working Day Chips ────────────────────

function WorkingDayChips({ deadline, projects }: { deadline: Date; projects: Project[] }) {
  const chips = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: { date: Date; isToday: boolean; projectsOnDay: Project[]; isPast: boolean }[] = [];
    const cursor = new Date(today);
    while (cursor <= deadline) {
      if (isWorkingDay(cursor)) {
        const dayIso = isoDate(cursor);
        const projectsOnDay = projects.filter(
          (p) =>
            (p.plannedWorkDate && isoDate(new Date(p.plannedWorkDate)) === dayIso) ||
            (p.promisedDeliveryDate && isoDate(new Date(p.promisedDeliveryDate)) === dayIso)
        );
        result.push({
          date: new Date(cursor),
          isToday: dayIso === isoDate(today),
          projectsOnDay,
          isPast: cursor < today,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [deadline, projects]);

  return (
    <Card className="mb-4">
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Hammer className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Working Days to Deadline</span>
          <span className="text-xs text-muted-foreground">({chips.filter((c) => !c.isPast).length} remaining)</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => {
            const hasWork = chip.projectsOnDay.length > 0;
            const label = chip.date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
            const isDeadline = isoDate(chip.date) === "2026-12-19";
            return (
              <Tooltip key={isoDate(chip.date)}>
                <TooltipTrigger asChild>
                  <div
                    className={`
                      text-[10px] px-1.5 py-0.5 rounded border font-mono cursor-default select-none
                      ${chip.isPast ? "opacity-40 bg-muted border-transparent" : ""}
                      ${chip.isToday ? "bg-blue-100 border-blue-400 text-blue-800 font-bold ring-1 ring-blue-400" : ""}
                      ${!chip.isPast && !chip.isToday && hasWork ? "bg-green-100 border-green-400 text-green-800" : ""}
                      ${!chip.isPast && !chip.isToday && !hasWork ? "bg-muted border-muted-foreground/30 text-muted-foreground" : ""}
                      ${isDeadline ? "bg-red-100 border-red-500 text-red-700 font-bold" : ""}
                    `}
                  >
                    {label}
                    {hasWork && !chip.isPast && (
                      <span className="ml-0.5 inline-flex items-center justify-center w-3 h-3 rounded-full bg-green-600 text-white text-[8px]">
                        {chip.projectsOnDay.length}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{label}</p>
                  {chip.projectsOnDay.length > 0 ? (
                    chip.projectsOnDay.map((p) => <p key={p.id} className="text-xs">{p.clientName}</p>)
                  ) : (
                    <p className="text-xs text-muted-foreground">No work scheduled</p>
                  )}
                  {isDeadline && <p className="text-xs text-red-500 font-bold">🎄 HARD DEADLINE</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────── Calendar Grid ─────────────────────────

function CalendarGrid({ projects }: { projects: Project[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const todayDate = new Date();

  const [calYear, setCalYear] = useState(todayDate.getFullYear());
  const [calMonth, setCalMonth] = useState(todayDate.getMonth()); // 0-indexed
  const [countProject, setCountProject] = useState<Project | null>(null);
  const [photoCount, setPhotoCount] = useState("");

  const [lastSyncErrors, setLastSyncErrors] = useState<string[]>([]);

  const syncMutation = useMutation({
    mutationFn: () => campaignFetch("POST", "/api/campaign/sync-calendar", {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      setLastSyncErrors(data.errors || []);
      const hasConnectorError = (data.errors || []).some((e: string) =>
        /not connected|authoris|connector/i.test(e)
      );
      if (hasConnectorError) {
        toast({
          title: "Google Calendar not connected",
          description: "Authorise the connector in Deployment › Advanced › Connectors, then sync again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Calendar synced",
          description: `${data.created} new, ${data.updated} updated${data.errors?.length ? `, ${data.errors.length} errors` : ""}`,
        });
      }
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, count }: { id: string; count: number }) =>
      campaignFetch("PATCH", `/api/campaign/projects/${id}/count`, { selectedPhotoCount: count }),
    onSuccess: (updated: any) => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      setCountProject(null);
      if (updated?.driveGalleryLink) {
        toast({ title: "Photo count saved", description: "Drive folder created automatically!" });
      } else {
        toast({ title: "Photo count saved" });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Build month grid cells (Sun–Sat)
  const { cells, monthLabel } = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const prevMonthLastDay = new Date(calYear, calMonth, 0).getDate();

    const built: { date: Date; isCurrentMonth: boolean }[] = [];

    // Pad start with previous-month days
    for (let i = startDow - 1; i >= 0; i--) {
      built.push({ date: new Date(calYear, calMonth - 1, prevMonthLastDay - i), isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      built.push({ date: new Date(calYear, calMonth, d), isCurrentMonth: true });
    }
    // Pad end with next-month days to always produce exactly 42 cells (6 rows × 7 cols)
    let nextD = 1;
    while (built.length < 42) {
      built.push({ date: new Date(calYear, calMonth + 1, nextD++), isCurrentMonth: false });
    }

    const label = firstDay.toLocaleString("default", { month: "long" }) + " " + calYear;
    return { cells: built, monthLabel: label };
  }, [calYear, calMonth]);

  // Map projects by promisedDeliveryDate (fallback: deliveryDueDate, then shootDate)
  const projectsByDate = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const p of projects) {
      const dateField = p.promisedDeliveryDate || p.deliveryDueDate || p.shootDate;
      if (!dateField) continue;
      const key = localDateKey(new Date(dateField));
      map[key] = map[key] || [];
      map[key].push(p);
    }
    return map;
  }, [projects]);

  const todayStr = localDateKey(todayDate);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };
  const goToday = () => { setCalMonth(todayDate.getMonth()); setCalYear(todayDate.getFullYear()); };

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl font-bold tracking-tight">{monthLabel}</CardTitle>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="h-7 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "Syncing…" : "Refresh from Calendar"}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={prevMonth}>
                <span className="text-base leading-none">‹</span>
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={goToday}>
                Today
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={nextMonth}>
                <span className="text-base leading-none">›</span>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Double-click a project pill to enter photo count</p>
          {lastSyncErrors.some(e => /not connected|authoris|connector/i.test(e)) && (
            <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
              <span>
                <strong>Google Calendar not connected.</strong> Authorise the connector in{" "}
                <em>Deployment › Advanced settings › Connectors</em>, then click{" "}
                <strong>Refresh from Calendar</strong> to pull in Noël shoots.
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-t">
            {DAY_HEADERS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1.5 border-r last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {/* Month grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
              {week.map(({ date, isCurrentMonth }, di) => {
                const dayStr = localDateKey(date);
                const isToday = dayStr === todayStr;
                const pills = isCurrentMonth ? (projectsByDate[dayStr] || []) : [];

                return (
                  <div
                    key={di}
                    className={`
                      min-h-[88px] border-r last:border-r-0 p-1 align-top
                      ${!isCurrentMonth ? "bg-muted/30" : ""}
                    `}
                  >
                    {/* Day number */}
                    <div className="flex justify-end mb-0.5">
                      {isToday ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                          {date.getDate()}
                        </span>
                      ) : (
                        <span className={`text-[11px] ${isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"}`}>
                          {date.getDate()}
                        </span>
                      )}
                    </div>

                    {/* Project pills — double-click opens count popover */}
                    {pills.slice(0, 4).map(p => (
                      <Popover
                        key={p.id}
                        open={countProject?.id === p.id}
                        onOpenChange={open => {
                          if (!open) setCountProject(null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <div
                            onDoubleClick={() => {
                              setCountProject(p);
                              setPhotoCount(String(p.selectedPhotoCount ?? ""));
                            }}
                            className="text-[10px] border-l-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 rounded-r px-1 py-0.5 mb-0.5 truncate cursor-pointer select-none hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                            title={`${p.clientName}${p.selectedPhotoCount ? ` — ${p.selectedPhotoCount} photos` : " — double-click to enter count"}`}
                          >
                            {p.clientName}
                            {p.selectedPhotoCount ? (
                              <span className="ml-1 opacity-70">({p.selectedPhotoCount})</span>
                            ) : null}
                            {p.driveFolderId ? " 📁" : null}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" side="right" align="start">
                          <div className="space-y-3">
                            <p className="text-sm font-semibold flex items-center gap-1.5">
                              <Camera className="h-3.5 w-3.5 text-amber-600" />
                              {p.clientName}
                            </p>
                            <div>
                              <label className="text-xs font-medium block mb-1">Number of photos</label>
                              <Input
                                type="number"
                                min={0}
                                value={countProject?.id === p.id ? photoCount : ""}
                                onChange={e => setPhotoCount(e.target.value)}
                                placeholder="e.g. 120"
                                className="h-7 text-sm"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    const n = parseInt(photoCount, 10);
                                    if (!isNaN(n) && n >= 0) saveMutation.mutate({ id: p.id, count: n });
                                  }
                                  if (e.key === "Escape") setCountProject(null);
                                }}
                              />
                            </div>
                            {p.driveGalleryLink ? (
                              <a
                                href={p.driveGalleryLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline block"
                              >
                                📁 Open Drive Folder
                              </a>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">
                                Drive folder auto-created when count {">"} 0 is saved.
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs flex-1"
                                onClick={() => setCountProject(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-6 text-xs flex-1"
                                onClick={() => {
                                  const n = parseInt(photoCount, 10);
                                  if (isNaN(n) || n < 0) return;
                                  saveMutation.mutate({ id: p.id, count: n });
                                }}
                                disabled={saveMutation.isPending}
                              >
                                {saveMutation.isPending ? "…" : "Save"}
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ))}
                    {pills.length > 4 && (
                      <div className="text-[9px] text-muted-foreground pl-1">+{pills.length - 4} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>

    </>
  );
}

// ─────────────────────── Move Ripple Preview ───────────────────

function MoveRipplePreview({ newDate, project }: { newDate: string; project?: Project }) {
  if (!project) return null;
  const oldDate = project.promisedDeliveryDate || project.deliveryDueDate;
  if (!oldDate) return null;
  const oldD = new Date(oldDate);
  const newD = new Date(newDate);
  const slipDays = Math.round((newD.getTime() - oldD.getTime()) / (1000 * 60 * 60 * 24));
  if (slipDays === 0) return null;

  const isLater = slipDays > 0;
  const oldWorkDays = getWorkingDaysUntil(oldD);
  const newWorkDays = getWorkingDaysUntil(newD);
  const campaign_threshold = 3;

  return (
    <div className={`rounded border p-2 text-xs space-y-1 ${isLater ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-green-300 bg-green-50 dark:bg-green-950/30"}`}>
      <p className="font-medium">{isLater ? "⚠️" : "✅"} Move ripple preview</p>
      <p>
        {oldD.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} →{" "}
        {newD.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
        {" "}({isLater ? "+" : ""}{slipDays} calendar days)
      </p>
      <p className="text-muted-foreground">
        Working days: {oldWorkDays} → {newWorkDays} ({isLater ? "-" : "+"}{Math.abs(newWorkDays - oldWorkDays)} working days)
      </p>
      {isLater && slipDays >= campaign_threshold && (
        <p className="text-amber-700 dark:text-amber-300">
          Client will be notified via chat (slip ≥ {campaign_threshold} days threshold).
        </p>
      )}
      <p className="text-muted-foreground">Scheduler will automatically update planned work dates for all retouchers.</p>
    </div>
  );
}

// ─────────────────────── Project Row ───────────────────────────

interface ProjectRowProps {
  project: Project;
  onCount: (id: string, count: number) => void;
  onAssign: (id: string) => void;
  onMove: (id: string) => void;
  onEmail: (id: string, type: "estimate" | "ready" | "survey") => void;
  onMarkDelivered: (id: string) => void;
  isPending: boolean;
}

// ── Selection tier dot ──────────────────────────────────────────────────────
function SelectionTierDot({ tier, sentAt }: { tier: number | null | undefined; sentAt: string | null | undefined }) {
  if (!sentAt) return null;
  const t = tier ?? 0;
  const colors = ["bg-green-500", "bg-orange-500", "bg-red-500"];
  const labels = ["Invite sent", "Orange reminder sent", "Red reminder sent"];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-block w-2.5 h-2.5 rounded-full ml-1 ${colors[Math.min(t, 2)]}`} />
      </TooltipTrigger>
      <TooltipContent>{labels[Math.min(t, 2)]}</TooltipContent>
    </Tooltip>
  );
}

function ProjectRow({ project, onCount, onAssign, onMove, onEmail, onMarkDelivered, isPending }: ProjectRowProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [countInput, setCountInput] = useState(String(project.selectedPhotoCount || project.selectedCount || ""));
  const [selExpanded, setSelExpanded] = useState(false);
  const [pixiesetInput, setPixiesetInput] = useState(project.pixiesetLink || "");
  const [allowanceInput, setAllowanceInput] = useState(String(project.selectionAllowance ?? project.packageCount ?? ""));
  const [extraPriceInput, setExtraPriceInput] = useState(String(project.extraPhotoPrice ?? ""));

  const dueDate = project.promisedDeliveryDate || project.deliveryDueDate;
  const plannedWork = project.plannedWorkDate;
  const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "—";
  const shootDateStr = project.shootDate ? new Date(project.shootDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "—";
  const workDateStr = plannedWork ? new Date(plannedWork).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "—";
  const statusKey = (project.status || "").replace(/\s/g, "");
  const statusClass = STATUS_COLORS[statusKey] || "bg-gray-100 text-gray-700";
  const workDaysLeft = dueDate ? getWorkingDaysUntil(new Date(dueDate)) : 0;
  const isDeadlineNear = workDaysLeft <= 5 && workDaysLeft > 0;
  const isOverdue = dueDate && new Date(dueDate) < new Date() && project.status !== "Delivered";

  // ── Selection mutations ───────────────────────────────────────────────────
  const saveFieldsMutation = useMutation({
    mutationFn: () =>
      campaignFetch("PATCH", `/api/campaign/projects/${project.id}/selection-fields`, {
        pixiesetLink: pixiesetInput,
        selectionAllowance: parseInt(allowanceInput, 10) || project.packageCount,
        extraPhotoPrice: parseInt(extraPriceInput, 10) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      toast({ title: "Selection fields saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const sendSelectionEmailMutation = useMutation({
    mutationFn: () => campaignFetch("POST", `/api/campaign/projects/${project.id}/email/selection`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      toast({ title: "Selection email sent" });
    },
    onError: (e: any) => toast({ title: "Email failed", description: e.message, variant: "destructive" }),
  });

  const collectFilesMutation = useMutation({
    mutationFn: () => campaignFetch("POST", `/api/campaign/projects/${project.id}/files-collected`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaign"] });
      toast({ title: "Files marked as collected", description: "Photos-ready email will fire when conditions are met." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // ── Selection panel derived values ──────────────────────────────────────
  const clientDone = !!project.clientSelectionDoneAt;
  const selAllowance = project.selectionAllowance ?? project.packageCount ?? 0;
  const selExtras = clientDone && project.clientSelectionCount != null
    ? Math.max(0, project.clientSelectionCount - selAllowance)
    : 0;
  const selExtrasTotal = selExtras * (project.extraPhotoPrice ?? 0);

  return (
    <>
      <tr className="border-b hover:bg-muted/30 transition-colors">
        <td className="py-2 px-3">
          <div className="font-medium">{project.clientName}</div>
          {project.clientEmail && <div className="text-xs text-muted-foreground">{project.clientEmail}</div>}
        </td>
        <td className="py-2 px-3 text-muted-foreground text-xs">{shootDateStr}</td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1 text-xs">
            <Hammer className="h-3 w-3 text-purple-500" />
            <span className={plannedWork ? "text-purple-700" : "text-muted-foreground"}>{workDateStr}</span>
          </div>
        </td>
        <td className="py-2 px-3">
          <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-600 font-bold" : isDeadlineNear ? "text-amber-600 font-semibold" : ""}`}>
            {dueDateStr}
            {(isDeadlineNear || isOverdue) && <AlertTriangle className="h-3 w-3" />}
          </div>
          {workDaysLeft > 0 && (
            <div className="text-[10px] text-muted-foreground">{workDaysLeft}wd left</div>
          )}
          <button onClick={() => onMove(project.id)} className="text-xs text-primary hover:underline mt-0.5 block">
            <Edit3 className="h-3 w-3 inline mr-0.5" />Move
          </button>
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              className="h-7 w-20 text-xs"
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
            />
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onCount(project.id, Number(countInput))} disabled={isPending}>
              ✓
            </Button>
          </div>
        </td>
        <td className="py-2 px-3">
          {project.assignedRetoucherId ? (
            <button onClick={() => onAssign(project.id)} className="text-sm hover:underline text-primary">
              {project.assignedRetoucherId}
            </button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAssign(project.id)}>
              <Users className="h-3 w-3 mr-1" /> Assign
            </Button>
          )}
        </td>
        <td className="py-2 px-3">
          <Badge variant="outline" className={`text-xs border ${statusClass}`}>
            {project.status}
          </Badge>
        </td>
        <td className="py-2 px-3">
          {project.driveGalleryLink ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={project.driveGalleryLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Linked
                </a>
              </TooltipTrigger>
              <TooltipContent>Open Drive folder</TooltipContent>
            </Tooltip>
          ) : project.driveFolderId ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium cursor-default">
                  <FolderOpen className="h-3.5 w-3.5" />
                  No link
                </span>
              </TooltipTrigger>
              <TooltipContent>Folder created but share link not yet generated</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-default">
                  <FolderX className="h-3.5 w-3.5" />
                  Pending
                </span>
              </TooltipTrigger>
              <TooltipContent>Drive folder created automatically when photo count is saved</TooltipContent>
            </Tooltip>
          )}
        </td>
        <td className="py-2 px-3">
          <div className="flex gap-1 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEmail(project.id, "estimate")} disabled={!project.clientEmail}>
                  <Mail className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Email 1: Delivery Estimate</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEmail(project.id, "ready")} disabled={!project.clientEmail}>
                  <Send className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Email 2: Photos Ready</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEmail(project.id, "survey")} disabled={!project.clientEmail}>
                  <CheckCircle2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Email 3: Satisfaction Survey</TooltipContent>
            </Tooltip>
            {project.status !== "Delivered" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => onMarkDelivered(project.id)}
                    disabled={isPending}
                  >
                    <PackageCheck className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark Delivered (manual fallback)</TooltipContent>
              </Tooltip>
            )}
            {/* Selection panel toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={selExpanded ? "secondary" : "ghost"}
                  className="h-7 w-7 p-0"
                  onClick={() => setSelExpanded((v) => !v)}
                >
                  <Image className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Selection flow</TooltipContent>
            </Tooltip>
          </div>
        </td>
      </tr>

      {/* ── Selection panel (collapsible sub-row) ──────────────────────────── */}
      {selExpanded && (
        <tr className="bg-muted/20 border-b">
          <td colSpan={9} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Image className="h-3.5 w-3.5" />
              Photo Selection
            </div>

            {/* Fields row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium block mb-1">Pixieset gallery link</label>
                <Input
                  placeholder="https://gallery.pixieset.com/…"
                  value={pixiesetInput}
                  onChange={(e) => setPixiesetInput(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Selection allowance (photos)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder={String(project.packageCount ?? 0)}
                  value={allowanceInput}
                  onChange={(e) => setAllowanceInput(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Extra photo price (R)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={extraPriceInput}
                  onChange={(e) => setExtraPriceInput(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Save + Send buttons */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => saveFieldsMutation.mutate()}
                disabled={saveFieldsMutation.isPending}
              >
                {saveFieldsMutation.isPending ? "Saving…" : "Save fields"}
              </Button>

              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => sendSelectionEmailMutation.mutate()}
                disabled={sendSelectionEmailMutation.isPending || !project.clientEmail || !!project.selectionEmailSentAt}
              >
                <Mail className="h-3 w-3 mr-1" />
                {project.selectionEmailSentAt
                  ? `Sent ${new Date(project.selectionEmailSentAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                  : sendSelectionEmailMutation.isPending
                  ? "Sending…"
                  : "Send Selection Email"}
              </Button>
              <SelectionTierDot tier={project.selectionReminderTier} sentAt={project.selectionEmailSentAt as any} />
            </div>

            {/* Selection Done list */}
            {clientDone && project.clientSelectionCount != null ? (
              <div className="bg-white dark:bg-card border rounded-lg p-3">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Client selection received
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                  <div>
                    <span className="text-muted-foreground block">Selected</span>
                    <span className="font-bold text-sm">{project.clientSelectionCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Allowance</span>
                    <span className="font-bold text-sm">{selAllowance}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Extras</span>
                    <span className={`font-bold text-sm ${selExtras > 0 ? "text-orange-600" : "text-green-600"}`}>
                      {selExtras > 0 ? `+${selExtras}` : "None"}
                    </span>
                  </div>
                  {selExtras > 0 && (
                    <div>
                      <span className="text-muted-foreground block">Extras total</span>
                      <span className="font-bold text-sm text-orange-600">R{selExtrasTotal}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {project.filesCollected ? (
                    <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                      <HardDrive className="h-3.5 w-3.5" />
                      Files collected{project.filesCollectedAt
                        ? ` on ${new Date(project.filesCollectedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                        : ""}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                      onClick={() => collectFilesMutation.mutate()}
                      disabled={collectFilesMutation.isPending}
                    >
                      <HardDrive className="h-3 w-3 mr-1" />
                      {collectFilesMutation.isPending ? "Marking…" : "Mark Files Collected"}
                    </Button>
                  )}
                  {project.photosReadyEmailSentAt && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      Photos-ready email sent
                    </span>
                  )}
                </div>
              </div>
            ) : project.selectionEmailSentAt ? (
              <p className="text-xs text-muted-foreground italic">Waiting for client to complete their selection…</p>
            ) : null}
          </td>
        </tr>
      )}
    </>
  );
}
