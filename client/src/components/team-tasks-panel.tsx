import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock, AlertTriangle, User, Calendar } from "lucide-react";
import { format, isAfter } from "date-fns";
import { TeamTask } from "@shared/schema";
import { User as UserType } from "@/lib/types";

interface TeamTasksPanelProps {
  user: UserType;
  showMyTasks?: boolean;
}

export function TeamTasksPanel({ user, showMyTasks = false }: TeamTasksPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for tasks assigned to the user or created by the user
  const tasksQuery = useQuery({
    queryKey: showMyTasks 
      ? ["/api/team-tasks/assigned", user.name] 
      : ["/api/team-tasks/created", user.name],
    queryFn: async () => {
      const endpoint = showMyTasks 
        ? `/api/team-tasks/assigned/${encodeURIComponent(user.name)}`
        : `/api/team-tasks/created/${encodeURIComponent(user.name)}`;
      const response = await fetch(endpoint);
      return response.json();
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("PATCH", `/api/team-tasks/${taskId}`, {
        status: "completed",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-tasks"] });
      toast({
        title: "Task completed",
        description: "Task has been marked as completed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const tasks: TeamTask[] = tasksQuery.data || [];
  
  // Filter tasks based on view type
  const filteredTasks = showMyTasks 
    ? tasks.filter(t => t.status === 'pending') // Only show pending tasks assigned to user
    : tasks; // Show all tasks created by user

  const getTaskBadge = (task: TeamTask) => {
    if (task.status === 'completed') {
      return <Badge className="bg-green-500 text-white">Completed</Badge>;
    }
    
    if (task.priority === 'urgent') {
      return <Badge className="bg-red-500 text-white">Urgent</Badge>;
    }
    
    // Check if overdue
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    if (isAfter(now, dueDate)) {
      return <Badge className="bg-orange-500 text-white">Overdue</Badge>;
    }
    
    return <Badge variant="outline">Pending</Badge>;
  };

  const getTaskIcon = (task: TeamTask) => {
    if (task.status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    
    if (task.priority === 'urgent') {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    
    return <Clock className="h-4 w-4 text-blue-600" />;
  };

  if (tasksQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {showMyTasks ? "My Tasks" : "Tasks I Created"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-500">Loading tasks...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-blue-600" />
          {showMyTasks ? "My Tasks" : "Tasks I Created"}
          <span className="text-sm font-normal text-gray-500">
            ({filteredTasks.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {showMyTasks 
              ? "No tasks currently assigned to you" 
              : "No tasks created yet"
            }
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                data-testid={`task-card-${task.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getTaskIcon(task)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {task.title}
                        </h4>
                        {getTaskBadge(task)}
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">{task.clientName}</span>
                        {showMyTasks ? (
                          <span> • Assigned by {task.assignedBy}</span>
                        ) : (
                          <span> • Assigned to {task.assignedTo}</span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {format(new Date(task.dueDate), "MMM d, h:mm a")}
                        </div>
                        <div>
                          Created: {format(new Date(task.createdAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {showMyTasks && task.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => completeTaskMutation.mutate(task.id)}
                      disabled={completeTaskMutation.isPending}
                      className="ml-4 bg-green-600 hover:bg-green-700"
                      data-testid={`button-complete-task-${task.id}`}
                    >
                      {completeTaskMutation.isPending ? "..." : "Complete"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}