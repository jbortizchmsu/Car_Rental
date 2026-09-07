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

import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';
import { sendVerificationEmail } from '../../lib/email';
import { JWT_SECRET } from '../../lib/config';
import authRouter from '../auth';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const bcryptCompareMock = bcrypt.compare as unknown as jest.Mock;
const bcryptHashMock = bcrypt.hash as unknown as jest.Mock;
const sendVerificationEmailMock = sendVerificationEmail as jest.Mock;

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
