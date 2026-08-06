import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

// Retouchers are loaded dynamically from /api/users — no hardcoded list

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

type CampaignProject = Project & { clientChatToken?: string | null };

interface CampaignData {
  campaign: Campaign | null;
  projects: CampaignProject[];
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

  // Real retouchers from the users table
  const { data: usersData } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: () => campaignFetch("GET", "/api/users"),
  });
  const retouchers: { id: string; name: string }[] = useMemo(() => {
    if (!usersData) return [];
    return usersData
      .filter((u: any) => u.role && (u.role.toLowerCase().includes("retoucher") || u.role === "LeadRetoucher"))
      .map((u: any) => ({ id: u.id, name: u.username || u.name || u.id }));
  }, [usersData]);

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
      const r = retouchers.find((x) => x.id === retoucherId);
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
                        <th className="text-left py-2 px-3">Allowance</th>
                        <th className="text-left py-2 px-3">Selected</th>
                        <th className="text-left py-2 px-3">Pixieset</th>
                        <th className="text-left py-2 px-3">Retoucher</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Drive</th>
                        <th className="text-left py-2 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center py-8 text-muted-foreground">
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

              {/* One lane per retoucher — populated from real users */}
              {retouchers.map((r) => {
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
            <CalendarGrid
              projects={projects}
              onChipClick={(id) => {
                setMoveProjectId(id);
                const p = projects.find((proj) => proj.id === id);
                const d = p?.promisedDeliveryDate || p?.deliveryDueDate;
                setMoveDate(d ? new Date(d).toISOString().slice(0, 10) : "2026-12-19");
              }}
            />
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
              {moveProjectId && (() => {
                const mp = projects.find((p) => p.id === moveProjectId);
                return mp?.clientChatToken ? (
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2 flex items-center gap-1.5">
                    <MessageCircle className="h-3 w-3 shrink-0" />
                    This will send an update message to{" "}
                    <span className="font-medium">{mp.clientName}</span> in their chat.
                  </p>
                ) : null;
              })()}
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
                {retouchers.length === 0 && (
                <SelectItem value="__none" disabled>No retouchers found</SelectItem>
              )}
              {retouchers.map((r) => (
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

// ─────────────────────── Calendar helpers ──────────────────────

function formatWeekLabel(monday: Date, friday: Date): string {
  const monDay = monday.getDate();
  const friDay = friday.getDate();
  const monMonth = monday.toLocaleString("en-GB", { month: "short" });
  const friMonth = friday.toLocaleString("en-GB", { month: "short" });
  if (monMonth === friMonth) return `${monDay}–${friDay} ${monMonth}`;
  return `${monDay} ${monMonth}–${friDay} ${friMonth}`;
}

function getChipColor(project: Project, todayKey: string): string {
  if (project.status === "Delivered") return "bg-teal-500";
  if (project.plannedWorkDate) {
    const workKey = localDateKey(new Date(project.plannedWorkDate));
    if (workKey < todayKey) return "bg-red-600";
  }
  const dueDate = project.promisedDeliveryDate || project.deliveryDueDate;
  if (dueDate && getWorkingDaysUntil(new Date(dueDate)) <= 2) return "bg-amber-500";
  return "bg-purple-600";
}

// ─────────────────────── Calendar Grid ─────────────────────────

function CalendarGrid({
  projects,
  onChipClick,
}: {
  projects: Project[];
  onChipClick: (projectId: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedRetoucher, setSelectedRetoucher] = useState<string>("all");
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

  // today, normalised to midnight
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayKey = localDateKey(today);

  // Build weeks: Monday of current week → 19 Dec 2026
  const weeks = useMemo(() => {
    const start = new Date(today);
    const dow = start.getDay(); // 0=Sun
    const toMonday = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + toMonday);

    const end = new Date(2026, 11, 19); // 19 Dec 2026

    const result: { weekLabel: string; monday: Date; days: Date[] }[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const monday = new Date(cursor);
      const friday = new Date(cursor);
      friday.setDate(friday.getDate() + 4);
      const capFriday = friday > end ? new Date(end) : friday;

      const days: Date[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(cursor);
        d.setDate(d.getDate() + i);
        if (d <= end) days.push(d);
      }

      if (days.length > 0) {
        result.push({ weekLabel: formatWeekLabel(monday, capFriday), monday, days });
      }

      cursor.setDate(cursor.getDate() + 7);
    }
    return result;
  }, [today]);

  // Index projects by plannedWorkDate
  const projectsByDate = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const p of projects) {
      if (!p.plannedWorkDate) continue;
      const key = localDateKey(new Date(p.plannedWorkDate));
      map[key] = map[key] || [];
      map[key].push(p);
    }
    return map;
  }, [projects]);

  // Retouchers that actually have projects
  const activeRetouchers = useMemo(
    () => RETOUCHERS.filter((r) => projects.some((p) => p.assignedRetoucherId === r.id || p.assignedTo === r.id)),
    [projects]
  );

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
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

        {/* Retoucher filter pills */}
        <div className="flex gap-1 flex-wrap">
          {(["all", ...activeRetouchers.map((r) => r.id)] as string[]).map((id) => {
            const label = id === "all" ? "All" : (RETOUCHERS.find((r) => r.id === id)?.name ?? id);
            const active = selectedRetoucher === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedRetoucher(id)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Connector warning */}
      {lastSyncErrors.some((e) => /not connected|authoris|connector/i.test(e)) && (
        <div className="flex items-start gap-2 mb-3 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
          <span>
            <strong>Google Calendar not connected.</strong> Authorise the connector in{" "}
            <em>Deployment › Advanced settings › Connectors</em>, then click{" "}
            <strong>Refresh from Calendar</strong> to pull in Noël shoots.
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 mb-3 flex-wrap text-[10px] text-white">
        <span className="bg-teal-500 rounded px-2 py-0.5">Delivered</span>
        <span className="bg-purple-600 rounded px-2 py-0.5">On track</span>
        <span className="bg-amber-500 rounded px-2 py-0.5">At risk (≤2 working days)</span>
        <span className="bg-red-600 rounded px-2 py-0.5">Overdue</span>
      </div>

      {/* Grid */}
      <div className="rounded-lg border overflow-hidden">
        {/* Sticky column headers */}
        <div className="grid border-b bg-muted/40" style={{ gridTemplateColumns: "110px repeat(5, 1fr)" }}>
          <div className="p-2 text-xs font-semibold text-muted-foreground">Week</div>
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
            <div key={d} className="p-2 text-xs font-semibold text-center text-muted-foreground border-l">
              {d}
            </div>
          ))}
        </div>

        {/* Scrollable rows */}
        <div className="overflow-y-auto max-h-[640px]">
          {weeks.map(({ weekLabel, days }, wi) => {
            // Week total photo count (unfiltered — load warning is always global)
            const weekPhotos = days.reduce((sum, day) => {
              const key = localDateKey(day);
              return sum + (projectsByDate[key] || []).reduce((s, p) => s + (p.selectedPhotoCount || 0), 0);
            }, 0);
            const overloaded = weekPhotos >= 200;

            return (
              <div
                key={wi}
                className="grid border-b last:border-b-0"
                style={{ gridTemplateColumns: "110px repeat(5, 1fr)" }}
              >
                {/* Week label */}
                <div className="p-2 border-r bg-muted/20 flex flex-col justify-between min-h-[80px]">
                  <span className="text-[11px] font-semibold leading-tight">{weekLabel}</span>
                  <span className={`text-[10px] font-medium mt-1 flex items-center gap-0.5 ${overloaded ? "text-amber-600" : "text-muted-foreground"}`}>
                    {overloaded && "⚠ "}
                    {weekPhotos}ph
                  </span>
                </div>

                {/* Day cells — always render 5 slots (Mon–Fri) */}
                {Array.from({ length: 5 }).map((_, di) => {
                  const day = days[di];
                  if (!day) {
                    return <div key={di} className="border-l bg-muted/10 min-h-[80px]" />;
                  }
                  const dayKey = localDateKey(day);
                  const isToday = dayKey === todayKey;
                  const allDayProjects = projectsByDate[dayKey] || [];
                  const visibleProjects =
                    selectedRetoucher === "all"
                      ? allDayProjects
                      : allDayProjects.filter(
                          (p) =>
                            p.assignedRetoucherId === selectedRetoucher ||
                            p.assignedTo === selectedRetoucher
                        );

                  return (
                    <div
                      key={di}
                      className={`border-l p-1 min-h-[80px] ${isToday ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                    >
                      {/* Day number */}
                      <div className="text-[10px] text-muted-foreground text-right mb-0.5 leading-none">
                        {isToday ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white font-bold">
                            {day.getDate()}
                          </span>
                        ) : (
                          day.getDate()
                        )}
                      </div>

                      {/* Project chips */}
                      <div className="space-y-0.5">
                        {visibleProjects.map((p) => {
                          const color = getChipColor(p, todayKey);
                          const firstName = (p.clientName || "").split(" ")[0];
                          const count = p.selectedPhotoCount || 0;
                          return (
                            <button
                              key={p.id}
                              onClick={() => onChipClick(p.id)}
                              className={`w-full text-left text-[10px] text-white rounded px-1 py-0.5 truncate ${color} hover:opacity-80 active:opacity-70 transition-opacity`}
                              title={`${p.clientName} · ${count}ph — click to reschedule`}
                            >
                              {firstName} · {count}ph
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
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
  project: CampaignProject;
  onCount: (id: string, count: number) => void;
  onAssign: (id: string) => void;
  onMove: (id: string) => void;
  onEmail: (id: string, type: "estimate" | "ready" | "survey") => void;
  onMarkDelivered: (id: string) => void;
  isPending: boolean;
}

function ProjectRow({ project, onCount, onAssign, onMove, onEmail, onMarkDelivered, isPending }: ProjectRowProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [countInput, setCountInput] = useState(
    String(project.selectedPhotoCount || project.selectedCount || "")
  );
  const [allowanceInput, setAllowanceInput] = useState(
    String(project.selectionAllowance ?? project.packageCount ?? "")
  );
  const [pixiesetInput, setPixiesetInput] = useState(project.pixiesetLink || "");

  const savePixiesetMutation = useMutation({
    mutationFn: (patch: { pixiesetLink?: string; selectionAllowance?: number }) =>
      campaignFetch("PATCH", `/api/campaign/projects/${project.id}/pixieset-link`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/campaign"] }),
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

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
        {/* Allowance — how many photos are in the client's package */}
        <td className="py-2 px-3">
          <Input
            type="number"
            min={0}
            placeholder="pkg"
            className="h-7 w-16 text-xs"
            value={allowanceInput}
            onChange={(e) => setAllowanceInput(e.target.value)}
            onBlur={() => {
              const n = Number(allowanceInput);
              if (!isNaN(n) && String(n) !== String(project.selectionAllowance ?? project.packageCount ?? "")) {
                savePixiesetMutation.mutate({ selectionAllowance: n });
              }
            }}
          />
        </td>
        {/* Selected — how many photos the client chose in-studio */}
        <td className="py-2 px-3">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              className="h-7 w-16 text-xs"
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
            />
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onCount(project.id, Number(countInput))} disabled={isPending}>
              ✓
            </Button>
          </div>
        </td>
        <td className="py-2 px-3">
          <Input
            placeholder="https://pixieset.com/…"
            value={pixiesetInput}
            onChange={(e) => setPixiesetInput(e.target.value)}
            onBlur={() => {
              if (pixiesetInput !== (project.pixiesetLink || "")) {
                savePixiesetMutation.mutate({ pixiesetLink: pixiesetInput });
              }
            }}
            className="h-7 text-xs w-40"
          />
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
          <div className="flex gap-1 items-center">
            {/* Email 1 — delivery date + chat link. Fires manually after count is entered. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={() => onEmail(project.id, "estimate")}
                  disabled={!project.clientEmail}
                >
                  <Mail className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {project.clientEmail ? "Send delivery date + chat link (Email 1)" : "No client email — add it to the project first"}
              </TooltipContent>
            </Tooltip>
            {/* Mark Delivered — manual fallback; Drive detection handles this automatically */}
            {project.status !== "Delivered" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => onMarkDelivered(project.id)}
                    disabled={isPending}
                  >
                    <PackageCheck className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark Delivered (Drive usually does this automatically)</TooltipContent>
              </Tooltip>
            )}
            {/* Client chat — opens after Email 1 has been sent */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm" variant="ghost"
                  className={`h-7 w-7 p-0 ${project.clientChatToken ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" : "text-muted-foreground/30"}`}
                  disabled={!project.clientChatToken}
                  onClick={() => project.clientChatToken && window.open(`/client-chat/${project.clientChatToken}`, "_blank")}
                >
                  <MessageCircle className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{project.clientChatToken ? "Open client chat" : "Chat starts after Email 1 is sent"}</TooltipContent>
            </Tooltip>
          </div>
        </td>
      </tr>
    </>
  );
}
