import { Router } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { prisma } from '../db';
import { io } from '../index';
import { authenticateToken } from '../middleware/auth';
import { dmRateLimit } from '../middleware/rateLimit';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Multer configuration (reuse logic similar to tweets route but allow single image up to 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true); else cb(new Error('Invalid file type'));
  }
});

// S3 client (only initialized if creds exist)
const s3Client = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
}) : null;

const uploadImageToS3 = async (file: Express.Multer.File): Promise<string> => {
  if (!s3Client) throw new Error('S3 not configured');
  const usePublic = process.env.S3_PUBLIC_ACCESS === 'true';
  const key = `dm/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ...(usePublic && { ACL: 'public-read' })
  });
  await s3Client.send(command);
  if (usePublic) {
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
  return key; // store key for private buckets
};

const getSignedDmImageUrl = async (key?: string | null): Promise<string | undefined> => {
  if (!key) return undefined;
  if (key.startsWith('http')) return key; // already full URL
  if (!s3Client) return key; // fallback, not signed
  const command = new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key });
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

const sendMessageSchema = z.object({
  toUserId: z.string(),
  text: z.string().max(280).optional().default(''),
  gifUrl: z.string().url().optional(),
  imageUrl: z.string().optional() // For future extensibility when sending via JSON (e.g., already uploaded)
});

const messageHistorySchema = z.object({
  with: z.string(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  cursor: z.string().optional()
});

// POST /dm/send - Send direct message
router.post('/send', authenticateToken, dmRateLimit, upload.single('image'), async (req, res, next) => {
  try {
    console.log('DM send request:', { body: req.body, hasFile: !!req.file });
    const { toUserId, text, gifUrl } = sendMessageSchema.parse(req.body);
    const fromUserId = req.user!.id;
    const imageFile = req.file as Express.Multer.File | undefined;
    
    // Validate that we have at least one form of content
    if (!text?.trim() && !gifUrl && !imageFile) {
      const error: AppError = new Error('Message must contain text, a GIF, or an image');
      error.statusCode = 400;
      throw error;
    }
    
    let storedImageKeyOrUrl: string | undefined;
    if (imageFile) {
      try {
        storedImageKeyOrUrl = await uploadImageToS3(imageFile);
      } catch (e:any) {
        const error: AppError = new Error('Failed to upload image');
        error.statusCode = 500;
        throw error;
      }
    }

    console.log('Sending DM:', { fromUserId, toUserId, text, gifUrl, hasImage: !!storedImageKeyOrUrl });

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, username: true }
    });

    if (!recipient) {
      const error: AppError = new Error('Recipient not found');
      error.statusCode = 404;
      throw error;
    }

    if (toUserId === fromUserId) {
      const error: AppError = new Error('Cannot send message to yourself');
      error.statusCode = 400;
      throw error;
    }

    // Create message
  const message = await prisma.directMessage.create({
      data: {
        senderId: fromUserId,
        receiverId: toUserId,
        text: text || '',
    gifUrl,
    imageUrl: storedImageKeyOrUrl,
        status: 'DELIVERED' // Set status to DELIVERED when message is sent
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    console.log('DM created:', message.id);

    // Emit message to both users via WebSocket
    console.log('Emitting DM to users:', { toUserId, fromUserId });
    // If private bucket, sign image URL before emitting
    const signedMessage = {
      ...message,
      imageUrl: await getSignedDmImageUrl(message.imageUrl)
    } as any;
    io.to(`user:${toUserId}`).emit('dm', signedMessage);
    io.to(`user:${fromUserId}`).emit('dm', signedMessage);

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error sending DM:', error);
    next(error);
  }
});

// GET /dm/history - Get message history with a user
router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    const { with: otherUserId, limit, cursor } = messageHistorySchema.parse(req.query);
    const userId = req.user!.id;

    console.log('Getting message history:', { userId, otherUserId, limit, cursor });

    // Check if other user exists
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, username: true, displayName: true, avatarUrl: true }
    });

    if (!otherUser) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    let messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ],
        ...(cursor && {
          createdAt: {
            lt: new Date(cursor)
          }
        })
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        receiver: {
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

    // Sign image URLs if necessary
    messages = await Promise.all(messages.map(async (m) => ({
      ...m,
      imageUrl: await getSignedDmImageUrl(m.imageUrl)
    })));

    const nextCursor = messages.length === limit ? messages[messages.length - 1].createdAt.toISOString() : null;

    console.log('Found messages:', messages.length);

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      nextCursor,
      otherUser
    });
  } catch (error) {
    console.error('Error getting message history:', error);
    next(error);
  }
});

// GET /dm/conversations - Get list of conversations
router.get('/conversations', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    console.log('Getting conversations for user:', userId);

    // Get all messages where user is sender or receiver
    let allMessages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        receiver: {
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
      }
    });

    allMessages = await Promise.all(allMessages.map(async m => ({
      ...m,
      imageUrl: await getSignedDmImageUrl(m.imageUrl)
    })));

    // Group by conversation partner and get the latest message
    const conversationMap = new Map();
    
    allMessages.forEach(message => {
      const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
      const previewText = message.text?.trim() || (message.gifUrl ? '[GIF]' : (message.imageUrl ? '[Photo]' : ''));
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          id: message.id,
          text: previewText,
          created_at: message.createdAt,
          sender_id: message.senderId,
          receiver_id: message.receiverId,
          sender_username: message.sender.username,
          sender_display_name: message.sender.displayName,
          sender_avatar_url: message.sender.avatarUrl,
          receiver_username: message.receiver.username,
          receiver_display_name: message.receiver.displayName,
          receiver_avatar_url: message.receiver.avatarUrl
        });
      }
    });

    const conversations = Array.from(conversationMap.values());

    console.log('Found conversations:', conversations.length);
    console.log('Conversations data:', conversations);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    next(error);
  }
});

// POST /dm/mark-read - Mark messages as read
router.post('/mark-read', authenticateToken, async (req, res, next) => {
  try {
    const { fromUserId } = z.object({
      fromUserId: z.string()
    }).parse(req.body);
    
    const userId = req.user!.id;

    console.log('Marking messages as read:', { userId, fromUserId });

    // Mark all unread messages from the other user as read
    await prisma.directMessage.updateMany({
      where: {
        senderId: fromUserId,
        receiverId: userId,
        status: { not: 'READ' }
      },
      data: {
        status: 'READ',
        readAt: new Date()
      }
    });

    // Emit read status to the sender via WebSocket
    io.to(`user:${fromUserId}`).emit('messages_read', {
      readBy: userId,          // Who read the messages
      conversationWith: fromUserId  // Who sent the original messages
    });

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    next(error);
  }
});

// DELETE /dm/:messageId - Delete message
router.delete('/:messageId', authenticateToken, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    console.log('Deleting message:', { messageId, userId });

    // Check if message exists and user owns it
    const message = await prisma.directMessage.findUnique({
      where: { id: messageId },
      include: {
        sender: { select: { id: true, username: true } },
        receiver: { select: { id: true, username: true } }
      }
    });

    if (!message) {
      const error: AppError = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    // Only the sender can delete their own message
    if (message.senderId !== userId) {
      const error: AppError = new Error('You can only delete your own messages');
      error.statusCode = 403;
      throw error;
    }

    // Check if message is already deleted
    if (message.isDeleted) {
      const error: AppError = new Error('Message is already deleted');
      error.statusCode = 400;
      throw error;
    }

    // Mark message as deleted instead of actually deleting it
    const deletedMessage = await prisma.directMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
        receiver: { select: { id: true, username: true, avatarUrl: true } }
      }
    });

    // Emit deletion event to both sender and receiver via WebSocket
    const deletionData = {
      messageId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      deletedAt: deletedMessage.deletedAt
    };

    io.to(`user:${message.senderId}`).emit('message_deleted', deletionData);
    io.to(`user:${message.receiverId}`).emit('message_deleted', deletionData);

    console.log('Message deleted successfully:', deletionData);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    next(error);
  }
});

// GET /dm/unread - Get unread message count
router.get('/unread', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    // Count unread messages for this user (messages received that have not been read)
    const unreadCount = await prisma.directMessage.count({
      where: {
        receiverId: userId,
        readAt: null,
        isDeleted: false
      }
    });

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error getting unread message count:', error);
    next(error);
  }
});

// GET /dm/unread-per-conversation - Get unread message count per conversation
router.get('/unread-per-conversation', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    // Get unread message counts grouped by sender
    const unreadCounts = await prisma.directMessage.groupBy({
      by: ['senderId'],
      where: {
        receiverId: userId,
        readAt: null,
        isDeleted: false
      },
      _count: {
        id: true
      }
    });

    // Transform to a more usable format
    const unreadPerConversation: Record<string, number> = {};
    unreadCounts.forEach(item => {
      unreadPerConversation[item.senderId] = item._count.id;
    });

    res.json({
      success: true,
      unreadPerConversation
    });
  } catch (error) {
    console.error('Error getting unread message count per conversation:', error);
    next(error);
  }
});

export { router as dmRoutes };
