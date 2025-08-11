import { useState } from "react";
import { Bell, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Notification } from "@shared/schema";
import { User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NotificationsPanelProps {
  user: User;
}

export function NotificationsPanel({ user }: NotificationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only show notifications for Admin and Sales
  if (!['Admin', 'Sales'].includes(user.role)) {
    return null;
  }

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: ['Admin', 'Sales'].includes(user.role),
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("PATCH", `/api/notifications/${notificationId}`, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/notifications/mark-all-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Success",
        description: "All notifications marked as read.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read.",
        variant: "destructive",
      });
    },
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  className="text-xs h-6 px-2"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="text-center text-sm text-gray-500 py-4">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-4">
                No notifications yet
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      notification.isRead 
                        ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700" 
                        : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          {formatTimeAgo(notification.createdAt.toString())}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}