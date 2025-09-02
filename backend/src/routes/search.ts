import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { optionalAuth } from '../middleware/auth';

const router = Router();

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['all', 'users', 'hashtags']).optional().default('all'),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10)
});

// GET /search - Universal search
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q: query, type, limit } = searchSchema.parse(req.query);
    const userId = req.user?.id;
    
    const results: any = {
      success: true,
      query,
      users: [],
      hashtags: []
    };

    // Search users if type is 'all' or 'users'
    if (type === 'all' || type === 'users') {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            {
              username: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              displayName: {
                contains: query,
                mode: 'insensitive'
              }
            }
          ]
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          _count: {
            select: {
              followers: true,
              tweets: true
            }
          },
          ...(userId && {
            followers: {
              where: { followerId: userId },
              select: { followerId: true }
            }
          })
        },
        take: limit,
        orderBy: [
          {
            followers: {
              _count: 'desc'
            }
          },
          {
            username: 'asc'
          }
        ]
      });

      results.users = users.map(user => ({
        ...user,
        isFollowing: userId ? user.followers?.length > 0 : false
      }));
    }

    // Search hashtags if type is 'all' or 'hashtags'
    if (type === 'all' || type === 'hashtags') {
      // Remove # from query if present
      const hashtagQuery = query.startsWith('#') ? query.slice(1) : query;
      
      const hashtags = await prisma.hashtag.findMany({
        where: {
          tag: {
            contains: hashtagQuery.toLowerCase(),
            mode: 'insensitive'
          }
        },
        include: {
          _count: {
            select: {
              tweets: true
            }
          }
        },
        take: limit,
        orderBy: {
          tweets: {
            _count: 'desc'
          }
        }
      });

      results.hashtags = hashtags.map(hashtag => ({
        ...hashtag,
        tweetCount: hashtag._count.tweets
      }));
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /search/users - Search users only
router.get('/users', optionalAuth, async (req, res, next) => {
  try {
    const { q: query, limit } = searchSchema.parse(req.query);
    const userId = req.user?.id;

    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            username: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            displayName: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        _count: {
          select: {
            followers: true,
            tweets: true
          }
        },
        ...(userId && {
          followers: {
            where: { followerId: userId },
            select: { followerId: true }
          }
        })
      },
      take: limit,
      orderBy: [
        {
          followers: {
            _count: 'desc'
          }
        },
        {
          username: 'asc'
        }
      ]
    });

    const formattedUsers = users.map(user => ({
      ...user,
      isFollowing: userId ? user.followers?.length > 0 : false
    }));

    res.json({
      success: true,
      users: formattedUsers
    });
  } catch (error) {
    next(error);
  }
});

// GET /search/hashtags - Search hashtags only
router.get('/hashtags', optionalAuth, async (req, res, next) => {
  try {
    const { q: query, limit } = searchSchema.parse(req.query);

    // Remove # from query if present
    const hashtagQuery = query.startsWith('#') ? query.slice(1) : query;
    
    const hashtags = await prisma.hashtag.findMany({
      where: {
        tag: {
          contains: hashtagQuery.toLowerCase(),
          mode: 'insensitive'
        }
      },
      include: {
        _count: {
          select: {
            tweets: true
          }
        }
      },
      take: limit,
      orderBy: {
        tweets: {
          _count: 'desc'
        }
      }
    });

    const formattedHashtags = hashtags.map(hashtag => ({
      ...hashtag,
      tweetCount: hashtag._count.tweets
    }));

    res.json({
      success: true,
      hashtags: formattedHashtags
    });
  } catch (error) {
    next(error);
  }
});

export { router as searchRoutes };
