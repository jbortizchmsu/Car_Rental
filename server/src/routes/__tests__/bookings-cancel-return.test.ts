import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Same reasoning as bookings-release.test.ts and payments.test.ts: lib/notifications.ts
// imports `{ io } from '../index'`, and index.ts has real side effects at import time (live
// HTTP server, Socket.IO, background setInterval jobs, Supabase calls). An explicit factory
// here means Jest never requires the real notifications module, so index.ts is never pulled
// in transitively through bookings.ts.
jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createNotification: jest.fn().mockResolvedValue(undefined),
  createAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../lib/prisma';
import { createNotification, createAdminNotification } from '../../lib/notifications';
import { JWT_SECRET } from '../../lib/config';
import bookingsRouter from '../bookings';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createNotificationMock = createNotification as jest.Mock;
const createAdminNotificationMock = createAdminNotification as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/bookings', bookingsRouter);

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin', fullName: 'Admin User', isActive: true };
const CUSTOMER_USER = { id: 'cust-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz', isActive: true };
const OTHER_CUSTOMER_USER = { id: 'cust-2', email: 'other@example.com', role: 'customer', fullName: 'Other Customer', isActive: true };

const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });
const customerToken = jwt.sign({ id: CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });
const otherCustomerToken = jwt.sign({ id: OTHER_CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    status: 'PENDING_REVIEW',
    releaseOdometerKm: null,
    vehicle: { brand: 'Toyota', model: 'Vios', currentOdometerKm: 1000 },
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockReset(prismaMock);
  createNotificationMock.mockClear();
  createAdminNotificationMock.mockClear();

  prismaMock.user.findUnique.mockImplementation(((args: any) => {
    if (args?.where?.id === ADMIN_USER.id) return Promise.resolve(ADMIN_USER as any);
    if (args?.where?.id === CUSTOMER_USER.id) return Promise.resolve(CUSTOMER_USER as any);
    if (args?.where?.id === OTHER_CUSTOMER_USER.id) return Promise.resolve(OTHER_CUSTOMER_USER as any);
    return Promise.resolve(null);
  }) as any);
});

describe('PATCH /api/bookings/:id/cancel', () => {
  function cancelRequest(token: string) {
    return request(app)
      .patch('/api/bookings/booking-1/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({});
  }

  test('booking not found → 404', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);

    const res = await cancelRequest(customerToken);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Booking not found');
  });

  test('ownership check: a different customer cannot cancel someone else\'s booking → 403', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ customerId: 'cust-1' }));

    const res = await cancelRequest(otherCustomerToken); // logged in as cust-2

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Unauthorized to cancel this booking');
  });

  test('ownership check: admin CAN cancel a booking they do not own', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ customerId: 'cust-1', status: 'PENDING_REVIEW' }));
    prismaMock.booking.update.mockResolvedValue({ id: 'booking-1', status: 'CANCELLED' } as any);
    prismaMock.geofenceZone.updateMany.mockResolvedValue({ count: 0 } as any);

    const res = await cancelRequest(adminToken); // admin, not the owning customer

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'booking-1', status: 'CANCELLED' });
  });

  test('already cancelled → 400', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status: 'CANCELLED' }));

    const res = await cancelRequest(customerToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Booking is already cancelled');
  });

  test.each([
    ['ACTIVE', 'Cannot cancel an active rental'],
    ['RETURNED', 'Cannot cancel a returned rental'],
    ['COMPLETED', 'Cannot cancel a completed rental'],
    ['FULL_PAYMENT_SUBMITTED', 'Cannot cancel after payment has been submitted — please contact us directly'],
    ['DOWNPAYMENT_SUBMITTED', 'Cannot cancel after payment has been submitted — please contact us directly'],
    ['RESERVED', 'Cannot cancel a reserved booking — please contact us directly'],
    ['REJECTED', 'This booking has already been rejected'],
  ])('non-cancellable status %s → 400 with its specific mapped message', async (status, expectedMessage) => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status }));

    const res = await cancelRequest(customerToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(expectedMessage);
  });

  test('non-cancellable status with no explicit map entry → 400 with generic fallback message', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status: 'SOME_UNMAPPED_STATUS' }));

    const res = await cancelRequest(customerToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot cancel a booking with status: SOME_UNMAPPED_STATUS');
  });

  test('cancelling from READY_FOR_PICKUP reverts vehicle to AVAILABLE and sends the "payment at risk" admin notification', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status: 'READY_FOR_PICKUP' }));
    prismaMock.booking.update.mockResolvedValue({ id: 'booking-1', status: 'CANCELLED' } as any);
    prismaMock.geofenceZone.updateMany.mockResolvedValue({ count: 1 } as any);
    prismaMock.vehicle.update.mockResolvedValue({} as any);

    const res = await cancelRequest(customerToken);

    expect(res.status).toBe(200);
    expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'veh-1' },
      data: { status: 'AVAILABLE' },
    });
    expect(createAdminNotificationMock).toHaveBeenCalledWith(
      'Cancellation Request — Payment at Risk',
      expect.stringContaining('reverted to AVAILABLE')
    );
    // Geofence zones are always deactivated on cancel, regardless of prior status.
    expect(prismaMock.geofenceZone.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ bookingId: 'booking-1' }, { vehicleId: 'veh-1' }], isActive: true },
      data: { isActive: false },
    });
  });

  test('cancelling from a plain cancellable status (PENDING_REVIEW) does NOT touch vehicle status, sends the plain "booking cancelled" notification', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status: 'PENDING_REVIEW' }));
    prismaMock.booking.update.mockResolvedValue({ id: 'booking-1', status: 'CANCELLED' } as any);
    prismaMock.geofenceZone.updateMany.mockResolvedValue({ count: 0 } as any);

    const res = await cancelRequest(customerToken);

    expect(res.status).toBe(200);
    expect(prismaMock.vehicle.update).not.toHaveBeenCalled();
    expect(createAdminNotificationMock).toHaveBeenCalledWith(
      'Booking Cancelled',
      expect.stringContaining('cancelled booking')
    );
  });
});

