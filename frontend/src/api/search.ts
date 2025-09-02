import { api } from './client';

export interface SearchUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  _count: {
    followers: number;
    tweets: number;
  };
  isFollowing?: boolean;
}

export interface SearchHashtag {
  id: string;
  tag: string;
  _count: {
    tweets: number;
  };
}

export interface SearchResults {
  success: boolean;
  query: string;
  users: SearchUser[];
  hashtags: SearchHashtag[];
}

export const searchApi = {
  // Universal search
  search: async (query: string, type: 'all' | 'users' | 'hashtags' = 'all', limit = 10): Promise<SearchResults> => {
    const response = await api.get('/search', {
      params: { q: query, type, limit }
    });
    return response.data;
  },

  // Search users only
  searchUsers: async (query: string, limit = 10): Promise<{ success: boolean; users: SearchUser[] }> => {
    const response = await api.get('/search/users', {
      params: { q: query, limit }
    });
    return response.data;
  },

  // Search hashtags only
  searchHashtags: async (query: string, limit = 10): Promise<{ success: boolean; hashtags: SearchHashtag[] }> => {
    const response = await api.get('/search/hashtags', {
      params: { q: query, limit }
    });
    return response.data;
  }
};
