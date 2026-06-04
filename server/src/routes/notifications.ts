import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user notifications (paginated, with optional filters)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const skip = parseInt(req.query.skip as string) || 0;
    const take = parseInt(req.query.take as string) || 50;
    const isRead = req.query.isRead ? req.query.isRead === 'true' : undefined;
    const type = req.query.type as string | undefined;

    const whereClause: any = { userId: req.user!.id };

    if (isRead !== undefined) {
      whereClause.isRead = isRead;
    }

    if (type) {
      whereClause.type = type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.notification.count({ where: whereClause })
    ]);

    res.json({
      data: notifications,
      total,
      skip,
      take,
      hasMore: skip + take < total
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user!.id,
        isRead: false
      }
    });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark notification as read
router.post('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all as read
router.post('/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Delete/dismiss a notification
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Admin endpoint: Get all notifications for admin users
router.get('/admin/all', authenticate, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const skip = parseInt(req.query.skip as string) || 0;
    const take = parseInt(req.query.take as string) || 50;
    const isRead = req.query.isRead ? req.query.isRead === 'true' : undefined;
    const type = req.query.type as string | undefined;

    const whereClause: any = {
      targetRole: { in: ['admin', 'all'] }
    };

    if (isRead !== undefined) {
      whereClause.isRead = isRead;
    }

    if (type) {
      whereClause.type = type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, fullName: true } }
        }
      }),
      prisma.notification.count({ where: whereClause })
    ]);

    res.json({
      data: notifications,
      total,
      skip,
      take,
      hasMore: skip + take < total
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin notifications' });
  }
});

export default router;
