import { Router } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { NotificationType } from '@prisma/client';
import { prisma } from '../db';
import { io } from '../index';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { tweetRateLimit } from '../middleware/rateLimit';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Configure S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

const createTweetSchema = z.object({
  text: z.string().min(1).max(280),
  parentId: z.string().optional(), // For replies
  pollOptions: z.array(z.string()).optional(),
  pollDuration: z.number().min(1).max(7).optional() // days
});

const timelineSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  cursor: z.string().optional()
});

// GET /tweets/explore/popular - Get popular tweets
router.get('/explore/popular', optionalAuth, async (req, res, next) => {
  try {
    const { limit = '20' } = req.query;
    const userId = req.user?.id;
    
    console.log('GET /tweets/explore/popular request:', { userId, limit });

    // Get tweets with high engagement (likes + retweets + replies)
    const tweets = await prisma.tweet.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
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
            options: { include: { _count: { select: { votes: true } } }, orderBy: { id: 'asc' } }
          }
        },
        hashtags: {
          include: {
            hashtag: true
          }
        },
        likes: userId ? {
          where: { userId }
        } : false,
        retweets: userId ? {
          where: { userId }
        } : false,
        bookmarks: userId ? {
          where: { userId }
        } : false,
        _count: {
          select: {
            likes: true,
            retweets: true,
            replies: true,
            bookmarks: true
          }
        }
      },
      orderBy: [
        {
          likes: {
            _count: 'desc'
          }
        },
        {
          retweets: {
            _count: 'desc'
          }
        },
        {
          createdAt: 'desc'
        }
      ],
      take: parseInt(limit as string)
    });

    // Process media URLs for private/public bucket compatibility
    const tweetsWithProcessedMedia = await processTweetsWithMediaUrls(tweets);

    const formattedTweets = tweetsWithProcessedMedia.map(tweet => ({
      ...tweet,
      isLiked: userId ? (tweet as any).likes?.length > 0 : false,
      isRetweeted: userId ? (tweet as any).retweets?.length > 0 : false,
      isBookmarked: userId ? (tweet as any).bookmarks?.length > 0 : false,
      engagementScore: (tweet as any)._count?.likes + (tweet as any)._count?.retweets + (tweet as any)._count?.replies
    }));

    console.log(`GET /tweets/explore/popular - Returning ${formattedTweets.length} popular tweets`);
    
    res.json({
      success: true,
      tweets: formattedTweets
    });
  } catch (error) {
    next(error);
  }
});

// GET /tweets/explore/recommended-users - Get recommended users to follow
router.get('/explore/recommended-users', authenticateToken, async (req, res, next) => {
  try {
    const { limit = '10' } = req.query;
    const userId = req.user!.id;
    
    console.log('GET /tweets/explore/recommended-users request:', { userId, limit });

    // Get users that the current user is not following
    // Prioritize users with more followers and recent activity
    const recommendedUsers = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } }, // Not the current user
          {
            followers: {
              none: {
                followerId: userId
              }
            }
          } // Not already following
        ]
      },
      include: {
        _count: {
          select: {
            followers: true,
            tweets: true
          }
        }
      },
      orderBy: [
        {
          followers: {
            _count: 'desc'
          }
        },
        {
          tweets: {
            _count: 'desc'
          }
        }
      ],
      take: parseInt(limit as string)
    });

    console.log(`GET /tweets/explore/recommended-users - Returning ${recommendedUsers.length} recommended users`);
    
    res.json({
      success: true,
      users: recommendedUsers
    });
  } catch (error) {
    next(error);
  }
});

