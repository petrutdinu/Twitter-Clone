import api from './client';
import { Tweet, PaginatedResponse } from '../types';

export const tweetApi = {
  getTweets: async (limit = 20, cursor?: string): Promise<PaginatedResponse<Tweet>> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    
    console.log('Fetching tweets with params:', { limit, cursor });
    const response = await api.get(`/tweets?${params}`);
    console.log('Received tweets response:', response.data);
    
    return {
      success: response.data.success,
      data: response.data.tweets,
      nextCursor: response.data.nextCursor,
    };
  },

  getPopularTweets: async (limit = 20): Promise<{ success: boolean; data: Tweet[] }> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    
    console.log('Fetching popular tweets with params:', { limit });
    const response = await api.get(`/tweets/explore/popular?${params}`);
    console.log('Received popular tweets response:', response.data);
    
    return {
      success: response.data.success,
      data: response.data.tweets,
    };
  },

  getForYouTweets: async (limit = 20): Promise<{ success: boolean; data: Tweet[] }> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    
    console.log('Fetching for you tweets with params:', { limit });
    const response = await api.get(`/tweets/explore/for-you?${params}`);
    console.log('Received for you tweets response:', response.data);
    
    return {
      success: response.data.success,
      data: response.data.tweets,
    };
  },

  getRecommendedUsers: async (limit = 10): Promise<{ success: boolean; data: any[] }> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    
    console.log('Fetching recommended users with params:', { limit });
    const response = await api.get(`/tweets/explore/recommended-users?${params}`);
    console.log('Received recommended users response:', response.data);
    
    return {
      success: response.data.success,
      data: response.data.users,
    };
  },

  createTweet: async (data: {
    text: string;
    mediaFiles?: File[];
    pollOptions?: string[];
    pollDuration?: number;
    parentId?: string;
  }) => {
    console.log('Creating tweet with data:', {
      text: data.text,
      hasMedia: !!data.mediaFiles?.length,
      mediaCount: data.mediaFiles?.length || 0,
      pollOptions: data.pollOptions,
      parentId: data.parentId
    });
    
    const formData = new FormData();
    formData.append('text', data.text);
    
    if (data.parentId) {
      formData.append('parentId', data.parentId);
    }
    
    if (data.pollOptions?.length) {
      data.pollOptions.forEach(option => {
        formData.append('pollOptions', option);
      });
      if (data.pollDuration) {
        formData.append('pollDuration', data.pollDuration.toString());
      }
    }
    
    if (data.mediaFiles?.length) {
      data.mediaFiles.forEach(file => {
        formData.append('media', file);
      });
    }
    
    try {
      console.log('Sending tweet creation request to:', api.defaults.baseURL + '/tweets');
      const response = await api.post('/tweets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Tweet creation successful, response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating tweet:', error);
      throw error;
    }
  },

  getTweet: async (id: string) => {
    const response = await api.get(`/tweets/${id}`);
    return response.data;
  },

  likeTweet: async (id: string) => {
    const response = await api.post(`/tweets/${id}/like`);
    return response.data;
  },

  retweetTweet: async (id: string) => {
    const response = await api.post(`/tweets/${id}/retweet`);
    return response.data;
  },

  votePoll: async (tweetId: string, optionId: string) => {
    console.log('API call: votePoll', { tweetId, optionId });
    try {
      const response = await api.post(`/tweets/${tweetId}/poll/${optionId}/vote`);
      console.log('Vote API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Vote API error:', error);
      throw error;
    }
  },

  deleteTweet: async (tweetId: string) => {
    try {
      console.log('Deleting tweet:', tweetId);
      const response = await api.delete(`/tweets/${tweetId}`);
      console.log('Delete tweet response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Delete tweet API error:', error);
      throw error;
    }
  },

  bookmarkTweet: async (id: string) => {
    const response = await api.post(`/tweets/${id}/bookmark`);
    return response.data;
  },

  pinTweet: async (id: string) => {
    try {
      console.log('Pinning/unpinning tweet:', id);
      const response = await api.post(`/tweets/${id}/pin`);
      console.log('Pin tweet response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Pin tweet API error:', error);
      throw error;
    }
  },

  getSignedMediaUrl: async (key: string): Promise<string> => {
    try {
      const response = await api.get(`/tweets/media/signed-url/${encodeURIComponent(key)}`);
      return response.data.signedUrl;
    } catch (error) {
      console.error('Error getting signed media URL:', error);
      throw error;
    }
  },
};
