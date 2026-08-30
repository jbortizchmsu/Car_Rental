import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { JWT_SECRET } from '../lib/config';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    fullName: string;
    isActive: boolean;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    if (!decoded.id || typeof decoded.id !== 'string') {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Always re-fetch from DB — role must never be trusted from the token alone
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, fullName: true, isActive: true }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.isActive) return res.status(401).json({ error: 'Your account has been disabled.' });

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
