import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useNotifications } from '../hooks/useNotifications';
import { notificationsApi, Notification } from '../api/notifications';
import EmojiRenderer from '../components/EmojiRenderer';
import HashtagText from '../components/HashtagText';

const getNotificationText = (type: string, sourceUser: any) => {
  const displayName = sourceUser?.displayName || sourceUser?.username || 'Someone';
  const username = sourceUser?.username;
  
  switch (type) {
    case 'LIKE':
      return `${displayName} liked your tweet`;
    case 'RETWEET':
      return `${displayName} retweeted your tweet`;
    case 'FOLLOW':
      return `${displayName} followed you`;
    case 'MENTION':
      return `${displayName} mentioned you in a tweet`;
    case 'REPLY':
      return `${displayName} replied to your tweet`;
    case 'POLL_VOTE':
      return `${displayName} voted on your poll`;
    default:
      return `${displayName} interacted with you`;
  }
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'LIKE':
      return '❤️';
    case 'RETWEET':
      return '🔁';
    case 'FOLLOW':
      return '👥';
    case 'MENTION':
      return '@';
    case 'REPLY':
      return '💬';
    case 'POLL_VOTE':
      return '📊';
    default:
      return '🔔';
  }
};

const NotificationItem: React.FC<{ notification: Notification }> = ({ notification }) => {
  const { refreshUnreadCount, refreshNotifications } = useNotifications();
  const [isHovered, setIsHovered] = useState(false);
  
  const handleMarkAsRead = async () => {
    if (notification.isRead) return;
    
    try {
      await notificationsApi.markAsRead(notification.id);
      refreshUnreadCount();
      refreshNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  return (
    <Link
      to={notification.sourceTweet ? `/tweet/${notification.sourceTweet.id}` : '/'}
      className={`block p-4 border-b hover:bg-gray-50 transition-colors ${notification.isRead ? 'bg-white' : 'bg-blue-50'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleMarkAsRead}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white">
          {notification.type === 'LIKE' ? (
            <span className="text-lg">❤️</span>
          ) : (
            <EmojiRenderer text={getNotificationIcon(notification.type)} />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium">
            <EmojiRenderer text={getNotificationText(notification.type, notification.sourceUser)} />
          </p>
          {notification.sourceUser?.username && (
            <p className="text-sm text-gray-500 mt-1">
              @{notification.sourceUser.username}
            </p>
          )}
          {notification.sourceTweet && (
            <p className="text-gray-600 mt-1 line-clamp-2">
              <HashtagText text={notification.sourceTweet.text} />
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {new Date(notification.createdAt).toLocaleString()}
          </p>
        </div>
        {isHovered && !notification.isRead && (
          <button 
            className="text-xs text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleMarkAsRead();
            }}
          >
            Mark as read
          </button>
        )}
      </div>
    </Link>
  );
};

const Notifications: React.FC = () => {
  const { user } = useAuthStore();
  const { notifications, isLoadingNotifications, unreadCount, refreshUnreadCount, refreshNotifications } = useNotifications();
  
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    try {
      await notificationsApi.markAllAsRead();
      refreshUnreadCount();
      refreshNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  if (isLoadingNotifications) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Notifications</h1>
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

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm bg-primary text-white px-3 py-1 rounded-full hover:bg-primary/90 transition-colors"
          >
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>
      
      {notifications.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {notifications.map((notification: any) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
