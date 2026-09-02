import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { JWT_SECRET } from '../lib/config';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: 'You have requested too many verification emails. Please wait 1 hour before trying again.',
    code: 'RESEND_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: {
    error: 'You have requested too many password resets. Please wait 15 minutes before trying again.',
    code: 'RESET_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register Customer
router.post('/register', registerLimiter, async (req, res) => {
  const { email, password, confirmPassword, fullName, phoneNumber, address } = req.body;

  try {
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Email, password, and confirm password are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        fullName,
        phoneNumber,
        address,
        role: 'customer',
        emailVerified: false,
        verificationToken,
        verificationTokenExpiry,
      }
    });

    // Send verification email — non-blocking: registration succeeds even if email fails
    try {
      await sendVerificationEmail(email, fullName || email, verificationToken);
    } catch (emailErr) {
      console.error('[Registration] Failed to send verification email:', emailErr);
    }

    return res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account before logging in.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been disabled. Please contact the administrator.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Block unverified accounts — placed after password check to avoid user enumeration
    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Email not verified. Please check your inbox and verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }, token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/verify-email  { token }
// Using POST so email link scanners (GET prefetch) cannot consume the token
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid verification token.' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        emailVerified: false,
        verificationTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Verification link is invalid or has expired. Please request a new one.'
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      }
    });

    return res.status(200).json({
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// POST /auth/resend-verification
router.post('/resend-verification', resendLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required.' });

  // Always return the same message — never reveal if email exists
  const successResponse = {
    message: 'If that email exists and is unverified, a new link has been sent.'
  };

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Already verified — tell them directly so they know to just log in
    if (user && user.emailVerified) {
      return res.status(400).json({
        error: 'This email address is already verified. You can log in normally.',
        code: 'ALREADY_VERIFIED'
      });
    }

    // User not found — return generic message (never reveal if email exists)
    if (!user) {
      return res.status(200).json(successResponse);
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('DEBUG resend: about to update token');
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry }
    });

    console.log('DEBUG resend: user found, sending email to:', user.email);
    try {
      await sendVerificationEmail(user.email, user.fullName, verificationToken);
    } catch (emailErr) {
      console.error('[Resend] Failed to send verification email:', emailErr);
    }

    return res.status(200).json(successResponse);
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(200).json(successResponse); // still safe response
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const successResponse = {
    message: 'If an account with that email exists, a password reset link has been sent.'
  };

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.status(200).json(successResponse);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    try {
      await sendPasswordResetEmail(user.email, user.fullName, resetToken);
    } catch (emailErr) {
      console.error('[ForgotPassword] Failed to send reset email:', emailErr);
    }

    return res.status(200).json(successResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(200).json(successResponse);
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Password reset link is invalid or has expired. Please request a new one.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      }
    });

    return res.status(200).json({
      message: 'Password reset successful. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

// POST /auth/change-password — authenticated users only
router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from your current password.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { passwordHash: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect.', code: 'WRONG_CURRENT_PASSWORD' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: hashedPassword }
    });

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

// Me (Get profile)
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, fullName: true, role: true, phoneNumber: true, address: true, avatarUrl: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
