import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { tweetApi } from '../api/tweets';
import { useToast } from '../hooks/useToast';
import { useAuthStore } from '../store/auth';
import { Tweet } from '../types';
import EmojiRenderer from './EmojiRenderer';
import HashtagText from './HashtagText';
import DefaultProfileIcon from './DefaultProfileIcon';
import SmartImage from './SmartImage';
import { updateTweetInCache } from '../utils/cacheUtils';

interface TweetItemProps {
  tweet: Tweet;
  showPinnedIndicator?: boolean;
}

const TweetItem: React.FC<TweetItemProps> = ({ tweet, showPinnedIndicator = false }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user: currentUser } = useAuthStore();
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Check if current user is the author of the tweet
  const isOwnTweet = currentUser?.id === tweet.author.id;

  const likeMutation = useMutation({
    mutationFn: () => tweetApi.likeTweet(tweet.id),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tweets'] });
      await queryClient.cancelQueries({ queryKey: ['userTweets'] });
      await queryClient.cancelQueries({ queryKey: ['forYouTweets'] });
      await queryClient.cancelQueries({ queryKey: ['popularTweets'] });
      
      // Update timeline tweets
      updateTweetInCache(queryClient, ['tweets'], (oldData) => {
        if (oldData.pages) {
          // Infinite query format
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isLiked: !t.isLiked, 
                      _count: { 
                        ...t._count, 
                        likes: t.isLiked ? t._count.likes - 1 : t._count.likes + 1 
                      } 
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update user tweets
      updateTweetInCache(queryClient, ['userTweets'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isLiked: !t.isLiked, 
                      _count: { 
                        ...t._count, 
                        likes: t.isLiked ? t._count.likes - 1 : t._count.likes + 1 
                      } 
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update individual tweet cache (for tweet detail page)
      queryClient.setQueryData(['tweets', tweet.id], (oldData: any) => {
        if (!oldData || !oldData.tweet) return oldData;
        return {
          ...oldData,
          tweet: {
            ...oldData.tweet,
            isLiked: !oldData.tweet.isLiked,
            _count: {
              ...oldData.tweet._count,
              likes: oldData.tweet.isLiked ? oldData.tweet._count.likes - 1 : oldData.tweet._count.likes + 1
            }
          }
        };
      });

      // Update hashtag tweets cache (for hashtag pages)
      updateTweetInCache(queryClient, ['hashtag'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              tweets: page.tweets.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isLiked: !t.isLiked, 
                      _count: { 
                        ...t._count, 
                        likes: t.isLiked ? t._count.likes - 1 : t._count.likes + 1 
                      } 
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update explore page tweets cache (for For You and Popular tabs)
      updateTweetInCache(queryClient, ['forYouTweets'], (oldData) => {
        if (oldData?.data) {
          return {
            ...oldData,
            data: oldData.data.map((t: any) => 
              t.id === tweet.id 
                ? { 
                    ...t, 
                    isLiked: !t.isLiked, 
                    _count: { 
                      ...t._count, 
                      likes: t.isLiked ? t._count.likes - 1 : t._count.likes + 1 
                    } 
                  }
                : t
            )
          };
        }
        return oldData;
      });

      updateTweetInCache(queryClient, ['popularTweets'], (oldData) => {
        if (oldData?.data) {
          return {
            ...oldData,
            data: oldData.data.map((t: any) => 
              t.id === tweet.id 
                ? { 
                    ...t, 
                    isLiked: !t.isLiked, 
                    _count: { 
                      ...t._count, 
                      likes: t.isLiked ? t._count.likes - 1 : t._count.likes + 1 
                    } 
                  }
                : t
            )
          };
        }
        return oldData;
      });
    },
    onError: () => {
      // On error, invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['tweets'] });
      queryClient.invalidateQueries({ queryKey: ['forYouTweets'] });
      queryClient.invalidateQueries({ queryKey: ['popularTweets'] });
      showToast('Failed to update like', 'error');
    },
    onSuccess: () => {
      // Don't show toast for likes - too noisy
    },
  });

  const retweetMutation = useMutation({
    mutationFn: () => tweetApi.retweetTweet(tweet.id),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tweets'] });
      await queryClient.cancelQueries({ queryKey: ['userTweets'] });
      await queryClient.cancelQueries({ queryKey: ['forYouTweets'] });
      await queryClient.cancelQueries({ queryKey: ['popularTweets'] });
      
      // Update timeline tweets
      updateTweetInCache(queryClient, ['tweets'], (oldData) => {
        if (oldData.pages) {
          // Infinite query format
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isRetweeted: !t.isRetweeted, 
                      _count: { 
                        ...t._count, 
                        retweets: t.isRetweeted ? t._count.retweets - 1 : t._count.retweets + 1 
                      } 
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update user tweets
      updateTweetInCache(queryClient, ['userTweets'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isRetweeted: !t.isRetweeted, 
                      _count: { 
                        ...t._count, 
                        retweets: t.isRetweeted ? t._count.retweets - 1 : t._count.retweets + 1 
                      } 
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update individual tweet cache (for tweet detail page)
      queryClient.setQueryData(['tweets', tweet.id], (oldData: any) => {
        if (!oldData || !oldData.tweet) return oldData;
        return {
          ...oldData,
          tweet: {
            ...oldData.tweet,
            isRetweeted: !oldData.tweet.isRetweeted,
            _count: {
              ...oldData.tweet._count,
              retweets: oldData.tweet.isRetweeted ? oldData.tweet._count.retweets - 1 : oldData.tweet._count.retweets + 1
            }
          }
        };
      });

      // Update hashtag tweets cache (for hashtag pages)
      updateTweetInCache(queryClient, ['hashtag'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              tweets: page.tweets.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isRetweeted: !t.isRetweeted, 
                      _count: { 
                        ...t._count, 
                        retweets: t.isRetweeted ? t._count.retweets - 1 : t._count.retweets + 1 
                      } 
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update explore page tweets cache (for For You and Popular tabs)
      updateTweetInCache(queryClient, ['forYouTweets'], (oldData) => {
        if (oldData?.data) {
          return {
            ...oldData,
            data: oldData.data.map((t: any) => 
              t.id === tweet.id 
                ? { 
                    ...t, 
                    isRetweeted: !t.isRetweeted, 
                    _count: { 
                      ...t._count, 
                      retweets: t.isRetweeted ? t._count.retweets - 1 : t._count.retweets + 1 
                    } 
                  }
                : t
            )
          };
        }
        return oldData;
      });

      updateTweetInCache(queryClient, ['popularTweets'], (oldData) => {
        if (oldData?.data) {
          return {
            ...oldData,
            data: oldData.data.map((t: any) => 
              t.id === tweet.id 
                ? { 
                    ...t, 
                    isRetweeted: !t.isRetweeted, 
                    _count: { 
                      ...t._count, 
                      retweets: t.isRetweeted ? t._count.retweets - 1 : t._count.retweets + 1 
                    } 
                  }
                : t
            )
          };
        }
        return oldData;
      });
    },
    onError: () => {
      // On error, invalidate to refetch correct data
      queryClient.invalidateQueries({ queryKey: ['tweets'] });
      queryClient.invalidateQueries({ queryKey: ['userTweets'] });
      queryClient.invalidateQueries({ queryKey: ['tweets', tweet.id] });
      queryClient.invalidateQueries({ queryKey: ['hashtag'] });
      queryClient.invalidateQueries({ queryKey: ['forYouTweets'] });
      queryClient.invalidateQueries({ queryKey: ['popularTweets'] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: () => tweetApi.bookmarkTweet(tweet.id),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tweets'] });
      await queryClient.cancelQueries({ queryKey: ['userTweets'] });
      await queryClient.cancelQueries({ queryKey: ['forYouTweets'] });
      await queryClient.cancelQueries({ queryKey: ['popularTweets'] });
      
      // Update timeline tweets
      updateTweetInCache(queryClient, ['tweets'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isBookmarked: !(t.isBookmarked || false)
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update user tweets
      updateTweetInCache(queryClient, ['userTweets'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isBookmarked: !(t.isBookmarked || false)
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update individual tweet cache
      queryClient.setQueryData(['tweets', tweet.id], (oldData: any) => {
        if (!oldData || !oldData.tweet) return oldData;
        return {
          ...oldData,
          tweet: {
            ...oldData.tweet,
            isBookmarked: !(oldData.tweet.isBookmarked || false)
          }
        };
      });

      // Update hashtag tweets cache
      updateTweetInCache(queryClient, ['hashtag'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              tweets: page.tweets.map((t: any) => 
                t.id === tweet.id 
                  ? { 
                      ...t, 
                      isBookmarked: !(t.isBookmarked || false)
                    }
                  : t
              )
            }))
          };
        }
        return oldData;
      });

      // Update explore page tweets cache (for For You and Popular tabs)
      updateTweetInCache(queryClient, ['forYouTweets'], (oldData) => {
        if (oldData?.data) {
          return {
            ...oldData,
            data: oldData.data.map((t: any) => 
              t.id === tweet.id 
                ? { 
                    ...t, 
                    isBookmarked: !(t.isBookmarked || false)
                  }
                : t
            )
          };
        }
        return oldData;
      });

      updateTweetInCache(queryClient, ['popularTweets'], (oldData) => {
        if (oldData?.data) {
          return {
            ...oldData,
            data: oldData.data.map((t: any) => 
              t.id === tweet.id 
                ? { 
                    ...t, 
                    isBookmarked: !(t.isBookmarked || false)
                  }
                : t
            )
          };
        }
        return oldData;
      });
    },
    onError: () => {
      // On error, invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['tweets'] });
      queryClient.invalidateQueries({ queryKey: ['forYouTweets'] });
      queryClient.invalidateQueries({ queryKey: ['popularTweets'] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: (optionId: string) => {
      console.log('Voting for option:', optionId, 'in tweet:', tweet.id);
      return tweetApi.votePoll(tweet.id, optionId);
    },
    onSuccess: (data) => {
      console.log('Vote successful:', data);
      // Invalidate all tweet-related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['tweets'] });
      queryClient.invalidateQueries({ queryKey: ['userTweets'] });
      queryClient.invalidateQueries({ queryKey: ['hashtag'] });
      queryClient.invalidateQueries({ queryKey: ['forYouTweets'] });
      queryClient.invalidateQueries({ queryKey: ['popularTweets'] });
      // Also invalidate the specific tweet if we're on the tweet detail page
      queryClient.invalidateQueries({ queryKey: ['tweets', tweet.id] });
    },
    onError: (error: any) => {
      console.error('Vote failed:', error);
      // Show user-friendly error message with custom toast
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already voted')) {
        showToast('You have already voted in this poll!', 'warning');
      } else {
        showToast('Failed to vote. Please try again.', 'error');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tweetApi.deleteTweet(tweet.id),
    onSuccess: () => {
      // Mark the tweet as deleted in all caches instead of removing it
      const markTweetAsDeleted = (queryKey: any[], updater: (oldData: any) => any) => {
        queryClient.setQueriesData({ queryKey }, (oldData: any) => {
          if (!oldData) return oldData;
          return updater(oldData);
        });
      };

      // Mark as deleted in timeline tweets
      markTweetAsDeleted(['tweets'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((t: any) => 
                t.id === tweet.id ? { ...t, deleted: true } : t
              )
            }))
          };
        }
        return oldData;
      });

      // Mark as deleted in user tweets
      markTweetAsDeleted(['userTweets'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: page.data.map((t: any) => 
                t.id === tweet.id ? { ...t, deleted: true } : t
              )
            }))
          };
        }
        return oldData;
      });

      // Mark as deleted in hashtag tweets
      markTweetAsDeleted(['hashtag'], (oldData) => {
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              tweets: page.tweets.map((t: any) => 
                t.id === tweet.id ? { ...t, deleted: true } : t
              )
            }))
          };
        }
        return oldData;
      });

      // Mark as deleted in explore page tweets
      markTweetAsDeleted(['forYouTweets'], (oldData) => {
        if (oldData?.data) {
          return {
            ...oldData,
            data: oldData.data.map((t: any) => 
              t.id === tweet.id ? { ...t, deleted: true } : t
            )
          };
        }
        return oldData;
      });

      markTweetAsDeleted(['popularTweets'], (oldData) => {
        if (oldData?.data) {
          return {
            ...oldData,
            data: oldData.data.map((t: any) => 
              t.id === tweet.id ? { ...t, deleted: true } : t
            )
          };
        }
        return oldData;
      });

      // Mark as deleted in individual tweet cache
      queryClient.setQueryData(['tweets', tweet.id], (oldData: any) => {
        if (!oldData || !oldData.tweet) return oldData;
        return {
          ...oldData,
          tweet: { ...oldData.tweet, deleted: true }
        };
      });

      showToast('Tweet deleted successfully!', 'success');
      setShowDropdown(false);
    },
    onError: (error: any) => {
      console.error('Delete tweet failed:', error);
      showToast('Failed to delete tweet. Please try again.', 'error');
      setShowDropdown(false);
    },
  });

  const pinMutation = useMutation({
    mutationFn: () => tweetApi.pinTweet(tweet.id),
    onSuccess: (data) => {
      const isPinned = data.isPinned;
      showToast(data.message, 'success');
      setShowDropdown(false);
      
      // Invalidate user profile to refresh pinned tweet display
      queryClient.invalidateQueries({ queryKey: ['user', tweet.author.username] });
      // Invalidate user tweets to refresh the pinned status
      queryClient.invalidateQueries({ queryKey: ['userTweets', tweet.author.username] });
    },
    onError: (error: any) => {
      console.error('Pin tweet failed:', error);
      const message = error.response?.data?.message || 'Failed to pin/unpin tweet. Please try again.';
      showToast(message, 'error');
      setShowDropdown(false);
    },
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {tweet.deleted ? (
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="p-4">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm italic">This tweet has been deleted</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border-b hover:bg-gray-50 transition-colors">
      <div className={`p-4 ${showPinnedIndicator ? 'pt-2' : ''}`}>
        {showPinnedIndicator && (
          <div className="mb-2 flex items-center space-x-2 text-sm text-blue-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 19V5z" />
            </svg>
            <span className="font-medium">Pinned</span>
          </div>
        )}
        {tweet.type === 'retweet' && tweet.retweetedBy && (
          <div className="mb-3 flex items-center space-x-2 text-sm text-gray-600">
            <EmojiRenderer text="🔄" />
            <Link 
              to={`/profile/${tweet.retweetedBy.username}`}
              className="hover:underline font-medium"
            >
              <EmojiRenderer text={tweet.retweetedBy.displayName || tweet.retweetedBy.username} />
            </Link>
            <EmojiRenderer text="retweeted" />
          </div>
        )}
        {tweet.parent && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
              <EmojiRenderer text="💬" />
              <span>Replying to @{tweet.parent.author.username}</span>
            </div>
            <Link to={`/tweet/${tweet.parent.id}`} className="text-gray-700 hover:text-gray-900">
              <HashtagText text={tweet.parent.text} className="text-sm line-clamp-2" />
            </Link>
          </div>
        )}
        <div className="flex space-x-3">
          <Link to={`/profile/${tweet.author.username}`} className="flex-shrink-0">
            {tweet.author.avatarUrl ? (
              <img
                src={tweet.author.avatarUrl}
                alt={tweet.author.username}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100">
                <DefaultProfileIcon size={20} />
              </div>
            )}
          </Link>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Link 
                  to={`/profile/${tweet.author.username}`}
                  className="font-semibold hover:underline"
                >
                  <EmojiRenderer text={tweet.author.displayName || tweet.author.username} />
                </Link>
                <span className="text-gray-500 text-sm">·</span>
                <span className="text-gray-500 text-sm">{formatDate(tweet.createdAt)}</span>
              </div>
              
              {/* Three dots menu for tweet actions */}
              {isOwnTweet && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDropdown(!showDropdown);
                    }}
                    className="p-1 rounded-full hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
                    title="Tweet options"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  
                  {showDropdown && (
                    <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          pinMutation.mutate();
                        }}
                        disabled={pinMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <span>
                          {pinMutation.isPending 
                            ? (tweet.isPinned ? 'Unpinning...' : 'Pinning...') 
                            : (tweet.isPinned ? 'Unpin tweet' : 'Pin tweet')
                          }
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this tweet?')) {
                            deleteMutation.mutate();
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>{deleteMutation.isPending ? 'Deleting...' : 'Delete tweet'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Link 
                to={`/profile/${tweet.author.username}`}
                className="text-gray-500 text-sm hover:underline"
              >
                @{tweet.author.username}
              </Link>
            </div>
            
            <Link to={`/tweet/${tweet.id}`} className="block mt-1">
              <HashtagText text={tweet.text} className="text-gray-900 whitespace-pre-wrap" />
            </Link>
            
            {tweet.media && tweet.media.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {tweet.media.map((media) => (
                  <div key={media.id} className="rounded-lg overflow-hidden">
                    {media.type === 'IMAGE' ? (
                      <SmartImage
                        src={media.url}
                        alt="Tweet media"
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <video
                        src={media.url}
                        controls
                        className="w-full h-48 object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {tweet.poll && (
              <div className="mt-3 space-y-2">
                {tweet.poll.options.map((option) => {
                  const hasVoted = option.votes && option.votes.length > 0;
                  return (
                    <button
                      key={option.id}
                      onClick={() => voteMutation.mutate(option.id)}
                      disabled={voteMutation.isPending}
                      className={`w-full flex items-center justify-between p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        hasVoted
                          ? 'bg-blue-100 border-2 border-blue-500 text-blue-900'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <span><HashtagText text={option.text} /></span>
                      <span className={`text-sm ${hasVoted ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
                        {option._count?.votes || 0} votes {hasVoted && '✓'}
                      </span>
                    </button>
                  );
                })}
                <div className="text-sm text-gray-500">
                  Poll expires: {formatDate(tweet.poll.expiresAt)}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between mt-3 text-gray-500 max-w-md">
              <button
                onClick={() => likeMutation.mutate()}
                disabled={likeMutation.isPending}
                className={`flex items-center space-x-1 hover:text-red-500 transition-colors ${
                  tweet.isLiked ? 'text-red-500' : ''
                }`}
              >
                <span>{tweet.isLiked ? '❤️' : '🤍'}</span>
                <span className="text-sm">{tweet._count.likes}</span>
              </button>
              
              <button
                onClick={() => retweetMutation.mutate()}
                disabled={retweetMutation.isPending}
                className={`flex items-center space-x-1 hover:text-green-500 transition-colors ${
                  tweet.isRetweeted ? 'text-green-500' : ''
                }`}
              >
                <EmojiRenderer text="🔄" />
                <span className="text-sm">{tweet._count.retweets}</span>
              </button>
              
              <button 
                onClick={() => navigate(`/tweet/${tweet.id}`)} 
                className="flex items-center space-x-1 hover:text-blue-500 transition-colors"
              >
                <EmojiRenderer text="💬" />
                <span className="text-sm">Reply</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  bookmarkMutation.mutate();
                }}
                disabled={bookmarkMutation.isPending}
                className={`flex items-center space-x-1 transition-colors ${
                  tweet.isBookmarked 
                    ? 'text-yellow-600 hover:text-yellow-700' 
                    : 'text-gray-500 hover:text-yellow-500'
                }`}
              >
                <EmojiRenderer text="📚" />
                <span className="text-sm">Bookmark</span>
              </button>
              
              <button 
                onClick={() => {
                  // Copy the tweet URL to clipboard
                  const url = `${window.location.origin}/tweet/${tweet.id}`;
                  navigator.clipboard.writeText(url);
                  alert('Tweet URL copied to clipboard!');
                }}
                className="flex items-center space-x-1 hover:text-blue-500 transition-colors"
              >
                <EmojiRenderer text="🔗" />
                <span className="text-sm">Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}
    </>
  );
};

export default TweetItem;
