import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';

export const useTokenRefresh = () => {
  const { logout } = useAuthStore();

  useEffect(() => {
    const checkAndRefreshToken = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      try {
        // Decode token to check expiration
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        
        const payload = JSON.parse(jsonPayload);
        const expirationTime = payload.exp * 1000;
        const currentTime = Date.now();
        const timeUntilExpiry = expirationTime - currentTime;
        
        // Refresh if token expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000) {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) {
            logout();
            return;
          }

          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (response.ok) {
            const data = await response.json();
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            console.log('Token refreshed proactively');
          } else {
            logout();
          }
        }
      } catch (error) {
        console.error('Error checking token:', error);
        logout();
      }
    };

    // Check immediately
    checkAndRefreshToken();

    // Check every 4 minutes
    const interval = setInterval(checkAndRefreshToken, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, [logout]);
};