// GET /tweets/explore/for-you - Get personalized tweets based on user activity
router.get('/explore/for-you', authenticateToken, async (req, res, next) => {
  try {
    const { limit = '20' } = req.query;
    const userId = req.user!.id;
    
    console.log('GET /tweets/explore/for-you request:', { userId, limit });

    // Get hashtags that the user has interacted with
    const userHashtags = await prisma.hashtag.findMany({
      where: {
        tweets: {
          some: {
            tweet: {
              OR: [
                { authorId: userId },
                { likes: { some: { userId } } },
                { retweets: { some: { userId } } }
              ]
            }
          }
        }
      },
      select: { id: true, tag: true }
    });

    const hashtagIds = userHashtags.map(h => h.id);

    // Get tweets with hashtags the user has interacted with
    const tweets = await prisma.tweet.findMany({
      where: {
        AND: [
          { authorId: { not: userId } }, // Not user's own tweets
          {
            OR: [
              // Tweets with hashtags user has interacted with
              hashtagIds.length > 0 ? {
                hashtags: {
                  some: {
                    hashtagId: {
                      in: hashtagIds
                    }
                  }
                }
              } : {},
              // Popular tweets from last 3 days as fallback
              {
                createdAt: {
                  gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                }
              }
            ]
          }
        ]
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
            options: { include: { _count: { select: { votes: true } } }, orderBy: { id: 'asc' } }
          }
        },
        hashtags: {
          include: {
            hashtag: true
          }
        },
        likes: {
          where: { userId }
        },
        retweets: {
          where: { userId }
        },
        bookmarks: {
          where: { userId }
        },
        _count: {
          select: {
            likes: true,
            retweets: true,
            replies: true,
            bookmarks: true
          }
        }
      },
      orderBy: [
        {
          likes: {
            _count: 'desc'
          }
        },
        {
          createdAt: 'desc'
        }
      ],
      take: parseInt(limit as string)
    });

    const formattedTweets = tweets.map(tweet => ({
      ...tweet,
      isLiked: (tweet as any).likes?.length > 0,
      isRetweeted: (tweet as any).retweets?.length > 0,
      isBookmarked: (tweet as any).bookmarks?.length > 0
    }));

    console.log(`GET /tweets/explore/for-you - Returning ${formattedTweets.length} personalized tweets`);
    
    res.json({
      success: true,
      tweets: formattedTweets
    });
  } catch (error) {
    next(error);
  }
});
const extractHashtags = (text: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const matches = [...text.matchAll(hashtagRegex)];
  return matches.map(match => match[1].toLowerCase());
};

const extractMentions = (text: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];
  return matches.map(match => match[1].toLowerCase());
};

const uploadToS3 = async (file: Express.Multer.File, key: string) => {
  const usePublicBucket = process.env.S3_PUBLIC_ACCESS === 'true';
  
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    // Only set ACL if using public bucket
    ...(usePublicBucket && { ACL: 'public-read' })
  });

  await s3Client.send(command);
  
  if (usePublicBucket) {
    // Return direct public URL
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } else {
    // Return the S3 key for private bucket (we'll generate signed URLs when needed)
    return key;
  }
};

// Function to generate signed URLs for private bucket
const getSignedImageUrl = async (key: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key
  });
  
  // Generate signed URL valid for 24 hours
  return await getSignedUrl(s3Client, command, { expiresIn: 86400 });
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

const getTweetWithDetails = async (tweetId: string, userId?: string) => {
  const tweet = await prisma.tweet.findUnique({
    where: { id: tweetId },
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
              votes: userId ? {
                where: { userId },
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
          retweets: true,
          bookmarks: true
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
        },
        bookmarks: {
          where: { userId },
          select: { userId: true }
        }
      })
    }
  });

  if (!tweet) return null;

  // Process media URLs for private/public bucket compatibility
  const processedMedia = await processMediaUrls(tweet.media);

  return {
    ...tweet,
    media: processedMedia
  };
};

