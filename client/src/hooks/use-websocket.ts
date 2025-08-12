import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { WebSocketMessage, Notification } from '@shared/schema';
import notificationSound from '@assets/Default iPhone Notification Sound (Apple Sound) - Sound Effect for Editing_1755004252731.mp3';

export function useWebSocket(user?: { id: string; username: string } | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio for notifications
    audioRef.current = new Audio(notificationSound);
    audioRef.current.volume = 0.5; // Set volume to 50%

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connect = () => {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Send user identification if user is logged in
        if (user && wsRef.current) {
          const identifyMessage: WebSocketMessage = {
            type: 'USER_IDENTIFY',
            data: {
              userId: user.id,
              username: user.username
            },
            timestamp: new Date()
          };
          wsRef.current.send(JSON.stringify(identifyMessage));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'NOTIFICATION':
              const notification = message.data as Notification;
              console.log('Received notification:', notification);
              
              // Add notification to the list
              setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
              
              // Play notification sound for important notifications (not welcome message)
              if (notification.title !== 'Live Sync Connected' && audioRef.current) {
                audioRef.current.currentTime = 0; // Reset to beginning
                audioRef.current.play().catch(error => {
                  console.log('Could not play notification sound:', error);
                });
              }
              
              // Show browser notification if permission granted
              if (Notification.permission === 'granted' && notification.title !== 'Live Sync Connected') {
                new Notification(notification.title, {
                  body: notification.message,
                  icon: '/favicon.ico'
                });
              }
              break;

            case 'PROJECT_UPDATE':
              console.log('Project updated:', message.data);
              // Invalidate projects query to refresh data
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
              break;

            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
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