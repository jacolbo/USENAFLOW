import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { NavigationBar } from "@/components/navigation-bar";
import { KPICards } from "@/components/kpi-cards";
import { FilterPanel, FilterState } from "@/components/filter-panel";
import { DataTable } from "@/components/data-table";
import { CalendarHeatmap } from "@/components/calendar-heatmap";
import { DueDateCalendar } from "@/components/due-date-calendar";
import { SettingsDialog } from "@/components/settings-dialog";
import {
  CalendarEvent,
  CalendarInfo,
  Forecast,
  KPIData,
  UserSettings,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, addMonths } from "date-fns";

const DEFAULT_FILTERS: FilterState = {
  dateRangeStart: format(subMonths(new Date(), 1), "yyyy-MM-dd"),
  dateRangeEnd: format(addMonths(new Date(), 2), "yyyy-MM-dd"),
  deadlineDate: null,
  turnaroundDays: 5,
  statusFilter: "all",
};

type QuickFilter = "none" | "linkNotSent" | "notDelivered";

interface AuthSession {
  authenticated: boolean;
  user?: { id: string; username: string };
}

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("none");

  const { data: session } = useQuery<AuthSession>({
    queryKey: ["/api/auth/session"],
    staleTime: 60000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/login");
    },
    onError: () => {
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const { data: calendars = [], isLoading: isLoadingCalendars } = useQuery<
    CalendarInfo[]
  >({
    queryKey: ["/api/calendars"],
  });

  const { data: settings, isLoading: isLoadingSettings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const selectedCalendarIds = useMemo(() => {
    if (settings?.selectedCalendarIds) {
      return settings.selectedCalendarIds.split(',').filter(id => id.trim());
    }
    if (settings?.selectedCalendarId) {
      return [settings.selectedCalendarId];
    }
    return [];
  }, [settings?.selectedCalendarIds, settings?.selectedCalendarId]);

  const eventsQueryParams = new URLSearchParams();
  if (selectedCalendarIds.length > 0) {
    eventsQueryParams.set("calendarIds", selectedCalendarIds.join(','));
  }
  if (filters.dateRangeStart) eventsQueryParams.set("start", filters.dateRangeStart);
  if (filters.dateRangeEnd) eventsQueryParams.set("end", filters.dateRangeEnd);
  eventsQueryParams.set("turnaroundDays", filters.turnaroundDays.toString());

  const { data: events = [], isLoading: isLoadingEvents } = useQuery<
    CalendarEvent[]
  >({
    queryKey: ["/api/events", eventsQueryParams.toString()],
    queryFn: async () => {
      if (selectedCalendarIds.length === 0) return [];
      const res = await fetch(`/api/events?${eventsQueryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    enabled: selectedCalendarIds.length > 0,
  });

  const pendingLinkCount = useMemo(() => 
    events.filter(e => e.status === "done" && !e.isLinkSent).length,
    [events]
  );

  const pendingDeliveryCount = useMemo(() => 
    events.filter(e => e.status === "done" && !e.isDelivered).length,
    [events]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.statusFilter === "done" && event.status !== "done") return false;
      if (filters.statusFilter === "upcoming" && event.status !== "upcoming") return false;
      
      if (quickFilter === "linkNotSent") {
        if (event.status !== "done" || event.isLinkSent) return false;
      }
      if (quickFilter === "notDelivered") {
        if (event.status !== "done" || event.isDelivered) return false;
      }
      
      return true;
    });
  }, [events, filters.statusFilter, quickFilter]);

  const { data: kpiData, isLoading: isLoadingKPI } = useQuery<KPIData>({
    queryKey: ["/api/kpi", eventsQueryParams.toString(), filters.deadlineDate],
    queryFn: async () => {
      if (selectedCalendarIds.length === 0) {
        return {
          total: 0,
          done: 0,
          upcoming: 0,
          dueThisWeek: 0,
          overdue: 0,
          dueByDeadline: 0,
          atRisk: 0,
        };
      }
      const params = new URLSearchParams(eventsQueryParams);
      if (filters.deadlineDate) params.set("deadline", filters.deadlineDate);
      const res = await fetch(`/api/kpi?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch KPI data");
      return res.json();
    },
    enabled: selectedCalendarIds.length > 0,
  });

  const forecastQueryParams = new URLSearchParams(eventsQueryParams);
  if (filters.deadlineDate)
    forecastQueryParams.set("deadline", filters.deadlineDate);
  if (settings?.capacityPerDay)
    forecastQueryParams.set("capacity", settings.capacityPerDay.toString());

  const { data: forecast, isLoading: isLoadingForecast } = useQuery<Forecast>({
    queryKey: ["/api/forecast", forecastQueryParams.toString()],
    queryFn: async () => {
      if (selectedCalendarIds.length === 0 || !filters.deadlineDate) return null;
      const res = await fetch(`/api/forecast?${forecastQueryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch forecast");
      return res.json();
    },
    enabled: selectedCalendarIds.length > 0 && !!filters.deadlineDate,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>) => {
      return apiRequest("PATCH", "/api/settings", newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kpi"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecast"] });
      setSettingsOpen(false);
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const selectCalendarsMutation = useMutation({
    mutationFn: async (calendarIds: string[]) => {
      return apiRequest("PATCH", "/api/settings", { 
        selectedCalendarIds: calendarIds.join(','),
        selectedCalendarId: calendarIds[0] || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kpi"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecast"] });
    },
  });

  const updateOverrideMutation = useMutation({
    mutationFn: async ({
      eventId,
      startTime,
      linkSent,
      delivered,
      notes,
    }: {
      eventId: string;
      startTime: string;
      linkSent?: boolean;
      delivered?: boolean;
      notes?: string;
    }) => {
      return apiRequest("POST", "/api/overrides", {
        eventId,
        eventStartTime: startTime,
        linkSent,
        delivered,
        notes,
      });
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/events"] });
      
      // Snapshot the previous value
      const eventsQueryKey = ["/api/events", eventsQueryParams.toString()];
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(eventsQueryKey);
      
      // Optimistically update the cache
      if (previousEvents) {
        queryClient.setQueryData<CalendarEvent[]>(eventsQueryKey, (old) =>
          old?.map((event) => {
            if (event.id !== variables.eventId) return event;
            
            const updates: Partial<CalendarEvent> = {};
            
            if (variables.linkSent !== undefined) {
              updates.isLinkSent = variables.linkSent;
              updates.linkSentAt = variables.linkSent ? new Date().toISOString() : null;
            }
            
            if (variables.delivered !== undefined) {
              updates.isDelivered = variables.delivered;
              updates.isOverdue = variables.delivered ? false : event.isOverdue;
              updates.deliveredAt = variables.delivered ? new Date().toISOString() : null;
            }
            
            return { ...event, ...updates };
          })
        );
      }
      
      // Return context with the snapshotted value
      return { previousEvents, eventsQueryKey };
    },
    onError: (error: any, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousEvents) {
        queryClient.setQueryData(context.eventsQueryKey, context.previousEvents);
      }
      console.error("Override error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (_, variables) => {
      if (variables.linkSent !== undefined) {
        toast({
          title: variables.linkSent ? "Link marked as sent" : "Link marked as not sent",
          description: "Project status updated successfully.",
        });
      } else if (variables.delivered !== undefined) {
        toast({
          title: variables.delivered ? "Marked as delivered" : "Marked as not delivered",
          description: "Project status updated successfully.",
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache is in sync
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kpi"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecast"] });
    },
  });

  const handleLinkSentToggle = useCallback(
    (eventId: string, startTime: string, linkSent: boolean) => {
      updateOverrideMutation.mutate({ eventId, startTime, linkSent });
    },
    [updateOverrideMutation]
  );

  const handleDeliveryToggle = useCallback(
    (eventId: string, startTime: string, delivered: boolean) => {
      updateOverrideMutation.mutate({ eventId, startTime, delivered });
    },
    [updateOverrideMutation]
  );

  const handleNotesChange = useCallback(
    (eventId: string, startTime: string, notes: string) => {
      updateOverrideMutation.mutate({ eventId, startTime, notes });
    },
    [updateOverrideMutation]
  );

  const [isBulkActionPending, setIsBulkActionPending] = useState(false);

  const handleBulkAction = useCallback(
    (
      events: { eventId: string; eventStartTime: string }[], 
      action: string, 
      notes?: string,
      onSuccess?: () => void
    ) => {
      setIsBulkActionPending(true);
      apiRequest("POST", "/api/overrides/bulk", { events, action, notes })
        .then((response: any) => {
          queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          queryClient.invalidateQueries({ queryKey: ["/api/kpi"] });
          queryClient.invalidateQueries({ queryKey: ["/api/forecast"] });
          
          if (response.failed && response.failed > 0) {
            toast({
              title: "Partial update",
              description: `Updated ${response.updated} events. ${response.failed} failed.`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Bulk update complete",
              description: `Updated ${response.updated} events.`,
            });
            if (onSuccess) onSuccess();
          }
        })
        .catch(() => {
          toast({
            title: "Error",
            description: "Failed to update events. Please try again.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsBulkActionPending(false);
        });
    },
    [toast]
  );

  const handleExportCSV = useCallback(() => {
    if (filteredEvents.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no events to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Title",
      "Shoot Date",
      "Status",
      "Delivery Due",
      "Delivered",
      "Notes",
    ];
    const rows = filteredEvents.map((event) => [
      `"${event.title.replace(/"/g, '""')}"`,
      event.startTime,
      event.status,
      event.deliveryDueDate || "",
      event.isDelivered ? "Yes" : "No",
      `"${event.notes.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `shoottracker-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({
      title: "Export complete",
      description: `Exported ${filteredEvents.length} events to CSV.`,
    });
  }, [filteredEvents, toast]);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const isConnected = calendars.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar
        calendars={calendars}
        selectedCalendarIds={selectedCalendarIds}
        onCalendarChange={(ids) => selectCalendarsMutation.mutate(ids)}
        onExportCSV={handleExportCSV}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={() => logoutMutation.mutate()}
        isLoadingCalendars={isLoadingCalendars}
        isConnected={isConnected}
        username={session?.user?.username}
      />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <KPICards data={kpiData || null} isLoading={isLoadingKPI || isLoadingEvents} />

        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
        />

        <CalendarHeatmap
          forecast={forecast || null}
          deadlineDate={filters.deadlineDate}
          capacityPerDay={settings?.capacityPerDay || null}
          isLoading={isLoadingForecast}
        />

        <DueDateCalendar
          events={filteredEvents}
          isLoading={isLoadingEvents}
          onLinkSentToggle={handleLinkSentToggle}
          onDeliveryToggle={handleDeliveryToggle}
        />

        <DataTable
          events={filteredEvents}
          isLoading={isLoadingEvents}
          onLinkSentToggle={handleLinkSentToggle}
          onDeliveryToggle={handleDeliveryToggle}
          onNotesChange={handleNotesChange}
          onBulkAction={handleBulkAction}
          isBulkActionPending={isBulkActionPending}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
          pendingLinkCount={pendingLinkCount}
          pendingDeliveryCount={pendingDeliveryCount}
        />
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings || null}
        onSave={(newSettings) => updateSettingsMutation.mutate(newSettings)}
        isSaving={updateSettingsMutation.isPending}
      />
    </div>
  );
}
