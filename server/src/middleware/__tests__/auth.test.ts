import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../lib/config';
import { authenticate } from '../auth';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// middleware/auth.ts only imports jsonwebtoken, lib/prisma, and lib/config — no
// notifications/email/io — so unlike the route test files, nothing else needs mocking
// here to safely import it in a Jest process.
const app = express();
app.get('/protected', authenticate, (req, res) => res.json({ ok: true }));

function tokenFor(id: string): string {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  mockReset(prismaMock);
});

describe('authenticate middleware', () => {
  test('pending user with an otherwise-valid JWT → 401', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz',
      isActive: true, approvalStatus: 'pending',
    } as any);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${tokenFor('user-1')}`);

    expect(res.status).toBe(401);
  });

  test('rejected user with an otherwise-valid JWT → 401', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz',
      isActive: true, approvalStatus: 'rejected',
    } as any);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${tokenFor('user-1')}`);

    expect(res.status).toBe(401);
  });

  test('approved user with a valid JWT → passes through to the route', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz',
      isActive: true, approvalStatus: 'approved',
    } as any);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${tokenFor('user-1')}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('a user record with no approvalStatus field at all (legacy/mocked fixture) → passes through, not accidentally blocked', async () => {
    // Deliberately omits approvalStatus entirely — proves the check uses `=== 'pending'`/
    // `=== 'rejected'` (never `!== 'approved'`), so a row that predates this field, or any
    // other test fixture in this codebase that hasn't been updated, keeps working.
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz',
      isActive: true,
    } as any);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${tokenFor('user-1')}`);

    expect(res.status).toBe(200);
  });
});
