import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { tweetApi } from '../api/tweets';
import { userApi } from '../api/users';
import { api } from '../api/client';
import TweetItem from '../components/TweetItem';
import EmojiRenderer from '../components/EmojiRenderer';
import DefaultProfileIcon from '../components/DefaultProfileIcon';
import { useAuthStore } from '../store/auth';
import { trendCategories } from '../config/trendCategories';

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

const Trends: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'for-you' | 'trending' | 'popular' | 'categories'>('for-you');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
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

  // Fetch For You tweets
  const { data: forYouTweets, isLoading: forYouLoading } = useQuery({
    queryKey: ['forYouTweets'],
    queryFn: () => tweetApi.getForYouTweets(15),
    enabled: activeTab === 'for-you' && !!user,
  });

  // Fetch popular tweets
  const { data: popularTweets, isLoading: popularLoading } = useQuery({
    queryKey: ['popularTweets'],
    queryFn: () => tweetApi.getPopularTweets(15),
    enabled: activeTab === 'popular',
  });

  // Fetch recommended users
  const { data: recommendedUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['recommendedUsers'],
    queryFn: () => tweetApi.getRecommendedUsers(8),
    enabled: !!user,
  });

  const trends: TrendingHashtag[] = trendsData?.trends || [];
  const forYouData = forYouTweets?.data || [];
  const popularData = popularTweets?.data || [];
  const usersData: RecommendedUser[] = recommendedUsers?.data || [];

  // Determine how many users to show
  const usersToShow = showAllUsers ? usersData : usersData.slice(0, 4);
  const hasMoreUsers = usersData.length > 4;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              <EmojiRenderer text="🔭 Explore" />
            </h1>
            <p className="text-gray-600">Discover trending content and interesting topics</p>
          </div>
          <div className="text-4xl">🌍</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Trending Topics</p>
              <p className="text-2xl font-bold">{trends.length}</p>
            </div>
            <EmojiRenderer text="🔥" style={{ fontSize: '2rem' }} />
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Popular Tweets</p>
              <p className="text-2xl font-bold">{popularData.length}</p>
            </div>
            <EmojiRenderer text="⭐" style={{ fontSize: '2rem' }} />
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Users to Follow</p>
              <p className="text-2xl font-bold">{usersData.length}</p>
            </div>
            <EmojiRenderer text="👥" style={{ fontSize: '2rem' }} />
          </div>
        </div>
      </div>

      {/* Recommended Users Section */}
      {user && usersData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <EmojiRenderer text="🧑‍🤝‍🧑" />
            <span className="ml-2">Recommended Users</span>
          </h2>
          <div className="space-y-4">
            {usersToShow.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
              >
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  <Link to={`/profile/${user.username}`} className="flex-shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100">
                        <DefaultProfileIcon size={24} />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${user.username}`} className="block">
                      <h3 className="font-semibold text-gray-900 text-base leading-tight">
                        <EmojiRenderer text={user.displayName || user.username} />
                      </h3>
                      <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                      <div className="flex space-x-4 text-xs text-gray-400 mt-1">
                        <span>{user._count.followers} followers</span>
                        <span>{user._count.tweets} tweets</span>
                      </div>
                    </Link>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    followMutation.mutate(user.username);
                  }}
                  disabled={followMutation.isPending}
                  className="flex-shrink-0 px-4 py-2 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 font-medium ml-4"
                >
                  {followMutation.isPending ? 'Following...' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
          {hasMoreUsers && (
            <div className="text-center mt-6">
              <button 
                onClick={() => setShowAllUsers(!showAllUsers)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
              >
                {showAllUsers ? (
                  <span>Show less users</span>
                ) : (
                  <span>See more users ({usersData.length - 4} more)</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="bg-white rounded-lg shadow max-w-4xl mx-auto">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('for-you')}
            className={`flex-1 min-w-0 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'for-you'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex flex-col items-center">
              <EmojiRenderer text="🧠" />
              <span className="text-sm mt-1">For You</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex-1 min-w-0 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'trending'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex flex-col items-center">
              <EmojiRenderer text="🔥" />
              <span className="text-sm mt-1">Trending</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('popular')}
            className={`flex-1 min-w-0 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'popular'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex flex-col items-center">
              <EmojiRenderer text="⭐" />
              <span className="text-sm mt-1">Popular</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 min-w-0 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'categories'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex flex-col items-center">
              <EmojiRenderer text="🧪" />
              <span className="text-sm mt-1">Categories</span>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'for-you' && (
            <div className="max-w-3xl mx-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <EmojiRenderer text="🧠" />
                <span className="ml-2">For You</span>
                <span className="ml-2 text-sm text-gray-500 font-normal">- personalized based on your activity</span>
              </h2>
              {!user ? (
                <div className="text-center py-8">
                  <EmojiRenderer text="🔐" style={{ fontSize: '3rem' }} />
                  <p className="text-gray-500 mt-2">Log in for personalized content</p>
                </div>
              ) : forYouLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : forYouData.length === 0 ? (
                <div className="text-center py-8">
                  <EmojiRenderer text="🌱" style={{ fontSize: '3rem' }} />
                  <p className="text-gray-500 mt-2">Interact more for personalized recommendations</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {forYouData.map((tweet) => (
                    <TweetItem key={tweet.id} tweet={tweet} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'trending' && (
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <EmojiRenderer text="🔥" />
                  <span className="ml-2">Trending Topics</span>
                </h2>
                <span className="text-sm text-gray-500">Updated every 2 minutes</span>
              </div>
              {trendsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : trends.length === 0 ? (
                <div className="text-center py-8">
                  <EmojiRenderer text="📊" style={{ fontSize: '3rem' }} />
                  <p className="text-gray-500 mt-2">No trending topics yet</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {trends.map((trend, index) => (
                    <Link
                      key={trend.tag}
                      to={`/hashtag/${trend.tag}`}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group max-w-sm mx-auto"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">#{index + 1} Trending</span>
                        <span className="text-2xl">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📈'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                        #{trend.tag}
                      </h3>
                      <p className="text-sm text-gray-600">
                        <EmojiRenderer text={`💬 ${trend.usage_count} tweet${trend.usage_count !== 1 ? 's' : ''}`} />
                      </p>
                      <div className="mt-2 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to explore →
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'popular' && (
            <div className="max-w-3xl mx-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <EmojiRenderer text="⭐" />
                <span className="ml-2">Popular Content</span>
                <span className="ml-2 text-sm text-gray-500 font-normal">- tweets with high engagement</span>
              </h2>
              {popularLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : popularData.length === 0 ? (
                <div className="text-center py-8">
                  <EmojiRenderer text="🌟" style={{ fontSize: '3rem' }} />
                  <p className="text-gray-500 mt-2">No popular content yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {popularData.map((tweet) => (
                    <TweetItem key={tweet.id} tweet={tweet} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="max-w-5xl mx-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <EmojiRenderer text="🧪" />
                <span className="ml-2">Explore by Categories</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 max-w-2xl mx-auto">
                {trendCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`p-6 rounded-lg border transition-all duration-200 text-center ${
                      selectedCategory === category.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-3xl mb-3">
                      <EmojiRenderer text={category.icon} />
                    </div>
                    <h3 className="font-medium text-sm">{category.name}</h3>
                  </button>
                ))}
              </div>
              
              {selectedCategory && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-3">
                    {trendCategories.find(c => c.id === selectedCategory)?.name} - Popular Hashtags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {trendCategories.find(c => c.id === selectedCategory)?.hashtags.map((hashtag) => (
                      <Link
                        key={hashtag}
                        to={`/hashtag/${hashtag.slice(1)}`}
                        className="px-3 py-1 bg-white rounded-full text-sm text-blue-600 hover:bg-blue-50 transition-colors border"
                      >
                        {hashtag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Trends;
