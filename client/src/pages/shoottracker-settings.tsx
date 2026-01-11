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
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getAdminHeaders } from "@/lib/adminAuth";
import { UserRoles, shoottrackerSettingsSchema, type ShoottrackerSettings } from "@shared/schema";
import { ArrowLeft, Calendar, Settings, RefreshCw, Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
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
  excluded: number;
  upcoming: number;
  done: number;
  created: number;
  updated: number;
  errors: string[];
}

export default function ShootTrackerSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newHoliday, setNewHoliday] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);

  const storedUser = localStorage.getItem("usenaUser");
  const user = storedUser ? JSON.parse(storedUser) : null;
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
    onSuccess: (data) => {
      setSyncStats(data.stats);
      toast({ 
        title: "Sync Complete", 
        description: `Created ${data.stats.created} projects, updated ${data.stats.updated}` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

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

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Calendar Sync
              </CardTitle>
              <CardDescription>
                Sync your Google Calendar events to automatically create projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => syncMutation.mutate()} 
                disabled={syncMutation.isPending}
                className="w-full sm:w-auto"
              >
                {syncMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" /> Sync Now</>
                )}
              </Button>

              {syncStats && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Last Sync Results</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Fetched: {syncStats.fetched}</span>
                    </div>
                    <div>Excluded: {syncStats.excluded}</div>
                    <div>Upcoming: {syncStats.upcoming}</div>
                    <div>Done: {syncStats.done}</div>
                    <div className="text-green-600">Created: {syncStats.created}</div>
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
