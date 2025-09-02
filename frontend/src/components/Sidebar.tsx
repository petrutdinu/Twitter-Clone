import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useNotifications } from '../hooks/useNotifications';
import { useMessageNotifications } from '../hooks/useMessageNotifications';
import EmojiRenderer from './EmojiRenderer';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMessageCount } = useMessageNotifications();

  const navigation = [
    { name: 'Home', href: '/', icon: '🏠' },
    { name: 'Explore', href: '/trends', icon: '🔭' },
    { name: 'Notifications', href: '/notifications', icon: '🔔' },
    { name: 'Messages', href: '/messages', icon: '💬' },
    { name: 'Search', href: '/search', icon: '🔍' },
    { name: 'Profile', href: `/profile/${user?.username}`, icon: '👤' },
  ];

  return (
    <nav className="w-56 bg-white rounded-lg shadow p-4 flex-shrink-0">
      <div className="space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors relative ${
              location.pathname === item.href
                ? 'bg-primary text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}            >
              <EmojiRenderer text={item.icon} />
              <span className="font-medium">{item.name}</span>
            {/* Show notification indicator for notifications tab */}
            {item.name === 'Notifications' && unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
            {/* Show notification indicator for messages tab */}
            {item.name === 'Messages' && unreadMessageCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </div>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default Sidebar;
