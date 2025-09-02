import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { authApi } from './api/auth';
import { useWebSocket } from './hooks/useWebSocket';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import { ToastProvider } from './hooks/useToast';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Layout components
import Layout from './components/Layout';
import AuthLayout from './components/AuthLayout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import Tweet from './pages/Tweet';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Search from './pages/Search';
import Trends from './pages/Trends';
import Hashtag from './pages/Hashtag';

function App() {
  const { user, isAuthenticated, isLoading, login, logout, setLoading } = useAuthStore();
  const { socket, isConnected, sendMessage, startTyping, stopTyping } = useWebSocket(isAuthenticated ? localStorage.getItem('accessToken') || undefined : undefined);
  
  // Add proactive token refresh
  useTokenRefresh();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const { user } = await authApi.getMe();
          login(user, token, localStorage.getItem('refreshToken') || '');
        } catch (error) {
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [login, logout, setLoading]);

  // Handle WebSocket events
  useEffect(() => {
    if (!socket) return;

    socket.on('new_tweet', (tweet) => {
      // Handle new tweet notification
      console.log('New tweet:', tweet);
    });

    socket.on('notification', (notification) => {
      // Handle notification
      console.log('New notification:', notification);
    });

    socket.on('dm', (message) => {
      // Handle direct message
      console.log('New DM:', message);
    });

    return () => {
      socket.off('new_tweet');
      socket.off('notification');
      socket.off('dm');
    };
  }, [socket]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <WebSocketProvider value={{ socket, isConnected, sendMessage, startTyping, stopTyping }}>
        <div className="min-h-screen bg-white">
          <Routes>
            {!isAuthenticated ? (
              <>
                <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
                <Route path="/signup" element={<AuthLayout><Signup /></AuthLayout>} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : (
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="profile/:username" element={<Profile />} />
                <Route path="tweet/:id" element={<Tweet />} />
                <Route path="hashtag/:hashtag" element={<Hashtag />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="messages" element={<Messages />} />
                <Route path="search" element={<Search />} />
                <Route path="trends" element={<Trends />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            )}
          </Routes>
        </div>
      </WebSocketProvider>
    </ToastProvider>
  );
}

export default App;
