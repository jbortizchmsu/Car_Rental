import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// vehicles.ts pulls in the Supabase client and multer upload middleware at import time —
// neither is exercised by GET /available, and the real modules would open network/storage
// handles, so they're replaced with inert stubs.
jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  uploadToSupabaseStorage: jest.fn(),
  BUCKETS: {},
}));
jest.mock('../../middleware/upload', () => ({
  __esModule: true,
  vehicleImageUpload: { single: () => (_req: any, _res: any, next: any) => next() },
}));

import { prisma } from '../../lib/prisma';
import vehiclesRouter from '../vehicles';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.use('/api/vehicles', vehiclesRouter);

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.vehicle.findMany.mockResolvedValue([] as any);
});

function lastWhere(): any {
  return (prismaMock.vehicle.findMany.mock.calls[0][0] as any).where;
}

describe('GET /api/vehicles/available — date-window interpretation', () => {
  test('bare dates become a 9 AM pickup / 5 PM return in Philippine time (+08:00), not UTC midnight', async () => {
    const res = await request(app).get('/api/vehicles/available?pickupDate=2026-09-10&returnDate=2026-09-13');

    expect(res.status).toBe(200);
    const [overlapStartsBeforeEnd, overlapEndsAfterStart] = lastWhere().bookings.none.AND;
    // Existing booking overlaps if: booking.startDate < requested end AND booking.endDate > requested start
    expect((overlapStartsBeforeEnd.startDate.lt as Date).toISOString()).toBe('2026-09-13T09:00:00.000Z'); // 5 PM PHT
    expect((overlapEndsAfterStart.endDate.gt as Date).toISOString()).toBe('2026-09-10T01:00:00.000Z'); // 9 AM PHT
  });

  test('a full datetime is passed through untouched (callers that already send a time keep their exact behavior)', async () => {
    const res = await request(app).get(
      '/api/vehicles/available?pickupDate=2026-09-10T14:30:00%2B08:00&returnDate=2026-09-11T16:00:00%2B08:00'
    );

    expect(res.status).toBe(200);
    const [overlapStartsBeforeEnd, overlapEndsAfterStart] = lastWhere().bookings.none.AND;
    expect((overlapStartsBeforeEnd.startDate.lt as Date).toISOString()).toBe('2026-09-11T08:00:00.000Z');
    expect((overlapEndsAfterStart.endDate.gt as Date).toISOString()).toBe('2026-09-10T06:30:00.000Z');
  });

  test('keeps the existing exclusions: maintenance/retired vehicles and finished bookings never count', async () => {
    await request(app).get('/api/vehicles/available?pickupDate=2026-09-10&returnDate=2026-09-13');

    const where = lastWhere();
    expect(where.status).toEqual({ notIn: ['UNDER_MAINTENANCE', 'RETIRED'] });
    expect(where.bookings.none.status).toEqual({ notIn: ['REJECTED', 'CANCELLED', 'COMPLETED'] });
  });

  test('an unparseable bare date still falls back to the safe AVAILABLE-only default', async () => {
    await request(app).get('/api/vehicles/available?pickupDate=2026-13-01&returnDate=2026-13-02');

    expect(lastWhere()).toEqual({ status: 'AVAILABLE' });
  });

  test('no dates at all still returns only AVAILABLE vehicles', async () => {
    await request(app).get('/api/vehicles/available');

    expect(lastWhere()).toEqual({ status: 'AVAILABLE' });
  });
});
