import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Same reasoning as payments.test.ts: lib/notifications.ts imports `{ io } from '../index'`,
// and index.ts has real side effects at import time. An explicit factory here means Jest
// never requires the real notifications module.
jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createNotification: jest.fn().mockResolvedValue(undefined),
  createAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  uploadToSupabaseStorage: jest.fn().mockResolvedValue('https://example.test/fake-proof.jpg'),
  BUCKETS: { PAYMENT_PROOFS: 'payment-proofs' },
}));

import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../lib/config';
import paymentsRouter from '../payments';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRouter);

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin', fullName: 'Admin User', isActive: true };
const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function confirmCashRequest(body: Record<string, any>) {
  return request(app)
    .post('/api/payments/booking/booking-1/confirm-cash')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findUnique.mockResolvedValue(ADMIN_USER as any);
  prismaMock.booking.findUnique.mockResolvedValue({ id: 'booking-1', customerId: 'cust-1', totalAmount: 5000 } as any);
});

describe('POST /api/payments/booking/:id/confirm-cash', () => {
  test('amount missing → 400, payment never created', async () => {
    const res = await confirmCashRequest({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Amount must be a valid number greater than 0.');
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  test('amount non-numeric string → 400', async () => {
    const res = await confirmCashRequest({ amount: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Amount must be a valid number greater than 0.');
  });

  test('amount of 0 → 400 (must be greater than 0)', async () => {
    const res = await confirmCashRequest({ amount: 0 });

    expect(res.status).toBe(400);
  });

  test('negative amount → 400', async () => {
    const res = await confirmCashRequest({ amount: -500 });

    expect(res.status).toBe(400);
  });

  test('NaN/Infinity → 400', async () => {
    expect((await confirmCashRequest({ amount: NaN })).status).toBe(400);
    expect((await confirmCashRequest({ amount: Infinity })).status).toBe(400);
  });

  test('valid positive amount (number) → payment created, booking transitioned', async () => {
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' } as any);
    prismaMock.booking.update.mockResolvedValue({ id: 'booking-1', status: 'READY_FOR_PICKUP' } as any);

    const res = await confirmCashRequest({ amount: 2500 });

    expect(res.status).toBe(200);
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 2500 }) })
    );
  });

  test('valid positive amount as a numeric string is accepted', async () => {
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' } as any);
    prismaMock.booking.update.mockResolvedValue({ id: 'booking-1', status: 'READY_FOR_PICKUP' } as any);

    const res = await confirmCashRequest({ amount: '2500.50' });

    expect(res.status).toBe(200);
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 2500.5 }) })
    );
  });

  test('booking not found → 404, before amount is even considered', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);

    const res = await confirmCashRequest({ amount: 'not-a-number' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Booking not found');
  });
});
