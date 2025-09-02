import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

const signupSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string()
});

const refreshSchema = z.object({
  refreshToken: z.string()
});

// Generate tokens
const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// POST /auth/signup
router.post('/signup', authRateLimit, async (req, res, next) => {
  try {
    const { username, email, password } = signupSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });
    
    if (existingUser) {
      const error: AppError = new Error('Username or email already exists');
      error.statusCode = 409;
      throw error;
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        createdAt: true
      }
    });
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    res.status(201).json({
      success: true,
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/login
router.post('/login', authRateLimit, async (req, res, next) => {
  try {
    const { usernameOrEmail, password } = loginSchema.parse(req.body);
    
    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameOrEmail },
          { email: usernameOrEmail }
        ]
      }
    });
    
    if (!user) {
      const error: AppError = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      const error: AppError = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      const error: AppError = new Error('Invalid refresh token');
      error.statusCode = 401;
      throw error;
    }
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
    
    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    next(error);
  }
});

// GET /auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            tweets: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };
