import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Same reasoning as bookings-release.test.ts: lib/notifications.ts imports `{ io } from
// '../index'`, and index.ts has real side effects at import time. An explicit factory here
// means Jest never requires the real notifications module, so index.ts is never pulled in.
jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createNotification: jest.fn().mockResolvedValue(undefined),
  createAdminNotification: jest.fn().mockResolvedValue(undefined),
  createTypedNotification: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../lib/config';
import { toManilaDateString } from '../../lib/validation';
import bookingsRouter from '../bookings';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.use('/api/bookings', bookingsRouter);

const CUSTOMER_USER = { id: 'cust-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz', isActive: true };
const customerToken = jwt.sign({ id: CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });

// "YYYY-MM-DDTHH:MM:00" local-time-ish string, N days from now, matching formatApiDate()'s
// shape (no timezone marker) — same convention as lib/__tests__/validation.test.ts.
function localDateTime(daysFromNow: number, hour: number, minute: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}:00`;
}

function manilaOffsetDateString(days: number): string {
  return toManilaDateString(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

function validBody(overrides: Record<string, any> = {}) {
  return {
    vehicleId: 'veh-1',
    startDate: localDateTime(1, 9, 0),
    endDate: localDateTime(3, 17, 0),
    pickupLocation: 'JD Car Rental Main Shop',
    destinationName: 'Bacolod',
    fullName: 'Jane Dela Cruz',
    contactNumber: '09123456789',
    address: 'Bacolod City',
    licenseNumber: 'N01-12-345678',
    licenseExpiry: manilaOffsetDateString(365),
    emergencyContact: 'John Dela Cruz',
    emergencyPhone: '09987654321',
    ...overrides,
  };
}

function createBookingRequest(overrides: Record<string, any> = {}) {
  return request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(validBody(overrides));
}

function mockSuccessfulCreate() {
  prismaMock.vehicle.findUnique.mockResolvedValue({
    id: 'veh-1', status: 'AVAILABLE', dailyRate: 1500, category: 'Sedan', brand: 'Toyota', model: 'Vios',
  } as any);
  prismaMock.booking.findFirst.mockResolvedValue(null); // no conflicting booking
  prismaMock.pricingRule.findMany.mockResolvedValue([]); // no active pricing rules
  prismaMock.booking.create.mockResolvedValue({ id: 'booking-1' } as any);
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findUnique.mockResolvedValue(CUSTOMER_USER as any);
});

describe('POST /api/bookings — license number validation', () => {
  test('valid, already-formatted license number → 201, stored as-is', async () => {
    mockSuccessfulCreate();

    const res = await createBookingRequest({ licenseNumber: 'N01-12-345678' });

    expect(res.status).toBe(201);
    expect(prismaMock.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ licenseNumber: 'N01-12-345678' }) })
    );
  });

  test('lowercase, no hyphens, with spaces → 201, normalized before storing', async () => {
    mockSuccessfulCreate();

    const res = await createBookingRequest({ licenseNumber: 'n01 12 345678' });

    expect(res.status).toBe(201);
    expect(prismaMock.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ licenseNumber: 'N01-12-345678' }) })
    );
  });

  test('wrong letter count → 400, booking never created', async () => {
    const res = await createBookingRequest({ licenseNumber: 'NN01-12-345678' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('License number must follow the format A00-00-000000 (e.g., N01-12-345678)');
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });

  test('wrong digit count → 400', async () => {
    const res = await createBookingRequest({ licenseNumber: 'N01-12-34567' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('License number must follow the format A00-00-000000 (e.g., N01-12-345678)');
  });

  test('extra trailing character → 400', async () => {
    const res = await createBookingRequest({ licenseNumber: 'N01-12-345678X' });

    expect(res.status).toBe(400);
  });

  test('whitespace-only → 400 (falls through the truthiness check, caught by the format schema)', async () => {
    const res = await createBookingRequest({ licenseNumber: '   ' });

    expect(res.status).toBe(400);
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings — license expiry validation', () => {
  test('expiry one year from now → 201', async () => {
    mockSuccessfulCreate();

    const res = await createBookingRequest({ licenseExpiry: manilaOffsetDateString(365) });

    expect(res.status).toBe(201);
  });

  test('expiry yesterday (already expired) → 400', async () => {
    const res = await createBookingRequest({ licenseExpiry: manilaOffsetDateString(-1) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Your driver's license has expired.");
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });

  test('invalid date string → 400', async () => {
    const res = await createBookingRequest({ licenseExpiry: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('License expiry date is invalid.');
  });

  test('more than 10 years in the future → 400', async () => {
    const farFuture = manilaOffsetDateString(365 * 11);

    const res = await createBookingRequest({ licenseExpiry: farFuture });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('License expiry date cannot be more than 10 years in the future.');
  });

  test('expiry before the rental end date → 400, distinct message', async () => {
    // Rental runs from +1 day to +3 days; license expires on +2 (before the end date).
    const startDate = localDateTime(1, 9, 0);
    const endDate = localDateTime(3, 17, 0);
    const expiryBeforeEnd = manilaOffsetDateString(2);

    const res = await createBookingRequest({ startDate, endDate, licenseExpiry: expiryBeforeEnd });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Your driver's license must be valid for the whole rental period.");
    expect(prismaMock.booking.create).not.toHaveBeenCalled();
  });

  test('expiry exactly on the rental end date (same calendar day, earlier time-of-day) → 201, not treated as expiring before end', async () => {
    mockSuccessfulCreate();
    const startDate = localDateTime(1, 9, 0);
    const endDate = localDateTime(3, 17, 0);
    // Same calendar day as endDate — expiry itself has no time component (bare date),
    // so this must still be accepted as "valid through end of that day".
    const expiryOnEndDate = manilaOffsetDateString(3);

    const res = await createBookingRequest({ startDate, endDate, licenseExpiry: expiryOnEndDate });

    expect(res.status).toBe(201);
  });
});