// GET /tweets - Timeline
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { limit, cursor } = timelineSchema.parse(req.query);
    const userId = req.user?.id;
    
    console.log('GET /tweets - Timeline request:', { 
      userId, 
      limit, 
      cursor, 
      isAuthenticated: !!userId 
    });

    let tweets;
    
    // Note: This has been modified to show all tweets to all users (global feed)
    // instead of only showing tweets from followed users
    if (userId) {
      // Get all tweets for the global feed, but keep track of which ones the user has liked/retweeted
      tweets = await prisma.tweet.findMany({
        where: {
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
              options: { include: { _count: { select: { votes: true } }, votes: userId ? { where: { userId }, select: { id: true } } : false }, orderBy: { id: 'asc' } }
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
            where: { userId },
            select: { userId: true }
          },
          retweets: {
            where: { userId },
            select: { userId: true }
          },
          bookmarks: {
            where: { userId },
            select: { userId: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });
    } else {
      // Get public tweets for non-authenticated users
      tweets = await prisma.tweet.findMany({
        where: {
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
              options: { include: { _count: { select: { votes: true } }, votes: userId ? { where: { userId }, select: { id: true } } : false }, orderBy: { id: 'asc' } }
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
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });
    }

    const nextCursor = tweets.length === limit ? tweets[tweets.length - 1].createdAt.toISOString() : null;

    // Process media URLs for private/public bucket compatibility
    const tweetsWithProcessedMedia = await processTweetsWithMediaUrls(tweets);

    const formattedTweets = tweetsWithProcessedMedia.map(tweet => ({
      ...tweet,
      isLiked: userId ? tweet.likes?.length > 0 : false,
      isRetweeted: userId ? tweet.retweets?.length > 0 : false,
      isBookmarked: userId ? tweet.bookmarks?.length > 0 : false
    }));

    const result = {
      success: true,
      tweets: formattedTweets,
      nextCursor
    };

    // Cache the result for authenticated users (only for first page)
    // Temporarily disabled to fix stale data issues
    console.log(`GET /tweets - Returning ${formattedTweets.length} tweets`);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /tweets - Create tweet
router.post('/', authenticateToken, tweetRateLimit, upload.array('media', 4), async (req, res, next) => {
  try {
    const { text, parentId, pollOptions, pollDuration } = createTweetSchema.parse(req.body);
    const userId = req.user!.id;
    const mediaFiles = req.files as Express.Multer.File[];

    console.log('Creating tweet:', { text, userId, parentId });
    
    // Check if this is a reply and if the original tweet exists
    let parentTweet = null;
    if (parentId) {
      parentTweet = await prisma.tweet.findUnique({
        where: { id: parentId },
        include: { author: true }
      });
      
      if (!parentTweet) {
        return res.status(404).json({
          success: false,
          message: 'Original tweet not found'
        });
      }
    }
    
    // Create tweet
    const tweet = await prisma.tweet.create({
      data: {
        text,
        authorId: userId,
        ...(parentId && { parentId })
      }
    });
    
    console.log('Tweet created with ID:', tweet.id);
    
    // If this is a reply, create notification for the original tweet author
    if (parentTweet && parentTweet.authorId !== userId) {
      const notification = await prisma.notification.create({
        data: {
          userId: parentTweet.authorId,
          type: 'REPLY',
          sourceUserId: userId,
          sourceTweetId: tweet.id
        }
      });
      
      // Emit notification via WebSocket
      io.to(`user:${parentTweet.authorId}`).emit('notification', notification);
    }
    
    // Process mentions to create notifications
    const mentions = extractMentions(text);
    console.log('Extracted mentions from text:', text, '-> mentions:', mentions);
    if (mentions.length > 0) {
      // Find users who were mentioned
      const mentionedUsers = await prisma.user.findMany({
        where: {
          username: {
            in: mentions
          }
        }
      });
      
      console.log('Found mentioned users:', mentionedUsers.map(u => u.username));
      
      // Create notifications for mentioned users
      for (const mentionedUser of mentionedUsers) {
        // Don't notify yourself
        if (mentionedUser.id === userId) continue;
        
        console.log('Creating mention notification for user:', mentionedUser.username);
        const notification = await prisma.notification.create({
          data: {
            userId: mentionedUser.id,
            type: 'MENTION',
            sourceUserId: userId,
            sourceTweetId: tweet.id
          }
        });
        
        console.log('Created notification:', notification.id);
        
        // Emit notification via WebSocket
        io.to(`user:${mentionedUser.id}`).emit('notification', notification);
        console.log('Emitted WebSocket notification to user:', mentionedUser.id);
      }
    }

    // Handle media uploads
    if (mediaFiles && mediaFiles.length > 0) {
      const mediaUploads = await Promise.all(
        mediaFiles.map(async (file, index) => {
          const key = `tweets/${tweet.id}/media_${index}_${Date.now()}`;
          const url = await uploadToS3(file, key);
          
          return prisma.media.create({
            data: {
              tweetId: tweet.id,
              url,
              type: file.mimetype.startsWith('image/') ? 'IMAGE' : 'VIDEO',
              order: index
            }
          });
        })
      );
    }

    // Handle poll creation
    if (pollOptions && pollOptions.length > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (pollDuration || 1));
      
      await prisma.poll.create({
        data: {
          tweetId: tweet.id,
          expiresAt,
          options: {
            create: pollOptions.map(option => ({
              text: option,
              voteCount: 0
            }))
          }
        }
      });
    }

    // Handle hashtags
    const hashtags = extractHashtags(text);
    if (hashtags.length > 0) {
      for (const tag of hashtags) {
        const hashtag = await prisma.hashtag.upsert({
          where: { tag },
          update: {},
          create: { tag }
        });
        
        await prisma.tweetTag.create({
          data: {
            tweetId: tweet.id,
            hashtagId: hashtag.id
          }
        });
      }
    }

    // Get full tweet details
    const fullTweet = await getTweetWithDetails(tweet.id, userId);

    // Emit to followers via WebSocket
    const followers = await prisma.follow.findMany({
      where: { followeeId: userId },
      select: { followerId: true }
    });

    followers.forEach(({ followerId }) => {
      io.to(`user:${followerId}`).emit('new_tweet', fullTweet);
    });

    console.log('Sending response with tweet:', fullTweet?.id);
    
    res.status(201).json({
      success: true,
      tweet: {
        ...fullTweet,
        isLiked: false,
        isRetweeted: false
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /tweets/:id/like - Toggle like
router.post('/:id/like', authenticateToken, async (req, res, next) => {
  try {
    const tweetId = req.params.id;
    const userId = req.user!.id;

    // Check if tweet exists
    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      include: { author: true }
    });

    if (!tweet) {
      const error: AppError = new Error('Tweet not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_tweetId: {
          userId,
          tweetId
        }
      }
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: {
          userId_tweetId: {
            userId,
            tweetId
          }
        }
      });
    } else {
      // Like
      await prisma.like.create({
        data: {
          userId,
          tweetId
        }
      });

      // Create notification for tweet author
      if (tweet.authorId !== userId) {
        const notification = await prisma.notification.create({
          data: {
            userId: tweet.authorId,
            type: 'LIKE',
            sourceUserId: userId,
            sourceTweetId: tweetId
          }
        });

        // Emit notification via WebSocket
        io.to(`user:${tweet.authorId}`).emit('notification', notification);
      }
    }

    const likeCount = await prisma.like.count({
      where: { tweetId }
    });

    res.json({
      success: true,
      isLiked: !existingLike,
      likeCount
    });
  } catch (error) {
    next(error);
  }
});

// POST /tweets/:id/retweet - Toggle retweet
router.post('/:id/retweet', authenticateToken, async (req, res, next) => {
  try {
    const tweetId = req.params.id;
    const userId = req.user!.id;

    // Check if tweet exists
    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      include: { author: true }
    });

    if (!tweet) {
      const error: AppError = new Error('Tweet not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if already retweeted
    const existingRetweet = await prisma.retweet.findUnique({
      where: {
        userId_tweetId: {
          userId,
          tweetId
        }
      }
    });

    if (existingRetweet) {
      // Remove retweet
      await prisma.retweet.delete({
        where: {
          userId_tweetId: {
            userId,
            tweetId
          }
        }
      });
    } else {
      // Create retweet
      await prisma.retweet.create({
        data: {
          userId,
          tweetId
        }
      });

      // Create notification for tweet author
      if (tweet.authorId !== userId) {
        const notification = await prisma.notification.create({
          data: {
            userId: tweet.authorId,
            type: 'RETWEET',
            sourceUserId: userId,
            sourceTweetId: tweetId
          }
        });

        // Emit notification via WebSocket
        io.to(`user:${tweet.authorId}`).emit('notification', notification);
      }
    }

    const retweetCount = await prisma.retweet.count({
      where: { tweetId }
    });

    res.json({
      success: true,
      isRetweeted: !existingRetweet,
      retweetCount
    });
  } catch (error) {
    next(error);
  }
});

// POST /tweets/:id/bookmark - Toggle bookmark
router.post('/:id/bookmark', authenticateToken, async (req, res, next) => {
  try {
    const tweetId = req.params.id;
    const userId = req.user!.id;

    // Check if tweet exists
    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId }
    });

    if (!tweet) {
      const error: AppError = new Error('Tweet not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if already bookmarked
    const existingBookmark = await prisma.bookmark.findUnique({
      where: {
        userId_tweetId: {
          userId,
          tweetId
        }
      }
    });

    if (existingBookmark) {
      // Remove bookmark
      await prisma.bookmark.delete({
        where: {
          userId_tweetId: {
            userId,
            tweetId
          }
        }
      });
    } else {
      // Create bookmark
      await prisma.bookmark.create({
        data: {
          userId,
          tweetId
        }
      });
    }

    const bookmarkCount = await prisma.bookmark.count({
      where: { tweetId }
    });

    res.json({
      success: true,
      isBookmarked: !existingBookmark,
      bookmarkCount
    });
  } catch (error) {
    next(error);
  }
});

// GET /tweets/:id - Get single tweet
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const tweetId = req.params.id;
    const userId = req.user?.id;

    const tweet = await getTweetWithDetails(tweetId, userId);

    if (!tweet) {
      const error: AppError = new Error('Tweet not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      tweet: {
        ...tweet,
        isLiked: userId ? tweet.likes.length > 0 : false,
        isRetweeted: userId ? tweet.retweets.length > 0 : false,
        isBookmarked: userId ? tweet.bookmarks.length > 0 : false
      }
    });
  } catch (error) {
    next(error);
  }
});

