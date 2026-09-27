import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

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

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findUnique.mockResolvedValue(ADMIN_USER as any);
  prismaMock.payment.findMany.mockResolvedValue([]);
});

describe('GET /api/payments/list — payment type filter', () => {
  function listRequest(query: Record<string, string> = {}) {
    return request(app)
      .get('/api/payments/list')
      .query(query)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  test('ALL → no paymentType key in the where clause', async () => {
    const res = await listRequest({ paymentType: 'ALL' });

    expect(res.status).toBe(200);
    const where = prismaMock.payment.findMany.mock.calls[0][0]!.where as any;
    expect(where.paymentType).toBeUndefined();
  });

  test('GCASH → exact-match "in" filter for both GCash sub-types, no substring match', async () => {
    await listRequest({ paymentType: 'GCASH' });

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentType: { in: ['FULL_GCASH', 'DOWNPAYMENT_GCASH'] } }),
      })
    );
  });

  test('CASH → exact-match "in" filter for REMAINING_CASH only (not FULL_GCASH/DOWNPAYMENT_GCASH)', async () => {
    await listRequest({ paymentType: 'CASH' });

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentType: { in: ['REMAINING_CASH'] } }),
      })
    );
  });

  test('BANK (legacy/removed option) → "in" filter that matches nothing, not an error', async () => {
    const res = await listRequest({ paymentType: 'BANK' });

    expect(res.status).toBe(200);
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentType: { in: [] } }),
      })
    );
  });

  test('full literal value (e.g. REMAINING_CASH) still works directly', async () => {
    await listRequest({ paymentType: 'REMAINING_CASH' });

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentType: { in: ['REMAINING_CASH'] } }),
      })
    );
  });

  test('combined with status and date filters — all three still applied together', async () => {
    await listRequest({ paymentType: 'GCASH', status: 'VERIFIED', startDate: '2026-01-01', endDate: '2026-01-31' });

    const where = prismaMock.payment.findMany.mock.calls[0][0]!.where as any;
    expect(where.paymentType).toEqual({ in: ['FULL_GCASH', 'DOWNPAYMENT_GCASH'] });
    expect(where.status).toBe('VERIFIED');
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);
  });
});

describe('GET /api/payments/export — CSV export payment type filter', () => {
  function exportRequest(query: Record<string, string> = {}) {
    return request(app)
      .get('/api/payments/export')
      .query(query)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  test('no paymentType → no filter applied (matches the previous, unfiltered export behavior)', async () => {
    const res = await exportRequest({});

    expect(res.status).toBe(200);
    const where = prismaMock.payment.findMany.mock.calls[0][0]!.where as any;
    expect(where.paymentType).toBeUndefined();
  });

  test('GCASH → CSV export query is filtered exactly like the list view', async () => {
    await exportRequest({ paymentType: 'GCASH' });

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentType: { in: ['FULL_GCASH', 'DOWNPAYMENT_GCASH'] } }),
      })
    );
  });

  test('CASH → CSV export matches only REMAINING_CASH', async () => {
    await exportRequest({ paymentType: 'CASH' });

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentType: { in: ['REMAINING_CASH'] } }),
      })
    );
  });

  test('BANK → CSV export matches nothing, still returns 200 with just the header row', async () => {
    const res = await exportRequest({ paymentType: 'BANK' });

    expect(res.status).toBe(200);
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentType: { in: [] } }),
      })
    );
  });

  test('paymentType combined with status filter — both applied to the export query', async () => {
    await exportRequest({ paymentType: 'CASH', status: 'PAID_IN_PERSON' });

    const where = prismaMock.payment.findMany.mock.calls[0][0]!.where as any;
    expect(where.paymentType).toEqual({ in: ['REMAINING_CASH'] });
    expect(where.status).toBe('PAID_IN_PERSON');
  });
});
