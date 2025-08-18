import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@shared/schema';
import notificationSound from '@assets/Default iPhone Notification Sound (Apple Sound) - Sound Effect for Editing_1755004252731.mp3';

export function useSSE(user?: { id: string; username: string } | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio for notifications
    audioRef.current = new Audio(notificationSound);
    audioRef.current.volume = 0.5;

    if (!user) return;

    // Create SSE connection with user identification
    const url = `/api/events?userId=${encodeURIComponent(user.id)}&username=${encodeURIComponent(user.username)}`;
    eventSourceRef.current = new EventSource(url);

    eventSourceRef.current.onopen = () => {
      console.log('SSE connected');
      setIsConnected(true);
    };

    eventSourceRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'notification':
            const notification = data.payload as Notification;
            console.log('Received notification:', notification);
            setNotifications(prev => [notification, ...prev]);
            
            // Play notification sound
            if (audioRef.current) {
              audioRef.current.play().catch(console.error);
            }
            
            // Show browser notification if permission granted
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico'
              });
            }
            break;

          case 'project_update':
            console.log('Project updated via SSE');
            queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
            break;

          case 'trade_completed':
            console.log('Trade completed via SSE');
            queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
            queryClient.invalidateQueries({ queryKey: ['/api/trade-offers'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/trade-offers'] });
            break;

          case 'connected':
            console.log('SSE connection confirmed');
            break;

          default:
            // Handle rollover completion
          if (data.type === 'rollover_complete') {
            console.log(`🔄 Rollover completed: ${data.payload?.message}`);
            // Refresh projects after rollover
            queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
            // Show notification if there were rolled over projects
            if (data.payload?.rolledOverCount > 0 && audioRef.current) {
              audioRef.current.play().catch(console.error);
            }
            break;
          }
          
          console.log('Unknown SSE message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSourceRef.current.onerror = (error) => {
      console.error('SSE error:', error);
      setIsConnected(false);
      
      // EventSource will automatically reconnect
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [queryClient, user]);

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return {
    isConnected,
    notifications,
    markNotificationAsRead,
    clearAllNotifications,
    unreadCount: notifications.filter(n => !n.read).length
  };
}