// Vote in a poll
router.post('/:tweetId/poll/:optionId/vote', authenticateToken, async (req, res, next) => {
  try {
    const { tweetId, optionId } = req.params;
    const userId = req.user!.id;

    console.log('Poll vote attempt:', { tweetId, optionId, userId });

    // Check if the poll exists and is still active
    const poll = await prisma.poll.findFirst({
      where: {
        tweetId: tweetId,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        options: { include: { _count: { select: { votes: true } }, votes: userId ? { where: { userId }, select: { id: true } } : false }, orderBy: { id: 'asc' } }
      }
    });

    console.log('Poll found:', poll ? 'Yes' : 'No');

    if (!poll) {
      const error: AppError = new Error('Poll not found or expired');
      error.statusCode = 404;
      throw error;
    }

    // Check if option exists
    const option = poll.options.find(opt => opt.id === optionId);
    if (!option) {
      const error: AppError = new Error('Poll option not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if user has already voted in this poll
    const existingVote = await prisma.pollVote.findFirst({
      where: {
        userId: userId,
        option: {
          poll: {
            id: poll.id
          }
        }
      }
    });

    console.log('Existing vote:', existingVote ? 'Found' : 'None');

    if (existingVote) {
      const error: AppError = new Error('You have already voted in this poll');
      error.statusCode = 400;
      throw error;
    }

    console.log('Creating vote for option:', optionId);

    // Create the vote
    await prisma.pollVote.create({
      data: {
        userId: userId,
        optionId: optionId
      }
    });

    console.log('Vote created successfully');

    // Get the tweet to find the poll owner
    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      include: { author: true }
    });

    // Create notification for poll owner (if not voting on own poll)
    if (tweet && tweet.authorId !== userId) {
      const notification = await prisma.notification.create({
        data: {
          userId: tweet.authorId,
          type: 'POLL_VOTE' as NotificationType,
          sourceUserId: userId,
          sourceTweetId: tweetId
        }
      });

      // Emit notification via WebSocket
      io.to(`user:${tweet.authorId}`).emit('notification', notification);
    }

    // Get updated poll with vote counts
    const updatedPoll = await prisma.poll.findUnique({
      where: { id: poll.id },
      include: {
        options: {
          include: {
            _count: {
              select: { votes: true }
            }
          },
          orderBy: { id: 'asc' }
        }
      }
    });

    // Emit real-time update
    io.emit('poll:update', {
      tweetId,
      poll: updatedPoll
    });

    res.json({
      success: true,
      poll: updatedPoll
    });
  } catch (error) {
    next(error);
  }
});

