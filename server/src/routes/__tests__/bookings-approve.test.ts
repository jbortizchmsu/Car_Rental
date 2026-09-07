import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Same reasoning as every other bookings.ts route-test round: lib/notifications.ts imports
// `{ io } from '../index'`, and index.ts has real side effects at import time. An explicit
// factory here means Jest never requires the real notifications module.
jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createNotification: jest.fn().mockResolvedValue(undefined),
  createAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../lib/config';
import bookingsRouter from '../bookings';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.use('/api/bookings', bookingsRouter);

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin', fullName: 'Admin User', isActive: true };
const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findUnique.mockResolvedValue(ADMIN_USER as any);
});

describe('POST /api/bookings/:id/approve', () => {
  test('SUSPECTED-BUG-FIX: booking with a past startDate but no real conflict → approval still succeeds (skipPastDateCheck)', async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      vehicleId: 'veh-1',
      startDate: daysAgo(1), // originally scheduled pickup date has already passed
      endDate: daysFromNow(1),
    } as any);
    // checkVehicleAvailability's own internal calls: vehicle is fine, no real conflict.
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'RESERVED' } as any);
    prismaMock.booking.findFirst.mockResolvedValue(null);
    prismaMock.bookingDocument.findMany.mockResolvedValue([{ id: 'doc-1' }] as any);
    prismaMock.booking.update.mockResolvedValue({ id: 'booking-1', customerId: 'cust-1', status: 'APPROVED_FOR_PAYMENT' } as any);

    const res = await request(app)
      .post('/api/bookings/booking-1/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED_FOR_PAYMENT');
  });
});
