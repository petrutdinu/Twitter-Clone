import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { tweetApi } from '../api/tweets';
import { userApi } from '../api/users';
import EmojiRenderer from './EmojiRenderer';
import DefaultProfileIcon from './DefaultProfileIcon';
import { useAuthStore } from '../store/auth';

interface TrendingHashtag {
  tag: string;
  usage_count: number;
}

interface RecommendedUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  _count: {
    followers: number;
    tweets: number;
  };
}

const RightSidebar: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Follow user mutation
  const followMutation = useMutation({
    mutationFn: (username: string) => userApi.followUser(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendedUsers'] });
    }
  });

  // Fetch trending hashtags
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends'],
    queryFn: async () => {
      const response = await api.get('/trends');
      return response.data;
    },
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });

  // Fetch recommended users
  const { data: recommendedUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['recommendedUsers'],
    queryFn: () => tweetApi.getRecommendedUsers(3),
    enabled: !!user,
  });

  const trends: TrendingHashtag[] = trendsData?.trends || [];
  const usersData: RecommendedUser[] = recommendedUsers?.data || [];

  return (
    <div className="space-y-6">
      {/* Trending Section */}
      <div className="bg-white rounded-lg p-4 shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg flex items-center">
            <EmojiRenderer text="🔥" />
            <span className="ml-2">Trending</span>
          </h3>
          <Link 
            to="/trends" 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            See all
          </Link>
        </div>
        
        {trendsLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : trends.length === 0 ? (
          <div className="text-center py-4">
            <EmojiRenderer text="📊" style={{ fontSize: '2rem' }} />
            <p className="text-gray-500 text-sm mt-2">No trending topics yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trends.slice(0, 5).map((trend, index) => (
              <Link
                key={trend.tag}
                to={`/hashtag/${trend.tag}`}
                className="block p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs text-gray-500">#{index + 1} Trending</span>
                      <span className="text-sm">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📈'}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      #{trend.tag}
                    </h4>
                    <p className="text-xs text-gray-600">
                      <EmojiRenderer text={`💬 ${trend.usage_count} tweet${trend.usage_count !== 1 ? 's' : ''}`} />
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        
        {trends.length > 5 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Link 
              to="/trends" 
              className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <EmojiRenderer text="👀 Show more trends" />
            </Link>
          </div>
        )}
      </div>

      {/* Who to Follow Section */}
      {user && usersData.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center">
              <EmojiRenderer text="👥" />
              <span className="ml-2">Who to follow</span>
            </h3>
            <Link 
              to="/trends" 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              See all
            </Link>
          </div>
          
          {usersLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {usersData.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Link to={`/profile/${user.username}`} className="flex-shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100">
                        <DefaultProfileIcon size={20} />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${user.username}`} className="block">
                      <h4 className="font-medium text-gray-900 truncate hover:text-blue-600 transition-colors">
                        <EmojiRenderer text={user.displayName || user.username} />
                      </h4>
                      <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                      <p className="text-xs text-gray-400">
                        {user._count.followers} followers
                      </p>
                    </Link>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      followMutation.mutate(user.username);
                    }}
                    disabled={followMutation.isPending}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {followMutation.isPending ? '...' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RightSidebar;
