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

// Same reasoning as auth.test.ts: OAuth2Client is instantiated at module load time by
// auth.ts (used only by POST /auth/google, untouched by this file), so it must still be
// mocked here purely to let the module load at all — no test in this file exercises it.
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

// auth.ts imports sendVerificationEmail/sendPasswordResetEmail/sendPasswordAddedEmail
// from lib/email.ts, which constructs a real Resend client at module-load time — mocked
// so no test here makes a real network call, and so sendPasswordAddedEmail's
// success/failure can be controlled per test.
jest.mock('../../lib/email', () => ({
  __esModule: true,
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordAddedEmail: jest.fn().mockResolvedValue(undefined),
}));

// auth.ts imports createTypedNotification from lib/notifications.ts, which transitively
// imports `io` from ../index — index.ts has real side effects at import time (HTTP
// server, Socket.IO, background jobs, Supabase), so it's mocked here too, same as
// auth.test.ts, even though no route in this file calls createTypedNotification.
jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createTypedNotification: jest.fn().mockResolvedValue(null),
}));

import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';
import { sendPasswordAddedEmail } from '../../lib/email';
import { JWT_SECRET } from '../../lib/config';
import authRouter from '../auth';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const bcryptCompareMock = bcrypt.compare as unknown as jest.Mock;
const bcryptHashMock = bcrypt.hash as unknown as jest.Mock;
const sendPasswordAddedEmailMock = sendPasswordAddedEmail as jest.Mock;

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api/auth', authRouter);

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    fullName: 'Jane Dela Cruz',
    role: 'customer',
    passwordHash: null, // Google-only account by default in this file
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
    ...overrides,
  } as any;
}

const authToken = jwt.sign({ id: 'user-1' }, JWT_SECRET, { expiresIn: '1h' });

// setPasswordLimiter is keyed by client IP (max 5/hour) — all tests in this file share
// one process, so without a distinct apparent IP per call, later tests would get
// rate-limited (429) by earlier ones. Same test-harness-only workaround already used by
// auth.test.ts's own register tests, via `app.set('trust proxy', 1)` above.
let setPasswordCallCount = 0;
function setPasswordRequest(body: Record<string, any>) {
  setPasswordCallCount += 1;
  return request(app)
    .post('/api/auth/set-password')
    .set('Authorization', `Bearer ${authToken}`)
    .set('X-Forwarded-For', `10.0.0.${setPasswordCallCount}`)
    .send(body);
}

function changePasswordRequest(body: Record<string, any>) {
  return request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${authToken}`)
    .send(body);
}

beforeEach(() => {
  mockReset(prismaMock);
  bcryptCompareMock.mockReset();
  bcryptHashMock.mockReset();
  bcryptHashMock.mockResolvedValue('hashed-password-value');
  sendPasswordAddedEmailMock.mockReset();
  sendPasswordAddedEmailMock.mockResolvedValue(undefined);
  // authenticate middleware's own lookup — every test in this file is a Google-only
  // account (passwordHash: null) unless overridden inside the test itself.
  prismaMock.user.findUnique.mockResolvedValue(makeUser() as any);
});

describe('POST /api/auth/set-password', () => {
  test('missing fields → 400', async () => {
    const res = await setPasswordRequest({ newPassword: 'longenough1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('New password and confirm password are required.');
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  test('mismatched confirmation → 400', async () => {
    const res = await setPasswordRequest({ newPassword: 'longenough1', confirmPassword: 'different1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('New password and confirm password do not match.');
  });

  test('whitespace-only password → 400', async () => {
    const res = await setPasswordRequest({ newPassword: '        ', confirmPassword: '        ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Password cannot be blank or whitespace only.');
  });

  test('too short (< 8 chars) → 400', async () => {
    const res = await setPasswordRequest({ newPassword: 'short1', confirmPassword: 'short1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('New password must be at least 8 characters.');
  });

  test('too long (> 72 chars) → 400', async () => {
    const tooLong = 'a1'.repeat(37); // 74 chars
    const res = await setPasswordRequest({ newPassword: tooLong, confirmPassword: tooLong });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('New password must be at most 72 characters.');
  });

  test('valid password, passwordHash currently null → 200, hashed and saved atomically, notification email attempted', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

    const res = await setPasswordRequest({ newPassword: 'longenough1', confirmPassword: 'longenough1' });

    expect(res.status).toBe(200);
    expect(bcryptHashMock).toHaveBeenCalledWith('longenough1', 10);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', passwordHash: null },
      data: { passwordHash: 'hashed-password-value' },
    });
    expect(sendPasswordAddedEmailMock).toHaveBeenCalledWith('jane@example.com', 'Jane Dela Cruz');
  });

  test('account already has a password (updateMany matches 0 rows) → 400, distinct message', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    const res = await setPasswordRequest({ newPassword: 'longenough1', confirmPassword: 'longenough1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This account already has a password. Use Change Password instead.');
    expect(sendPasswordAddedEmailMock).not.toHaveBeenCalled();
  });

  test('notification email fails → request still succeeds (200)', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    sendPasswordAddedEmailMock.mockRejectedValue(new Error('Resend is down'));

    const res = await setPasswordRequest({ newPassword: 'longenough1', confirmPassword: 'longenough1' });

    expect(res.status).toBe(200);
    expect(sendPasswordAddedEmailMock).toHaveBeenCalled();
  });

  test('after set-password succeeds, the user can log in with email + password (subject to the existing approval gate)', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    const setRes = await setPasswordRequest({ newPassword: 'longenough1', confirmPassword: 'longenough1' });
    expect(setRes.status).toBe(200);

    // Login re-fetches the user — now with the newly-set hash, same approval state.
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ passwordHash: 'hashed-password-value' }) as any);
    bcryptCompareMock.mockResolvedValue(true);
    prismaMock.user.update.mockResolvedValue({} as any);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'longenough1' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(bcryptCompareMock).toHaveBeenCalledWith('longenough1', 'hashed-password-value');
  });

  test('after set-password, a still-pending account logging in gets PENDING_APPROVAL, not a token', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    const setRes = await setPasswordRequest({ newPassword: 'longenough1', confirmPassword: 'longenough1' });
    expect(setRes.status).toBe(200);

    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ passwordHash: 'hashed-password-value', approvalStatus: 'pending' }) as any
    );
    bcryptCompareMock.mockResolvedValue(true);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'longenough1' });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.code).toBe('PENDING_APPROVAL');
    expect(loginRes.body.token).toBeUndefined();
  });
});

describe('POST /api/auth/change-password — null passwordHash', () => {
  test('Google-only account (passwordHash: null) → 400 "Use Add Password instead", not a 500/crash', async () => {
    // authenticate middleware's lookup, then the route's own `select: { passwordHash: true }` lookup.
    prismaMock.user.findUnique
      .mockResolvedValueOnce(makeUser() as any)
      .mockResolvedValueOnce({ passwordHash: null } as any);

    const res = await changePasswordRequest({ currentPassword: 'whatever1', newPassword: 'longenough1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This account has no password yet. Use Add Password instead.');
    expect(bcryptCompareMock).not.toHaveBeenCalled();
  });
});
