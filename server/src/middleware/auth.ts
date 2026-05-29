import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    fullName: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if user is still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { isActive: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Your account has been disabled.' });
    }

    req.user = decoded;
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
