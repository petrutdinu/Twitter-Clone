import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchHashtag } from '../api/search';

interface HashtagSearchResultProps {
  hashtag: SearchHashtag;
}

const HashtagSearchResult: React.FC<HashtagSearchResultProps> = ({ hashtag }) => {
  const navigate = useNavigate();

  const handleHashtagClick = () => {
    navigate(`/hashtag/${hashtag.tag}`);
  };

  const formatTweetCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div
      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer border-b border-gray-100"
      onClick={handleHashtagClick}
    >
      <div className="flex items-center space-x-4 flex-1">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <span className="text-primary text-xl font-bold">#</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base">
            #{hashtag.tag}
          </h3>
          <p className="text-gray-500 text-sm mt-1">
            {formatTweetCount(hashtag._count.tweets)} tweets
          </p>
        </div>
      </div>
      
      <div className="text-gray-400">
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 5l7 7-7 7" 
          />
        </svg>
      </div>
    </div>
  );
};

export default HashtagSearchResult;
