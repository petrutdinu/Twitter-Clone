import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Server } from 'socket.io';
import { prisma } from './db';
import { authRoutes } from './routes/auth';
import { tweetRoutes } from './routes/tweets';
import { userRoutes } from './routes/users';
import { notificationRoutes, setIOInstance } from './routes/notifications';
import { dmRoutes } from './routes/dm';
import { trendsRoutes } from './routes/trends';
import { searchRoutes } from './routes/search';
import { setupWebSocket } from './websocket';
import { logger } from './utils/logger';
import { cleanupService } from './utils/cleanup';
import { globalRateLimit } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// HTTPS configuration
const useHttps = process.env.NODE_ENV === 'production' || process.env.USE_HTTPS === 'true';
let server;

if (useHttps) {
  try {
    // Check if we're in Docker (files mounted to /app/ssl) or local development (../../ssl)
    const dockerSslPath = '/app/ssl';
    const localSslPath = join(__dirname, '../../ssl');
    
    // Use existsSync to determine which path to use
    const sslPath = existsSync(dockerSslPath) ? dockerSslPath : localSslPath;
    
    const httpsOptions = {
      key: readFileSync(join(sslPath, 'server.key')),
      cert: readFileSync(join(sslPath, 'server.crt'))
    };
    server = createHttpsServer(httpsOptions, app);
    console.log('HTTPS server configured');
  } catch (error) {
    console.warn('SSL certificates not found, falling back to HTTP:', error);
    server = createServer(app);
  }
} else {
  server = createServer(app);
}
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Export io for use in routes
export { io };

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', globalRateLimit);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tweets', tweetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    });
  }
});

// Error handling
app.use(errorHandler);

// Setup WebSocket
setupWebSocket(io);

// Set io instance for routes that need it
setIOInstance(io);

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');
    
    // Start cleanup service
    cleanupService.start();
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  cleanupService.stop();
  await prisma.$disconnect();
  process.exit(0);
});
