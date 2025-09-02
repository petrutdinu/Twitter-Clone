import React, { useEffect, useState, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { tweetApi } from '../api/tweets';
import TweetComposer from '../components/TweetComposer';
import TweetItem from '../components/TweetItem';
import { useAuthStore } from '../store/auth';
import { useWebSocketContext } from '../contexts/WebSocketContext';

const Home: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { socket, isConnected } = useWebSocketContext();
  const queryClient = useQueryClient();
  const [newTweetsCount, setNewTweetsCount] = useState(0);
  const [latestTweetTimestamp, setLatestTweetTimestamp] = useState<string | null>(null);
  const [detectedTweetIds, setDetectedTweetIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Add debug logs
  console.log('Home component rendering with:', { 
    isAuthenticated, 
    hasUser: !!user, 
    userId: user?.id,
    wsConnected: isConnected
  });

  // Listen for new tweets via WebSocket
  useEffect(() => {
    if (!socket) {
      console.log('No socket connection available');
      return;
    }
    
    console.log('Setting up WebSocket listeners for new tweets');
    
    socket.on('new_tweet', (tweet) => {
      console.log('New tweet received via WebSocket:', tweet);
      console.log('Current detected IDs:', Array.from(detectedTweetIds));
      
      // Skip if this is our own tweet
      if (tweet.author?.id === user?.id) {
        console.log('Skipping own tweet:', tweet.id);
        return;
      }
      
      // Check if we've already counted this tweet
      if (!detectedTweetIds.has(tweet.id)) {
        setDetectedTweetIds(prev => new Set([...prev, tweet.id]));
        setNewTweetsCount(prev => {
          const newCount = prev + 1;
          console.log('WebSocket: Incrementing new tweets count from', prev, 'to', newCount, 'for tweet:', tweet.id);
          return newCount;
        });
      } else {
        console.log('WebSocket: Tweet already detected, skipping:', tweet.id);
      }
    });
    
    return () => {
      console.log('Cleaning up WebSocket listeners');
      socket.off('new_tweet');
    };
  }, [socket, detectedTweetIds]);

  // Check for new tweets periodically
  const checkForNewTweets = async () => {
    if (!latestTweetTimestamp || isRefreshing) {
      console.log('Skipping periodic check - no timestamp or refreshing');
      return;
    }
    
    console.log('Checking for new tweets since:', latestTweetTimestamp);
    
    try {
      // Get the latest tweets without cursor to check for new ones
      const response = await tweetApi.getTweets(20);
      const latestTweets = response.data;
      
      console.log('Fetched latest tweets for comparison:', latestTweets.length);
      
      if (latestTweets.length > 0) {
        // Count how many tweets are newer than our latest timestamp and not already detected
        const newerTweets = latestTweets.filter(tweet => {
          const tweetTime = new Date(tweet.createdAt);
          const latestTime = new Date(latestTweetTimestamp);
          const isNewer = tweetTime > latestTime;
          const notDetected = !detectedTweetIds.has(tweet.id);
          const notOwnTweet = tweet.author?.id !== user?.id; // Skip our own tweets
          return isNewer && notDetected && notOwnTweet;
        });
        
        console.log('Found newer tweets not yet detected:', newerTweets.length);
        
        if (newerTweets.length > 0) {
          // Add the new tweet IDs to our detected set
          setDetectedTweetIds(prev => {
            const newSet = new Set([...prev, ...newerTweets.map(t => t.id)]);
            console.log('Adding tweet IDs to detected set:', newerTweets.map(t => t.id));
            return newSet;
          });
          
          setNewTweetsCount(prev => {
            const newCount = prev + newerTweets.length;
            console.log('Periodic check: Adding', newerTweets.length, 'new tweets, total count:', newCount);
            return newCount;
          });
        }
      }
    } catch (error) {
      console.error('Error checking for new tweets:', error);
    }
  };

  // Set up periodic checking for new tweets
  useEffect(() => {
    // Clear any existing interval
    if (checkInterval.current) {
      clearInterval(checkInterval.current);
    }

    // Start checking every 10 seconds (for testing)
    if (latestTweetTimestamp) {
      console.log('Starting periodic check for new tweets every 10 seconds');
      checkInterval.current = setInterval(checkForNewTweets, 10000);
      
      // Also do an immediate check
      checkForNewTweets();
    } else {
      console.log('No latest tweet timestamp, not starting periodic check');
    }

    return () => {
      if (checkInterval.current) {
        console.log('Clearing periodic check interval');
        clearInterval(checkInterval.current);
      }
    };
  }, [latestTweetTimestamp, detectedTweetIds, isRefreshing]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['tweets', 'timeline'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => tweetApi.getTweets(20, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
  });

  // Update latest tweet timestamp when data changes
  useEffect(() => {
    if (data?.pages?.[0]?.data?.length > 0) {
      const latestTweet = data.pages[0].data[0];
      console.log('Setting latest tweet timestamp to:', latestTweet.createdAt);
      setLatestTweetTimestamp(latestTweet.createdAt);
      
      // Always mark all current tweets as seen when data refreshes AND reset counter
      const allCurrentTweetIds = data.pages.flatMap(page => page.data).map(tweet => tweet.id);
      setDetectedTweetIds(new Set(allCurrentTweetIds));
      setNewTweetsCount(0); // Always reset counter when data changes
      setIsRefreshing(false); // Clear refresh flag
      console.log('Marked all current tweets as seen after data refresh and reset counter:', allCurrentTweetIds.length, 'tweets');
    } else {
      console.log('No tweets found in data');
      setIsRefreshing(false); // Clear refresh flag even if no data
    }
  }, [data, user?.id]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading tweets</p>
      </div>
    );
  }

  // Extract tweets from all pages
  const tweets = data?.pages.flatMap((page) => page.data) || [];
  
  console.log('Rendered tweets:', tweets.length, tweets);
  console.log('Current state:', { 
    newTweetsCount, 
    latestTweetTimestamp, 
    isConnected,
    hasSocket: !!socket 
  });
  
  // Function to refresh and show new tweets
  const loadNewTweets = () => {
    console.log("Loading new tweets");
    setIsRefreshing(true); // Set refresh flag
    setNewTweetsCount(0); // Reset counter
    // Mark all current tweets as seen instead of clearing
    const currentTweetIds = tweets.map(tweet => tweet.id);
    setDetectedTweetIds(new Set(currentTweetIds));
    console.log('Marked all current tweets as seen:', currentTweetIds.length);
    queryClient.invalidateQueries({ queryKey: ['tweets', 'timeline'] });
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">What's happening?</h2>
        <TweetComposer onTweetSuccess={() => {
          console.log('Tweet posted successfully, refreshing feed');
          setIsRefreshing(true); // Set refresh flag
          setNewTweetsCount(0);
          setDetectedTweetIds(new Set()); // Clear temporarily
          // Invalidate and refetch the timeline
          queryClient.invalidateQueries({ queryKey: ['tweets', 'timeline'] });
        }} />
      </div>
      
      {newTweetsCount > 0 && (
        <div className="text-center mb-4">
          <button 
            onClick={loadNewTweets}
            className="flex items-center space-x-2 bg-gradient-to-r from-primary to-primary/90 text-white px-6 py-3 rounded-full font-medium shadow-lg hover:from-primary/90 hover:to-primary/80 transition-all duration-200 transform hover:scale-105"
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 11l5-5m0 0l5 5m-5-5v12" 
              />
            </svg>
            <span>{newTweetsCount} new tweet{newTweetsCount > 1 ? 's' : ''} - Refresh Feed</span>
          </button>
        </div>
      )}
      
      {newTweetsCount === 0 && (
        <div className="text-center mb-4">
          <button 
            onClick={loadNewTweets}
            className="flex items-center space-x-2 text-primary hover:text-primary/80 font-medium px-4 py-2 rounded-full hover:bg-primary/10 transition-colors"
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            <span>Refresh Feed</span>
          </button>
        </div>
      )}
      
      {tweets.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">No tweets yet. Be the first to post!</p>
        </div>
      ) : (
        <div className="space-y-0">
          {tweets.map((tweet) => (
            <TweetItem key={tweet.id} tweet={tweet} />
          ))}
        </div>
      )}
      
      {hasNextPage && (
        <div className="text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="btn btn-secondary"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
