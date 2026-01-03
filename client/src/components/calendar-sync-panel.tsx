import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, RefreshCw, Download, Check, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";

interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
}

interface CalendarSettings {
  id?: string;
  turnaroundDays: number;
  selectedCalendarIds: string;
  exclusionKeywords: string;
  cancelKeywords: string;
  defaultPackageCount: number;
  autoImport: boolean;
  lastSyncAt?: string;
}

export function CalendarSyncPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [turnaroundDays, setTurnaroundDays] = useState(5);
  const [defaultPackageCount, setDefaultPackageCount] = useState(5);
  const [exclusionKeywords, setExclusionKeywords] = useState("FULL DAY,BLOCK,HOLD,OUT OF OFFICE");
  const [cancelKeywords, setCancelKeywords] = useState("CANCEL,CANCELLED,DID NOT COME,NO SHOW,NOT COMING");
  const [autoImport, setAutoImport] = useState(false);
  const [previewEvents, setPreviewEvents] = useState<CalendarEvent[]>([]);
  const [cancelledEvents, setCancelledEvents] = useState<CalendarEvent[]>([]);
  const [selectedEventsToImport, setSelectedEventsToImport] = useState<string[]>([]);
  
  const { data: settings, isLoading: settingsLoading } = useQuery<CalendarSettings>({
    queryKey: ['/api/calendar/settings'],
  });
  
  const { data: calendars, isLoading: calendarsLoading, error: calendarsError } = useQuery<CalendarInfo[]>({
    queryKey: ['/api/calendar/calendars'],
  });
  
  useEffect(() => {
    if (settings) {
      setTurnaroundDays(settings.turnaroundDays || 5);
      setDefaultPackageCount(settings.defaultPackageCount || 5);
      setExclusionKeywords(settings.exclusionKeywords || "FULL DAY,BLOCK,HOLD,OUT OF OFFICE");
      setCancelKeywords(settings.cancelKeywords || "CANCEL,CANCELLED,DID NOT COME,NO SHOW,NOT COMING");
      setAutoImport(settings.autoImport || false);
      if (settings.selectedCalendarIds) {
        setSelectedCalendarIds(settings.selectedCalendarIds.split(",").filter(id => id));
      }
    }
  }, [settings]);
  
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/calendar/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnaroundDays,
          defaultPackageCount,
          exclusionKeywords,
          cancelKeywords,
          autoImport,
          selectedCalendarIds: selectedCalendarIds.join(","),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/settings'] });
      toast({ title: "Settings saved", description: "Calendar sync settings have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });
  
  const fetchEventsMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const startDate = startOfMonth(addMonths(now, -1)).toISOString();
      const endDate = endOfMonth(addMonths(now, 1)).toISOString();
      
      const response = await apiRequest('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarIds: selectedCalendarIds,
          startDate,
          endDate,
        }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      setPreviewEvents(data.validEvents || []);
      setCancelledEvents(data.cancelledEvents || []);
      setSelectedEventsToImport(data.validEvents?.map((e: CalendarEvent) => e.id) || []);
      toast({ 
        title: "Events fetched", 
        description: `Found ${data.validEvents?.length || 0} valid events and ${data.cancelledEvents?.length || 0} cancelled events.` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to fetch calendar events.", 
        variant: "destructive" 
      });
    },
  });
  
  const importEventsMutation = useMutation({
    mutationFn: async () => {
      const eventsToImport = previewEvents.filter(e => selectedEventsToImport.includes(e.id));
      const response = await apiRequest('/api/calendar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToImport }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: "Import complete", 
        description: `Imported ${data.imported} projects. ${data.skipped} events skipped (already imported).` 
      });
      setPreviewEvents([]);
      setCancelledEvents([]);
      setSelectedEventsToImport([]);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to import events.", 
        variant: "destructive" 
      });
    },
  });
  
  const toggleCalendarSelection = (calendarId: string) => {
    setSelectedCalendarIds(prev => 
      prev.includes(calendarId) 
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };
  
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventsToImport(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };
  
  const selectAllEvents = () => {
    setSelectedEventsToImport(previewEvents.map(e => e.id));
  };
  
  const deselectAllEvents = () => {
    setSelectedEventsToImport([]);
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar Integration
          </CardTitle>
          <CardDescription>
            Automatically import photoshoot bookings from Google Calendar to create projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Select Calendars</Label>
              <p className="text-sm text-gray-500 mb-3">Choose which calendars to sync events from.</p>
              
              {calendarsLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading calendars...
                </div>
              ) : calendarsError ? (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  {(calendarsError as any)?.message || "Failed to load calendars. Please ensure Google Calendar is connected."}
                </div>
              ) : (
                <div className="space-y-2">
                  {calendars?.map(calendar => (
                    <div key={calendar.id} className="flex items-center space-x-3 p-2 rounded border hover:bg-gray-50">
                      <Checkbox
                        id={calendar.id}
                        checked={selectedCalendarIds.includes(calendar.id)}
                        onCheckedChange={() => toggleCalendarSelection(calendar.id)}
                        data-testid={`checkbox-calendar-${calendar.id}`}
                      />
                      <Label htmlFor={calendar.id} className="flex-1 cursor-pointer">
                        <span className="font-medium">{calendar.summary}</span>
                        {calendar.primary && <Badge variant="secondary" className="ml-2">Primary</Badge>}
                        {calendar.description && (
                          <span className="block text-sm text-gray-500">{calendar.description}</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="turnaroundDays">Turnaround Days</Label>
                <Input
                  id="turnaroundDays"
                  type="number"
                  min="1"
                  max="30"
                  value={turnaroundDays}
                  onChange={(e) => setTurnaroundDays(parseInt(e.target.value) || 5)}
                  data-testid="input-turnaround-days"
                />
                <p className="text-xs text-gray-500">Business days from shoot to delivery due date.</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="defaultPackageCount">Default Package Count</Label>
                <Input
                  id="defaultPackageCount"
                  type="number"
                  min="1"
                  max="100"
                  value={defaultPackageCount}
                  onChange={(e) => setDefaultPackageCount(parseInt(e.target.value) || 5)}
                  data-testid="input-default-package-count"
                />
                <p className="text-xs text-gray-500">Default number of photos in package for imported projects.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="exclusionKeywords">Exclusion Keywords</Label>
              <Input
                id="exclusionKeywords"
                value={exclusionKeywords}
                onChange={(e) => setExclusionKeywords(e.target.value)}
                placeholder="FULL DAY,BLOCK,HOLD"
                data-testid="input-exclusion-keywords"
              />
              <p className="text-xs text-gray-500">Comma-separated keywords. Events containing these words will be skipped entirely.</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cancelKeywords">Cancellation Keywords</Label>
              <Input
                id="cancelKeywords"
                value={cancelKeywords}
                onChange={(e) => setCancelKeywords(e.target.value)}
                placeholder="CANCEL,DID NOT COME"
                data-testid="input-cancel-keywords"
              />
              <p className="text-xs text-gray-500">Comma-separated keywords. Events containing these words will be marked as cancelled.</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="autoImport"
                checked={autoImport}
                onCheckedChange={setAutoImport}
                data-testid="switch-auto-import"
              />
              <Label htmlFor="autoImport">Auto-import new events (Coming soon)</Label>
            </div>
            
            <Button 
              onClick={() => saveSettingsMutation.mutate()} 
              disabled={saveSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveSettingsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync Calendar Events
          </CardTitle>
          <CardDescription>
            Preview and import photoshoot bookings from your selected calendars.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => fetchEventsMutation.mutate()} 
            disabled={fetchEventsMutation.isPending || selectedCalendarIds.length === 0}
            variant="outline"
            data-testid="button-fetch-events"
          >
            {fetchEventsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Fetch Events (Last 30 days + Next 30 days)
              </>
            )}
          </Button>
          
          {previewEvents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Valid Events ({previewEvents.length})</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllEvents} data-testid="button-select-all">
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllEvents} data-testid="button-deselect-all">
                    Deselect All
                  </Button>
                </div>
              </div>
              
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                {previewEvents.map(event => (
                  <div 
                    key={event.id} 
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selectedEventsToImport.includes(event.id)}
                      onCheckedChange={() => toggleEventSelection(event.id)}
                      data-testid={`checkbox-event-${event.id}`}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(event.startTime), 'PPP p')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={() => importEventsMutation.mutate()} 
                disabled={importEventsMutation.isPending || selectedEventsToImport.length === 0}
                data-testid="button-import-events"
              >
                {importEventsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import {selectedEventsToImport.length} Events as Projects
                  </>
                )}
              </Button>
            </div>
          )}
          
          {cancelledEvents.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-red-600">Cancelled Events ({cancelledEvents.length})</h4>
              <div className="max-h-40 overflow-y-auto border border-red-200 rounded-lg bg-red-50">
                {cancelledEvents.map(event => (
                  <div key={event.id} className="p-3 border-b last:border-b-0">
                    <p className="font-medium text-red-700">{event.title}</p>
                    <p className="text-sm text-red-500">
                      {format(new Date(event.startTime), 'PPP p')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
