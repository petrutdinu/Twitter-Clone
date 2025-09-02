import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tweetApi } from '../api/tweets';
import TweetItem from '../components/TweetItem';
import TweetComposer from '../components/TweetComposer';
import { useAuthStore } from '../store/auth';

const Tweet: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['tweets', id],
    queryFn: () => tweetApi.getTweet(id!),
    enabled: !!id
  });
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Tweet</h1>
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Tweet</h1>
        <p className="text-red-500">Error loading tweet</p>
      </div>
    );
  }
  
  const tweet = data?.tweet;
  
  if (!tweet) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Tweet</h1>
        <p className="text-gray-600">Tweet not found</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <Link to="/" className="text-primary hover:underline">
          ◄ Back to timeline
        </Link>
        <h1 className="text-2xl font-bold mt-2">Tweet</h1>
      </div>
      
      <TweetItem tweet={tweet} />
      
      {user && tweet && (
        <div className="p-4 border-t">
          <h2 className="font-bold text-lg mb-2">Reply to this tweet</h2>
          <TweetComposer 
            parentTweet={tweet}
            placeholder="Write your reply..."
          />
        </div>
      )}
    </div>
  );
};

export default Tweet;
