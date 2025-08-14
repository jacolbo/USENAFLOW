import { useQuery } from "@tanstack/react-query";
import { Task, Project } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface TaskStatusIndicatorProps {
  projectId: string;
  clientName: string;
}

export function TaskStatusIndicator({ projectId, clientName }: TaskStatusIndicatorProps) {
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      return response.json();
    },
  });

  const pendingTasks = tasks.filter(task => task.status === "pending");
  const completedTasks = tasks.filter(task => task.status === "completed");

  if (tasks.length === 0) {
    return null;
  }

  // Show red dot if there are pending tasks, green if all completed
  const hasUrgentTasks = pendingTasks.length > 0;

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div 
          className={`w-3 h-3 rounded-full ${
            hasUrgentTasks ? 'bg-red-500 animate-pulse' : 'bg-green-500'
          }`}
          title={`${pendingTasks.length} pending, ${completedTasks.length} completed`}
        />
        {hasUrgentTasks && (
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-600 rounded-full animate-ping" />
        )}
      </div>
      <Badge 
        variant="secondary" 
        className={`text-xs ${
          hasUrgentTasks 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : 'bg-green-100 text-green-800 border-green-200'
        }`}
      >
        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
      </Badge>
    </div>
  );
}