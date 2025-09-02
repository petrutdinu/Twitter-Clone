import { api } from './client';

export interface Notification {
  id: string;
  type: 'LIKE' | 'RETWEET' | 'FOLLOW' | 'MENTION' | 'REPLY' | 'POLL_VOTE';
  isRead: boolean;
  createdAt: string;
  sourceUser: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  sourceTweet?: {
    id: string;
    text: string;
  };
}

export interface NotificationsResponse {
  success: boolean;
  notifications: Notification[];
  nextCursor?: string;
}

export interface UnreadCountResponse {
  success: boolean;
  unreadCount: number;
}

export const notificationsApi = {
  getNotifications: async (cursor?: string, limit = 20): Promise<NotificationsResponse> => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());
    
    const response = await api.get(`/notifications?${params.toString()}`);
    return response.data;
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await api.get('/notifications/unread');
    return response.data;
  },

  markAsRead: async (notificationId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async (notificationIds?: string[]): Promise<{ success: boolean; message: string }> => {
    const response = await api.put('/notifications/read', { notificationIds });
    return response.data;
  },
};