// Delete a tweet
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const tweetId = req.params.id;
    const userId = req.user!.id;

    // Check if the tweet exists and belongs to the user
    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      include: { author: true }
    });

    if (!tweet) {
      const error: AppError = new Error('Tweet not found');
      error.statusCode = 404;
      throw error;
    }

    if (tweet.authorId !== userId) {
      const error: AppError = new Error('You can only delete your own tweets');
      error.statusCode = 403;
      throw error;
    }

    // Delete the tweet and all related data (likes, retweets, replies, etc.)
    // Prisma will handle cascading deletes based on the schema
    await prisma.tweet.delete({
      where: { id: tweetId }
    });

    res.json({ 
      success: true, 
      message: 'Tweet deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
});

// POST /tweets/:id/pin - Toggle pin tweet
router.post('/:id/pin', authenticateToken, async (req, res, next) => {
  try {
    const tweetId = req.params.id;
    const userId = req.user!.id;

    // Check if tweet exists and belongs to the user
    const tweet = await prisma.tweet.findUnique({
      where: { id: tweetId },
      include: { author: true }
    });

    if (!tweet) {
      const error: AppError = new Error('Tweet not found');
      error.statusCode = 404;
      throw error;
    }

    // Only the author can pin their own tweets
    if (tweet.authorId !== userId) {
      const error: AppError = new Error('You can only pin your own tweets');
      error.statusCode = 403;
      throw error;
    }

    // Check if user already has a pinned tweet
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pinnedTweetId: true }
    });

    if (user?.pinnedTweetId === tweetId) {
      // Unpin the tweet
      await prisma.user.update({
        where: { id: userId },
        data: { pinnedTweetId: null }
      });

      res.json({
        success: true,
        isPinned: false,
        message: 'Tweet unpinned successfully'
      });
    } else {
      // Pin the tweet (replace any existing pinned tweet)
      await prisma.user.update({
        where: { id: userId },
        data: { pinnedTweetId: tweetId }
      });

      res.json({
        success: true,
        isPinned: true,
        message: 'Tweet pinned successfully'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get signed URL for private images
router.get('/media/:key', authenticateToken, async (req, res, next) => {
  try {
    const { key } = req.params;
    const usePublicBucket = process.env.S3_PUBLIC_ACCESS === 'true';
    
    if (usePublicBucket) {
      // For public bucket, return direct URL
      const publicUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      return res.json({ success: true, url: publicUrl });
    }
    
    // For private bucket, generate signed URL
    const signedUrl = await getSignedImageUrl(key);
    res.json({ success: true, url: signedUrl });
  } catch (error) {
    next(error);
  }
});

// GET /tweets/media/signed-url/:key - Get fresh signed URL for media
router.get('/media/signed-url/:key(*)', optionalAuth, async (req, res, next) => {
  try {
    const { key } = req.params;
    
    // Decode the key parameter (it might be URL encoded)
    const decodedKey = decodeURIComponent(key);
    
    // Generate a fresh signed URL
    const signedUrl = await getSignedImageUrl(decodedKey);
    
    res.json({
      success: true,
      signedUrl
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    next(error);
  }
});

export { router as tweetRoutes };
