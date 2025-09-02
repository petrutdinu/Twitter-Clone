import { Router } from 'express';
import { prisma } from '../db';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// GET /trends - Get trending hashtags
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    // Get trending hashtags from last 24 hours
    const rawTrends = await prisma.$queryRaw`
      SELECT h.tag, COUNT(*) as usage_count
      FROM tweet_tags tt
      JOIN hashtags h ON h.id = tt.hashtag_id
      WHERE tt.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY h.tag
      ORDER BY usage_count DESC
      LIMIT 10
    `;

    // Convert BigInt to number for JSON serialization
    const trends = (rawTrends as any[]).map(trend => ({
      tag: trend.tag,
      usage_count: Number(trend.usage_count)
    }));

    res.json({
      success: true,
      trends
    });
  } catch (error) {
    next(error);
  }
});

// GET /trends/search - Search hashtags
router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.json({
        success: true,
        hashtags: []
      });
    }

    const hashtags = await prisma.hashtag.findMany({
      where: {
        tag: {
          contains: query.toLowerCase(),
          mode: 'insensitive'
        }
      },
      take: 10,
      orderBy: {
        tweets: {
          _count: 'desc'
        }
      }
    });

    res.json({
      success: true,
      hashtags
    });
  } catch (error) {
    next(error);
  }
});

// GET /trends/hashtag/:tag - Get tweets for a specific hashtag
router.get('/hashtag/:tag', optionalAuth, async (req, res, next) => {
  try {
    const { tag } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const cursor = req.query.cursor as string;
    const userId = req.user?.id;

    const hashtag = await prisma.hashtag.findUnique({
      where: { tag: tag.toLowerCase() }
    });

    if (!hashtag) {
      return res.json({
        success: true,
        tweets: [],
        nextCursor: null
      });
    }

    const tweets = await prisma.tweet.findMany({
      where: {
        hashtags: {
          some: {
            hashtagId: hashtag.id
          }
        },
        ...(cursor && {
          createdAt: {
            lt: new Date(cursor)
          }
        })
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        media: {
          orderBy: { order: 'asc' }
        },
        poll: {
          include: {
            options: true
          }
        },
        hashtags: {
          include: {
            hashtag: true
          }
        },
        _count: {
          select: {
            likes: true,
            retweets: true
          }
        },
        ...(userId && {
          likes: {
            where: { userId },
            select: { userId: true }
          },
          retweets: {
            where: { userId },
            select: { userId: true }
          }
        })
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const nextCursor = tweets.length === limit ? tweets[tweets.length - 1].createdAt.toISOString() : null;

    res.json({
      success: true,
      tweets: tweets.map((tweet: any) => ({
        ...tweet,
        isLiked: userId ? tweet.likes?.length > 0 : false,
        isRetweeted: userId ? tweet.retweets?.length > 0 : false
      })),
      nextCursor
    });
  } catch (error) {
    next(error);
  }
});

export { router as trendsRoutes };
