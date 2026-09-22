import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('bcrypt');

// google-auth-library's real OAuth2Client makes network calls to Google's public keys
// to verify a token's signature — entirely untestable without a real, live-signed
// Google ID token, which this environment cannot produce. Mocking verifyIdToken lets
// these tests deterministically exercise the linking/rejection/creation branches in
// POST /auth/google that a real token would otherwise select, without touching the
// network or trusting an unverified payload. The route's own signature-verification
// CALL is what's mocked here, not skipped — a real deployment still always calls it.
const verifyIdTokenMock = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: verifyIdTokenMock,
  })),
}));

// auth.ts also imports sendVerificationEmail/sendPasswordResetEmail from lib/email.ts, which
// constructs a real Resend client at module-load time. jest.setup.ts sets a placeholder
// RESEND_API_KEY so that module-load no longer crashes (see the auth login round's findings),
// but we still don't want register tests making real network calls to Resend — so the whole
// module is mocked here via an explicit factory, giving per-test control over success/failure.
jest.mock('../../lib/email', () => ({
  __esModule: true,
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

// auth.ts now also imports createTypedNotification from lib/notifications.ts (fired on
// email verification and on new-Google-account creation). That module imports `io` from
// ../index — which transitively imports routes/webhooks.ts, which imports the ESM-only
// `svix` package that Jest (CommonJS) cannot require. Every other route test file that
// touches lib/notifications already mocks it for exactly this reason (see
// bookings-approve.test.ts, bookings-documents.test.ts, etc.) — same pattern here.
jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createTypedNotification: jest.fn().mockResolvedValue(null),
}));

import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';
import { sendVerificationEmail } from '../../lib/email';
import { createTypedNotification } from '../../lib/notifications';
import { JWT_SECRET } from '../../lib/config';
import authRouter from '../auth';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const bcryptCompareMock = bcrypt.compare as unknown as jest.Mock;
const bcryptHashMock = bcrypt.hash as unknown as jest.Mock;
const sendVerificationEmailMock = sendVerificationEmail as jest.Mock;
const createTypedNotificationMock = createTypedNotification as jest.Mock;

// Minimal standalone Express app mounting the real, unmodified auth router —
// mirrors how src/index.ts mounts it (`app.use(express.json()); app.use('/api/auth', authRoutes);`)
// without importing index.ts itself, since index.ts has side effects at import time
// (starts an HTTP server, opens a Socket.IO server, initializes background setInterval jobs,
// and calls out to Supabase) that would make it unsuitable and unsafe to import in a test process.
//
// `trust proxy` + a distinct X-Forwarded-For per register test below is test-harness-only: the
// real /register route is guarded by an express-rate-limit instance (max 5 requests/hour, no
// skipSuccessfulRequests), and all our register tests share one process/IP — without varying the
// apparent client IP, later register tests would get rate-limited (429) by earlier ones in the
// same run, which would be a test-infrastructure artifact, not a real behavior under test.
const app = express();
app.set('trust proxy', 1); // matches src/index.ts's own trust-proxy setting exactly
app.use(express.json());
app.use('/api/auth', authRouter);

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    fullName: 'Jane Dela Cruz',
    role: 'customer',
    passwordHash: 'hashed-password',
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockReset(prismaMock);
  bcryptCompareMock.mockReset();
  bcryptHashMock.mockReset();
  bcryptHashMock.mockResolvedValue('hashed-password-value');
  sendVerificationEmailMock.mockReset();
  sendVerificationEmailMock.mockResolvedValue(undefined);
  createTypedNotificationMock.mockReset();
  createTypedNotificationMock.mockResolvedValue(null);
});

