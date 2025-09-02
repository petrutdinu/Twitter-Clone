import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

// Simple in-memory rate limiter (for development/small scale)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const createRateLimit = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = config.keyGenerator 
        ? config.keyGenerator(req) 
        : `rate_limit:${req.ip}`;
      
      const now = Date.now();
      const resetTime = now + config.windowMs;
      
      let entry = rateLimitStore.get(key);
      
      if (!entry || now > entry.resetTime) {
        // Create new entry or reset expired entry
        entry = { count: 1, resetTime };
        rateLimitStore.set(key, entry);
      } else {
        // Increment existing entry
        entry.count++;
      }
      
      const remaining = Math.max(0, config.maxRequests - entry.count);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
      });
      
      if (entry.count > config.maxRequests) {
        const error: AppError = new Error(
          config.message || 'Too many requests, please try again later'
        );
        error.statusCode = 429;
        throw error;
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Pre-configured rate limiters
export const globalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000,
  message: 'Too many requests from this IP, please try again later'
});

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => `auth_rate_limit:${req.ip}`
});

export const dmRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  message: 'Too many messages sent, please slow down',
  keyGenerator: (req) => `dm_rate_limit:${req.user?.id || req.ip}`
});

export const tweetRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50,
  message: 'Too many tweets posted, please wait before posting again',
  keyGenerator: (req) => `tweet_rate_limit:${req.user?.id || req.ip}`
});

export const followRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many follow/unfollow actions, please slow down',
  keyGenerator: (req) => `follow_rate_limit:${req.user?.id || req.ip}`
});
