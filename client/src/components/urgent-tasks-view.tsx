import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, Project } from "@shared/schema";
import { User } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, AlertTriangle, User as UserIcon, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UrgentTasksViewProps {
  user: User;
}

export function UrgentTasksView({ user }: UrgentTasksViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: myTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks/assigned", user.name],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/assigned/${encodeURIComponent(user.name)}`);
      return response.json();
    },
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}`, {
        status: "completed"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Task Completed",
        description: "Great work! Task marked as completed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark task as completed.",
        variant: "destructive",
      });
    },
  });

  const urgentTasks = myTasks.filter(task => task.status === "pending");

  if (urgentTasks.length === 0) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            All Caught Up!
          </CardTitle>
          <CardDescription className="text-green-600">
            No urgent tasks assigned to you right now.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getProjectName = (projectId: string) => {
    const project = allProjects.find(p => p.id === projectId);
    return project?.clientName || "Unknown Project";
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <Card className="bg-red-50 border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-5 w-5" />
          Urgent Tasks ({urgentTasks.length})
        </CardTitle>
        <CardDescription className="text-red-600">
          Tasks assigned to you that need attention
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {urgentTasks.map((task) => (
          <div
            key={task.id}
            className={`p-4 rounded-lg border-2 ${
              isOverdue(task.dueDate)
                ? 'bg-red-100 border-red-300'
                : 'bg-white border-red-200'
            }`}
            data-testid={`urgent-task-${task.id}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-red-600" />
                  <h3 className="font-semibold text-red-900">{task.title}</h3>
                  {isOverdue(task.dueDate) && (
                    <Badge variant="destructive" className="text-xs">
                      OVERDUE
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-red-700 mb-2">
                  <strong>Project:</strong> {getProjectName(task.projectId)}
                </p>
                
                {task.note && (
                  <p className="text-sm text-red-600 mb-2 italic">
                    "{task.note}"
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-red-600">
                  <span className="flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    Requested by: {task.assignedBy}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due: {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              <Button
                size="sm"
                onClick={() => completeTaskMutation.mutate(task.id)}
                disabled={completeTaskMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white ml-4"
                data-testid={`button-complete-task-${task.id}`}
              >
                {completeTaskMutation.isPending ? "Completing..." : "Mark Complete"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}