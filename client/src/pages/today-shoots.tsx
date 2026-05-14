import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Camera, ChevronLeft, ChevronRight, Loader2, ArrowLeft, CalendarDays, MapPin, Link2Off } from "lucide-react";
import type { Project } from "@shared/schema";
import { InsposEditor } from "@/components/inspos-panel";

interface TodayItem {
  project: Project;
  inspoCount: number;
}

interface CalendarEventItem {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  calendarId: string;
  projectId: string | null;
  linkedToProject: boolean;
}

interface TodayResponse {
  projects: TodayItem[];
  calendarEvents: CalendarEventItem[];
}

export default function TodayShoots() {
  const [, navigate] = useLocation();
  const [date, setDate] = useState<Date>(() => new Date());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const userRole = localStorage.getItem("usena_role") || "";
  const userId = localStorage.getItem("usena_user_id") || "";
  const userName = userId;

  const allowed = ["Admin", "Photographer", "DataWrangler", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "Evans"].includes(userRole);
  const canEdit = ["Admin", "Photographer"].includes(userRole);

  // Local-day key (YYYY-MM-DD in the user's timezone) — used purely for cache
  // keys and "is this today?" checks. The server filter is driven by the
  // start/end ISO timestamps below.
  const dateKey = useMemo(() => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [date]);

  // Day boundaries in the user's local timezone, expressed as absolute UTC
  // instants. The server uses these to filter projects whose shootDate falls
  // within the user's local day.
  const { startIso, endIso } = useMemo(() => {
    // Use next-local-midnight (not +24h) so DST transitions don't shift
    // the boundary by an hour.
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, [date]);

  // Recompute every render so "Today" stays accurate after midnight rollover
  // while the page is left open.
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const shootsQuery = useQuery<TodayResponse>({
    queryKey: ["/api/today-shoots", dateKey],
    queryFn: async () => {
      const url = `/api/today-shoots?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}&date=${dateKey}`;
      const r = await fetch(url, { headers: getAdminHeaders(userRole, userName) });
      if (!r.ok) throw new Error("Failed to load shoots");
      const data = await r.json();
      // Backwards-compat: server used to return a bare array.
      if (Array.isArray(data)) return { projects: data as TodayItem[], calendarEvents: [] };
      return data as TodayResponse;
    },
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Access denied</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">You don't have permission to view this page.</p>
            <Button onClick={() => navigate("/")}>Go home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const shiftDay = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d);
  };

  const isToday = dateKey === todayKey;
  const items = shootsQuery.data?.projects || [];
  const calendarEvents = shootsQuery.data?.calendarEvents || [];
  // Hide calendar events that already correspond to a project we're showing
  // above so the same shoot doesn't appear twice.
  const projectEventIds = new Set(items.map(i => (i.project as any).calendarEventId).filter(Boolean));
  const unmatchedEvents = calendarEvents.filter(ev => !projectEventIds.has(ev.id));
  const active = items.find(i => i.project.id === activeProjectId);

  const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          {userRole !== "Photographer" && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Camera className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Today's Shoots</h1>
            <p className="text-xs text-muted-foreground">{date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftDay(-1)} data-testid="button-prev-day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isToday ? "default" : "outline"} size="sm" onClick={() => setDate(new Date())} data-testid="button-today">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftDay(1)} data-testid="button-next-day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length} shoot{items.length === 1 ? "" : "s"}
            {unmatchedEvents.length > 0 && ` · ${unmatchedEvents.length} calendar event${unmatchedEvents.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {shootsQuery.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 && unmatchedEvents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No shoots scheduled for this day.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map(({ project, inspoCount }) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveProjectId(project.id)}
                data-testid={`card-shoot-${project.id}`}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <span
                    className={`h-3 w-3 rounded-full flex-shrink-0 ${inspoCount > 0 ? "bg-green-500" : "bg-gray-300"}`}
                    title={inspoCount > 0 ? `${inspoCount} inspo(s) uploaded` : "No inspos yet"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{project.clientName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{project.packageCount} photos</span>
                      {project.shootDate && (
                        <span>· {new Date(project.shootDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={inspoCount > 0 ? "default" : "outline"} className={inspoCount > 0 ? "bg-green-600" : ""}>
                    {inspoCount} inspo{inspoCount === 1 ? "" : "s"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {unmatchedEvents.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              From Google Calendar
              <span className="text-xs">({unmatchedEvents.length})</span>
            </div>
            <p className="text-xs text-muted-foreground">
              These events are on the calendar but don't have a project record yet. Sync ShootTracker to turn them into projects.
            </p>
            <div className="space-y-2">
              {unmatchedEvents.map((ev) => (
                <Card key={ev.id} data-testid={`card-cal-event-${ev.id}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{ev.summary || "(untitled event)"}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{fmtTime(ev.start)}{ev.end ? ` – ${fmtTime(ev.end)}` : ""}</span>
                        {ev.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3" /> {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Link2Off className="h-3 w-3" /> No project
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      <Dialog open={!!activeProjectId} onOpenChange={(o) => !o && setActiveProjectId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-inspo-editor">
          <DialogHeader>
            <DialogTitle>Inspo Editor — {active?.project.clientName}</DialogTitle>
          </DialogHeader>
          {active && (
            <InsposEditor
              projectId={active.project.id}
              userRole={userRole}
              userId={userName}
              canEdit={canEdit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
