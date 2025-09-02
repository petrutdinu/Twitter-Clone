import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationsApi } from '../api/notifications';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAuthStore } from '../store/auth';

export const useNotifications = () => {
  const { user } = useAuthStore();
  const { socket } = useWebSocketContext();
  const queryClient = useQueryClient();

  // Query for unread notification count
  const { data: unreadData, isLoading: isLoadingUnread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.getUnreadCount,
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds as fallback
  });

  // Query for notifications list
  const { data: notificationsData, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getNotifications(),
    enabled: !!user,
  });

  // Listen for real-time notification updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: any) => {
      console.log('New notification received:', notification);
      
      // Invalidate and refetch both unread count and notifications list
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const handleNotificationRead = () => {
      // When a notification is marked as read, update the unread count
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification', handleNewNotification);
    socket.on('notificationRead', handleNotificationRead);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notificationRead', handleNotificationRead);
    };
  }, [socket, queryClient]);

  return {
    unreadCount: unreadData?.unreadCount || 0,
    notifications: notificationsData?.notifications || [],
    isLoadingUnread,
    isLoadingNotifications,
    refreshUnreadCount: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
    refreshNotifications: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  };
};
