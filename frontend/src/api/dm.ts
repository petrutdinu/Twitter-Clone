import { api } from './client';
import { DirectMessage } from '../types';

export interface MessageHistoryResponse {
  success: boolean;
  messages: DirectMessage[];
  nextCursor?: string;
  otherUser: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface ConversationsResponse {
  success: boolean;
  conversations: {
    id: string;
    text: string;
    created_at: string;
    sender_id: string;
    sender_username: string;
    sender_display_name?: string;
    sender_avatar_url?: string;
    receiver_id: string;
    receiver_username: string;
    receiver_display_name?: string;
    receiver_avatar_url?: string;
  }[];
}

export interface SendMessageResponse {
  success: boolean;
  message: DirectMessage;
}

export const dmApi = {
  sendMessage: async (toUserId: string, text: string, gifUrl?: string, imageFile?: File): Promise<SendMessageResponse> => {
    if (imageFile) {
      const form = new FormData();
      form.append('toUserId', toUserId);
      form.append('text', text);
      if (gifUrl) form.append('gifUrl', gifUrl);
      form.append('image', imageFile);
      const response = await api.post('/dm/send', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      return response.data;
    } else {
      const response = await api.post('/dm/send', { toUserId, text, gifUrl });
      return response.data;
    }
  },

  getMessageHistory: async (
    withUserId: string, 
    limit = 20, 
    cursor?: string
  ): Promise<MessageHistoryResponse> => {
    const params = new URLSearchParams();
    params.append('with', withUserId);
    params.append('limit', limit.toString());
    if (cursor) params.append('cursor', cursor);
    
    const response = await api.get(`/dm/history?${params.toString()}`);
    return response.data;
  },

  getConversations: async (): Promise<ConversationsResponse> => {
    const response = await api.get('/dm/conversations');
    return response.data;
  },

  markAsRead: async (fromUserId: string): Promise<{ success: boolean }> => {
    const response = await api.post('/dm/mark-read', { fromUserId });
    return response.data;
  },

  deleteMessage: async (messageId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/dm/${messageId}`);
    return response.data;
  },

  getUnreadCount: async (): Promise<{ success: boolean; unreadCount: number }> => {
    const response = await api.get('/dm/unread');
    return response.data;
  },

  getUnreadCountPerConversation: async (): Promise<{ success: boolean; unreadPerConversation: Record<string, number> }> => {
    const response = await api.get('/dm/unread-per-conversation');
    return response.data;
  },
};
