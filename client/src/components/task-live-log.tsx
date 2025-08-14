import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle, Clock, User as UserIcon, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TaskActivity {
  id: string;
  type: "task_assigned" | "task_completed" | "task_created";
  title: string;
  message: string;
  timestamp: Date;
  projectId?: string;
  assignedTo?: string;
  completedBy?: string;
}

interface TaskLiveLogProps {
  activities: TaskActivity[];
}

export function TaskLiveLog({ activities }: TaskLiveLogProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "task_assigned":
        return <UserIcon className="h-4 w-4 text-blue-600" />;
      case "task_completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "task_created":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "task_assigned":
        return "bg-blue-50 border-blue-200";
      case "task_completed":
        return "bg-green-50 border-green-200";
      case "task_created":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getActivityBadgeColor = (type: string) => {
    switch (type) {
      case "task_assigned":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "task_completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "task_created":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Sort activities by timestamp (most recent first)
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Live Task Activity
        </CardTitle>
        <p className="text-sm text-gray-600">
          Real-time updates on task assignments and completions across all projects
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-96 overflow-y-auto">
          <div className="space-y-4">
            {sortedActivities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No task activity yet</p>
                <p className="text-sm">Task assignments and completions will appear here</p>
              </div>
            ) : (
              sortedActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`p-4 rounded-lg border ${getActivityColor(activity.type)}`}
                  data-testid={`task-activity-${activity.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getActivityIcon(activity.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getActivityBadgeColor(activity.type)}`}
                        >
                          {activity.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {activity.title}
                      </p>
                      
                      <p className="text-sm text-gray-700">
                        {activity.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}