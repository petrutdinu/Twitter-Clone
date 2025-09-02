import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchUser } from '../api/search';
import { userApi } from '../api/users';
import { useAuthStore } from '../store/auth';
import EmojiRenderer from './EmojiRenderer';
import DefaultProfileIcon from './DefaultProfileIcon';

interface UserSearchResultProps {
  user: SearchUser;
  onUserUpdate?: (user: SearchUser) => void;
}

const UserSearchResult: React.FC<UserSearchResultProps> = ({ user, onUserUpdate }) => {
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = React.useState(user.isFollowing || false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleProfileClick = () => {
    navigate(`/profile/${user.username}`);
  };

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent profile navigation when clicking follow button
    if (!currentUser || user.id === currentUser.id) return;

    setIsLoading(true);
    try {
      const result = await userApi.followUser(user.username);
      const newFollowingState = !isFollowing; // Toggle the state
      setIsFollowing(newFollowingState);
      
      // Update the user object if callback provided
      if (onUserUpdate) {
        onUserUpdate({
          ...user,
          isFollowing: newFollowingState,
          _count: {
            ...user._count,
            followers: user._count.followers + (newFollowingState ? 1 : -1)
          }
        });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer border-b border-gray-100"
      onClick={handleProfileClick}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="relative">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100">
              <DefaultProfileIcon size={24} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-gray-900 truncate text-base">
              {user.displayName ? (
                <EmojiRenderer text={user.displayName} />
              ) : (
                user.username
              )}
            </h3>
            <span className="text-gray-500 text-sm font-normal">@{user.username}</span>
          </div>
          {user.bio && (
            <p className="text-gray-600 text-sm mt-1 line-clamp-2 leading-relaxed">
              <EmojiRenderer text={user.bio} />
            </p>
          )}
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center">
              <span className="font-semibold text-gray-700">{user._count.followers}</span>
              <span className="ml-1">followers</span>
            </span>
            <span className="flex items-center">
              <span className="font-semibold text-gray-700">{user._count.tweets}</span>
              <span className="ml-1">tweets</span>
            </span>
          </div>
        </div>
      </div>
      
      {currentUser && user.id !== currentUser.id && (
        <button
          onClick={handleFollowToggle}
          disabled={isLoading}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 min-w-[100px] ${
            isFollowing
              ? 'bg-transparent text-gray-700 border border-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
              : 'bg-blue-500 text-white hover:bg-blue-600 border border-blue-500'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
};

export default UserSearchResult;
