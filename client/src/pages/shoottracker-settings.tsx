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
import { UserRoles, shoottrackerSettingsSchema, type ShoottrackerSettings, StagingStatus, type CalendarEventStaging, type KeywordTurnaroundRule, type Holiday } from "@shared/schema";
import { ArrowLeft, Calendar, Settings, RefreshCw, Clock, AlertTriangle, CheckCircle, Loader2, CalendarPlus, Eye, EyeOff, Plus, ChevronRight, Search, X, Mail, MessageCircle, Send } from "lucide-react";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { AppLayout, PageHeader } from "@/components/app-layout";
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

function InlineNumberInput({ 
  value, 
  onSave, 
  min = 0,
  className = "" 
}: { 
  value: number; 
  onSave: (val: number) => void; 
  min?: number;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);
  
  const handleBlur = () => {
    const parsed = parseInt(localValue) || 0;
    const validated = Math.max(min, parsed);
    if (validated !== value) {
      onSave(validated);
    }
    setLocalValue(String(validated));
  };
  
  return (
    <Input
      type="number"
      min={min}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={className}
    />
  );
}
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
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayStart, setNewHolidayStart] = useState("");
  const [newHolidayEnd, setNewHolidayEnd] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [targetWeekOffset, setTargetWeekOffset] = useState(0);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleKeywords, setNewRuleKeywords] = useState("");
  const [newRuleDays, setNewRuleDays] = useState(10);
  const [isFetchingPublicHolidays, setIsFetchingPublicHolidays] = useState(false);

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

  const autoSyncStatusQuery = useQuery<{
    enabled: boolean;
    intervalMinutes: number;
    lastSyncAt: string | null;
    isCurrentlySyncing: boolean;
  }>({
    queryKey: ["/api/admin/shoottracker/autosync-status"],
    queryFn: async () => {
      const headers = getAdminHeaders(userRole, userId);
      const response = await fetch("/api/admin/shoottracker/autosync-status", { headers });
      if (!response.ok) throw new Error("Failed to fetch auto-sync status");
      return response.json();
    },
    enabled: hasAccess,
  });

  // Query chat projects for unread count (for sidebar badge)
  const chatRoles = ["Admin", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "Evans"];
  const { data: chatProjects = [] } = useQuery<Array<{ project: any; unreadCount: number }>>({
    queryKey: ["/api/admin/chat/projects"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/chat/projects`, {
        headers: getAdminHeaders(userRole, userId),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: hasAccess && chatRoles.includes(userRole),
    refetchInterval: 30000,
  });
  const totalChatUnread = chatProjects.reduce((sum, p) => sum + p.unreadCount, 0);

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
      keyword_turnaround_rules: [],
      auto_sync_enabled: false,
      auto_sync_interval_minutes: 15,
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/autosync-status"] });
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
      setEventSearchQuery("");
      setDateFrom("");
      setDateTo("");
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
    mutationFn: async (eventId: string) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/shoottracker/staged/${eventId}/promote`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Failed to promote event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Added to Week", description: "Project placed in appropriate week based on due date" });
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

  const updatePackageMutation = useMutation({
    mutationFn: async ({ eventId, packagePhotos, selectedPhotos }: { eventId: string; packagePhotos?: number; selectedPhotos?: number }) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/shoottracker/staged/${eventId}/package`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ packagePhotos, selectedPhotos }),
      });
      if (!response.ok) throw new Error("Failed to update package info");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
    },
  });

  // Email notification mutations
  const sendDeliveryEstimateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/shoottracker/project/${projectId}/send-delivery-estimate`, {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send delivery estimate");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Email Sent", description: "Delivery estimate email sent successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendProjectAddedMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/shoottracker/project/${projectId}/send-project-added`, {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send project added email");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Email Sent", description: "Project added email with extras approval link sent" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendChatLinkMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const headers = {
        ...getAdminHeaders(userRole, userId),
        "Content-Type": "application/json",
      };
      const response = await fetch(`/api/admin/shoottracker/project/${projectId}/send-chat-link`, {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send chat link email");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shoottracker/staged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Email Sent", description: "Chat link email sent successfully" });
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

  const resolveTurnaroundDays = (eventTitle: string): { turnaroundDays: number; matchedRule: string | null } => {
    const settings = settingsQuery.data;
    if (!settings) {
      return { turnaroundDays: 5, matchedRule: null };
    }
    
    const titleUpper = eventTitle.toUpperCase();
    
    for (const rule of settings.keyword_turnaround_rules || []) {
      for (const keyword of rule.keywords) {
        if (titleUpper.includes(keyword.toUpperCase())) {
          return {
            turnaroundDays: rule.turnaround_days,
            matchedRule: rule.name,
          };
        }
      }
    }
    
    return {
      turnaroundDays: settings.turnaround_days,
      matchedRule: null,
    };
  };

  const isDateInHolidayRange = (dateStr: string, holidays: Holiday[]): boolean => {
    for (const holiday of holidays) {
      if (dateStr >= holiday.start_date && dateStr <= holiday.end_date) {
        return true;
      }
    }
    return false;
  };

  const calculateDeliveryDueDate = (shootDate: Date, eventTitle: string): Date => {
    const settings = settingsQuery.data;
    if (!settings) {
      const dueDate = new Date(shootDate);
      dueDate.setDate(dueDate.getDate() + 5);
      return dueDate;
    }
    
    const { turnaroundDays } = resolveTurnaroundDays(eventTitle);
    let daysToAdd = turnaroundDays;
    const workingDays = new Set(settings.working_days.map(d => d.toUpperCase()));
    const holidays = settings.holidays || [];
    
    let currentDate = new Date(shootDate);
    let daysAdded = 0;
    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    while (daysAdded < daysToAdd) {
      currentDate.setDate(currentDate.getDate() + 1);
      const dayName = DAY_NAMES[currentDate.getDay()];
      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (workingDays.has(dayName) && !isDateInHolidayRange(dateStr, holidays)) {
        daysAdded++;
      }
    }
    
    return currentDate;
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
    let successCount = 0;
    let errorCount = 0;

    for (const eventId of Array.from(selectedEvents)) {
      try {
        await promoteMutation.mutateAsync(eventId);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setSelectedEvents(new Set());
    toast({
      title: "Events Added",
      description: `${successCount} events added to their due weeks${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
    });
  };

  const ignoreSelectedEvents = async () => {
    let successCount = 0;
    let errorCount = 0;

    for (const eventId of Array.from(selectedEvents)) {
      try {
        await ignoreMutation.mutateAsync(eventId);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setSelectedEvents(new Set());
    toast({
      title: "Events Ignored",
      description: `${successCount} events ignored${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
    });
  };

  const matchesFilters = (event: CalendarEventStaging) => {
    if (eventSearchQuery.trim()) {
      const searchLower = eventSearchQuery.toLowerCase();
      const matchesText = event.title.toLowerCase().includes(searchLower) ||
        (event.location && event.location.toLowerCase().includes(searchLower)) ||
        (event.description && event.description.toLowerCase().includes(searchLower));
      if (!matchesText) return false;
    }
    if (dateFrom) {
      const eventDate = new Date(event.eventStart).toISOString().split('T')[0];
      if (eventDate < dateFrom) return false;
    }
    if (dateTo) {
      const eventDate = new Date(event.eventStart).toISOString().split('T')[0];
      if (eventDate > dateTo) return false;
    }
    return true;
  };

  const hasActiveFilters = eventSearchQuery.trim() || dateFrom || dateTo;

  const selectAllPendingEvents = () => {
    const pendingEvents = stagedEventsQuery.data?.filter(e => e.status === StagingStatus.PENDING) || [];
    const filteredEvents = pendingEvents.filter(matchesFilters);
    const allIds = new Set(filteredEvents.map(e => e.id));
    setSelectedEvents(allIds);
  };

  const clearSelection = () => {
    setSelectedEvents(new Set());
  };

  const onSubmit = (data: ShoottrackerSettings) => {
    saveSettingsMutation.mutate(data);
  };

  const addHoliday = () => {
    if (newHolidayName.trim() && newHolidayStart && newHolidayEnd) {
      const currentHolidays = form.getValues("holidays") || [];
      const newHoliday: Holiday = {
        name: newHolidayName.trim(),
        start_date: newHolidayStart,
        end_date: newHolidayEnd,
        is_public: false,
      };
      const exists = currentHolidays.some(h => 
        h.name === newHoliday.name && h.start_date === newHoliday.start_date
      );
      if (!exists) {
        form.setValue("holidays", [...currentHolidays, newHoliday], { shouldDirty: true });
        setNewHolidayName("");
        setNewHolidayStart("");
        setNewHolidayEnd("");
      }
    }
  };

  const removeHoliday = (index: number) => {
    const currentHolidays = form.getValues("holidays") || [];
    form.setValue("holidays", currentHolidays.filter((_, i) => i !== index), { shouldDirty: true });
  };

  const fetchSAPublicHolidays = async () => {
    setIsFetchingPublicHolidays(true);
    try {
      const years = [2025, 2026];
      const allHolidays: Holiday[] = [];
      
      for (const year of years) {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ZA`);
        if (response.ok) {
          const data = await response.json();
          for (const holiday of data) {
            allHolidays.push({
              name: holiday.localName || holiday.name,
              start_date: holiday.date,
              end_date: holiday.date,
              is_public: true,
            });
          }
        }
      }
      
      const currentHolidays = form.getValues("holidays") || [];
      const nonPublicHolidays = currentHolidays.filter(h => !h.is_public);
      const mergedHolidays = [...nonPublicHolidays, ...allHolidays];
      form.setValue("holidays", mergedHolidays, { shouldDirty: true });
      
      toast({
        title: "Public Holidays Loaded",
        description: `Added ${allHolidays.length} SA public holidays for 2025-2026`,
      });
    } catch (error) {
      toast({
        title: "Failed to fetch holidays",
        description: "Could not load SA public holidays. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingPublicHolidays(false);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      const currentKeywords = form.getValues("exclude_keywords");
      if (!currentKeywords.includes(newKeyword.toUpperCase())) {
        form.setValue("exclude_keywords", [...currentKeywords, newKeyword.toUpperCase()], { shouldDirty: true });
        setNewKeyword("");
      }
    }
  };

  const removeKeyword = (keyword: string) => {
    const currentKeywords = form.getValues("exclude_keywords");
    form.setValue("exclude_keywords", currentKeywords.filter(k => k !== keyword), { shouldDirty: true });
  };

  const addTurnaroundRule = () => {
    if (newRuleName.trim() && newRuleKeywords.trim() && newRuleDays > 0) {
      const keywords = newRuleKeywords.split(",").map(k => k.trim().toUpperCase()).filter(k => k);
      if (keywords.length > 0) {
        const currentRules = form.getValues("keyword_turnaround_rules") || [];
        const newRule: KeywordTurnaroundRule = {
          name: newRuleName.trim(),
          keywords,
          turnaround_days: newRuleDays,
        };
        form.setValue("keyword_turnaround_rules", [...currentRules, newRule], { shouldDirty: true });
        setNewRuleName("");
        setNewRuleKeywords("");
        setNewRuleDays(10);
      }
    }
  };

  const removeTurnaroundRule = (index: number) => {
    const currentRules = form.getValues("keyword_turnaround_rules") || [];
    form.setValue("keyword_turnaround_rules", currentRules.filter((_, i) => i !== index), { shouldDirty: true });
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

  const storedName = localStorage.getItem("usena_name") || userId;
  const currentUserData = storedName ? {
    name: storedName,
    role: userRole
  } : null;

  return (
    <AppLayout currentUser={currentUserData} unreadChatCount={totalChatUnread}>
      <PageHeader 
        title="ShootTracker"
        description="Configure calendar sync and project scheduling"
      />
      <div className="p-6 max-w-4xl">
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
                <div className="mb-4 flex flex-wrap gap-3 items-end">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search events by name..."
                      value={eventSearchQuery}
                      onChange={(e) => setEventSearchQuery(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {eventSearchQuery && (
                      <button
                        onClick={() => setEventSearchQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-[140px]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-[140px]"
                      />
                    </div>
                    {(dateFrom || dateTo) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDateFrom(""); setDateTo(""); }}
                        className="mt-5"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {stagedEventsQuery.data && stagedEventsQuery.data.filter(e => e.status === StagingStatus.PENDING).length > 0 && (
                  <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={selectedEvents.size > 0 ? clearSelection : selectAllPendingEvents}
                      >
                        {selectedEvents.size > 0 ? "Clear Selection" : hasActiveFilters ? "Select Filtered" : "Select All"}
                      </Button>
                      {selectedEvents.size > 0 && (
                        <span className="text-sm font-medium">{selectedEvents.size} event(s) selected</span>
                      )}
                      {hasActiveFilters && (
                        <span className="text-sm text-muted-foreground">
                          Showing {stagedEventsQuery.data.filter(matchesFilters).length} of {stagedEventsQuery.data.length} events
                        </span>
                      )}
                    </div>
                    {selectedEvents.size > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={ignoreSelectedEvents}
                          disabled={ignoreMutation.isPending}
                        >
                          <EyeOff className="h-4 w-4 mr-1" />
                          Ignore Selected
                        </Button>
                        <Button
                          size="sm"
                          onClick={promoteSelectedEvents}
                          disabled={promoteMutation.isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add to Due Weeks
                        </Button>
                      </div>
                    )}
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
                  <div className="space-y-3">
                    {stagedEventsQuery.data
                      .filter(matchesFilters)
                      .map((event) => {
                      const deliveryDue = calculateDeliveryDueDate(new Date(event.eventStart), event.title);
                      const { matchedRule } = resolveTurnaroundDays(event.title);
                      return (
                        <div
                          key={event.id}
                          className={`p-4 border rounded-lg transition-colors ${
                            event.status === StagingStatus.PROMOTED ? "bg-green-50 border-green-200 dark:bg-green-950/20" :
                            event.status === StagingStatus.IGNORED ? "bg-muted/50 opacity-60" :
                            selectedEvents.has(event.id) ? "bg-primary/5 border-primary" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {event.status === StagingStatus.PENDING && (
                              <Checkbox
                                checked={selectedEvents.has(event.id)}
                                onCheckedChange={() => toggleEventSelection(event.id)}
                                className="mt-1"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium truncate">{event.title}</div>
                                <div className="flex items-center gap-2">
                                  {event.status === StagingStatus.PROMOTED && (
                                    <>
                                      <Badge variant="default" className="bg-green-600">Added</Badge>
                                      {event.clientEmail && event.promotedProjectId && (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => sendDeliveryEstimateMutation.mutate(event.promotedProjectId!)}
                                            disabled={sendDeliveryEstimateMutation.isPending}
                                            title="Send delivery estimate email"
                                          >
                                            <Send className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => sendProjectAddedMutation.mutate(event.promotedProjectId!)}
                                            disabled={sendProjectAddedMutation.isPending}
                                            title="Send project added email (with extras approval)"
                                          >
                                            <Mail className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => sendChatLinkMutation.mutate(event.promotedProjectId!)}
                                            disabled={sendChatLinkMutation.isPending}
                                            title="Send chat link email"
                                          >
                                            <MessageCircle className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </>
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
                              
                              <div className="text-sm text-muted-foreground mb-3">
                                <span className="font-medium">Shoot:</span> {format(new Date(event.eventStart), "MMM d, yyyy 'at' h:mm a")}
                                {event.location && ` • ${event.location}`}
                              </div>
                              
                              <div className="text-sm mb-3">
                                <span className="font-medium text-primary">Due:</span>{" "}
                                <span className="text-orange-600 dark:text-orange-400 font-medium">
                                  {format(deliveryDue, "MMM d, yyyy")}
                                </span>
                                {matchedRule && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {matchedRule}
                                  </Badge>
                                )}
                              </div>
                              
                              {event.status === StagingStatus.PENDING && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Package Photos</Label>
                                    <InlineNumberInput
                                      value={event.packagePhotos || 0}
                                      onSave={(val) => updatePackageMutation.mutate({
                                        eventId: event.id,
                                        packagePhotos: val
                                      })}
                                      className="h-8 mt-1"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Selected Photos</Label>
                                    <InlineNumberInput
                                      value={event.selectedPhotos || 0}
                                      onSave={(val) => updatePackageMutation.mutate({
                                        eventId: event.id,
                                        selectedPhotos: val
                                      })}
                                      className="h-8 mt-1"
                                    />
                                  </div>
                                  <div className="col-span-2 sm:col-span-1">
                                    <Label className="text-xs text-muted-foreground">Add to Week</Label>
                                    <div className="flex gap-1 mt-1">
                                      <Button
                                        size="sm"
                                        className="h-8 w-full"
                                        onClick={() => promoteMutation.mutate(event.id)}
                                        disabled={promoteMutation.isPending}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add to Due Week
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {stagedEventsQuery.data.filter(matchesFilters).length === 0 && hasActiveFilters && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No events match your filters</p>
                        <Button 
                          variant="link" 
                          onClick={() => { setEventSearchQuery(""); setDateFrom(""); setDateTo(""); }}
                          className="mt-2"
                        >
                          Clear all filters
                        </Button>
                      </div>
                    )}
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
                    <Clock className="h-5 w-5" />
                    Automatic Sync
                  </CardTitle>
                  <CardDescription>
                    Automatically sync calendar changes without clicking "Sync Now"
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="auto_sync_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Automatic Sync</FormLabel>
                          <FormDescription>
                            Automatically check Google Calendar for changes
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("auto_sync_enabled") && (
                    <FormField
                      control={form.control}
                      name="auto_sync_interval_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sync Interval</FormLabel>
                          <Select
                            value={String(field.value)}
                            onValueChange={(value) => field.onChange(parseInt(value))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select interval" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="5">Every 5 minutes</SelectItem>
                              <SelectItem value="10">Every 10 minutes</SelectItem>
                              <SelectItem value="15">Every 15 minutes</SelectItem>
                              <SelectItem value="30">Every 30 minutes</SelectItem>
                              <SelectItem value="60">Every hour</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            How often to check Google Calendar for changes
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {autoSyncStatusQuery.data && (
                    <div className="rounded-lg border p-4 bg-muted/50">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        Auto-Sync Status
                        {autoSyncStatusQuery.data.isCurrentlySyncing && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={autoSyncStatusQuery.data.enabled ? "default" : "secondary"}>
                            {autoSyncStatusQuery.data.enabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        {autoSyncStatusQuery.data.enabled && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Interval:</span>
                            <span>Every {autoSyncStatusQuery.data.intervalMinutes} minutes</span>
                          </div>
                        )}
                        {autoSyncStatusQuery.data.lastSyncAt && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Last sync:</span>
                            <span>{format(new Date(autoSyncStatusQuery.data.lastSyncAt), "MMM d, yyyy h:mm a")}</span>
                          </div>
                        )}
                      </div>
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
                    Turnaround Time Rules
                  </CardTitle>
                  <CardDescription>
                    Set different turnaround times based on keywords in shoot titles (e.g., maternity shoots take longer)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-2">
                    <Input
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="Rule name (e.g. Maternity)"
                    />
                    <Input
                      value={newRuleKeywords}
                      onChange={(e) => setNewRuleKeywords(e.target.value)}
                      placeholder="Keywords (comma-separated)"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={newRuleDays}
                        onChange={(e) => setNewRuleDays(parseInt(e.target.value) || 10)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground self-center">days</span>
                      <Button type="button" onClick={addTurnaroundRule} variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                  
                  {(form.watch("keyword_turnaround_rules") || []).length > 0 ? (
                    <div className="space-y-2">
                      {(form.watch("keyword_turnaround_rules") || []).map((rule, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <div className="font-medium">{rule.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Keywords: {rule.keywords.join(", ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">{rule.turnaround_days} days</Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTurnaroundRule(index)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No custom rules. All shoots will use the default turnaround time above.
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Rules are checked in order. The first matching keyword determines the turnaround time.
                  </p>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Holidays</CardTitle>
                      <CardDescription>
                        Add dates or date ranges that should not count as working days
                      </CardDescription>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={fetchSAPublicHolidays}
                      disabled={isFetchingPublicHolidays}
                    >
                      {isFetchingPublicHolidays ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" /> Fetch SA Public Holidays</>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input
                      placeholder="Holiday name"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={newHolidayStart}
                      onChange={(e) => {
                        setNewHolidayStart(e.target.value);
                        if (!newHolidayEnd) setNewHolidayEnd(e.target.value);
                      }}
                    />
                    <Input
                      type="date"
                      value={newHolidayEnd}
                      onChange={(e) => setNewHolidayEnd(e.target.value)}
                    />
                    <Button type="button" onClick={addHoliday} variant="outline">
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(form.watch("holidays") || []).map((holiday, index) => (
                      <div key={`${holiday.name}-${holiday.start_date}-${index}`} className={`flex items-center justify-between p-2 rounded border ${holiday.is_public ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20' : 'bg-muted/50'}`}>
                        <div className="flex items-center gap-2">
                          {holiday.is_public && <Badge variant="outline" className="text-xs">Public</Badge>}
                          <span className="font-medium">{holiday.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {holiday.start_date === holiday.end_date 
                              ? holiday.start_date 
                              : `${holiday.start_date} → ${holiday.end_date}`}
                          </span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeHoliday(index)}>
                          ×
                        </Button>
                      </div>
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
    </AppLayout>
  );
}
