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
import reportsRouter from '../reports';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.use('/api/admin/reports', reportsRouter);

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin', fullName: 'Admin User', isActive: true };
const CUSTOMER_USER = { id: 'cust-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz', isActive: true };

const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });
const customerToken = jwt.sign({ id: CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function trendRequest(query: Record<string, string>, token = adminToken) {
  return request(app)
    .get('/api/admin/reports/revenue-trend')
    .query(query)
    .set('Authorization', `Bearer ${token}`);
}

function revenueRequest(query: Record<string, string>, token = adminToken) {
  return request(app)
    .get('/api/admin/reports/revenue')
    .query(query)
    .set('Authorization', `Bearer ${token}`);
}

function payment(amount: number, createdAt: string, status: 'VERIFIED' | 'PAID_IN_PERSON' = 'VERIFIED', paymentType = 'FULL_GCASH') {
  return { amount, createdAt: new Date(createdAt), status, paymentType } as any;
}

function maintenanceLog(cost: number, serviceDate: string) {
  return { cost, serviceDate: new Date(serviceDate) } as any;
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findUnique.mockImplementation(((args: any) => {
    if (args?.where?.id === ADMIN_USER.id) return Promise.resolve(ADMIN_USER as any);
    if (args?.where?.id === CUSTOMER_USER.id) return Promise.resolve(CUSTOMER_USER as any);
    return Promise.resolve(null);
  }) as any);
  prismaMock.payment.findMany.mockResolvedValue([]);
  prismaMock.maintenanceLog.findMany.mockResolvedValue([]);
  prismaMock.revenueAnalytics.create.mockResolvedValue({} as any);
});

describe('GET /api/admin/reports/revenue-trend — validation', () => {
  test('missing startDate/endDate → 400', async () => {
    const res = await trendRequest({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('invalid date format → 400', async () => {
    const res = await trendRequest({ startDate: 'not-a-date', endDate: '2026-09-28' });
    expect(res.status).toBe(400);
  });

  test('start after end → 400', async () => {
    const res = await trendRequest({ startDate: '2026-09-28', endDate: '2026-09-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must not be after/i);
  });

  test('start equal to end (a single day) → 200, not rejected', async () => {
    const res = await trendRequest({ startDate: '2026-09-28', endDate: '2026-09-28' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/reports/revenue-trend — admin-only access', () => {
  test('a customer token → 403', async () => {
    const res = await trendRequest({ startDate: '2026-09-01', endDate: '2026-09-28' }, customerToken);
    expect(res.status).toBe(403);
  });

  test('no token at all → 401', async () => {
    const res = await request(app).get('/api/admin/reports/revenue-trend').query({ startDate: '2026-09-01', endDate: '2026-09-28' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/reports/revenue-trend — grouping thresholds', () => {
  test('a 1-day range groups by day', async () => {
    const res = await trendRequest({ startDate: '2026-09-28', endDate: '2026-09-28' });
    expect(res.body.grouping).toBe('day');
    expect(res.body.periods).toHaveLength(1);
  });

  test('a 31-day range groups by day', async () => {
    const res = await trendRequest({ startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(res.body.grouping).toBe('day');
    expect(res.body.periods).toHaveLength(31);
  });

  test('a 32-day range groups by week', async () => {
    const res = await trendRequest({ startDate: '2026-01-01', endDate: '2026-02-01' });
    expect(res.body.grouping).toBe('week');
  });

  test('a range over 183 days groups by month', async () => {
    const res = await trendRequest({ startDate: '2026-01-01', endDate: '2026-07-03' });
    expect(res.body.grouping).toBe('month');
  });
});

describe('GET /api/admin/reports/revenue-trend — empty periods and Manila boundaries', () => {
  test('no matching payments or maintenance logs → every period is present with 0 revenue/cost/profit', async () => {
    const res = await trendRequest({ startDate: '2026-09-26', endDate: '2026-09-28' });

    expect(res.status).toBe(200);
    expect(res.body.periods).toHaveLength(3);
    for (const p of res.body.periods) {
      expect(p.revenue).toBe(0);
      expect(p.maintenanceCost).toBe(0);
      expect(p.netProfit).toBe(0);
    }
  });

  test('a payment recorded just after Manila midnight on the last day of the range is still counted in that day\'s period (not pushed to the next day by a UTC-based boundary)', async () => {
    // 2026-09-28T00:00:01+08:00 is still Sep 28 in Manila, but Sep 27 16:00:01 UTC.
    prismaMock.payment.findMany.mockResolvedValue([payment(1000, '2026-09-28T00:00:01+08:00')]);

    const res = await trendRequest({ startDate: '2026-09-26', endDate: '2026-09-28' });

    const lastPeriod = res.body.periods[res.body.periods.length - 1];
    expect(lastPeriod.startDate).toBe('2026-09-28');
    expect(lastPeriod.revenue).toBe(1000);
  });

  test('a payment recorded just before Manila midnight is counted in the earlier day, not rolled into the next', async () => {
    // 2026-09-27T23:59:59+08:00 is Sep 27 in Manila.
    prismaMock.payment.findMany.mockResolvedValue([payment(500, '2026-09-27T23:59:59+08:00')]);

    const res = await trendRequest({ startDate: '2026-09-26', endDate: '2026-09-28' });

    const sep27 = res.body.periods.find((p: any) => p.startDate === '2026-09-27');
    const sep28 = res.body.periods.find((p: any) => p.startDate === '2026-09-28');
    expect(sep27.revenue).toBe(500);
    expect(sep28.revenue).toBe(0);
  });
});

describe('GET /api/admin/reports/revenue-trend — sum of periods equals /revenue\'s total', () => {
  test('day grouping: sum of period netProfit equals /revenue\'s netProfit for the same range', async () => {
    const payments = [
      payment(3000, '2026-09-26T10:00:00+08:00', 'VERIFIED'),
      payment(1500, '2026-09-27T15:00:00+08:00', 'PAID_IN_PERSON'),
      payment(2000, '2026-09-28T09:00:00+08:00', 'VERIFIED'),
    ];
    const logs = [maintenanceLog(800, '2026-09-27T12:00:00+08:00')];

    prismaMock.payment.findMany.mockResolvedValue(payments as any);
    prismaMock.maintenanceLog.findMany.mockResolvedValue(logs as any);
    prismaMock.maintenanceLog.aggregate.mockResolvedValue({ _sum: { cost: 800 } } as any);

    const trendRes = await trendRequest({ startDate: '2026-09-26', endDate: '2026-09-28' });
    const revenueRes = await revenueRequest({ startDate: '2026-09-26', endDate: '2026-09-28' });

    const sumNetProfit = trendRes.body.periods.reduce((sum: number, p: any) => sum + p.netProfit, 0);
    expect(sumNetProfit).toBeCloseTo(revenueRes.body.netProfit, 5);
  });

  test('week grouping: sum of period revenue equals /revenue\'s total revenue for the same range', async () => {
    const payments = [
      payment(1000, '2026-01-05T10:00:00+08:00'),
      payment(2000, '2026-01-20T10:00:00+08:00'),
      payment(4000, '2026-01-31T10:00:00+08:00'),
    ];
    prismaMock.payment.findMany.mockResolvedValue(payments as any);
    prismaMock.maintenanceLog.aggregate.mockResolvedValue({ _sum: { cost: 0 } } as any);

    const trendRes = await trendRequest({ startDate: '2026-01-01', endDate: '2026-02-15' });
    const revenueRes = await revenueRequest({ startDate: '2026-01-01', endDate: '2026-02-15' });

    expect(trendRes.body.grouping).toBe('week');
    const sumRevenue = trendRes.body.periods.reduce((sum: number, p: any) => sum + p.revenue, 0);
    expect(sumRevenue).toBeCloseTo(revenueRes.body.breakdown.total, 5);
  });
});
