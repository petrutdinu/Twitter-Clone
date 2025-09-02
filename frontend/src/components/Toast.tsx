import React, { useState, useEffect } from 'react';
import EmojiRenderer from './EmojiRenderer';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'success', 
  duration = 3000, 
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getToastColors = () => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400 shadow-blue-500/30';
      case 'error':
        return 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-500 shadow-blue-600/30';
      case 'info':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400 shadow-blue-500/30';
      case 'warning':
        return 'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-400 shadow-red-500/30';
      default:
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400 shadow-blue-500/30';
    }
  };

  return (
    <div
      className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 min-w-[400px] max-w-[500px] ${getToastColors()} rounded-xl shadow-2xl backdrop-blur-sm transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="flex items-center p-6">
        <div className="flex-1 text-center">
          <p className="text-lg font-medium"><EmojiRenderer text={message} /></p>
        </div>
        <div className="ml-6 flex-shrink-0">
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className={`inline-flex text-white focus:outline-none w-8 h-8 items-center justify-center rounded-full transition-all duration-200 ${
              type === 'warning' 
                ? 'hover:text-red-200 hover:bg-white/20' 
                : 'hover:text-blue-200 hover:bg-white/20'
            }`}
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
