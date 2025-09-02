import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../db';
import { io } from '../index';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { followRateLimit } from '../middleware/rateLimit';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const userProfileSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  cursor: z.string().optional()
});

const updateProfileSchema = z.object({
  bio: z.string().max(160).optional(),
  displayName: z.string().max(50).optional(),
  avatarUrl: z.string().url().optional(),
  location: z.string().max(50).optional()
});

// S3 client configuration
const s3Client = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
}) : null;

// Helper function to generate signed URLs for S3 objects
const getSignedImageUrl = async (key: string): Promise<string> => {
  if (!s3Client) {
    throw new Error('S3 client not configured');
  }
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key
  });
  // Generate signed URL valid for 1 hour
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

// Helper function to convert S3 keys to proper URLs
const processMediaUrls = async (media: any[]): Promise<any[]> => {
  const usePublicBucket = process.env.S3_PUBLIC_ACCESS === 'true';
  
  if (usePublicBucket) {
    // For public bucket, URLs are already direct URLs
    return media.map(m => ({
      ...m,
      url: m.url.startsWith('http') 
        ? m.url 
        : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${m.url}`
    }));
  } else {
    // For private bucket, generate signed URLs
    const processedMedia = await Promise.all(
      media.map(async (m) => ({
        ...m,
        url: m.url.startsWith('http') ? m.url : await getSignedImageUrl(m.url)
      }))
    );
    return processedMedia;
  }
};

// Helper function to process tweets array with media URLs
const processTweetsWithMediaUrls = async (tweets: any[]): Promise<any[]> => {
  return await Promise.all(
    tweets.map(async (tweet) => ({
      ...tweet,
      media: tweet.media ? await processMediaUrls(tweet.media) : []
    }))
  );
};

// GET /users/:username - Get user profile
router.get('/:username', optionalAuth, async (req, res, next) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: currentUserId ? true : false,
        avatarUrl: true,
        bio: true,
        location: true,
        pinnedTweetId: true,
        createdAt: true,
        pinnedTweet: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            },
            parent: {
              select: {
                id: true,
                text: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true
                  }
                }
              }
            },
            media: {
              orderBy: { order: 'asc' }
            },
            poll: {
              include: {
                options: {
                  include: {
                    _count: {
                      select: { votes: true }
                    },
                    votes: currentUserId ? {
                      where: { userId: currentUserId },
                      select: { id: true }
                    } : false
                  },
                  orderBy: { id: 'asc' }
                }
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
            ...(currentUserId && {
              likes: {
                where: { userId: currentUserId },
                select: { userId: true }
              },
              retweets: {
                where: { userId: currentUserId },
                select: { userId: true }
              }
            })
          }
        },
        _count: {
          select: {
            followers: true,
            following: true,
            tweets: true
          }
        }
      }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if current user follows this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: currentUserId,
            followeeId: user.id
          }
        }
      });
      isFollowing = !!follow;
    }

    // Format pinned tweet if it exists
    let formattedPinnedTweet = null;
    if (user.pinnedTweet) {
      // Process media URLs for pinned tweet
      const pinnedTweetWithMedia = await processTweetsWithMediaUrls([user.pinnedTweet]);
      formattedPinnedTweet = {
        ...pinnedTweetWithMedia[0],
        isLiked: currentUserId ? user.pinnedTweet.likes?.length > 0 : false,
        isRetweeted: currentUserId ? user.pinnedTweet.retweets?.length > 0 : false,
        isPinned: true
      };
    }

    const result = {
      success: true,
      user: {
        ...user,
        isFollowing,
        pinnedTweet: formattedPinnedTweet
      }
    };

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /users/:username/tweets - Get user's tweets
router.get('/:username/tweets', optionalAuth, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { limit, cursor } = userProfileSchema.parse(req.query);
    const currentUserId = req.user?.id;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const tweets = await prisma.tweet.findMany({
      where: {
        authorId: user.id,
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
            displayName: true,
            avatarUrl: true
          }
        },
        parent: {
          select: {
            id: true,
            text: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
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
            retweets: true,
            bookmarks: true
          }
        },
        ...(currentUserId && {
          likes: {
            where: { userId: currentUserId },
            select: { userId: true }
          },
          retweets: {
            where: { userId: currentUserId },
            select: { userId: true }
          },
          bookmarks: {
            where: { userId: currentUserId },
            select: { userId: true }
          }
        })
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Also get retweets by this user
    const retweets = await prisma.retweet.findMany({
      where: {
        userId: user.id,
        ...(cursor && {
          createdAt: {
            lt: new Date(cursor)
          }
        })
      },
      include: {
        tweet: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            },
            parent: {
              select: {
                id: true,
                text: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true
                  }
                }
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
                retweets: true,
                bookmarks: true
              }
            },
            ...(currentUserId && {
              likes: {
                where: { userId: currentUserId },
                select: { userId: true }
              },
              retweets: {
                where: { userId: currentUserId },
                select: { userId: true }
              },
              bookmarks: {
                where: { userId: currentUserId },
                select: { userId: true }
              }
            })
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Combine tweets and retweets, sort by creation date
    const combinedItems = [
      ...tweets.map(tweet => ({
        ...tweet,
        type: 'tweet' as const,
        createdAt: tweet.createdAt
      })),
      ...retweets.map(retweet => ({
        ...retweet.tweet,
        type: 'retweet' as const,
        retweetedBy: retweet.user,
        createdAt: retweet.createdAt // Use retweet creation date for sorting
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, limit);

    const nextCursor = combinedItems.length === limit ? combinedItems[combinedItems.length - 1].createdAt.toISOString() : null;

    // Get user's pinned tweet ID to mark it in the response
    const userWithPinnedTweet = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pinnedTweetId: true }
    });

    // Process media URLs for tweets
    const tweetsWithProcessedMedia = await processTweetsWithMediaUrls(combinedItems);

    res.json({
      success: true,
      tweets: tweetsWithProcessedMedia.map((item: any) => ({
        ...item,
        isLiked: currentUserId ? item.likes?.length > 0 : false,
        isRetweeted: currentUserId ? item.retweets?.length > 0 : false,
        isBookmarked: currentUserId ? item.bookmarks?.length > 0 : false,
        isPinned: userWithPinnedTweet?.pinnedTweetId === item.id
      })),
      nextCursor
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:username/bookmarks - Get user bookmarks (only accessible by the user themselves)
router.get('/:username/bookmarks', authenticateToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { limit, cursor } = userProfileSchema.parse(req.query);
    const currentUserId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Only allow users to see their own bookmarks
    if (user.id !== currentUserId) {
      const error: AppError = new Error('Unauthorized to view bookmarks');
      error.statusCode = 403;
      throw error;
    }

    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: user.id,
        ...(cursor && {
          createdAt: {
            lt: new Date(cursor)
          }
        })
      },
      include: {
        tweet: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            },
            parent: {
              select: {
                id: true,
                text: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true
                  }
                }
              }
            },
            media: {
              orderBy: { order: 'asc' }
            },
            poll: {
              include: {
                options: {
                  include: {
                    _count: {
                      select: { votes: true }
                    },
                    votes: {
                      where: { userId: currentUserId },
                      select: { id: true }
                    }
                  },
                  orderBy: { id: 'asc' }
                }
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
                retweets: true,
                bookmarks: true
              }
            },
            likes: {
              where: { userId: currentUserId },
              select: { userId: true }
            },
            retweets: {
              where: { userId: currentUserId },
              select: { userId: true }
            },
            bookmarks: {
              where: { userId: currentUserId },
              select: { userId: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const nextCursor = bookmarks.length === limit ? bookmarks[bookmarks.length - 1].createdAt.toISOString() : null;

    // Process media URLs for bookmarked tweets
    const bookmarkedTweets = bookmarks.map(bookmark => bookmark.tweet);
    const tweetsWithProcessedMedia = await processTweetsWithMediaUrls(bookmarkedTweets);

    res.json({
      success: true,
      tweets: tweetsWithProcessedMedia.map((tweet, index) => ({
        ...tweet,
        isLiked: bookmarks[index].tweet.likes?.length > 0,
        isRetweeted: bookmarks[index].tweet.retweets?.length > 0,
        isBookmarked: bookmarks[index].tweet.bookmarks?.length > 0
      })),
      nextCursor
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/:username/follow - Follow/unfollow user
router.post('/:username/follow', authenticateToken, followRateLimit, async (req, res, next) => {
  try {
    const { username } = req.params;
    const followerId = req.user!.id;

    const userToFollow = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (!userToFollow) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (userToFollow.id === followerId) {
      const error: AppError = new Error('Cannot follow yourself');
      error.statusCode = 400;
      throw error;
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId: userToFollow.id
        }
      }
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: {
          followerId_followeeId: {
            followerId,
            followeeId: userToFollow.id
          }
        }
      });
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          followerId,
          followeeId: userToFollow.id
        }
      });

      // Create notification
      const notification = await prisma.notification.create({
        data: {
          userId: userToFollow.id,
          type: 'FOLLOW',
          sourceUserId: followerId
        },
        include: {
          sourceUser: {
            select: {
              id: true,
              username: true,
              avatarUrl: true
            }
          }
        }
      });

      // Emit notification via WebSocket
      io.to(`user:${userToFollow.id}`).emit('notification', notification);
    }

    const followerCount = await prisma.follow.count({
      where: { followeeId: userToFollow.id }
    });

    res.json({
      success: true,
      isFollowing: !existingFollow,
      followerCount
    });
  } catch (error) {
    next(error);
  }
});

// PUT /users/profile - Update user profile
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const { bio, displayName, avatarUrl, location } = updateProfileSchema.parse(req.body);
    const userId = req.user!.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(bio !== undefined && { bio }),
        ...(displayName !== undefined && { displayName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(location !== undefined && { location })
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        location: true,
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
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:username/followers - Get user's followers
router.get('/:username/followers', optionalAuth, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { limit, cursor } = userProfileSchema.parse(req.query);

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const followers = await prisma.follow.findMany({
      where: {
        followeeId: user.id,
        ...(cursor && {
          createdAt: {
            lt: new Date(cursor)
          }
        })
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            location: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const nextCursor = followers.length === limit ? followers[followers.length - 1].createdAt.toISOString() : null;

    res.json({
      success: true,
      followers: followers.map((follow: any) => follow.follower),
      nextCursor
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:username/following - Get users that user is following
router.get('/:username/following', optionalAuth, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { limit, cursor } = userProfileSchema.parse(req.query);

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const following = await prisma.follow.findMany({
      where: {
        followerId: user.id,
        ...(cursor && {
          createdAt: {
            lt: new Date(cursor)
          }
        })
      },
      include: {
        followee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            location: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const nextCursor = following.length === limit ? following[following.length - 1].createdAt.toISOString() : null;

    res.json({
      success: true,
      following: following.map((follow: any) => follow.followee),
      nextCursor
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/profile - Delete user profile (requires password)
router.delete('/profile', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { password } = req.body;

    if (!password) {
      const error: AppError = new Error('Password is required to delete your account');
      error.statusCode = 400;
      throw error;
    }

    // Get user with password for verification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        passwordHash: true
      }
    });

    if (!user) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const error: AppError = new Error('Invalid password');
      error.statusCode = 401;
      throw error;
    }

    // Delete user and all related data (Prisma will handle cascading deletes)
    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
});

export { router as userRoutes };
