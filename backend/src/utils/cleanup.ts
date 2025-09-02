import { prisma } from '../db';

class CleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  start() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, 60 * 60 * 1000);
    
    console.log('Cleanup service started');
  }
  
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('Cleanup service stopped');
  }
  
  private async runCleanup() {
    try {
      console.log('Running periodic cleanup...');
      
      // Clean up old notifications (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const deletedNotifications = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo
          }
        }
      });
      
      console.log(`Cleaned up ${deletedNotifications.count} old notifications`);
      
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const cleanupService = new CleanupService();