import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { DirectMessage } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (toUserId: string, text: string) => void;
  startTyping: (toUserId: string) => void;
  stopTyping: (toUserId: string) => void;
}

export const useWebSocket = (token?: string): UseWebSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      console.log('No token provided for WebSocket connection');
      return;
    }

    console.log('Attempting to connect to WebSocket:', WS_URL);
    const newSocket = io(WS_URL, {
      auth: { token },
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      console.log('Closing WebSocket connection');
      newSocket.close();
    };
  }, [token]);

  const sendMessage = (toUserId: string, text: string, gifUrl?: string) => {
    if (socket && isConnected) {
      socket.emit('send_dm', { toUserId, text, gifUrl });
    }
  };

  const startTyping = (toUserId: string) => {
    if (socket && isConnected) {
      socket.emit('typing:start', { toUserId });
    }
  };

  const stopTyping = (toUserId: string) => {
    if (socket && isConnected) {
      socket.emit('typing:stop', { toUserId });
    }
  };

  return { socket, isConnected, sendMessage, startTyping, stopTyping };
};
