import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';
import { Server } from 'socket.io';

const router = Router();

let io: Server;

const notificationQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  cursor: z.string().optional()
});

// GET /notifications - Get user's notifications
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { limit, cursor } = notificationQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(cursor && {
          createdAt: {
            lt: new Date(cursor)
          }
        })
      },
      include: {
        sourceUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        sourceTweet: {
          select: {
            id: true,
            text: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const nextCursor = notifications.length === limit ? notifications[notifications.length - 1].createdAt.toISOString() : null;

    res.json({
      success: true,
      notifications,
      nextCursor
    });
  } catch (error) {
    next(error);
  }
});

// GET /notifications/unread - Get unread notification count
router.get('/unread', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
});

// PUT /notifications/read - Mark notifications as read
router.put('/read', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { notificationIds } = req.body;

    if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId
        },
        data: {
          isRead: true
        }
      });
    } else {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });
    }

    res.json({
      success: true,
      message: 'Notifications marked as read'
    });

    // Emit WebSocket event to user about notification read status update
    io.to(`user:${userId}`).emit('notificationRead', { 
      type: notificationIds ? 'specific' : 'all',
      notificationIds: notificationIds || []
    });
  } catch (error) {
    next(error);
  }
});

// POST /notifications/:id/read - Mark notification as read
router.post('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user!.id;
    
    // Find the notification and ensure it belongs to the user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Update the notification to mark it as read
    await prisma.notification.update({
      where: {
        id: notificationId
      },
      data: {
        isRead: true
      }
    });
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });

    // Emit WebSocket event to user about notification read status update
    io.to(`user:${userId}`).emit('notificationRead', { 
      type: 'specific',
      notificationIds: [notificationId]
    });
  } catch (error) {
    next(error);
  }
});

export { router as notificationRoutes };

// Function to set the io instance
export const setIOInstance = (ioInstance: Server) => {
  io = ioInstance;
};
