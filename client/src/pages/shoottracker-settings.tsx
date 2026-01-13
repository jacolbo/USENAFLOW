import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getAdminHeaders } from "@/lib/adminAuth";
import { UserRoles, shoottrackerSettingsSchema, type ShoottrackerSettings, StagingStatus, type CalendarEventStaging } from "@shared/schema";
import { ArrowLeft, Calendar, Settings, RefreshCw, Clock, AlertTriangle, CheckCircle, Loader2, CalendarPlus, Eye, EyeOff, Plus, ChevronRight } from "lucide-react";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALLOWED_ROLES = [UserRoles.ADMIN, UserRoles.DATA_WRANGLER, UserRoles.LEAD_RETOUCHER];
const DAYS_OF_WEEK = [
  { value: "MON", label: "Monday" },
  { value: "TUE", label: "Tuesday" },
  { value: "WED", label: "Wednesday" },
  { value: "THU", label: "Thursday" },
  { value: "FRI", label: "Friday" },
  { value: "SAT", label: "Saturday" },
  { value: "SUN", label: "Sunday" },
];

const TIMEZONES = [
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

interface SyncStats {
  fetched: number;
  staged: number;
  updated: number;
  excluded: number;
  errors: string[];
}

interface CalendarListItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
}

export default function ShootTrackerSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newHoliday, setNewHoliday] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState(false);
  const [targetWeekOffset, setTargetWeekOffset] = useState(0);

  const storedSession = localStorage.getItem("usenaflow_session");
  const sessionData = storedSession ? JSON.parse(storedSession) : null;
  const user = sessionData?.user || null;
  const userRole = user?.role || "";
  const userId = user?.id || "";

  const hasAccess = ALLOWED_ROLES.includes(userRole as any);

  const settingsQuery = useQuery<ShoottrackerSettings>({
    queryKey: ["/api/admin/shoottracker/settings"],
    queryFn: async () => {
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch("/api/admin/shoottracker/settings", { headers });
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    },
    enabled: hasAccess,
  });

  const calendarsQuery = useQuery<CalendarListItem[]>({
    queryKey: ["/api/admin/shoottracker/calendars"],
    queryFn: async () => {
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch("/api/admin/shoottracker/calendars", { headers });
      if (!response.ok) throw new Error("Failed to fetch calendars");
      return response.json();
    },
    enabled: hasAccess,
  });

  const form = useForm<ShoottrackerSettings>({
    resolver: zodResolver(shoottrackerSettingsSchema),
    defaultValues: {
      turnaround_days: 5,
      working_days: ["MON", "TUE", "WED", "THU", "FRI"],
      holidays: [],
      exclude_keywords: ["FULL DAY", "BLOCK", "HOLD", "CANCEL", "NO SHOW"],
      selected_calendar_ids: [],
      timezone: "Africa/Johannesburg",
      daily_capacity_projects: 3,
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset(settingsQuery.data);
    }
  }, [settingsQuery.data, form]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: ShoottrackerSettings) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch("/api/admin/shoottracker/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved", description: "ShootTracker settings have been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/settings"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch("/api/admin/shoottracker/sync", {
        method: "POST",
        headers,
      });
      if (!response.ok) throw new Error("Failed to sync calendar");
      return response.json();
    },
    onSuccess: (data: SyncStats) => {
      setSyncStats(data);
      toast({ 
        title: "Sync Complete", 
        description: `${data.staged} new events staged, ${data.updated} updated` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const stagedEventsQuery = useQuery<CalendarEventStaging[]>({
    queryKey: ["/api/admin/shoottracker/staged", showIgnored ? "all" : "pending"],
    queryFn: async () => {
      const headers = getAdminHeaders(userRole, userId);
      const status = showIgnored ? undefined : StagingStatus.PENDING;
      const url = status ? `/api/admin/shoottracker/staged?status=${status}` : "/api/admin/shoottracker/staged";
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error("Failed to fetch staged events");
      return response.json();
    },
    enabled: hasAccess,
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ eventId, targetWeekStart }: { eventId: string; targetWeekStart: Date }) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/shoottracker/staged/${eventId}/promote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ targetWeekStart: targetWeekStart.toISOString() }),
      });
      if (!response.ok) throw new Error("Failed to promote event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch(`/api/admin/shoottracker/staged/${eventId}/ignore`, {
        method: "POST",
        headers,
      });
      if (!response.ok) throw new Error("Failed to ignore event");
      return { eventId };
    },
    onSuccess: (data) => {
      setSelectedEvents(prev => {
        const next = new Set(prev);
        next.delete(data.eventId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch(`/api/admin/shoottracker/staged/${eventId}/restore`, {
        method: "POST",
        headers,
      });
      if (!response.ok) throw new Error("Failed to restore event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getTargetWeekStart = () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    return addWeeks(weekStart, targetWeekOffset);
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const promoteSelectedEvents = async () => {
    const targetWeekStart = getTargetWeekStart();
    let successCount = 0;
    let errorCount = 0;

    for (const eventId of Array.from(selectedEvents)) {
      try {
        await promoteMutation.mutateAsync({ eventId, targetWeekStart });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setSelectedEvents(new Set());
    toast({
      title: "Events Promoted",
      description: `${successCount} events added to week of ${format(targetWeekStart, "MMM d, yyyy")}${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
    });
  };

  const onSubmit = (data: ShoottrackerSettings) => {
    saveSettingsMutation.mutate(data);
  };

  const addHoliday = () => {
    if (newHoliday && /^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) {
      const currentHolidays = form.getValues("holidays");
      if (!currentHolidays.includes(newHoliday)) {
        form.setValue("holidays", [...currentHolidays, newHoliday]);
        setNewHoliday("");
      }
    }
  };

  const removeHoliday = (holiday: string) => {
    const currentHolidays = form.getValues("holidays");
    form.setValue("holidays", currentHolidays.filter(h => h !== holiday));
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      const currentKeywords = form.getValues("exclude_keywords");
      if (!currentKeywords.includes(newKeyword.toUpperCase())) {
        form.setValue("exclude_keywords", [...currentKeywords, newKeyword.toUpperCase()]);
        setNewKeyword("");
      }
    }
  };

  const removeKeyword = (keyword: string) => {
    const currentKeywords = form.getValues("exclude_keywords");
    form.setValue("exclude_keywords", currentKeywords.filter(k => k !== keyword));
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access ShootTracker settings.
              Only Admin, Lead Retoucher, and Data Wrangler can access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              ShootTracker Settings
            </h1>
            <p className="text-muted-foreground">Configure calendar sync and project scheduling</p>
          </div>
        </div>

        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" />
              Calendar Projects
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarPlus className="h-5 w-5" />
                      Calendar Events
                    </CardTitle>
                    <CardDescription>
                      Review synced calendar events and add them to your project schedule
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowIgnored(!showIgnored)}
                    >
                      {showIgnored ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                      {showIgnored ? "Hide Ignored" : "Show Ignored"}
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => syncMutation.mutate()} 
                      disabled={syncMutation.isPending}
                    >
                      {syncMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" /> Sync Now</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedEvents.size > 0 && (
                  <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">{selectedEvents.size} event(s) selected</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTargetWeekOffset(targetWeekOffset - 1)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm min-w-[140px] text-center">
                        {format(getTargetWeekStart(), "MMM d, yyyy")}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTargetWeekOffset(targetWeekOffset + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={promoteSelectedEvents}
                        disabled={promoteMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add to Week
                      </Button>
                    </div>
                  </div>
                )}

                {stagedEventsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stagedEventsQuery.isError ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive opacity-50" />
                    <p className="text-destructive">Failed to load calendar events</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check your calendar connection and try syncing again
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => stagedEventsQuery.refetch()}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : stagedEventsQuery.data && stagedEventsQuery.data.length > 0 ? (
                  <div className="space-y-2">
                    {stagedEventsQuery.data.map((event) => (
                      <div
                        key={event.id}
                        className={`p-3 border rounded-lg flex items-center gap-3 transition-colors ${
                          event.status === StagingStatus.PROMOTED ? "bg-green-50 border-green-200 dark:bg-green-950/20" :
                          event.status === StagingStatus.IGNORED ? "bg-muted/50 opacity-60" :
                          selectedEvents.has(event.id) ? "bg-primary/5 border-primary" : ""
                        }`}
                      >
                        {event.status === StagingStatus.PENDING && (
                          <Checkbox
                            checked={selectedEvents.has(event.id)}
                            onCheckedChange={() => toggleEventSelection(event.id)}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(event.eventStart), "MMM d, yyyy 'at' h:mm a")}
                            {event.location && ` • ${event.location}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.status === StagingStatus.PROMOTED && (
                            <Badge variant="default" className="bg-green-600">Added</Badge>
                          )}
                          {event.status === StagingStatus.IGNORED && (
                            <>
                              <Badge variant="secondary">Ignored</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => restoreMutation.mutate(event.id)}
                                disabled={restoreMutation.isPending}
                              >
                                Restore
                              </Button>
                            </>
                          )}
                          {event.status === StagingStatus.PENDING && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => ignoreMutation.mutate(event.id)}
                              disabled={ignoreMutation.isPending}
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No calendar events found</p>
                    <p className="text-sm mt-1">Click "Sync Now" to fetch events from your calendar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        Calendar Sync
                      </CardTitle>
                      <CardDescription>
                        Sync your calendar events to automatically create projects
                      </CardDescription>
                    </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="selected_calendar_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Calendars to Sync</FormLabel>
                        {calendarsQuery.isLoading ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading calendars...
                          </div>
                        ) : calendarsQuery.error ? (
                          <div className="text-destructive text-sm">
                            Failed to load calendars. Make sure Google Calendar is connected.
                          </div>
                        ) : calendarsQuery.data && calendarsQuery.data.length > 0 ? (
                          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                            {calendarsQuery.data.map((cal) => (
                              <div key={cal.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`cal-${cal.id}`}
                                  checked={field.value.includes(cal.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, cal.id]);
                                    } else {
                                      field.onChange(field.value.filter((id) => id !== cal.id));
                                    }
                                  }}
                                />
                                <Label htmlFor={`cal-${cal.id}`} className="flex-1 cursor-pointer flex items-center gap-2">
                                  {cal.backgroundColor && (
                                    <span 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: cal.backgroundColor }}
                                    />
                                  )}
                                  <span>{cal.summary}</span>
                                  {cal.primary && (
                                    <Badge variant="secondary" className="text-xs">Primary</Badge>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm">
                            No calendars found. Check your Google Calendar connection.
                          </div>
                        )}
                        <FormDescription>
                          Select one or more calendars to sync events from
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      onClick={() => syncMutation.mutate()} 
                      disabled={syncMutation.isPending}
                    >
                      {syncMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" /> Sync Now</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => calendarsQuery.refetch()}
                      disabled={calendarsQuery.isFetching}
                    >
                      {calendarsQuery.isFetching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Refresh Calendars"
                      )}
                    </Button>
                  </div>
                  
                  {!form.watch("selected_calendar_ids").length && (
                    <p className="text-sm text-amber-600">
                      No calendars selected. Sync will use your primary calendar by default.
                    </p>
                  )}

                  {syncStats && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Last Sync Results</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Fetched: {syncStats.fetched}</span>
                        </div>
                        <div>Excluded: {syncStats.excluded}</div>
                        <div className="text-green-600">Staged: {syncStats.staged}</div>
                        <div className="text-blue-600">Updated: {syncStats.updated}</div>
                      </div>
                      {syncStats.errors.length > 0 && (
                        <div className="mt-2 text-destructive text-sm">
                          {syncStats.errors.map((err, i) => (
                            <div key={i}>{err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    General Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="turnaround_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Turnaround Days</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1} 
                              max={30}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                            />
                          </FormControl>
                          <FormDescription>
                            Business days to deliver after shoot
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="daily_capacity_projects"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Daily Capacity</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1} 
                              max={50}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 3)}
                            />
                          </FormControl>
                          <FormDescription>
                            Max projects per day for forecasting
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Working Days
                  </CardTitle>
                  <CardDescription>
                    Select which days count as business days for due date calculations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="working_days"
                    render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {DAYS_OF_WEEK.map((day) => (
                            <div key={day.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={day.value}
                                checked={field.value.includes(day.value as any)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...field.value, day.value]);
                                  } else {
                                    field.onChange(field.value.filter((d) => d !== day.value));
                                  }
                                }}
                              />
                              <Label htmlFor={day.value} className="text-sm cursor-pointer">
                                {day.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Holidays</CardTitle>
                  <CardDescription>
                    Add dates that should not count as working days (format: YYYY-MM-DD)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={newHoliday}
                      onChange={(e) => setNewHoliday(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" onClick={addHoliday} variant="outline">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.watch("holidays").map((holiday) => (
                      <Badge key={holiday} variant="secondary" className="cursor-pointer" onClick={() => removeHoliday(holiday)}>
                        {holiday} ×
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Exclude Keywords</CardTitle>
                  <CardDescription>
                    Calendar events containing these keywords will be skipped during sync
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="Add keyword..."
                      className="flex-1"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                    />
                    <Button type="button" onClick={addKeyword} variant="outline">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.watch("exclude_keywords").map((keyword) => (
                      <Badge key={keyword} variant="outline" className="cursor-pointer" onClick={() => removeKeyword(keyword)}>
                        {keyword} ×
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setLocation("/")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveSettingsMutation.isPending}>
                  {saveSettingsMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
