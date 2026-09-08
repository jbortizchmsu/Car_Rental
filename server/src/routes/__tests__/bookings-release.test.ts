import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// lib/notifications.ts imports `{ io } from '../index'`, and index.ts has real side effects
// at import time (starts an HTTP server, opens Socket.IO, starts background setInterval jobs,
// calls out to Supabase). An explicit factory here means Jest never actually requires the real
// notifications module — so index.ts is never pulled in transitively through bookings.ts.
jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createNotification: jest.fn().mockResolvedValue(undefined),
  createAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../lib/config';
import bookingsRouter from '../bookings';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// Same standalone-app pattern established in auth.test.ts: mount the real, unmodified
// bookings router directly, without importing index.ts.
const app = express();
app.use(express.json());
app.use('/api/bookings', bookingsRouter);

const ADMIN_USER = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'admin',
  fullName: 'Admin User',
  isActive: true,
};

const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function pastHours(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function pastDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function futureDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    status: 'READY_FOR_PICKUP',
    vehicleId: 'veh-1',
    customerId: 'cust-1',
    startDate: pastHours(1),
    endDate: futureDays(2),
    agreementSignedAt: new Date(),
    destinationName: null,
    vehicle: { brand: 'Toyota', model: 'Vios' },
    ...overrides,
  } as any;
}

function releaseRequest(body: Record<string, any> = {}) {
  return request(app)
    .post('/api/bookings/booking-1/release')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
}

beforeEach(() => {
  mockReset(prismaMock);
  // authenticate + authorizeAdmin middleware re-fetches the user from the DB on every request.
  prismaMock.user.findUnique.mockResolvedValue(ADMIN_USER as any);
});

