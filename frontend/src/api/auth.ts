import { api } from './client';
import { User, AuthResponse } from '../types';

export const authApi = {
  login: async (usernameOrEmail: string, password: string): Promise<AuthResponse> => {
    console.log("Login API call with:", { usernameOrEmail });
    console.log("API URL being used:", api.defaults.baseURL);
    try {
      const response = await api.post('/auth/login', { usernameOrEmail, password });
      console.log("Login API response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Login API error:", error);
      throw error;
    }
  },

  signup: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    console.log("Signup API call with:", { username, email });
    const response = await api.post('/auth/signup', { username, email, password });
    console.log("Signup API response:", response.data);
    return response.data;
  },

  refresh: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  getMe: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};