describe('POST /api/auth/login', () => {
  test('email not found → 401 "Invalid credentials"', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('user found but isActive === false → 403 disabled-account message', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ isActive: false }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'whatever' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Your account has been disabled. Please contact the administrator.');
  });

  test('user active, wrong password (bcrypt.compare false) → 401 "Invalid credentials" (identical message to not-found case)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser());
    bcryptCompareMock.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('user active, correct password, emailVerified === false → 403 EMAIL_NOT_VERIFIED', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ emailVerified: false }));
    bcryptCompareMock.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'correct-password' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('ORDERING-CRITICAL: wrong password AND unverified email simultaneously → returns password 401, NOT the verification 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ emailVerified: false }));
    bcryptCompareMock.mockResolvedValue(false); // wrong password

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'wrong-password' });

    // The password check must short-circuit before the emailVerified check is ever reached.
    // If this ever returns 403/EMAIL_NOT_VERIFIED instead, the check order was accidentally
    // swapped, which would let an attacker distinguish "wrong password" from "unverified account"
    // for ANY email address without knowing the real password — an account-enumeration leak.
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
    expect(res.body.code).not.toBe('EMAIL_NOT_VERIFIED');
  });

  test('user active, verified, correct password → 200 with valid JWT and lastLoginAt update', async () => {
    const user = makeUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptCompareMock.mockResolvedValue(true);
    prismaMock.user.update.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');

    const decoded = jwt.verify(res.body.token, JWT_SECRET) as any;
    expect(decoded.id).toBe(user.id);
    expect(decoded.email).toBe(user.email);
    expect(decoded.role).toBe(user.role);

    expect(res.body.user).toEqual({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  test('user active, verified, correct password, approvalStatus explicitly "approved" → 200 with a token', async () => {
    const user = makeUser({ approvalStatus: 'approved' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    bcryptCompareMock.mockResolvedValue(true);
    prismaMock.user.update.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  test('approvalStatus === "pending" → 403 PENDING_APPROVAL, no token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ approvalStatus: 'pending' }));
    bcryptCompareMock.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'correct-password' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PENDING_APPROVAL');
    expect(res.body.token).toBeUndefined();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('approvalStatus === "rejected" → 403 ACCOUNT_REJECTED, no token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ approvalStatus: 'rejected' }));
    bcryptCompareMock.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'correct-password' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_REJECTED');
    expect(res.body.token).toBeUndefined();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('ORDERING: unverified email AND pending approval simultaneously → EMAIL_NOT_VERIFIED wins, not the approval error', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ emailVerified: false, approvalStatus: 'pending' }));
    bcryptCompareMock.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'correct-password' });

    // emailVerified is checked before approvalStatus — the applicant sees the step they
    // can actually act on (verify their email) rather than a confusing approval message
    // for an account that was never even verified.
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('ORDERING: wrong password AND pending approval simultaneously → generic "Invalid credentials", no status leak', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ approvalStatus: 'pending' }));
    bcryptCompareMock.mockResolvedValue(false); // wrong password

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'wrong-password' });

    // The password check must short-circuit before approvalStatus is ever reached — a
    // wrong-password attempt on a pending account must look identical to a wrong-password
    // attempt on any other account, never revealing that this account is pending.
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
    expect(res.body.code).not.toBe('PENDING_APPROVAL');
  });
});

describe('POST /api/auth/register', () => {
  // Each test uses a distinct spoofed client IP (see the `trust proxy` note above the app setup)
  // so the shared registerLimiter (max 5/hour, no skipSuccessfulRequests) never rate-limits
  // a later test in this file because of an earlier one's request.
  let ipCounter = 0;
  function registerRequest(body: Record<string, any>) {
    ipCounter += 1;
    return request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', `10.0.0.${ipCounter}`)
      .send(body);
  }

  const validPayload = {
    email: 'newcustomer@example.com',
    password: 'SecurePass123',
    confirmPassword: 'SecurePass123',
    fullName: 'New Customer',
    phoneNumber: '09171234567',
    address: '123 Main St, Talisay',
  };

  test('missing required field (password omitted) → 400', async () => {
    const { password, ...withoutPassword } = validPayload;

    const res = await registerRequest(withoutPassword);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email, password, and confirm password are required');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  test('password and confirmPassword mismatch → 400', async () => {
    const res = await registerRequest({ ...validPayload, confirmPassword: 'DifferentPass123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Passwords do not match');
  });

  test('password below minimum length (8 chars) → 400', async () => {
    const res = await registerRequest({ ...validPayload, password: 'Short1', confirmPassword: 'Short1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Password must be at least 8 characters long');
  });

  test('email already registered (Prisma returns an existing user) → 400', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ email: validPayload.email }));

    const res = await registerRequest(validPayload);

    // Confirmed against the actual code: this branch returns 400, not 409.
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email already registered');
  });

  test('verification email fails to send → registration still succeeds (201), failure is swallowed', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(makeUser({ email: validPayload.email }));
    sendVerificationEmailMock.mockRejectedValue(new Error('Simulated Resend API failure'));

    const res = await registerRequest(validPayload);

    // Confirmed against the actual code: the send call is wrapped in its own try/catch that
    // only console.errors — it never propagates, so the client is told registration succeeded
    // even though no verification email actually went out. The user account IS created either
    // way. This is worth flagging: the customer has no way to know the email never arrived
    // and may be stuck unable to log in (blocked by EMAIL_NOT_VERIFIED) with no obvious cause,
    // since the success message tells them to "check your email" for an email that never sent.
    expect(res.status).toBe(201);
    expect(res.body.message).toBe(
      'Registration successful. Please check your email to verify your account before logging in.'
    );
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
  });

  test('happy path: valid registration, email sends successfully → 201, no password/hash leaked in response', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const createdUser = makeUser({ email: validPayload.email, passwordHash: 'hashed-password-value' });
    prismaMock.user.create.mockResolvedValue(createdUser);

    const res = await registerRequest(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe(
      'Registration successful. Please check your email to verify your account before logging in.'
    );
    expect(sendVerificationEmailMock).toHaveBeenCalledWith(
      validPayload.email,
      validPayload.fullName,
      expect.any(String)
    );
    expect(bcryptHashMock).toHaveBeenCalledWith(validPayload.password, 10);

    // Explicit security check: the response body must never contain the password or its hash.
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('hashed-password-value');
    expect(JSON.stringify(res.body)).not.toContain(validPayload.password);
  });
});

