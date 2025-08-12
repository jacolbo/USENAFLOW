import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { WebSocketMessage, Notification } from '@shared/schema';
import notificationSound from '@assets/Default iPhone Notification Sound (Apple Sound) - Sound Effect for Editing_1755004252731.mp3';

export function useWebSocket(user?: { id: string; username: string } | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    // Initialize audio for notifications
    audioRef.current = new Audio(notificationSound);
    audioRef.current.volume = 0.5;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connect = () => {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        return; // Don't create multiple connections
      }

      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          reconnectAttempts.current = 0;
          
          // Send user identification after connection is established
          if (user) {
            setTimeout(() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
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
            }, 200);
          }
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            switch (message.type) {
              case 'NOTIFICATION':
                const notification = message.data as Notification;
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

              case 'PROJECT_UPDATE':
                console.log('Project updated:', message.data);
                queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                break;

              case 'SYNC_REQUEST':
                // Simple connection confirmation - no action needed
                break;

              default:
                console.log('Unknown WebSocket message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        wsRef.current.onclose = (event) => {
          console.log('WebSocket disconnected', event.code);
          setIsConnected(false);
          
          // Don't reconnect if it's a normal closure (1000) from component unmounting
          if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
            setTimeout(() => {
              if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                connect();
              }
            }, delay);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
      }
    };

    connect();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
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