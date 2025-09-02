import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { userApi } from '../api/users';
import { useAuthStore } from '../store/auth';
import TweetItem from '../components/TweetItem';
import EmojiRenderer from '../components/EmojiRenderer';
import DefaultProfileIcon from '../components/DefaultProfileIcon';
import { useToast } from '../hooks/useToast';

const Profile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tweets' | 'followers' | 'following' | 'bookmarks'>('tweets');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
    location: '',
    avatarUrl: ''
  });
  const [avatarError, setAvatarError] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<'displayName' | 'bio' | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const displayNameInputRef = useRef<HTMLInputElement>(null);
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset to tweets tab when username changes
  useEffect(() => {
    setActiveTab('tweets');
  }, [username]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(null);
      }
    };

    if (showProfileDropdown || showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown, showEmojiPicker]);

  // Fetch user profile
  const { data: profileData, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['user', username],
    queryFn: () => userApi.getProfile(username!),
    enabled: !!username,
  });

  // Fetch user tweets
  const {
    data: tweetsData,
    fetchNextPage: fetchNextTweetsPage,
    hasNextPage: hasNextTweetsPage,
    isFetchingNextPage: isFetchingNextTweetsPage,
    isLoading: tweetsLoading,
  } = useInfiniteQuery({
    queryKey: ['userTweets', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => 
      userApi.getUserTweets(username!, 20, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!username && activeTab === 'tweets',
  });

  // Fetch followers
  const {
    data: followersData,
    fetchNextPage: fetchNextFollowersPage,
    hasNextPage: hasNextFollowersPage,
    isFetchingNextPage: isFetchingNextFollowersPage,
    isLoading: followersLoading,
  } = useInfiniteQuery({
    queryKey: ['userFollowers', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => 
      userApi.getFollowers(username!, 20, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!username && activeTab === 'followers',
  });

  // Fetch following
  const {
    data: followingData,
    fetchNextPage: fetchNextFollowingPage,
    hasNextPage: hasNextFollowingPage,
    isFetchingNextPage: isFetchingNextFollowingPage,
    isLoading: followingLoading,
  } = useInfiniteQuery({
    queryKey: ['userFollowing', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => 
      userApi.getFollowing(username!, 20, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!username && activeTab === 'following',
  });

  // Fetch bookmarks (only for own profile)
  const {
    data: bookmarksData,
    fetchNextPage: fetchNextBookmarksPage,
    hasNextPage: hasNextBookmarksPage,
    isFetchingNextPage: isFetchingNextBookmarksPage,
    isLoading: bookmarksLoading,
  } = useInfiniteQuery({
    queryKey: ['userBookmarks', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => 
      userApi.getUserBookmarks(username!, 20, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!username && activeTab === 'bookmarks' && currentUser?.username === username,
  });

  // Follow/Unfollow mutation
  const followMutation = useMutation({
    mutationFn: (username: string) => userApi.followUser(username),
    onMutate: async (usernameToFollow) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['user', usernameToFollow] });

      // Snapshot the previous value for rollback
      const previousProfile = queryClient.getQueryData(['user', usernameToFollow]);

      // Optimistically update the cache
      queryClient.setQueryData(['user', usernameToFollow], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          user: {
            ...old.user,
            isFollowing: !old.user.isFollowing,
            followersCount: !old.user.isFollowing 
              ? (old.user.followersCount || 0) + 1
              : Math.max((old.user.followersCount || 0) - 1, 0)
          }
        };
      });

      return { previousProfile };
    },
    onSuccess: (data, usernameFollowed) => {
      // Force refetch the profile to get the latest data
      queryClient.invalidateQueries({ queryKey: ['user', usernameFollowed] });
      
      // Invalidate related queries
      if (currentUser?.username) {
        queryClient.invalidateQueries({ queryKey: ['userFollowing', currentUser.username] });
        queryClient.invalidateQueries({ queryKey: ['userFollowers', currentUser.username] });
      }
      queryClient.invalidateQueries({ queryKey: ['userFollowers', usernameFollowed] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      
      showToast(data.isFollowing ? 'Following successfully!' : 'Unfollowed successfully!', 'success');
    },
    onError: (error, usernameToFollow, context) => {
      // Roll back the optimistic update on error
      if (context?.previousProfile) {
        queryClient.setQueryData(['user', usernameToFollow], context.previousProfile);
      }
      showToast('Failed to update follow status', 'error');
    },
  });

  const handleFollow = async () => {
    if (!username) return;
    followMutation.mutate(username);
  };

  // Delete profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: (password: string) => userApi.deleteProfile(password),
    onSuccess: () => {
      showToast('Account deleted successfully', 'success');
      logout(); // Clear auth state
      navigate('/'); // Redirect to home
    },
    onError: (error: any) => {
      console.error('Delete profile failed:', error);
      const message = error.response?.data?.message || 'Failed to delete account. Please try again.';
      showToast(message, 'error');
    },
  });

  const handleDeleteProfile = () => {
    if (!deletePassword.trim()) {
      showToast('Please enter your password', 'error');
      return;
    }
    
    deleteProfileMutation.mutate(deletePassword);
  };

  const handleUpdateBio = async () => {
    try {
      await userApi.updateProfile({ bio: editForm.bio });
      queryClient.invalidateQueries({ queryKey: ['user', username] });
      setShowEditModal(false);
      showToast('Bio updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating bio:', error);
      showToast('Failed to update bio', 'error');
    }
  };

  const handleUpdateDisplayName = async () => {
    try {
      await userApi.updateProfile({ displayName: editForm.displayName });
      queryClient.invalidateQueries({ queryKey: ['user', username] });
      setShowEditModal(false);
      showToast('Display name updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating display name:', error);
      showToast('Failed to update display name', 'error');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const updates: any = {};
      if (editForm.displayName !== (profileData?.user.displayName || '')) {
        updates.displayName = editForm.displayName;
      }
      if (editForm.bio !== (profileData?.user.bio || '')) {
        updates.bio = editForm.bio;
      }
      if (editForm.location !== (profileData?.user.location || '')) {
        updates.location = editForm.location;
      }
      if (editForm.avatarUrl !== (profileData?.user.avatarUrl || '')) {
        updates.avatarUrl = editForm.avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        await userApi.updateProfile(updates);
        
        // Invalidate the current user's profile data
        queryClient.invalidateQueries({ queryKey: ['user', username] });
        
        // If this is the current user's own profile, update the auth store directly
        // This ensures immediate updates in header, tweet composer, etc.
        if (isOwnProfile && currentUser) {
          const { updateUser } = useAuthStore.getState();
          updateUser(updates);
          
          // Also invalidate auth-related queries
          queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
          queryClient.invalidateQueries({ queryKey: ['user', currentUser.username] });
        }
        
        showToast('Profile updated successfully!', 'success');
      }
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile', 'error');
    }
  };

  const openEditModal = () => {
    setEditForm({
      displayName: profileData?.user.displayName || '',
      bio: profileData?.user.bio || '',
      location: profileData?.user.location || '',
      avatarUrl: profileData?.user.avatarUrl || ''
    });
    setAvatarError(false);
    setFocusedField(null);
    setShowEmojiPicker(null);
    setShowEditModal(true);
  };

  const handleEmojiClick = (emojiData: EmojiClickData, field: 'displayName' | 'bio') => {
    const emoji = emojiData.emoji;
    
    if (field === 'displayName') {
      const input = displayNameInputRef.current;
      if (input) {
        const cursorPos = input.selectionStart || editForm.displayName.length;
        const newValue = editForm.displayName.slice(0, cursorPos) + emoji + editForm.displayName.slice(cursorPos);
        setEditForm(prev => ({ ...prev, displayName: newValue }));
        
        // Set cursor position after emoji
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        }, 0);
      }
    } else if (field === 'bio') {
      const textarea = bioTextareaRef.current;
      if (textarea) {
        const cursorPos = textarea.selectionStart || editForm.bio.length;
        const newValue = editForm.bio.slice(0, cursorPos) + emoji + editForm.bio.slice(cursorPos);
        setEditForm(prev => ({ ...prev, bio: newValue }));
        
        // Set cursor position after emoji
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        }, 0);
      }
    }
    
    setShowEmojiPicker(null);
  };

  const handleAvatarUrlChange = (url: string) => {
    setEditForm(prev => ({ ...prev, avatarUrl: url }));
    setAvatarError(false);
    
    // Test the image URL if it's not empty
    if (url.trim()) {
      const img = new Image();
      img.onload = () => setAvatarError(false);
      img.onerror = () => setAvatarError(true);
      img.src = url;
    }
  };

  const handleUserClick = (clickedUsername: string) => {
    navigate(`/profile/${clickedUsername}`);
  };

  if (profileLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (profileError || !profileData) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading profile or user not found</p>
      </div>
    );
  }

  const user = profileData.user;
  const isOwnProfile = currentUser?.username === username;
  const allTweets = tweetsData?.pages.flatMap((page) => page.data) || [];
  // Filter out pinned tweet from regular tweets list to avoid duplication
  const tweets = user.pinnedTweet 
    ? allTweets.filter(tweet => tweet.id !== user.pinnedTweet.id)
    : allTweets;
  const followers = followersData?.pages.flatMap((page) => page.data) || [];
  const following = followingData?.pages.flatMap((page) => page.data) || [];
  const bookmarks = bookmarksData?.pages.flatMap((page) => page.data) || [];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {user.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={`${user.username}'s avatar`}
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200 text-gray-400">
                <DefaultProfileIcon size={40} />
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  <EmojiRenderer text={user.displayName || user.username} />
                </h1>
                <p className="text-gray-600">@{user.username}</p>
              </div>
              
              <div className="flex items-center space-x-2">
                {isOwnProfile && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      title="Profile options"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {showProfileDropdown && (
                      <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[180px]">
                        <button
                          onClick={() => {
                            openEditModal();
                            setShowProfileDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit profile</span>
                        </button>
                        <hr className="my-1" />
                        <button
                          onClick={() => {
                            setShowDeleteModal(true);
                            setShowProfileDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete account</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!isOwnProfile && (
                  <button
                    onClick={handleFollow}
                    disabled={followMutation.isPending}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed ${
                      user.isFollowing
                        ? 'bg-transparent text-gray-700 border border-gray-300 hover:bg-primary/10 hover:text-primary hover:border-primary/30'
                        : 'bg-primary text-white hover:bg-primary-dark border border-primary'
                    }`}
                  >
                    {followMutation.isPending ? 'Loading...' : (user.isFollowing ? 'Following' : 'Follow')}
                  </button>
                )}
              </div>
            </div>

            {/* Bio */}
            <div className="mt-4">
              <p className="text-gray-800 text-sm">
                {user.bio ? (
                  <EmojiRenderer text={user.bio} />
                ) : (
                  isOwnProfile ? 'Add a bio to tell people about yourself' : 'No bio yet'
                )}
              </p>
            </div>

            {/* Location */}
            {user.location && (
              <div className="mt-2 flex items-center text-gray-600 text-sm">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <EmojiRenderer text={user.location} />
              </div>
            )}

            {/* Stats */}
            <div className="flex space-x-6 mt-4 text-sm">
              <div>
                <span className="font-semibold">{user._count?.tweets || 0}</span>
                <span className="text-gray-600 ml-1">Tweets</span>
              </div>
              <div>
                <span className="font-semibold">{user._count?.following || 0}</span>
                <span className="text-gray-600 ml-1">Following</span>
              </div>
              <div>
                <span className="font-semibold">{user._count?.followers || 0}</span>
                <span className="text-gray-600 ml-1">Followers</span>
              </div>
            </div>

            <p className="text-gray-500 text-sm mt-2">
              Joined {new Date(user.createdAt).toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('tweets')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'tweets'
                ? 'text-primary border-b-2 border-primary bg-primary/10'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Tweets
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'followers'
                ? 'text-primary border-b-2 border-primary bg-primary/10'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Followers
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'following'
                ? 'text-primary border-b-2 border-primary bg-primary/10'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Following
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'bookmarks'
                  ? 'text-primary border-b-2 border-primary bg-primary/10'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Bookmarks
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'tweets' && (
            <div>
              {tweetsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* Pinned Tweet Section */}
                  {user.pinnedTweet && (
                    <div className="mb-0">
                      <TweetItem tweet={user.pinnedTweet} showPinnedIndicator={true} />
                    </div>
                  )}
                  
                  {/* Regular Tweets */}
                  {tweets.length === 0 && !user.pinnedTweet ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">
                        {isOwnProfile ? "You haven't posted any tweets yet." : `@${username} hasn't posted any tweets yet.`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {tweets.map((tweet) => (
                        <TweetItem key={tweet.id} tweet={tweet} />
                      ))}
                      {hasNextTweetsPage && (
                        <div className="text-center pt-6">
                          <button
                            onClick={() => fetchNextTweetsPage()}
                            disabled={isFetchingNextTweetsPage}
                            className="btn btn-secondary"
                          >
                            {isFetchingNextTweetsPage ? 'Loading...' : 'Load more'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'followers' && (
            <div>
              {followersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : followers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No followers yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {followers.map((follower) => (
                    <div key={follower.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {follower.avatarUrl ? (
                          <img 
                            src={follower.avatarUrl} 
                            alt={`${follower.username}'s avatar`}
                            className="w-10 h-10 rounded-full object-cover cursor-pointer"
                            onClick={() => handleUserClick(follower.username)}
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer text-gray-400"
                            onClick={() => handleUserClick(follower.username)}
                          >
                            <DefaultProfileIcon size={20} />
                          </div>
                        )}
                        <div>
                          <p 
                            className="font-medium cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleUserClick(follower.username)}
                          >
                            <EmojiRenderer text={follower.displayName || follower.username} />
                          </p>
                          <p 
                            className="text-sm text-gray-500 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleUserClick(follower.username)}
                          >
                            @{follower.username}
                          </p>
                          {follower.bio && (
                            <p className="text-sm text-gray-600">
                              <EmojiRenderer text={follower.bio} />
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {hasNextFollowersPage && (
                    <div className="text-center pt-6">
                      <button
                        onClick={() => fetchNextFollowersPage()}
                        disabled={isFetchingNextFollowersPage}
                        className="btn btn-secondary"
                      >
                        {isFetchingNextFollowersPage ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'following' && (
            <div>
              {followingLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : following.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {isOwnProfile ? "You're not following anyone yet." : `@${username} isn't following anyone yet.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {following.map((followedUser) => (
                    <div key={followedUser.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {followedUser.avatarUrl ? (
                          <img 
                            src={followedUser.avatarUrl} 
                            alt={`${followedUser.username}'s avatar`}
                            className="w-10 h-10 rounded-full object-cover cursor-pointer"
                            onClick={() => handleUserClick(followedUser.username)}
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer text-gray-400"
                            onClick={() => handleUserClick(followedUser.username)}
                          >
                            <DefaultProfileIcon size={20} />
                          </div>
                        )}
                        <div>
                          <p 
                            className="font-medium cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleUserClick(followedUser.username)}
                          >
                            <EmojiRenderer text={followedUser.displayName || followedUser.username} />
                          </p>
                          <p 
                            className="text-sm text-gray-500 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleUserClick(followedUser.username)}
                          >
                            @{followedUser.username}
                          </p>
                          {followedUser.bio && (
                            <p className="text-sm text-gray-600">
                              <EmojiRenderer text={followedUser.bio} />
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {hasNextFollowingPage && (
                    <div className="text-center pt-6">
                      <button
                        onClick={() => fetchNextFollowingPage()}
                        disabled={isFetchingNextFollowingPage}
                        className="btn btn-secondary"
                      >
                        {isFetchingNextFollowingPage ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookmarks' && isOwnProfile && (
            <div>
              {bookmarksLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : bookmarks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No bookmarks yet. Start bookmarking tweets to see them here!</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {bookmarks.map((tweet) => (
                    <TweetItem key={tweet.id} tweet={tweet} />
                  ))}
                  {hasNextBookmarksPage && (
                    <div className="text-center pt-6">
                      <button
                        onClick={() => fetchNextBookmarksPage()}
                        disabled={isFetchingNextBookmarksPage}
                        className="btn btn-secondary"
                      >
                        {isFetchingNextBookmarksPage ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Display Name */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name
                  </label>
                  <div className="relative">
                    <input
                      ref={displayNameInputRef}
                      type="text"
                      value={editForm.displayName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                      onFocus={() => setFocusedField('displayName')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full p-3 pr-12 border rounded-lg transition-colors ${
                        focusedField === 'displayName' 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : 'border-gray-300 hover:border-gray-400'
                      } focus:outline-none`}
                      maxLength={50}
                      placeholder="Enter your display name..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(showEmojiPicker === 'displayName' ? null : 'displayName')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-gray-100 transition-colors opacity-60 hover:opacity-100"
                      title="Add emoji"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                        <circle cx="9" cy="9" r="1" fill="currentColor"/>
                        <circle cx="15" cy="9" r="1" fill="currentColor"/>
                        <path strokeLinecap="round" strokeWidth="1.5" d="m9 16c.85.63 2.025 1 3 1s2.15-.37 3-1"/>
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{editForm.displayName.length}/50</p>
                  
                  {/* Emoji Picker for Display Name */}
                  {showEmojiPicker === 'displayName' && (
                    <div ref={emojiPickerRef} className="absolute top-full left-0 z-50 mt-2">
                      <EmojiPicker
                        onEmojiClick={(emojiData) => handleEmojiClick(emojiData, 'displayName')}
                        width={300}
                        height={400}
                      />
                    </div>
                  )}
                </div>

                {/* Bio */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <div className="relative">
                    <textarea
                      ref={bioTextareaRef}
                      value={editForm.bio}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      onFocus={() => setFocusedField('bio')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full p-3 pr-12 border rounded-lg resize-none transition-colors ${
                        focusedField === 'bio' 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : 'border-gray-300 hover:border-gray-400'
                      } focus:outline-none`}
                      rows={4}
                      maxLength={160}
                      placeholder="Tell people about yourself..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(showEmojiPicker === 'bio' ? null : 'bio')}
                      className="absolute right-3 top-3 p-1 rounded-md hover:bg-gray-100 transition-colors opacity-60 hover:opacity-100"
                      title="Add emoji"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                        <circle cx="9" cy="9" r="1" fill="currentColor"/>
                        <circle cx="15" cy="9" r="1" fill="currentColor"/>
                        <path strokeLinecap="round" strokeWidth="1.5" d="m9 16c.85.63 2.025 1 3 1s2.15-.37 3-1"/>
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{editForm.bio.length}/160</p>
                  
                  {/* Emoji Picker for Bio */}
                  {showEmojiPicker === 'bio' && (
                    <div ref={emojiPickerRef} className="absolute top-full left-0 z-50 mt-2">
                      <EmojiPicker
                        onEmojiClick={(emojiData) => handleEmojiClick(emojiData, 'bio')}
                        width={300}
                        height={400}
                      />
                    </div>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                      onFocus={() => setFocusedField('location')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full p-3 pl-10 border rounded-lg transition-colors ${
                        focusedField === 'location' 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : 'border-gray-300 hover:border-gray-400'
                      } focus:outline-none`}
                      maxLength={50}
                      placeholder="Where are you from?"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{editForm.location.length}/50</p>
                </div>

                {/* Avatar URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={editForm.avatarUrl}
                    onChange={(e) => handleAvatarUrlChange(e.target.value)}
                    onFocus={() => setFocusedField('avatarUrl')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full p-3 border rounded-lg transition-colors ${
                      avatarError 
                        ? 'border-red-500 ring-2 ring-red-200' 
                        : focusedField === 'avatarUrl' 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : 'border-gray-300 hover:border-gray-400'
                    } focus:outline-none`}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <p className={`text-xs mt-1 ${avatarError ? 'text-red-500' : 'text-gray-500'}`}>
                    {avatarError ? 'Invalid image URL - please check the link' : 'Enter a URL for your profile picture'}
                  </p>
                </div>

                {/* Preview */}
                {editForm.avatarUrl && !avatarError && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Avatar Preview
                    </label>
                    <div className="flex items-center space-x-3">
                      <img
                        src={editForm.avatarUrl}
                        alt="Avatar preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                        onError={() => setAvatarError(true)}
                      />
                      <div className="text-sm text-green-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Image loaded successfully
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={avatarError}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    avatarError 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-primary text-white hover:bg-primary-dark'
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-red-600">Delete Account</h2>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={deleteProfileMutation.isPending}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <h3 className="font-semibold text-red-800">Are you sure you want to do this?</h3>
                  </div>
                  <p className="text-red-700 text-sm">
                    This action cannot be undone. This will permanently delete your account, all your tweets, and remove all your data from our servers.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your password to confirm:
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none"
                    placeholder="Your password"
                    disabled={deleteProfileMutation.isPending}
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                  }}
                  disabled={deleteProfileMutation.isPending}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProfile}
                  disabled={deleteProfileMutation.isPending || !deletePassword.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    deleteProfileMutation.isPending || !deletePassword.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {deleteProfileMutation.isPending ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
