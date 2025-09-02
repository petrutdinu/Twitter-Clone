import { api } from './client';
import { Tweet } from '../types';

export interface HashtagTweetsResponse {
  success: boolean;
  tweets: Tweet[];
  nextCursor?: string;
}

export interface TrendingHashtag {
  tag: string;
  usage_count: number;
}

export interface TrendsResponse {
  success: boolean;
  trends: TrendingHashtag[];
  cached: boolean;
}

export const trendsApi = {
  getTrendingHashtags: async (): Promise<TrendsResponse> => {
    const response = await api.get('/trends');
    return response.data;
  },

  getHashtagTweets: async (hashtag: string, limit = 20, cursor?: string): Promise<HashtagTweetsResponse> => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (cursor) params.append('cursor', cursor);
    
    // Remove # from hashtag if present
    const cleanHashtag = hashtag.startsWith('#') ? hashtag.slice(1) : hashtag;
    
    const response = await api.get(`/trends/hashtag/${encodeURIComponent(cleanHashtag)}?${params.toString()}`);
    return response.data;
  }
};
