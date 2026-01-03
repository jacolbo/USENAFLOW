import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarEvent } from "@shared/schema";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Clock, AlertTriangle, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DueDateCalendarProps {
  events: CalendarEvent[];
  isLoading?: boolean;
  onLinkSentToggle?: (eventId: string, startTime: string, linkSent: boolean) => void;
  onDeliveryToggle?: (eventId: string, startTime: string, delivered: boolean) => void;
}

interface DayProjectsDialogProps {
  date: Date;
  projects: CalendarEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinkSentToggle?: (eventId: string, startTime: string, linkSent: boolean) => void;
  onDeliveryToggle?: (eventId: string, startTime: string, delivered: boolean) => void;
}

function DayProjectsDialog({ date, projects, open, onOpenChange, onLinkSentToggle, onDeliveryToggle }: DayProjectsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Due on {format(date, "EEEE, MMMM d, yyyy")}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 pr-4">
            {projects.map((project) => {
              const canMarkStatus = project.status === "done";
              
              return (
                <div
                  key={`${project.id}-${project.startTime}`}
                  className="flex items-start gap-3 rounded-lg border p-3"
                  data-testid={`dialog-project-${project.id}`}
                >
                  <div className="mt-0.5">
                    {project.isDelivered ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : project.isOverdue ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{project.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Shot: {format(parseISO(project.startTime), "MMM d, yyyy")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {project.isLinkSent && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          <Link2 className="h-3 w-3 mr-1" />
                          Link Sent
                        </Badge>
                      )}
                      {project.isDelivered ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Delivered
                        </Badge>
                      ) : project.isOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : project.status === "upcoming" ? (
                        <Badge variant="outline">Upcoming</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </div>
                    
                    {canMarkStatus && (onLinkSentToggle || onDeliveryToggle) && (
                      <div className="mt-3 space-y-2 pt-2 border-t">
                        {onLinkSentToggle && (
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`link-sent-${project.id}`}
                              checked={project.isLinkSent}
                              onCheckedChange={(checked) => 
                                onLinkSentToggle(project.id, project.startTime, checked)
                              }
                              data-testid={`dialog-switch-link-sent-${project.id}`}
                            />
                            <Label 
                              htmlFor={`link-sent-${project.id}`}
                              className="text-sm cursor-pointer"
                            >
                              Link sent to client
                            </Label>
                          </div>
                        )}
                        {onDeliveryToggle && (
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`deliver-${project.id}`}
                              checked={project.isDelivered}
                              onCheckedChange={(checked) => 
                                onDeliveryToggle(project.id, project.startTime, checked)
                              }
                              data-testid={`dialog-switch-delivered-${project.id}`}
                            />
                            <Label 
                              htmlFor={`deliver-${project.id}`}
                              className="text-sm cursor-pointer"
                            >
                              Mark as delivered
                            </Label>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!canMarkStatus && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Shoot not yet completed
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function DueDateCalendar({ events, isLoading, onLinkSentToggle, onDeliveryToggle }: DueDateCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectsByDueDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      if (event.deliveryDueDate) {
        const dateKey = event.deliveryDueDate;
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(event);
      }
    });
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getProjectsForDay = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    return projectsByDueDate.get(dateKey) || [];
  };

  const getDayStats = (projects: CalendarEvent[]) => {
    const delivered = projects.filter((p) => p.isDelivered).length;
    const overdue = projects.filter((p) => p.isOverdue && !p.isDelivered).length;
    const pending = projects.length - delivered - overdue;
    return { delivered, overdue, pending, total: projects.length };
  };

  const handleDayClick = (date: Date) => {
    const projects = getProjectsForDay(date);
    if (projects.length > 0) {
      setSelectedDay(date);
      setDialogOpen(true);
    }
  };

  const selectedDayProjects = selectedDay ? getProjectsForDay(selectedDay) : [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Due Date Calendar
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48 mx-auto" />
            <div className="grid grid-cols-7 gap-1">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="due-date-calendar">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Due Date Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center" data-testid="text-current-month">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const projects = getProjectsForDay(day);
              const stats = getDayStats(projects);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isDayToday = isToday(day);

              return (
                <Tooltip key={day.toISOString()}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleDayClick(day)}
                      disabled={stats.total === 0}
                      className={cn(
                        "min-h-[80px] p-1 rounded-md border transition-colors text-left flex flex-col",
                        isCurrentMonth
                          ? "bg-background"
                          : "bg-muted/30 text-muted-foreground",
                        isDayToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                        stats.total > 0 && "cursor-pointer hover-elevate",
                        stats.total === 0 && "cursor-default"
                      )}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium mb-1",
                          isDayToday && "text-primary font-bold"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {stats.total > 0 && (
                        <div className="flex flex-col gap-0.5 flex-1">
                          {stats.overdue > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-xs text-red-600 dark:text-red-400">
                                {stats.overdue}
                              </span>
                            </div>
                          )}
                          {stats.pending > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                {stats.pending}
                              </span>
                            </div>
                          )}
                          {stats.delivered > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                {stats.delivered}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>
                  {stats.total > 0 && (
                    <TooltipContent side="top">
                      <div className="text-center">
                        <p className="font-medium">{format(day, "EEE, MMM d")}</p>
                        <p className="text-xs">
                          {stats.total} {stats.total === 1 ? "project" : "projects"} due
                        </p>
                        {stats.overdue > 0 && (
                          <p className="text-xs text-red-400">{stats.overdue} overdue</p>
                        )}
                        {stats.delivered > 0 && (
                          <p className="text-xs text-emerald-400">{stats.delivered} delivered</p>
                        )}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Overdue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Delivered</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <DayProjectsDialog
          date={selectedDay}
          projects={selectedDayProjects}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onLinkSentToggle={onLinkSentToggle}
          onDeliveryToggle={onDeliveryToggle}
        />
      )}
    </>
  );
}
