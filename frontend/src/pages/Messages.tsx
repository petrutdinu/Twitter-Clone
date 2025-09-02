import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { dmApi } from '../api/dm';
import { searchApi } from '../api/search';
import { useAuthStore } from '../store/auth';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useToast } from '../hooks/useToast';
import { useMessageNotifications } from '../hooks/useMessageNotifications';
import DefaultProfileIcon from '../components/DefaultProfileIcon';
import MessageItem from '../components/MessageItem';
import ConversationItem from '../components/ConversationItem';
import EmojiRenderer from '../components/EmojiRenderer';
import GifPicker from '../components/GifPicker';
import gifIcon from '../assets/icons/gif.svg';
import { DirectMessage, GifObject } from '../types';

interface ConversationPartner {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

interface Conversation {
  id: string;
  text: string;
  created_at: string;
  sender_id: string;
  sender_username: string;
  sender_display_name?: string;
  sender_avatar_url?: string;
  receiver_id: string;
  receiver_username: string;
  receiver_display_name?: string;
  receiver_avatar_url?: string;
}

interface TypingUser {
  userId: string;
  username: string;
}

const Messages: React.FC = () => {
  const { user } = useAuthStore();
  const { socket, isConnected, sendMessage, startTyping, stopTyping } = useWebSocketContext();
  const { showToast } = useToast();
  const { refreshUnreadCount } = useMessageNotifications();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ConversationPartner | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  // Get conversations
  const { data: conversationsData, isLoading: conversationsLoading, error: conversationsError } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      console.log('📥 Fetching conversations...');
      const result = await dmApi.getConversations();
      console.log('✅ Conversations loaded:', result);
      return result;
    },
  });

  // Get message history for selected conversation
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () => selectedConversation ? dmApi.getMessageHistory(selectedConversation) : null,
    enabled: !!selectedConversation,
  });

  // Search users for new message
  const { data: searchResults } = useQuery({
    queryKey: ['searchUsers', searchQuery],
    queryFn: () => searchApi.searchUsers(searchQuery, 10),
    enabled: searchQuery.length > 0,
  });

  // Get unread counts per conversation
  const { data: unreadCountsData } = useQuery({
    queryKey: ['unreadCounts'],
    queryFn: dmApi.getUnreadCountPerConversation,
    enabled: !!user,
  });

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (fromUserId: string) => dmApi.markAsRead(fromUserId),
    onSuccess: () => {
      // Invalidate messages query to update read status
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      // Invalidate unread counts to update conversation indicators
      queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
      // Refresh unread message count
      refreshUnreadCount();
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => dmApi.deleteMessage(messageId),
    onSuccess: () => {
      // Invalidate messages and conversations to update UI
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      showToast('Message deleted', 'success');
    },
    onError: (error: any) => {
      console.error('Error deleting message:', error);
      showToast(error.response?.data?.message || 'Failed to delete message', 'error');
    },
  });

  // Listen for real-time events
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: DirectMessage) => {
      console.log('📨 Received real-time DM:', message);
      
      // Update conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      // If this message is part of the current conversation, update it
      if (selectedConversation && 
          (message.sender.id === selectedConversation || message.receiver.id === selectedConversation)) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
        
        // Auto-mark as read if we're currently viewing this conversation and the message is from the other person
        if (message.sender.id === selectedConversation && user?.id !== message.sender.id) {
          console.log('🔵 Auto-marking message as read since conversation is open');
          markAsReadMutation.mutate(selectedConversation);
        }
      }

      // Show notification if not in current conversation
      if (!selectedConversation || 
          (message.sender.id !== selectedConversation && message.receiver.id !== selectedConversation)) {
        showToast(`New message from @${message.sender.username}`, 'info');
      }
    };

    const handleTypingStart = (data: TypingUser) => {
      console.log('⌨️ User started typing:', data);
      if (data.userId === selectedConversation) {
        setTypingUsers(prev => {
          if (!prev.find(u => u.userId === data.userId)) {
            return [...prev, data];
          }
          return prev;
        });
        setShowTypingIndicator(true);
      }
    };

    const handleTypingStop = (data: TypingUser) => {
      console.log('⌨️ User stopped typing:', data);
      setTypingUsers(prev => {
        const newUsers = prev.filter(u => u.userId !== data.userId);
        if (newUsers.length === 0) {
          setShowTypingIndicator(false);
        }
        return newUsers;
      });
    };

    const handleDMError = (error: { message: string }) => {
      console.error('❌ DM WebSocket error:', error);
      showToast(error.message, 'error');
    };

    const handleUserOnline = (data: { userId: string, username: string }) => {
      console.log('🟢 User came online:', data);
      setOnlineUsers(prev => {
        const newSet = new Set([...prev, data.userId]);
        console.log('Updated online users (after user online):', Array.from(newSet));
        return newSet;
      });
    };

    const handleUserOffline = (data: { userId: string, username: string }) => {
      console.log('🔴 User went offline:', data);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        console.log('Updated online users (after user offline):', Array.from(newSet));
        return newSet;
      });
    };

    const handleOnlineUsers = (data: { userIds: string[] }) => {
      console.log('👥 Online users list received:', data);
      setOnlineUsers(new Set(data.userIds));
      console.log('Set online users to:', data.userIds);
    };

    const handleMessagesRead = (data: { readBy: string, conversationWith: string }) => {
      console.log('✅ Messages read:', data);
      // This event is received when someone reads OUR messages
      // readBy = the person who read our messages
      // conversationWith = us (the sender of the original messages)
      // So we need to invalidate the conversation with the person who read our messages (data.readBy)
      if (selectedConversation === data.readBy) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      }
    };

    const handleMessageDeleted = (data: { messageId: string, senderId: string, receiverId: string, deletedAt: string }) => {
      console.log('🗑️ Message deleted:', data);
      // Update the messages in the current conversation
      if (selectedConversation && 
          (selectedConversation === data.senderId || selectedConversation === data.receiverId)) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      }
      // Update conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    socket.on('dm', handleNewMessage);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('dm_error', handleDMError);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);
    socket.on('online_users', handleOnlineUsers);
    socket.on('messages_read', handleMessagesRead);
    socket.on('message_deleted', handleMessageDeleted);

    // Request current online users when socket connects
    socket.emit('request_online_users');

    return () => {
      socket.off('dm', handleNewMessage);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('dm_error', handleDMError);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
      socket.off('online_users', handleOnlineUsers);
      socket.off('messages_read', handleMessagesRead);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [socket, selectedConversation, queryClient, showToast, user]);

  // Auto-scroll to bottom when new messages arrive or typing status changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData?.messages, typingUsers]);

  // Force scroll to bottom - used after sending messages
  const scrollToBottom = (forceImmediate = false) => {
    const messageContainer = document.querySelector('[data-messages-container]') as HTMLElement;
    if (messageContainer) {
      if (forceImmediate) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
      } else {
        messageContainer.scrollTo({
          top: messageContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
    // Fallback to ref method
    if (forceImmediate) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Enhanced scroll for GIF messages - waits for potential image loading
  const scrollToBottomWithDelay = () => {
    // Multiple scroll attempts to handle image loading
    setTimeout(() => scrollToBottom(true), 50);
    setTimeout(() => scrollToBottom(), 200);
    setTimeout(() => scrollToBottom(), 500);
    setTimeout(() => scrollToBottom(), 1000);
  };

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (selectedConversation && messagesData?.messages) {
      console.log('🔵 Marking messages as read for conversation:', selectedConversation);
      // Mark messages from the other user as read
      markAsReadMutation.mutate(selectedConversation);
    }
  }, [selectedConversation, messagesData?.messages?.length]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Handle typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!selectedConversation) return;

    // Start typing if there's text and not already typing
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      startTyping(selectedConversation);
    }

    // Stop typing if field is empty and currently typing
    if (!value.trim() && isTyping) {
      setIsTyping(false);
      stopTyping(selectedConversation);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const input = messageInputRef.current;
    
    if (input) {
      const cursorPos = input.selectionStart || newMessage.length;
      const newValue = newMessage.slice(0, cursorPos) + emoji + newMessage.slice(cursorPos);
      setNewMessage(newValue);
      
      // Set cursor position after emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
      }, 0);
    } else {
      setNewMessage(prev => prev + emoji);
    }
    
    setShowEmojiPicker(false);
  };

  const conversations = conversationsData?.conversations || [];
  const messages = messagesData?.messages || [];
  const otherUser = messagesData?.otherUser;

  console.log('📊 Current conversations state:', { 
    conversationsData, 
    conversations: conversations.length, 
    conversationsLoading, 
    conversationsError 
  });

  const handleDeleteMessage = (messageId: string) => {
    console.log('🗑️ Deleting message:', messageId);
    deleteMessageMutation.mutate(messageId);
  };

  const handleSendMessage = () => {
    if (!selectedConversation) return;
    if (!newMessage.trim() && !imageFile) return;
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      stopTyping(selectedConversation);
    }

    // If image attached, use REST API (multipart) so backend can upload to S3, then socket emits from server
    if (imageFile) {
      dmApi.sendMessage(selectedConversation, newMessage.trim(), undefined, imageFile)
        .then(() => {
          setImageFile(null);
          setNewMessage('');
          scrollToBottomWithDelay();
        })
        .catch(err => {
          console.error('Failed to send image message', err);
          showToast('Failed to send image', 'error');
        });
    } else {
      // Send via WebSocket for real-time delivery (text / gif only)
      sendMessage(selectedConversation, newMessage.trim());
      setNewMessage('');
    }
    
    // Auto-scroll to bottom after sending
    setTimeout(() => scrollToBottom(), 100);
  };

  const handleSendGif = (gif: GifObject) => {
    if (!selectedConversation) return;
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      stopTyping(selectedConversation);
    }

    // Send GIF via WebSocket
    sendMessage(selectedConversation, newMessage.trim(), gif.images.original.url);
    setNewMessage('');
    setShowGifPicker(false);
    
    // Enhanced auto-scroll for GIF messages (accounts for image loading)
    scrollToBottomWithDelay();
  };

  const handleStartNewConversation = (user: any) => {
    setSelectedConversation(user.id);
    setSelectedUser(user);
    setShowNewMessageModal(false);
    setSearchQuery('');
  };

  const getConversationPartner = (conversation: Conversation) => {
    if (conversation.sender_id === user?.id) {
      return {
        id: conversation.receiver_id,
        username: conversation.receiver_username,
        displayName: conversation.receiver_display_name,
        avatarUrl: conversation.receiver_avatar_url,
      };
    } else {
      return {
        id: conversation.sender_id,
        username: conversation.sender_username,
        displayName: conversation.sender_display_name,
        avatarUrl: conversation.sender_avatar_url,
      };
    }
  };

  return (
    <div className="bg-white rounded-lg shadow h-[calc(100vh-9rem)] flex">
      {/* Connection Status */}
      {!isConnected && (
        <div className="absolute top-2 right-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs z-10">
          <EmojiRenderer text="🔴 Disconnected" />
        </div>
      )}

      {/* Conversations List */}
      <div className="w-20 border-r border-gray-200 flex flex-col bg-gray-50 relative">
        <div className="h-[77px] p-4 border-b border-gray-200 bg-gray-50 flex items-center">
          <div className="flex justify-center w-full">
            <button
              onClick={() => setShowNewMessageModal(true)}
              className="bg-blue-500 text-white p-1.5 rounded-full hover:bg-blue-600 transition-colors duration-200 shadow-sm hover:shadow-md flex items-center justify-center"
              disabled={!isConnected}
              title="New Message ✉️"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-3">
          {conversationsLoading ? (
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          ) : conversationsError ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="space-y-3 px-2">
              {conversations.map((conversation) => {
                const partner = getConversationPartner(conversation);
                const isSelected = selectedConversation === partner.id;
                const unreadCount = unreadCountsData?.unreadPerConversation[partner.id] || 0;
                
                return (
                  <div
                    key={`${conversation.sender_id}-${conversation.receiver_id}`}
                    onClick={() => {
                      setSelectedConversation(partner.id);
                      setSelectedUser(partner);
                      setTypingUsers([]);
                    }}
                    className={`relative cursor-pointer transition-all duration-200 rounded-full ${
                      isSelected 
                        ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-50' 
                        : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2 hover:ring-offset-gray-50'
                    }`}
                    title={`@${partner.username} ${onlineUsers.has(partner.id) ? '🟢' : '🔴'}`}
                  >
                    {partner.avatarUrl ? (
                      <img
                        src={partner.avatarUrl}
                        alt={partner.username}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100">
                        <DefaultProfileIcon size={24} />
                      </div>
                    )}
                    {/* Unread message indicator */}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1 font-medium border-2 border-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </div>
                    )}
                    {/* Online indicator for selected user */}
                    {isSelected && onlineUsers.has(partner.id) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                    {/* Online indicator for non-selected users */}
                    {!isSelected && onlineUsers.has(partner.id) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* User Profile Indicator - matching message input layout */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <div className="flex-1 flex justify-center">
              <div className="relative">
                {/* Profile Picture */}
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-[2.625rem] h-[2.625rem] rounded-full object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-[2.625rem] h-[2.625rem] rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shadow-sm">
                    <DefaultProfileIcon size={20} />
                  </div>
                )}
                
                {/* Status Dot Overlay */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} title={isConnected ? 'Online' : 'Offline'}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Link to={`/profile/${selectedUser?.username || otherUser?.username}`} className="block">
                    {selectedUser?.avatarUrl ? (
                      <img
                        src={selectedUser.avatarUrl}
                        alt={selectedUser.username}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 hover:ring-primary transition-colors"
                        title={`Go to ${selectedUser.username}'s profile`}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100 hover:ring-primary transition-colors"
                           title={`Go to ${selectedUser?.username || otherUser?.username}'s profile`}>
                        <DefaultProfileIcon size={20} />
                      </div>
                    )}
                  </Link>
                  <div>
                    <Link 
                      to={`/profile/${selectedUser?.username || otherUser?.username}`}
                      className="font-medium text-gray-900 hover:text-primary hover:underline block"
                    >
                      <EmojiRenderer text={selectedUser?.displayName || otherUser?.displayName || `@${selectedUser?.username || otherUser?.username}`} />
                    </Link>
                    <div className="text-sm text-gray-500 flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        selectedUser?.id && onlineUsers.has(selectedUser.id) 
                          ? 'bg-green-500' 
                          : 'bg-gray-400'
                      }`}></span>
                      <EmojiRenderer text={
                        selectedUser?.id && onlineUsers.has(selectedUser.id) 
                          ? 'Online' 
                          : 'Offline'
                      } />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setSelectedUser(null);
                    setTypingUsers([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
                  title="Close chat"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4" data-messages-container>
              {messagesLoading ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p><EmojiRenderer text="Loading messages... ⏳" /></p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="mb-4">
                    <EmojiRenderer text="👋" className="text-4xl" />
                  </div>
                  <p className="font-medium">No messages yet</p>
                  <p className="text-sm mt-2"><EmojiRenderer text="Start the conversation! ✨" /></p>
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map((message, index) => {
                    const isOwnMessage = message.sender.id === user?.id;
                    
                    return (
                      <MessageItem
                        key={message.id}
                        message={message}
                        isOwnMessage={isOwnMessage}
                        showAvatar={true}
                        onDeleteMessage={handleDeleteMessage}
                      />
                    );
                  })}
                  
                  {/* Typing indicator - part of chat flow */}
                  <div className={`transition-all duration-300 ease-in-out ${
                    typingUsers.length > 0 && showTypingIndicator
                      ? 'opacity-100 translate-y-0 max-h-20' 
                      : 'opacity-0 translate-y-2 max-h-0'
                  }`}>
                    {typingUsers.length > 0 && (
                      <div className="flex justify-start mt-2">
                        <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 relative">
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  {imageFile && (
                    <div className="absolute -top-14 left-0 flex items-center space-x-2 bg-white p-2 rounded-md shadow border">
                      <div className="relative">
                        <img src={URL.createObjectURL(imageFile)} alt="preview" className="w-12 h-12 object-cover rounded" />
                        <button
                          onClick={() => setImageFile(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs"
                          title="Remove image"
                        >×</button>
                      </div>
                      <span className="text-xs text-gray-600 max-w-[120px] truncate">{imageFile.name}</span>
                    </div>
                  )}
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={isConnected ? "Type a message..." : "Connecting..."}
                    className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={!isConnected}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                    <label className="p-1 rounded-md hover:bg-gray-100 transition-colors opacity-60 hover:opacity-100 cursor-pointer flex items-center justify-center" title="Attach image">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setImageFile(file);
                        }}
                        disabled={!isConnected}
                      />
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Z" />
                        <circle cx="9" cy="9" r="2" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowGifPicker(!showGifPicker)}
                      className="p-1 rounded-md hover:bg-gray-100 transition-colors opacity-60 hover:opacity-100 flex items-center justify-center"
                      title="Add GIF"
                      disabled={!isConnected}
                    >
                      <img src={gifIcon} alt="GIF" className="w-5 h-5 text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1 rounded-md hover:bg-gray-100 transition-colors opacity-60 hover:opacity-100 flex items-center justify-center"
                      title="Add emoji"
                      disabled={!isConnected}
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                        <circle cx="9" cy="9" r="1" fill="currentColor"/>
                        <circle cx="15" cy="9" r="1" fill="currentColor"/>
                        <path strokeLinecap="round" strokeWidth="1.5" d="m9 16c.85.63 2.025 1 3 1s2.15-.37 3-1"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={(!newMessage.trim() && !imageFile) || !isConnected}
                  className="bg-primary text-white px-6 py-2 rounded-full hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <span>Send</span>
                </button>
              </div>
              
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute bottom-full right-4 z-50 mb-2">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width={300}
                    height={400}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
            <div className="text-center">
              <div className="mb-4">
                <EmojiRenderer text="✉️" className="text-6xl" />
              </div>
              <p className="text-xl font-medium"><EmojiRenderer text="Select a conversation" /></p>
              <p className="text-sm mt-2"><EmojiRenderer text="Choose from existing conversations or start a new one ✨" /></p>
            </div>
          </div>
        )}
      </div>

      {/* GIF Picker Modal */}
      {showGifPicker && (
        <GifPicker
          onGifSelect={handleSendGif}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">New Message</h2>
              <button
                onClick={() => {
                  setShowNewMessageModal(false);
                  setSearchQuery('');
                }}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                <EmojiRenderer text="✕" />
              </button>
            </div>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-4"
              autoFocus
            />
            
            <div className="max-h-48 overflow-y-auto">
              {searchQuery && searchResults?.users?.length === 0 && (
                <p className="text-gray-500 text-center py-8"><EmojiRenderer text="No users found" /></p>
              )}
              
              {searchResults?.users?.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleStartNewConversation(user)}
                  className="flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 ring-2 ring-gray-100">
                      <DefaultProfileIcon size={20} />
                    </div>
                  )}
                  <div>
                    <p className="font-medium"><EmojiRenderer text={`@${user.username}`} /></p>
                    {user.displayName && (
                      <p className="text-sm text-gray-500"><EmojiRenderer text={user.displayName} /></p>
                    )}
                  </div>
                </div>
              ))}
              
              {!searchQuery && (
                <div className="text-center py-8 text-gray-500">
                  <EmojiRenderer text="🔍" className="text-3xl block mb-2" />
                  <p>Start typing to search for users</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
