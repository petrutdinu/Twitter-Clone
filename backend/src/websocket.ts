import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './db';

// Track socket IDs and online users in memory
const userSockets = new Map<string, { socketId: string, username: string }>();
const onlineUsers = new Set<string>();

export const setupWebSocket = (io: Server) => {
  // Authentication middleware for WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true }
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.username} (${socket.userId}) connected via WebSocket`);
    
    const userId = socket.userId;
    
    // Add user to online users and track socket
    onlineUsers.add(userId);
    userSockets.set(userId, { socketId: socket.id, username: socket.username });
    console.log(`Added user ${socket.username} to online users`);
    
    // Join user-specific rooms
    socket.join(`user:${userId}`);
    socket.join(`dm:${userId}`);
    console.log(`User ${socket.username} joined rooms: user:${userId}, dm:${userId}`);
    
    // Get current online users
    const currentOnlineUsers = Array.from(onlineUsers);
    console.log('Current online user IDs:', currentOnlineUsers);
    
    // Send current online users to the newly connected user
    socket.emit('online_users', { userIds: currentOnlineUsers });
    
    // Broadcast updated online users list to ALL users (including the new one)
    io.emit('online_users', { userIds: currentOnlineUsers });
    
    // Also broadcast that this specific user is online (for real-time updates)
    socket.broadcast.emit('user:online', { userId, username: socket.username });
    
    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.username} disconnected`);
      
      // Remove user from online users and local socket tracking
      onlineUsers.delete(userId);
      userSockets.delete(userId);
      console.log(`Removed user ${socket.username} from online users`);
      
      // Get updated list of online users after removal
      const currentOnlineUsers = Array.from(onlineUsers);
      console.log('Updated online user IDs after disconnect:', currentOnlineUsers);
      
      // Broadcast updated online users list to ALL remaining users
      io.emit('online_users', { userIds: currentOnlineUsers });
      
      // Also broadcast that this specific user is offline (for real-time updates)
      socket.broadcast.emit('user:offline', { userId, username: socket.username });
    });
    
    // Handle typing indicators for DMs (simplified without Redis)
    socket.on('typing:start', ({ toUserId }) => {
      socket.to(`user:${toUserId}`).emit('typing:start', {
        userId,
        username: socket.username
      });
    });
    
    socket.on('typing:stop', ({ toUserId }) => {
      socket.to(`user:${toUserId}`).emit('typing:stop', {
        userId,
        username: socket.username
      });
    });

    // Handle request for current online users
    socket.on('request_online_users', () => {
      const currentOnlineUsers = Array.from(onlineUsers);
      console.log(`User ${socket.username} requested online users:`, currentOnlineUsers);
      socket.emit('online_users', { userIds: currentOnlineUsers });
    });

    // Handle real-time message sending
    socket.on('send_dm', async ({ toUserId, text, gifUrl }) => {
      try {
        console.log(`WebSocket DM from ${userId} to ${toUserId}: ${text} ${gifUrl ? '(with GIF)' : ''}`);
        
        // Validate input
        if (!toUserId || (!text?.trim() && !gifUrl)) {
          socket.emit('dm_error', { message: 'Invalid message data' });
          return;
        }

        // Check if recipient exists
        const recipient = await prisma.user.findUnique({
          where: { id: toUserId },
          select: { id: true, username: true }
        });

        if (!recipient) {
          socket.emit('dm_error', { message: 'Recipient not found' });
          return;
        }

        if (toUserId === userId) {
          socket.emit('dm_error', { message: 'Cannot send message to yourself' });
          return;
        }

        // Create message
        const message = await prisma.directMessage.create({
          data: {
            senderId: userId,
            receiverId: toUserId,
            text: text?.trim() || '',
            gifUrl
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                avatarUrl: true
              }
            },
            receiver: {
              select: {
                id: true,
                username: true,
                avatarUrl: true
              }
            }
          }
        });

        console.log('Real-time DM created:', message.id);

        // Emit to both users immediately
        const messageWithStatus = {
          ...message,
          status: 'sent'
        };

        // Send to recipient
        io.to(`user:${toUserId}`).emit('dm', messageWithStatus);
        // Send back to sender for confirmation
        socket.emit('dm', { ...messageWithStatus, status: 'delivered' });

      } catch (error) {
        console.error('Error sending real-time DM:', error);
        socket.emit('dm_error', { message: 'Failed to send message' });
      }
    });
    
    // Handle poll voting
    socket.on('poll:vote', async ({ pollId, optionId }) => {
      try {
        // Check if poll exists and is not expired
        const poll = await prisma.poll.findUnique({
          where: { id: pollId },
          include: {
            options: true,
            tweet: {
              include: {
                author: true
              }
            }
          }
        });
        
        if (!poll || poll.expiresAt < new Date()) {
          socket.emit('poll:error', { message: 'Poll not found or expired' });
          return;
        }
        
        // Check if user already voted
        const existingVote = await prisma.pollVote.findFirst({
          where: {
            userId,
            option: {
              pollId
            }
          }
        });
        
        if (existingVote) {
          socket.emit('poll:error', { message: 'You have already voted' });
          return;
        }
        
        // Create vote and update count
        await prisma.$transaction(async (tx: any) => {
          await tx.pollVote.create({
            data: {
              userId,
              optionId
            }
          });
          
          await tx.pollOption.update({
            where: { id: optionId },
            data: {
              voteCount: {
                increment: 1
              }
            }
          });
        });
        
        // Get updated poll data
        const updatedPoll = await prisma.poll.findUnique({
          where: { id: pollId },
          include: {
            options: true
          }
        });
        
        // Emit updated poll to all users
        io.emit('poll:update', {
          tweetId: poll.tweet.id,
          poll: updatedPoll
        });
        
      } catch (error) {
        socket.emit('poll:error', { message: 'Failed to vote' });
      }
    });
  });
};

// Extend Socket interface to include user data
declare module 'socket.io' {
  interface Socket {
    userId: string;
    username: string;
  }
}
