import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { trendsApi } from '../api/trends';
import TweetItem from '../components/TweetItem';

const Hashtag: React.FC = () => {
  const { hashtag } = useParams<{ hashtag: string }>();
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['hashtag', hashtag],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => 
      trendsApi.getHashtagTweets(hashtag!, 20, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!hashtag
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">#{hashtag}</h1>
        <p className="text-red-500">Error loading tweets</p>
      </div>
    );
  }

  // Extract tweets from all pages
  const tweets = data?.pages.flatMap((page) => page.tweets) || [];

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <Link to="/" className="text-primary hover:underline mb-2 inline-block">
          ◄ Back to timeline
        </Link>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xl">#</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">#{hashtag}</h1>
            <p className="text-gray-500">{tweets.length} tweets</p>
          </div>
        </div>
      </div>
      
      {tweets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No tweets found for #{hashtag}</p>
        </div>
      ) : (
        <div className="space-y-0">
          {tweets.map((tweet) => (
            <TweetItem key={tweet.id} tweet={tweet} />
          ))}
        </div>
      )}
      
      {hasNextPage && (
        <div className="text-center p-4">
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

export default Hashtag;
