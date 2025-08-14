import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, User, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { TeamTask } from "@shared/schema";
import { User as UserType } from "@/lib/types";

interface LiveTaskLogProps {
  user: UserType;
}

interface TaskLogEntry {
  id: string;
  type: 'task_created' | 'task_completed';
  task: TeamTask;
  timestamp: Date;
}

export function LiveTaskLog({ user }: LiveTaskLogProps) {
  const [taskLog, setTaskLog] = useState<TaskLogEntry[]>([]);

  // Initial load of recent tasks
  const tasksQuery = useQuery({
    queryKey: ["/api/team-tasks"],
    queryFn: async () => {
      const response = await fetch("/api/team-tasks");
      return response.json();
    },
  });

  // Use SSE to listen for real-time task updates
  const { isConnected } = useSSE(user ? { id: user.value, username: user.name } : null);

  useEffect(() => {
    if (tasksQuery.data) {
      // Initialize log with recent completed tasks (last 24 hours)
      const recentTasks = tasksQuery.data
        .filter((task: TeamTask) => {
          const taskDate = new Date(task.createdAt);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return taskDate > oneDayAgo;
        })
        .sort((a: TeamTask, b: TeamTask) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 10) // Limit to 10 most recent
        .map((task: TeamTask): TaskLogEntry => ({
          id: `initial_${task.id}`,
          type: task.status === 'completed' ? 'task_completed' : 'task_created',
          task,
          timestamp: new Date(task.status === 'completed' && task.completedAt 
            ? task.completedAt 
            : task.createdAt
          ),
        }));

      setTaskLog(recentTasks);
    }
  }, [tasksQuery.data]);

  useEffect(() => {
    // Listen for SSE task events
    const handleSSEMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'task_created' && data.payload) {
          const newEntry: TaskLogEntry = {
            id: `created_${data.payload.id}_${Date.now()}`,
            type: 'task_created',
            task: data.payload,
            timestamp: new Date(),
          };
          
          setTaskLog(prev => [newEntry, ...prev.slice(0, 19)]); // Keep last 20 entries
        } else if (data.type === 'task_updated' && data.payload?.status === 'completed') {
          const newEntry: TaskLogEntry = {
            id: `completed_${data.payload.id}_${Date.now()}`,
            type: 'task_completed',
            task: data.payload,
            timestamp: new Date(),
          };
          
          setTaskLog(prev => [newEntry, ...prev.slice(0, 19)]); // Keep last 20 entries
        }
      } catch (error) {
        // Ignore invalid JSON messages
      }
    };

    // Add event listener for SSE messages
    const eventSource = new EventSource('/api/sse');
    eventSource.addEventListener('message', handleSSEMessage);

    return () => {
      eventSource.removeEventListener('message', handleSSEMessage);
      eventSource.close();
    };
  }, []);

  const getLogIcon = (entry: TaskLogEntry) => {
    if (entry.type === 'task_completed') {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (entry.task.priority === 'urgent') {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    return <Clock className="h-4 w-4 text-blue-600" />;
  };

  const getLogBadge = (entry: TaskLogEntry) => {
    if (entry.type === 'task_completed') {
      return <Badge className="bg-green-500 text-white text-xs">Completed</Badge>;
    }
    if (entry.task.priority === 'urgent') {
      return <Badge className="bg-red-500 text-white text-xs">Urgent</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Created</Badge>;
  };

  const getLogMessage = (entry: TaskLogEntry) => {
    if (entry.type === 'task_completed') {
      return (
        <span>
          <span className="font-medium">{entry.task.assignedTo}</span> completed task 
          "<span className="font-medium">{entry.task.title}</span>" for{" "}
          <span className="font-medium">{entry.task.clientName}</span>
        </span>
      );
    }
    
    return (
      <span>
        <span className="font-medium">{entry.task.assignedBy}</span> assigned task 
        "<span className="font-medium">{entry.task.title}</span>" to{" "}
        <span className="font-medium">{entry.task.assignedTo}</span> for{" "}
        <span className="font-medium">{entry.task.clientName}</span>
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-blue-600" />
          Live Task Activity
          <div className="flex items-center gap-1 ml-auto">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          {taskLog.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent task activity
            </div>
          ) : (
            <div className="space-y-3">
              {taskLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  data-testid={`task-log-entry-${entry.task.id}`}
                >
                  {getLogIcon(entry)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getLogBadge(entry)}
                      <span className="text-xs text-gray-500">
                        {format(entry.timestamp, "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {getLogMessage(entry)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}