describe('POST /api/bookings/:id/return', () => {
  function returnRequest(body: Record<string, any> = {}) {
    return request(app)
      .post('/api/bookings/booking-1/return')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  function mockSuccessfulReturn() {
    prismaMock.booking.update.mockResolvedValue({ id: 'booking-1', vehicleId: 'veh-1', customerId: 'cust-1', status: 'RETURNED' } as any);
    prismaMock.geofenceZone.updateMany.mockResolvedValue({ count: 0 } as any);
    prismaMock.vehicle.update.mockResolvedValue({} as any);
  }

  test('odometer fallback chain: releaseOdometerKm used when present', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ releaseOdometerKm: 1500, vehicle: { brand: 'Toyota', model: 'Vios', currentOdometerKm: 9999 } })
    );
    mockSuccessfulReturn();

    await returnRequest({ odometer: '1800' });

    // tripDistance = returnKm(1800) - releaseKm(1500, since it's present and preferred
    // over vehicle.currentOdometerKm) = 300
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ returnOdometerKm: 1800, tripDistanceKm: 300 }) })
    );
  });

  test('odometer fallback chain: falls back to vehicle.currentOdometerKm when releaseOdometerKm is missing', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ releaseOdometerKm: null, vehicle: { brand: 'Toyota', model: 'Vios', currentOdometerKm: 1200 } })
    );
    mockSuccessfulReturn();

    await returnRequest({ odometer: '1500' });

    // releaseOdometerKm is null/falsy -> falls back to vehicle.currentOdometerKm (1200)
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ returnOdometerKm: 1500, tripDistanceKm: 300 }) })
    );
  });

  test('odometer missing from request → returnKm defaults to 0 (not any fallback lookup)', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ releaseOdometerKm: 1500, vehicle: { brand: 'Toyota', model: 'Vios', currentOdometerKm: 9999 } })
    );
    mockSuccessfulReturn();

    await returnRequest({}); // no odometer field at all

    // returnKm = 0 (odometer falsy -> hardcoded 0, per the actual code — not a further fallback
    // chain on the *return* side, only on the release-km comparison side).
    // tripDistance = Math.max(0, 0 - 1500) = 0 (floored, not negative)
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ returnOdometerKm: 0, tripDistanceKm: 0 }) })
    );
  });

  test('trip-distance floor: return odometer less than release odometer clamps to 0, does not go negative', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ releaseOdometerKm: 2000, vehicle: { brand: 'Toyota', model: 'Vios', currentOdometerKm: 2000 } })
    );
    mockSuccessfulReturn();

    // Data-entry error scenario: return odometer (1800) is LESS than release odometer (2000).
    await returnRequest({ odometer: '1800' });

    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ returnOdometerKm: 1800, tripDistanceKm: 0 }) })
    );
  });

  test('damageFound with damageDetails → creates a damage report and notifies the customer with cost text', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    mockSuccessfulReturn();
    prismaMock.damageReport.create.mockResolvedValue({ id: 'damage-1' } as any);

    await returnRequest({
      odometer: '1500',
      damageFound: true,
      damageDetails: { type: 'SCRATCH', severity: 'LOW', desc: 'Small scratch on rear bumper', cost: '2500' },
    });

    expect(prismaMock.damageReport.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'booking-1',
        damageType: 'SCRATCH',
        severity: 'LOW',
        description: 'Small scratch on rear bumper',
        estimatedCost: 2500,
        status: 'PENDING',
      },
    });
    expect(createNotificationMock).toHaveBeenCalledWith(
      'cust-1',
      'Damage Report Filed',
      expect.stringContaining('Estimated repair cost: ₱2,500.00')
    );
  });

  test('damageFound true but damageDetails missing → damage branch skipped entirely (both must be truthy)', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    mockSuccessfulReturn();

    await returnRequest({ odometer: '1500', damageFound: true }); // no damageDetails

    expect(prismaMock.damageReport.create).not.toHaveBeenCalled();
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  test('cost-text formatting: cost of 0 or non-numeric omits the cost sentence from the notification', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    mockSuccessfulReturn();
    prismaMock.damageReport.create.mockResolvedValue({ id: 'damage-2' } as any);

    await returnRequest({
      odometer: '1500',
      damageFound: true,
      damageDetails: { type: 'DENT', severity: 'MEDIUM', desc: 'Door dent', cost: '0' },
    });

    const [, , message] = createNotificationMock.mock.calls[0];
    expect(message).not.toContain('Estimated repair cost');
    expect(message).toContain('Description: Door dent.');
  });

  test('no damage reported at all → return still succeeds, no damage report and no customer notification sent', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    mockSuccessfulReturn();

    const res = await returnRequest({ odometer: '1500' });

    expect(res.status).toBe(200);
    expect(prismaMock.damageReport.create).not.toHaveBeenCalled();
    // Confirmed against the actual code: unlike release/cancel, the return route sends NO
    // customer notification at all in the no-damage path.
    expect(createNotificationMock).not.toHaveBeenCalled();
  });
});
