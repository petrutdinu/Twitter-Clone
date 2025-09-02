import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { dmApi } from '../api/dm';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAuthStore } from '../store/auth';

export const useMessageNotifications = () => {
  const { user } = useAuthStore();
  const { socket } = useWebSocketContext();
  const queryClient = useQueryClient();

  // Query for unread message count
  const { data: unreadData, isLoading: isLoadingUnread } = useQuery({
    queryKey: ['messages', 'unread'],
    queryFn: dmApi.getUnreadCount,
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds as fallback
  });

  // Listen for real-time message updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: any) => {
      console.log('New message received:', message);
      
      // Only update unread count if the current user is the receiver
      if (message.receiverId === user?.id) {
        queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] });
        queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
      }
    };

    const handleMessageRead = () => {
      // When messages are marked as read, update the unread count
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
    };

    socket.on('dm', handleNewMessage);
    socket.on('messages_read', handleMessageRead);

    return () => {
      socket.off('dm', handleNewMessage);
      socket.off('messages_read', handleMessageRead);
    };
  }, [socket, queryClient, user?.id]);

  return {
    unreadCount: unreadData?.unreadCount || 0,
    isLoadingUnread,
    refreshUnreadCount: () => queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] }),
  };
};