describe('POST /api/bookings/:id/release', () => {
  test('booking not found → 404', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Booking not found');
  });

  test('booking status not READY_FOR_PICKUP → 400', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status: 'RESERVED' }));

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Booking must be READY_FOR_PICKUP before release.');
  });

  test('startDate missing/null → 400', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ startDate: null }));

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Booking start date is missing. Cannot release vehicle.');
  });

  test('current date before startDate → 400 with formatted pickup-date message', async () => {
    const futureStart = futureDays(3);
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ startDate: futureStart, endDate: futureDays(5) })
    );

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    const expectedFormattedDate = futureStart.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
    });
    const expectedFormattedTime = futureStart.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      `Vehicle cannot be released before the scheduled pickup date. Pickup is scheduled for ${expectedFormattedDate} at ${expectedFormattedTime}.`
    );
  });

  test('agreementSignedAt not set → 400', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ agreementSignedAt: null }));

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Rental agreement must be signed before release.');
  });

  test('checklistConfirmed falsy → 400', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());

    const res = await releaseRequest({ odometer: '1000' }); // checklistConfirmed omitted

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Release checklist must be confirmed.');
  });

  test('odometer missing/falsy → 400', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());

    const res = await releaseRequest({ checklistConfirmed: true }); // odometer omitted

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Release odometer is required.');
  });

  test('final availability re-check finds a conflicting booking → 409', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    // checkVehicleAvailability's own internal Prisma calls:
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'RESERVED' } as any);
    prismaMock.booking.findFirst.mockResolvedValue({ id: 'other-booking', status: 'ACTIVE' } as any);

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(
      'Cannot release vehicle: This vehicle is already booked for the selected dates.'
    );
  });

  test('all guards pass, destinationName IS set → creates geofence zone, deactivates prior zones, links approvedGeofenceZoneId', async () => {
    const releasedBooking = { id: 'booking-1', vehicleId: 'veh-1', customerId: 'cust-1', status: 'ACTIVE' };
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ destinationName: 'Bacolod' }) // real entry in NEGROS_MUNICIPALITY_COORDS
    );
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'RESERVED' } as any);
    prismaMock.booking.findFirst.mockResolvedValue(null); // no conflict
    prismaMock.booking.update.mockResolvedValue(releasedBooking as any);
    prismaMock.vehicle.update.mockResolvedValue({} as any);
    prismaMock.systemSettings.findMany.mockResolvedValue([]); // no custom shop center configured
    prismaMock.geofenceZone.updateMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.geofenceZone.create.mockResolvedValue({ id: 'geo-zone-1' } as any);

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(releasedBooking);

    expect(prismaMock.geofenceZone.updateMany).toHaveBeenCalledWith({
      where: { vehicleId: 'veh-1', isActive: true },
      data: { isActive: false },
    });
    expect(prismaMock.geofenceZone.create).toHaveBeenCalledTimes(1);

    // booking.update is called twice: once for the release itself, once to link approvedGeofenceZoneId
    expect(prismaMock.booking.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.booking.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'booking-1' },
      data: { approvedGeofenceZoneId: 'geo-zone-1' },
    });
  });

  test('all guards pass, destinationName is NOT set → skips geofence creation entirely, release still succeeds', async () => {
    const releasedBooking = { id: 'booking-1', vehicleId: 'veh-1', customerId: 'cust-1', status: 'ACTIVE' };
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ destinationName: null }));
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'RESERVED' } as any);
    prismaMock.booking.findFirst.mockResolvedValue(null);
    prismaMock.booking.update.mockResolvedValue(releasedBooking as any);
    prismaMock.vehicle.update.mockResolvedValue({} as any);

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(releasedBooking);

    expect(prismaMock.geofenceZone.create).not.toHaveBeenCalled();
    expect(prismaMock.geofenceZone.updateMany).not.toHaveBeenCalled();
    // Only the single release update — no second call to link a geofence zone id
    expect(prismaMock.booking.update).toHaveBeenCalledTimes(1);
  });

  test('geofence creation throws internally → caught, release still succeeds (resilience)', async () => {
    const releasedBooking = { id: 'booking-1', vehicleId: 'veh-1', customerId: 'cust-1', status: 'ACTIVE' };
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ destinationName: 'Bacolod' })
    );
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'RESERVED' } as any);
    prismaMock.booking.findFirst.mockResolvedValue(null);
    prismaMock.booking.update.mockResolvedValue(releasedBooking as any);
    prismaMock.vehicle.update.mockResolvedValue({} as any);
    prismaMock.systemSettings.findMany.mockResolvedValue([]);
    prismaMock.geofenceZone.updateMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.geofenceZone.create.mockRejectedValue(new Error('Simulated DB failure during geofence creation'));

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    // The release itself must still succeed even though geofence creation blew up internally.
    expect(res.status).toBe(200);
    expect(res.body).toEqual(releasedBooking);

    // Only the single release update ran — the second (approvedGeofenceZoneId) update never
    // executes because geofenceZone.create rejected before reaching it.
    expect(prismaMock.booking.update).toHaveBeenCalledTimes(1);
  });

  test('SUSPECTED BUG: late release with no real conflict (original scheduled date has passed) should succeed', async () => {
    // Common, legitimate scenario: customer picks up a day late. All 7 route guards are
    // satisfied — status is READY_FOR_PICKUP, agreement signed, checklist confirmed, odometer
    // provided — and there is NO actual conflicting booking. Only the originally scheduled
    // startDate itself is now in the past.
    const releasedBooking = { id: 'booking-1', vehicleId: 'veh-1', customerId: 'cust-1', status: 'ACTIVE' };
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ startDate: pastDays(1), endDate: futureDays(1) })
    );
    // checkVehicleAvailability's own internal Prisma calls — vehicle is fine, and there is
    // genuinely no conflicting booking in the system.
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'RESERVED' } as any);
    prismaMock.booking.findFirst.mockResolvedValue(null);
    prismaMock.booking.update.mockResolvedValue(releasedBooking as any);
    prismaMock.vehicle.update.mockResolvedValue({} as any);

    const res = await releaseRequest({ checklistConfirmed: true, odometer: '1000' });

    // Intended/expected behavior: no real conflict exists, so release should succeed.
    expect(res.status).toBe(200);
    expect(res.body).toEqual(releasedBooking);
  });
});
