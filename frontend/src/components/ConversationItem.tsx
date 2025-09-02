import React from 'react';
import DefaultProfileIcon from './DefaultProfileIcon';

interface ConversationItemProps {
  partner: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  lastMessage: string;
  timestamp: string;
  isSelected: boolean;
  unreadCount?: number;
  onClick: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  partner,
  lastMessage,
  timestamp,
  isSelected,
  unreadCount,
  onClick,
}) => {
  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-blue-200' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        {partner.avatarUrl ? (
          <img
            src={partner.avatarUrl}
            alt={partner.username}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-100"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 ring-2 ring-gray-100">
            <DefaultProfileIcon size={24} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900 truncate">
              {partner.displayName || `@${partner.username}`}
            </p>
            <div className="flex items-center space-x-2">
              {unreadCount && unreadCount > 0 && (
                <div className="min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
              <div className="text-xs text-gray-400">
                {formatTime(timestamp)}
              </div>
            </div>
          </div>
          <p className={`text-sm truncate mt-1 ${unreadCount && unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            {lastMessage}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConversationItem;
