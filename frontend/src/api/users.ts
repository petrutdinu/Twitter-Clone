import api from './client';
import { User, PaginatedResponse } from '../types';

export const userApi = {
  getProfile: async (username: string): Promise<{ user: User }> => {
    const response = await api.get(`/users/${username}`);
    return response.data;
  },

  getUserTweets: async (username: string, limit = 20, cursor?: string): Promise<PaginatedResponse<any>> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    
    const response = await api.get(`/users/${username}/tweets?${params}`);
    return {
      success: response.data.success,
      data: response.data.tweets,
      nextCursor: response.data.nextCursor,
    };
  },

  getUserBookmarks: async (username: string, limit = 20, cursor?: string): Promise<PaginatedResponse<any>> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    
    const response = await api.get(`/users/${username}/bookmarks?${params}`);
    return {
      success: response.data.success,
      data: response.data.tweets,
      nextCursor: response.data.nextCursor,
    };
  },

  followUser: async (username: string) => {
    const response = await api.post(`/users/${username}/follow`);
    return response.data;
  },

  updateProfile: async (data: { bio?: string; displayName?: string; avatarUrl?: string; location?: string }) => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },

  getFollowers: async (username: string, limit = 20, cursor?: string): Promise<PaginatedResponse<User>> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    
    const response = await api.get(`/users/${username}/followers?${params}`);
    return {
      success: response.data.success,
      data: response.data.followers,
      nextCursor: response.data.nextCursor,
    };
  },

  getFollowing: async (username: string, limit = 20, cursor?: string): Promise<PaginatedResponse<User>> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    
    const response = await api.get(`/users/${username}/following?${params}`);
    return {
      success: response.data.success,
      data: response.data.following,
      nextCursor: response.data.nextCursor,
    };
  },

  deleteProfile: async (password: string) => {
    const response = await api.delete('/users/profile', {
      data: { password }
    });
    return response.data;
  },
};