describe('POST /api/auth/google', () => {
  const validPayload = {
    sub: 'google-sub-999',
    email: 'googleuser@example.com',
    email_verified: true,
    name: 'Google User',
  };

  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  test('missing idToken → 400, never calls verifyIdToken', async () => {
    const res = await request(app).post('/api/auth/google').send({});

    expect(res.status).toBe(400);
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  test('token fails verification (e.g. bad signature/expired) → 401, does not crash, does not touch the database', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('Token used too late'));

    const res = await request(app).post('/api/auth/google').send({ idToken: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Google sign-in failed. Please try again.');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  test('verified payload, existing user already linked by googleId → 200, returning-user path, no create/update-link', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => validPayload });
    const linkedUser = makeUser({ id: 'user-linked', email: validPayload.email, googleId: validPayload.sub, passwordHash: null });
    prismaMock.user.findUnique.mockResolvedValueOnce(linkedUser); // findUnique({ where: { googleId } })
    prismaMock.user.update.mockResolvedValue(linkedUser); // lastLoginAt update

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({
      id: linkedUser.id, email: linkedUser.email, fullName: linkedUser.fullName, role: linkedUser.role,
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  test('verified payload, no user by googleId, existing VERIFIED account with same email → links (sets googleId), does not create a duplicate', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => validPayload });
    const existing = makeUser({ id: 'user-existing-verified', email: validPayload.email, emailVerified: true, googleId: null });
    const linked = { ...existing, googleId: validPayload.sub };

    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // by googleId — not found
      .mockResolvedValueOnce(existing); // by email — found, verified
    prismaMock.user.update
      .mockResolvedValueOnce(linked) // the googleId-link update
      .mockResolvedValueOnce(linked); // the lastLoginAt update

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { googleId: validPayload.sub },
    });
    expect(res.body.user.email).toBe(validPayload.email);
  });

  test('verified payload, no user by googleId, existing UNVERIFIED account with same email → 409, does NOT link, does NOT create', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => validPayload });
    const existingUnverified = makeUser({ id: 'user-existing-unverified', email: validPayload.email, emailVerified: false, googleId: null });

    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // by googleId
      .mockResolvedValueOnce(existingUnverified); // by email

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EXISTING_UNVERIFIED_ACCOUNT');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  test('verified payload, no user by googleId, no user by email → creates a new user with passwordHash: null, emailVerified: true, role: customer, approvalStatus: pending — and does NOT return a token', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => validPayload });
    // approvalStatus: 'pending' overrides makeUser's 'approved' default — this reflects
    // what a real prisma.user.create() call actually returns for a brand-new Google
    // account (see the approvalStatus: 'pending' passed to create below), which is what
    // makes the route's post-creation pending check fire for real in this test.
    const created = makeUser({
      id: 'user-new-google', email: validPayload.email, fullName: validPayload.name,
      googleId: validPayload.sub, passwordHash: null, emailVerified: true, role: 'customer',
      approvalStatus: 'pending',
    });

    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // by googleId
      .mockResolvedValueOnce(null); // by email
    prismaMock.user.create.mockResolvedValue(created);

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        email: validPayload.email,
        fullName: validPayload.name,
        googleId: validPayload.sub,
        passwordHash: null,
        emailVerified: true,
        role: 'customer',
        authProvider: 'google',
        approvalStatus: 'pending',
      },
    });

    // Google Sign-In must not be a way to bypass admin approval: a brand-new account is
    // blocked exactly like a pending password-registered user hitting POST /login, and
    // critically, no JWT is ever issued for it.
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PENDING_APPROVAL');
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toBeUndefined();

    // lastLoginAt must never be touched for a blocked account.
    expect(prismaMock.user.update).not.toHaveBeenCalled();

    // Admins are notified the moment a new Google account is created (it's already
    // emailVerified: true at creation, so this is the equivalent moment to the
    // password-registration flow's POST /verify-email notification).
    expect(createTypedNotificationMock).toHaveBeenCalledWith(
      'NEW_USER_REGISTRATION',
      { customerName: created.fullName, customerEmail: created.email },
      created.id,
      'user'
    );
  });

  test('linking into an existing APPROVED account keeps its status — update touches only googleId, token is issued', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => validPayload });
    const existing = makeUser({ id: 'user-approved', email: validPayload.email, emailVerified: true, approvalStatus: 'approved', googleId: null });
    const linked = { ...existing, googleId: validPayload.sub };

    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // by googleId — not found
      .mockResolvedValueOnce(existing); // by email — found, verified, approved
    prismaMock.user.update
      .mockResolvedValueOnce(linked) // the googleId-link update
      .mockResolvedValueOnce(linked); // the lastLoginAt update

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    // The link update must touch ONLY googleId — never approvalStatus — so an already
    // approved account's status is provably untouched by linking.
    expect(prismaMock.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: existing.id },
      data: { googleId: validPayload.sub },
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  test('linking into an existing PENDING account → 403 PENDING_APPROVAL, no token (linking does not bypass approval)', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => validPayload });
    const existing = makeUser({ id: 'user-pending', email: validPayload.email, emailVerified: true, approvalStatus: 'pending', googleId: null });
    const linked = { ...existing, googleId: validPayload.sub };

    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // by googleId
      .mockResolvedValueOnce(existing); // by email
    prismaMock.user.update.mockResolvedValueOnce(linked); // the googleId-link update only

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PENDING_APPROVAL');
    expect(res.body.token).toBeUndefined();
    // Only the link update runs — the lastLoginAt update must never be reached.
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
  });

  test('linking into an existing REJECTED account → 403 ACCOUNT_REJECTED, no token', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => validPayload });
    const existing = makeUser({ id: 'user-rejected', email: validPayload.email, emailVerified: true, approvalStatus: 'rejected', googleId: null });
    const linked = { ...existing, googleId: validPayload.sub };

    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // by googleId
      .mockResolvedValueOnce(existing); // by email
    prismaMock.user.update.mockResolvedValueOnce(linked); // the googleId-link update only

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_REJECTED');
    expect(res.body.token).toBeUndefined();
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
  });

  test('verified payload but email_verified: false on the Google token itself → 401, never touches the database', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => ({ ...validPayload, email_verified: false }) });

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(401);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  test('GOOGLE_CLIENT_ID unconfigured → 503, and this must NEVER prevent the module from loading or other routes from working', async () => {
    // Deliberately re-imports the route module with GOOGLE_CLIENT_ID deleted, proving the
    // unconfigured case is a clean per-request 503 — not a throw at import time (which would
    // take down every other route mounted alongside it, e.g. /login, /register).
    const originalValue = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    jest.resetModules();

    const freshApp = express();
    freshApp.set('trust proxy', 1);
    freshApp.use(express.json());
    const freshAuthRouter = require('../auth').default;
    freshApp.use('/api/auth', freshAuthRouter);

    const googleRes = await request(freshApp).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(googleRes.status).toBe(503);

    // The rest of the router — mounted from the SAME fresh import — must still work normally.
    prismaMock.user.findUnique.mockResolvedValue(null);
    const loginRes = await request(freshApp).post('/api/auth/login').send({ email: 'x@example.com', password: 'y' });
    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error).toBe('Invalid credentials');

    process.env.GOOGLE_CLIENT_ID = originalValue;
    jest.resetModules();
  });
});

describe('POST /api/auth/verify-email', () => {
  test('valid token → 200, verifies the user, fires NEW_USER_REGISTRATION exactly once with referenceId = the user id', async () => {
    const user = makeUser({ id: 'user-to-verify', emailVerified: false });
    prismaMock.user.findFirst.mockResolvedValue(user);
    prismaMock.user.update.mockResolvedValue({ ...user, emailVerified: true, verificationToken: null, verificationTokenExpiry: null });

    const res = await request(app).post('/api/auth/verify-email').send({ token: 'valid-verification-token' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
    });
    expect(createTypedNotificationMock).toHaveBeenCalledTimes(1);
    expect(createTypedNotificationMock).toHaveBeenCalledWith(
      'NEW_USER_REGISTRATION',
      { customerName: user.fullName, customerEmail: user.email },
      user.id,
      'user'
    );
  });

  test('invalid or expired token → 400, no update, no notification fired', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/verify-email').send({ token: 'garbage-or-expired-token' });

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(createTypedNotificationMock).not.toHaveBeenCalled();
  });
});
