import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Forecast } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isWeekend, isSameDay, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarDays, TrendingUp, Gauge, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CalendarHeatmapProps {
  forecast: Forecast | null;
  deadlineDate: string | null;
  capacityPerDay: number | null;
  isLoading: boolean;
}

function ForecastSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[...Array(21)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyForecast() {
  return (
    <Card data-testid="empty-state-forecast">
      <CardContent className="py-12 text-center">
        <div className="mb-4 inline-flex rounded-full bg-muted p-4">
          <Target className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium" data-testid="text-forecast-empty-title">Set a Deadline</h3>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="text-forecast-empty-description">
          Select a deadline date in the filters to see your workload forecast.
        </p>
      </CardContent>
    </Card>
  );
}

export function CalendarHeatmap({
  forecast,
  deadlineDate,
  capacityPerDay,
  isLoading,
}: CalendarHeatmapProps) {
  const today = startOfToday();

  if (isLoading) {
    return <ForecastSkeleton />;
  }

  if (!forecast || !deadlineDate) {
    return <EmptyForecast />;
  }

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-muted/30";
    if (count === 1) return "bg-emerald-200 dark:bg-emerald-900/40";
    if (count === 2) return "bg-emerald-300 dark:bg-emerald-800/50";
    if (count === 3) return "bg-amber-300 dark:bg-amber-700/50";
    if (count === 4) return "bg-amber-400 dark:bg-amber-600/60";
    return "bg-red-400 dark:bg-red-600/60";
  };

  const feasibilityColors = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  const feasibilityText = {
    green: "On Track",
    amber: "At Risk",
    red: "Behind Schedule",
  };

  const feasibilityDescription = {
    green: "You have enough capacity to meet the deadline.",
    amber: "You may need to increase daily output to meet the deadline.",
    red: "Current capacity is insufficient to meet the deadline.",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Delivery Calendar</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-0.5">
              <div className="h-3 w-3 rounded-sm bg-muted/30" />
              <div className="h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/40" />
              <div className="h-3 w-3 rounded-sm bg-emerald-300 dark:bg-emerald-800/50" />
              <div className="h-3 w-3 rounded-sm bg-amber-300 dark:bg-amber-700/50" />
              <div className="h-3 w-3 rounded-sm bg-red-400 dark:bg-red-600/60" />
            </div>
            <span>More</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="flex flex-wrap gap-1.5">
              {forecast.dailyWorkload.map((day) => {
                const date = parseISO(day.date);
                const isToday = isSameDay(date, today);
                const isDeadline =
                  deadlineDate && isSameDay(date, parseISO(deadlineDate));

                return (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "h-10 w-10 rounded-md flex items-center justify-center font-mono text-xs transition-all",
                          day.isWorkday
                            ? getIntensityClass(day.count)
                            : "bg-muted/10 text-muted-foreground/50",
                          isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                          isDeadline && "ring-2 ring-red-500 ring-offset-2 ring-offset-background",
                          day.isHoliday && "bg-stripes-holiday",
                          "hover:scale-110"
                        )}
                        data-testid={`heatmap-${day.date}`}
                      >
                        {day.isWorkday && day.count > 0 ? day.count : ""}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <p className="font-medium">
                          {format(date, "EEE, dd MMM")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {day.isHoliday
                            ? "Holiday"
                            : !day.isWorkday
                            ? "Weekend"
                            : day.count === 0
                            ? "No deliveries"
                            : `${day.count} ${
                                day.count === 1 ? "delivery" : "deliveries"
                              } due`}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Deadline Forecast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Due by Deadline
              </p>
              <p
                className="mt-1 font-mono text-3xl font-bold"
                data-testid="forecast-due-by-deadline"
              >
                {forecast.projectsDueByDeadline}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                At Risk
              </p>
              <p
                className="mt-1 font-mono text-3xl font-bold text-orange-600 dark:text-orange-400"
                data-testid="forecast-at-risk"
              >
                {forecast.projectsAtRisk}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Working days remaining</span>
              <span
                className="font-mono font-medium"
                data-testid="forecast-remaining-days"
              >
                {forecast.remainingWorkingDays}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Required daily output</span>
              <span
                className="font-mono font-medium"
                data-testid="forecast-throughput"
              >
                {forecast.requiredThroughput.toFixed(1)} projects/day
              </span>
            </div>
            {capacityPerDay && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your capacity</span>
                <span className="font-mono font-medium">
                  {capacityPerDay} projects/day
                </span>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Gauge className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "text-white",
                      feasibilityColors[forecast.feasibilityStatus]
                    )}
                    data-testid="forecast-status-badge"
                  >
                    {feasibilityText[forecast.feasibilityStatus]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {feasibilityDescription[forecast.feasibilityStatus]}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
