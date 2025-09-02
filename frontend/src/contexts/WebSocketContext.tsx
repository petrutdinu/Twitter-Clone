import React, { createContext, useContext, ReactNode } from 'react';
import { Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (toUserId: string, text: string, gifUrl?: string) => void;
  startTyping: (toUserId: string) => void;
  stopTyping: (toUserId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  value: WebSocketContextType;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, value }) => {
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};
