import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Customer: Get Active Rental for GPS
router.get('/active-rental', authenticate, async (req: AuthRequest, res) => {
  try {
    const activeBooking = await prisma.booking.findFirst({
      where: {
        customerId: req.user!.id,
        status: 'ACTIVE'
      },
      include: {
        vehicle: true,
        trackingSession: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!activeBooking) {
      return res.json({ message: 'No active rental yet. GPS starts after vehicle release.', data: null });
    }

    res.json({
      message: 'Active rental found',
      data: activeBooking, // Return full booking including vehicle and trackingSession
      meta: {
        trackingSessionId: activeBooking.trackingSession?.id || null,
        bookingStatus: activeBooking.status,
        vehicleStatus: activeBooking.vehicle.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active rental' });
  }
});

// Profile Logic
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { 
        id: true, 
        email: true, 
        fullName: true, 
        role: true, 
        phoneNumber: true, 
        address: true, 
        avatarUrl: true,
        createdAt: true
      }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  const { fullName, phoneNumber, address } = req.body;
  
  try {
    // Only allow updating non-sensitive fields
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        fullName,
        phoneNumber,
        address
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phoneNumber: true,
        address: true,
        avatarUrl: true
      }
    });
    
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Notifications Logic (Proxy to existing but with /customer prefix if desired)
router.get('/notifications', authenticate, async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/notifications/:id/read', authenticate, async (req: AuthRequest, res) => {
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

router.get('/notifications/unread-count', authenticate, async (req: AuthRequest, res) => {
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

router.post('/notifications/read-all', authenticate, async (req: AuthRequest, res) => {
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

export default router;
