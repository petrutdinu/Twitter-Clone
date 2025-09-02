import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import DefaultProfileIcon from './DefaultProfileIcon';
import EmojiRenderer from './EmojiRenderer';
import { DirectMessage } from '../types';

interface MessageItemProps {
  message: DirectMessage;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  onDeleteMessage?: (messageId: string) => void;
}

const SeenIcon: React.FC<{ isRead: boolean; className?: string }> = ({ isRead, className = "" }) => {
  return (
    <svg 
      fill={isRead ? "#3B82F6" : "#9CA3AF"} 
      width="12" 
      height="12" 
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M2.305,11.235a1,1,0,0,1,1.414.024l3.206,3.319L14.3,7.289A1,1,0,0,1,15.7,8.711l-8.091,8a1,1,0,0,1-.7.289H6.9a1,1,0,0,1-.708-.3L2.281,12.649A1,1,0,0,1,2.305,11.235ZM20.3,7.289l-7.372,7.289-.263-.273a1,1,0,1,0-1.438,1.39l.966,1a1,1,0,0,0,.708.3h.011a1,1,0,0,0,.7-.289l8.091-8A1,1,0,0,0,20.3,7.289Z"/>
    </svg>
  );
};

const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isOwnMessage, 
  showAvatar = false,
  onDeleteMessage 
}) => {
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Function to check if message contains only emojis (up to 10)
  const isEmojiOnly = (text: string): boolean => {
    // Remove all whitespace
    const trimmedText = text.replace(/\s/g, '');
    if (!trimmedText) return false;
    
    // Regex to match most emoji characters (including multi-codepoint)
    const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
    const matched = trimmedText.match(emojiRegex);
    
    // If the entire trimmedText is made up of emojis, and there are at most 10
    return !!matched && matched.join('') === trimmedText && matched.length <= 10;
  };

  const messageIsEmojiOnly = !message.isDeleted && isEmojiOnly(message.text);

  const handleDeleteClick = () => {
    if (onDeleteMessage) {
      onDeleteMessage(message.id);
    }
    setShowDeleteMenu(false);
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      {/* Profile icon for other users (always show) */}
      {!isOwnMessage && (
        <div className="mr-3 flex-shrink-0">
          <Link to={`/profile/${message.sender.username}`} className="block">
            {message.sender.avatarUrl ? (
              <img
                src={message.sender.avatarUrl}
                alt={message.sender.username}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100 hover:ring-primary transition-colors"
                title={`Go to ${message.sender.username}'s profile`}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100 hover:ring-primary transition-colors"
                   title={`Go to ${message.sender.username}'s profile`}>
                <DefaultProfileIcon size={16} />
              </div>
            )}
          </Link>
        </div>
      )}
      
      {/* Message content and timestamp */}
      <div className="flex flex-col">
        {/* Username for other users' messages */}
        {!isOwnMessage && (
          <div className="mb-1">
            <Link 
              to={`/profile/${message.sender.username}`}
              className="text-xs font-medium text-gray-600 hover:text-primary hover:underline"
            >
              {message.sender.displayName || message.sender.username}
            </Link>
          </div>
        )}
        
        {/* Message bubble, emoji-only message, GIF, or deleted message */}
        {message.isDeleted ? (
          /* Deleted message */
          <div
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              isOwnMessage
                ? 'bg-gray-100 text-gray-500 rounded-br-sm border border-gray-200'
                : 'bg-gray-100 text-gray-500 rounded-bl-sm border border-gray-200'
            }`}
          >
            <p className="text-sm italic">
              <EmojiRenderer text="This message has been deleted" />
            </p>
          </div>
  ) : message.gifUrl ? (
          /* GIF message */
          <div className="max-w-xs lg:max-w-md relative group">
            {/* Delete button for own GIF messages */}
            {isOwnMessage && onDeleteMessage && (
              <div className="absolute top-2 right-2 z-10">
                <div className="relative">
                  <button
                    onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70"
                    title="Message options"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                    </svg>
                  </button>
                  
                  {showDeleteMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] z-20">
                      <button
                        onClick={handleDeleteClick}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <img
              src={message.gifUrl}
              alt="GIF"
              className="rounded-lg max-w-full h-auto"
              style={{ maxHeight: '200px' }}
              onLoad={() => {
                // Trigger scroll when GIF loads to ensure proper positioning
                setTimeout(() => {
                  const messageContainer = document.querySelector('[data-messages-container]');
                  if (messageContainer) {
                    messageContainer.scrollTop = messageContainer.scrollHeight;
                  }
                }, 100);
              }}
            />
            {message.text && (
              <div
                className={`mt-2 px-4 py-2 rounded-lg ${
                  isOwnMessage
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-gray-200 text-gray-900 rounded-bl-sm'
                }`}
              >
                <p className="text-sm break-words">
                  <EmojiRenderer text={message.text} />
                </p>
              </div>
            )}
          </div>
        ) : message.imageUrl ? (
          /* Image message */
          <div className="max-w-xs lg:max-w-md relative group">
            {isOwnMessage && onDeleteMessage && (
              <div className="absolute top-2 right-2 z-10">
                <div className="relative">
                  <button
                    onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70"
                    title="Message options"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                    </svg>
                  </button>
                  {showDeleteMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] z-20">
                      <button
                        onClick={handleDeleteClick}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <img
              src={message.imageUrl}
              alt="Image"
              className="rounded-lg max-w-full h-auto"
              style={{ maxHeight: '240px' }}
              onLoad={() => {
                setTimeout(() => {
                  const messageContainer = document.querySelector('[data-messages-container]');
                  if (messageContainer) {
                    messageContainer.scrollTop = messageContainer.scrollHeight;
                  }
                }, 100);
              }}
            />
            {message.text && (
              <div
                className={`mt-2 px-4 py-2 rounded-lg ${
                  isOwnMessage
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-gray-200 text-gray-900 rounded-bl-sm'
                }`}
              >
                <p className="text-sm break-words">
                  <EmojiRenderer text={message.text} />
                </p>
              </div>
            )}
          </div>
        ) : messageIsEmojiOnly ? (
          /* Emoji-only message without bubble */
          <div className="relative group">
            {/* Delete button for own emoji messages */}
            {isOwnMessage && onDeleteMessage && (
              <div className="absolute -top-1 -right-1 z-10">
                <div className="relative">
                  <button
                    onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-600 text-white rounded-full p-1 hover:bg-gray-700 text-xs"
                    title="Message options"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                    </svg>
                  </button>
                  
                  {showDeleteMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] z-20">
                      <button
                        onClick={handleDeleteClick}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="text-3xl leading-none">
              <EmojiRenderer text={message.text} />
            </div>
          </div>
        ) : (
          /* Regular message with bubble */
          <div className="relative group">
            {/* Delete button for own text messages */}
            {isOwnMessage && onDeleteMessage && (
              <div className="absolute -top-2 -right-2 z-10">
                <div className="relative">
                  <button
                    onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-600 text-white rounded-full p-1 hover:bg-gray-700 text-xs"
                    title="Message options"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                    </svg>
                  </button>
                  
                  {showDeleteMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] z-20">
                      <button
                        onClick={handleDeleteClick}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                isOwnMessage
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-gray-200 text-gray-900 rounded-bl-sm'
              }`}
            >
              <p className="text-sm break-words">
                <EmojiRenderer text={message.text} />
              </p>
            </div>
          </div>
        )}
        
        {/* Timestamp and status indicator under the bubble */}
        <div className={`mt-1 flex items-center ${isOwnMessage ? 'justify-end' : 'justify-start'} space-x-1`}>
          <p className="text-xs text-gray-500">
            {formatTime(message.createdAt)}
          </p>
          {/* Status indicator next to timestamp for own messages */}
          {isOwnMessage && (
            <SeenIcon isRead={message.status === 'READ'} />
          )}
        </div>
      </div>
      
      {/* Profile icon for own messages (always show) */}
      {isOwnMessage && (
        <div className="ml-3 flex-shrink-0">
          <Link to={`/profile/${message.sender.username}`} className="block">
            {message.sender.avatarUrl ? (
              <img
                src={message.sender.avatarUrl}
                alt={message.sender.username}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100 hover:ring-primary transition-colors"
                title={`Go to ${message.sender.username}'s profile`}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100 hover:ring-primary transition-colors"
                   title={`Go to ${message.sender.username}'s profile`}>
                <DefaultProfileIcon size={16} />
              </div>
            )}
          </Link>
        </div>
      )}
    </div>
  );
};

export default MessageItem;
