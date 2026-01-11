import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge, RiskDot } from "./risk-badge";
import { Calendar, RefreshCw, Camera, AlertTriangle, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UpcomingShoot {
  id: string;
  clientName: string;
  shootDate: string;
  daysUntilShoot: number;
  riskLevel: string;
  status: string;
  assignedTo?: string;
}

interface AtRiskProject {
  id: string;
  clientName: string;
  dueDate: string;
  riskLevel: string;
  status: string;
  riskDetails: {
    level: string;
    message: string;
    factors: {
      daysUntilDelivery: number;
      rolloverCount: number;
      isUnassigned: boolean;
      photosRemaining: number;
    };
  };
}

export function ShootTrackerWidget() {
  const { toast } = useToast();
  
  const { data: upcomingShoots, isLoading: shootsLoading } = useQuery<UpcomingShoot[]>({
    queryKey: ["/api/shoots/upcoming"],
    refetchInterval: 60000,
  });
  
  const { data: atRiskProjects, isLoading: riskLoading } = useQuery<AtRiskProject[]>({
    queryKey: ["/api/projects/at-risk"],
    refetchInterval: 60000,
  });
  
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/sync-calendar", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Calendar Synced",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shoots/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/at-risk"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendar",
        variant: "destructive",
      });
    },
  });
  
  const formatShootDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-500" />
              Upcoming Shoots
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="h-8"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {shootsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !upcomingShoots?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming shoots</p>
              <p className="text-xs mt-1">Sync your calendar to see scheduled shoots</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingShoots.slice(0, 5).map((shoot) => (
                <div 
                  key={shoot.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <Badge 
                      variant={shoot.daysUntilShoot === 0 ? "destructive" : shoot.daysUntilShoot <= 2 ? "default" : "secondary"}
                      className="text-xs font-medium"
                    >
                      {formatShootDate(shoot.shootDate)}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{shoot.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {shoot.assignedTo ? `Assigned to ${shoot.assignedTo}` : "Unassigned"}
                    </p>
                  </div>
                  <RiskDot level={shoot.riskLevel} />
                </div>
              ))}
              {upcomingShoots.length > 5 && (
                <Button variant="ghost" className="w-full text-sm text-muted-foreground">
                  View all {upcomingShoots.length} shoots
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            At-Risk Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {riskLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !atRiskProjects?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="h-10 w-10 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
              </div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">All Projects On Track</p>
              <p className="text-xs mt-1">No projects at risk right now</p>
            </div>
          ) : (
            <div className="space-y-2">
              {atRiskProjects.slice(0, 5).map((project) => (
                <div 
                  key={project.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <RiskDot level={project.riskLevel} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{project.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.riskDetails?.message || `Due ${formatDistanceToNow(new Date(project.dueDate), { addSuffix: true })}`}
                    </p>
                  </div>
                  <RiskBadge level={project.riskLevel} size="sm" showIcon={false} />
                </div>
              ))}
              {atRiskProjects.length > 5 && (
                <Button variant="ghost" className="w-full text-sm text-muted-foreground">
                  View all {atRiskProjects.length} at-risk projects
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
