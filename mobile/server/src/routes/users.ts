import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcrypt';

const router = Router();

// Only admin can access these routes
router.use(authenticate, authorizeAdmin);

// GET /api/admin/users
router.get('/', async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: { bookings: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // We can't aggregate total spent easily in a single Prisma query with _count,
    // so we'll fetch the users and map them. This is fine for admin scale.
    // For large scale, we'd do a raw query.
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        bookings: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            vehicle: {
              select: { brand: true, model: true }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Exclude passwordHash
    const { passwordHash, ...userSafe } = user;
    res.json(userSafe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// PATCH /api/admin/users/:id/status
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    if (id === req.user!.id && !isActive) {
      return res.status(403).json({ error: 'You cannot disable your own account.' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, role: true, isActive: true }
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/:id/role', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'customer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (id === req.user!.id && role !== 'admin') {
      return res.status(403).json({ error: 'You cannot demote your own role.' });
    }

    // If demoting an admin, ensure there is at least one OTHER active admin
    if (role === 'customer') {
      const otherAdmins = await prisma.user.count({
        where: {
          role: 'admin',
          isActive: true,
          id: { not: id }
        }
      });
      if (otherAdmins === 0) {
        return res.status(403).json({ error: 'At least one active administrator is required.' });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true, isActive: true }
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

export default router;
