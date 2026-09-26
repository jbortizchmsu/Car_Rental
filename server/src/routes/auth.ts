import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { JWT_SECRET, GOOGLE_CLIENT_ID } from '../lib/config';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email';
import { registerSchema } from '../lib/validation';
import { clientIpKeyGenerator } from '../lib/client-ip';
import { createTypedNotification } from '../lib/notifications';
import { NotificationType } from '../lib/notification-types';

const router = Router();

// Built once at module load from whatever GOOGLE_CLIENT_ID currently holds (undefined
// if unset — OAuth2Client accepts that fine, it just never validates an audience,
// which is why POST /auth/google below separately re-checks GOOGLE_CLIENT_ID itself
// before ever calling verifyIdToken).
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const loginLimiter = rateLimit({
  keyGenerator: clientIpKeyGenerator,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const registerLimiter = rateLimit({
  keyGenerator: clientIpKeyGenerator,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendLimiter = rateLimit({
  keyGenerator: clientIpKeyGenerator,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: 'You have requested too many verification emails. Please wait 1 hour before trying again.',
    code: 'RESEND_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailStatusLimiter = rateLimit({
  keyGenerator: clientIpKeyGenerator,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // generous enough for the 5-10s polling window (~2 min = ~24 requests)
  message: { error: 'Too many status checks. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const googleAuthLimiter = rateLimit({
  keyGenerator: clientIpKeyGenerator,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const forgotPasswordLimiter = rateLimit({
  keyGenerator: clientIpKeyGenerator,
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

    // Stricter format/required-field validation, layered on top of the checks above —
    // catches malformed emails, missing/malformed phone numbers, and missing name/address,
    // none of which the manual checks above ever caught. Purely additive: any request
    // that already failed a check above never reaches this, so those exact messages
    // are unchanged for the cases they already handled.
    const parsed = registerSchema.safeParse({ email, fullName, phoneNumber, address });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
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
        approvalStatus: 'pending',
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
      message: 'Registration successful. Please check your email to verify your account before logging in.',
      userId: user.id
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

    // A Google-only account (created via POST /auth/google) has passwordHash: null —
    // bcrypt.compare(x, null) would throw, so short-circuit to the same generic
    // rejection every other invalid-credentials case returns, rather than crash or
    // reveal that this email is a Google-only account.
    const validPassword = user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
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

    // Block accounts still awaiting, or denied, admin approval — checked after email
    // verification, so an unverified pending user sees EMAIL_NOT_VERIFIED first (the
    // step they can actually act on) rather than a confusing approval message.
    if (user.approvalStatus === 'pending') {
      return res.status(403).json({
        error: 'Your account is awaiting admin approval. You will receive an email once it is approved.',
        code: 'PENDING_APPROVAL'
      });
    }
    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({
        error: 'Your account registration was not approved. Please contact the administrator.',
        code: 'ACCOUNT_REJECTED'
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

// POST /auth/google  { idToken } — Google Identity Services client-side sign-in.
// The frontend never decodes the token itself; it is sent here as-is and verified
// against Google's public keys via google-auth-library, so only a genuinely
// Google-signed token for OUR client ID can ever authenticate a request.
router.post('/google', googleAuthLimiter, async (req, res) => {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'Google ID token is required.' });
  }

  // Fails cleanly, request-by-request, if Google Sign-In was never configured —
  // never throws at module load (see lib/config.ts), so every other route on this
  // server keeps working perfectly even if this env var is missing or wrong.
  if (!GOOGLE_CLIENT_ID) {
    console.error('[Google Sign-In] GOOGLE_CLIENT_ID is not configured on the server — rejecting request.');
    return res.status(503).json({ error: 'Google Sign-In is not available right now. Please use email and password instead.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ error: 'Invalid Google sign-in token.' });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({ error: "Your Google account's email address is not verified." });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const fullName = payload.name || email;

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (existingByEmail) {
        // Only link into an account that has itself already proven ownership of this
        // email address (emailVerified === true) — linking into an unverified account
        // would let a Google sign-in silently take over a row nobody has confirmed yet.
        if (!existingByEmail.emailVerified) {
          return res.status(409).json({
            error: "An account with this email exists but hasn't been verified. Please verify it first, or contact support.",
            code: 'EXISTING_UNVERIFIED_ACCOUNT',
          });
        }
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId },
        });
      } else {
        // New Google-only account — starts "pending" exactly like a password
        // registration, so Google Sign-In cannot be used to bypass admin approval.
        // An account linked into an EXISTING row above keeps that row's own
        // approvalStatus untouched — only brand-new accounts start pending here.
        user = await prisma.user.create({
          data: {
            email,
            fullName,
            googleId,
            passwordHash: null,
            emailVerified: true,
            role: 'customer',
            authProvider: 'google',
            approvalStatus: 'pending',
          },
        });

        // Google accounts are emailVerified immediately on creation (Google already
        // proved the address), so this is the equivalent moment to POST /verify-email's
        // notification below — fire it here instead, not on every subsequent sign-in.
        await createTypedNotification(
          NotificationType.NEW_USER_REGISTRATION,
          { customerName: user.fullName, customerEmail: user.email },
          user.id,
          'user'
        );
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been disabled. Please contact the administrator.' });
    }

    // Same approval gate as POST /login — a brand-new Google account (created just
    // above, pending) or a previously rejected account must not receive a token.
    if (user.approvalStatus === 'pending') {
      return res.status(403).json({
        error: 'Your account is awaiting admin approval. You will receive an email once it is approved.',
        code: 'PENDING_APPROVAL'
      });
    }
    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({
        error: 'Your account registration was not approved. Please contact the administrator.',
        code: 'ACCOUNT_REJECTED'
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Identical shape/signing to every other login path — POST /login issues the
    // exact same jwt.sign(...) call with the exact same payload and expiry.
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }, token });
  } catch (error) {
    console.error('[Google Sign-In] verification/login error:', error);
    return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
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

    // Notify admins the applicant is now ready for approval — non-blocking, same as
    // every other notification call site; never fails the request.
    await createTypedNotification(
      NotificationType.NEW_USER_REGISTRATION,
      { customerName: user.fullName, customerEmail: user.email },
      user.id,
      'user'
    );

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

    await prisma.user.update({
      where: { id: user.id },
      // Reset delivery status to 'pending' for this fresh send — otherwise a stale
      // 'bounced' from an earlier attempt would keep showing while this new email
      // is in flight, until the next webhook event overwrites it.
      data: { verificationToken, verificationTokenExpiry, emailDeliveryStatus: 'pending' }
    });

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

// GET /auth/email-status/:userId — polled by the "Check your email" screen right
// after registration (the user has no JWT yet, so this must stay public). Returns
// only the minimal status field — no name, email, or any other user data.
router.get('/email-status/:userId', emailStatusLimiter, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { emailDeliveryStatus: true }
    });
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ status: user.emailDeliveryStatus });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch status' });
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

    if (!user.passwordHash) {
      return res.status(400).json({ error: 'This account uses Google Sign-In and has no password to change.' });
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
