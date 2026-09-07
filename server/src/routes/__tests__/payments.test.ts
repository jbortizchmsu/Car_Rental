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
// '../index'`, and index.ts has real side effects at import time (live HTTP server, Socket.IO,
// background setInterval jobs, Supabase calls). An explicit factory here means Jest never
// requires the real notifications module, so index.ts is never pulled in transitively.
jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createNotification: jest.fn().mockResolvedValue(undefined),
  createAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

// payments.ts also imports uploadToSupabaseStorage/BUCKETS from lib/supabase — mocked so the
// upload-failure test can force a rejection deterministically, without any real network call.
jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  uploadToSupabaseStorage: jest.fn().mockResolvedValue('https://example.test/fake-proof.jpg'),
  BUCKETS: { PAYMENT_PROOFS: 'payment-proofs' },
}));

import { prisma } from '../../lib/prisma';
import { createNotification } from '../../lib/notifications';
import { uploadToSupabaseStorage } from '../../lib/supabase';
import { JWT_SECRET } from '../../lib/config';
import paymentsRouter from '../payments';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const createNotificationMock = createNotification as jest.Mock;
const uploadToSupabaseStorageMock = uploadToSupabaseStorage as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRouter);

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin', fullName: 'Admin User', isActive: true };
const CUSTOMER_USER = { id: 'cust-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz', isActive: true };

const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });
const customerToken = jwt.sign({ id: CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function pastHours(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}
function futureDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    startDate: pastHours(1),
    endDate: futureDays(2),
    totalAmount: 5000,
    customer: { fullName: 'Jane Dela Cruz' },
    ...overrides,
  } as any;
}

// Mocks the two internal Prisma calls checkVehicleAvailability makes, forcing "available: true".
function mockAvailabilityPasses() {
  prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'AVAILABLE' } as any);
  prismaMock.booking.findFirst.mockResolvedValue(null);
}

beforeEach(() => {
  mockReset(prismaMock);
  createNotificationMock.mockClear();
  uploadToSupabaseStorageMock.mockClear();
  uploadToSupabaseStorageMock.mockResolvedValue('https://example.test/fake-proof.jpg');

  prismaMock.user.findUnique.mockImplementation(((args: any) => {
    if (args?.where?.id === ADMIN_USER.id) return Promise.resolve(ADMIN_USER as any);
    if (args?.where?.id === CUSTOMER_USER.id) return Promise.resolve(CUSTOMER_USER as any);
    return Promise.resolve(null);
  }) as any);
});

describe('POST /api/payments/:id/submit', () => {
  function submitRequest(fields: Record<string, any> = {}) {
    return request(app)
      .post('/api/payments/booking-1/submit')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(fields);
  }

  test('booking not found → 404', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);

    const res = await submitRequest({ paymentType: 'FULL_GCASH' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Booking not found');
  });

  test('ownership check fails (submitting customer does not own this booking) → 403', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ customerId: 'someone-else' }));

    const res = await submitRequest({ paymentType: 'FULL_GCASH' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Unauthorized to submit payment for this booking');
  });

  test('availability conflict at submission time → 409', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'AVAILABLE' } as any);
    prismaMock.booking.findFirst.mockResolvedValue({ id: 'other-booking', status: 'ACTIVE' } as any);

    const res = await submitRequest({ paymentType: 'FULL_GCASH' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(
      'Vehicle is no longer available for your dates: This vehicle is already booked for the selected dates.'
    );
  });

  test('duplicate payment reference number → 400 rejected', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    mockAvailabilityPasses();
    prismaMock.paymentProof.findFirst.mockResolvedValue({ id: 'proof-existing', referenceNumber: 'REF123' } as any);

    const res = await submitRequest({ paymentType: 'FULL_GCASH', referenceNumber: 'REF123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This reference number has already been used.');
  });

  test('downpayment amount calculation: 30% of totalAmount, rounded', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ totalAmount: 5000 }));
    mockAvailabilityPasses();
    prismaMock.payment.create.mockResolvedValue({ id: 'payment-1', amount: 1500, paymentType: 'DOWNPAYMENT_GCASH', status: 'SUBMITTED' } as any);
    prismaMock.booking.update.mockResolvedValue({} as any);

    const res = await submitRequest({ paymentType: 'DOWNPAYMENT_GCASH' });

    expect(res.status).toBe(201);
    // 5000 * 0.3 = 1500 exactly, so Math.round has no visible effect here — see WB-055 remarks
    // for the case where rounding actually changes the result.
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 1500, paymentType: 'DOWNPAYMENT_GCASH' }) })
    );
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'DOWNPAYMENT_SUBMITTED' },
    });
  });

  test('full payment amount calculation: uses full totalAmount, no reduction', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ totalAmount: 5000 }));
    mockAvailabilityPasses();
    prismaMock.payment.create.mockResolvedValue({ id: 'payment-2', amount: 5000, paymentType: 'FULL_GCASH', status: 'SUBMITTED' } as any);
    prismaMock.booking.update.mockResolvedValue({} as any);

    const res = await submitRequest({ paymentType: 'FULL_GCASH' });

    expect(res.status).toBe(201);
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 5000, paymentType: 'FULL_GCASH' }) })
    );
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'FULL_PAYMENT_SUBMITTED' },
    });
  });

  test('file upload failure during proof submission → 502, handled gracefully with no inconsistent state', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    mockAvailabilityPasses();
    uploadToSupabaseStorageMock.mockRejectedValue(new Error('Simulated Supabase upload failure'));

    const res = await request(app)
      .post('/api/payments/booking-1/submit')
      .set('Authorization', `Bearer ${customerToken}`)
      .field('paymentType', 'FULL_GCASH')
      .attach('proof', Buffer.from('fake-image-bytes'), 'proof.jpg');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('File upload failed. Please try again.');
    // No payment record should ever be created once the upload has failed.
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments/:id/verify', () => {
  function verifyRequest(paymentId: string) {
    return request(app)
      .post(`/api/payments/${paymentId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
  }

  test('full payment verification → booking READY_FOR_PICKUP, remainingBalancePaidAt set', async () => {
    prismaMock.payment.update.mockResolvedValue({
      id: 'payment-1',
      paymentType: 'FULL_GCASH',
      amount: 5000,
      bookingId: 'booking-1',
      booking: { customerId: 'cust-1', vehicleId: 'veh-1' },
    } as any);
    prismaMock.booking.update.mockResolvedValue({} as any);
    prismaMock.vehicle.update.mockResolvedValue({} as any);

    const res = await verifyRequest('payment-1');

    expect(res.status).toBe(200);
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'READY_FOR_PICKUP', remainingBalancePaidAt: expect.any(Date) },
    });
    expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'veh-1' },
      data: { status: 'RESERVED' },
    });
  });

  test('downpayment verification → booking RESERVED, remainingBalancePaidAt explicitly null', async () => {
    prismaMock.payment.update.mockResolvedValue({
      id: 'payment-2',
      paymentType: 'DOWNPAYMENT_GCASH',
      amount: 1500,
      bookingId: 'booking-1',
      booking: { customerId: 'cust-1', vehicleId: 'veh-1' },
    } as any);
    prismaMock.booking.update.mockResolvedValue({} as any);
    prismaMock.vehicle.update.mockResolvedValue({} as any);

    const res = await verifyRequest('payment-2');

    expect(res.status).toBe(200);
    // Confirmed against the actual code (not assumed): the code explicitly sets
    // remainingBalancePaidAt to null at this stage — it is not left untouched or undefined.
    // The remaining balance is only marked paid later, via the separate cash-confirmation route.
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'RESERVED', remainingBalancePaidAt: null },
    });
  });
});

describe('POST /api/payments/:id/reject', () => {
  function rejectRequest(paymentId: string, body: Record<string, any> = {}) {
    return request(app)
      .post(`/api/payments/${paymentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  test('rejection with a provided reason → reason is used as given in the customer notification', async () => {
    prismaMock.payment.update.mockResolvedValue({
      id: 'payment-1',
      bookingId: 'booking-1',
      booking: { customerId: 'cust-1', status: 'FULL_PAYMENT_SUBMITTED' },
    } as any);
    prismaMock.booking.update.mockResolvedValue({} as any);

    const res = await rejectRequest('payment-1', { reason: 'Blurry image, cannot verify.' });

    expect(res.status).toBe(200);
    expect(createNotificationMock).toHaveBeenCalledWith(
      'cust-1',
      'Payment Rejected',
      expect.stringContaining('Reason: Blurry image, cannot verify.')
    );
  });

  test('rejection with no reason provided → fallback default reason applied', async () => {
    prismaMock.payment.update.mockResolvedValue({
      id: 'payment-2',
      bookingId: 'booking-1',
      booking: { customerId: 'cust-1', status: 'DOWNPAYMENT_SUBMITTED' },
    } as any);
    prismaMock.booking.update.mockResolvedValue({} as any);

    const res = await rejectRequest('payment-2', {}); // no reason field at all

    expect(res.status).toBe(200);
    expect(createNotificationMock).toHaveBeenCalledWith(
      'cust-1',
      'Payment Rejected',
      expect.stringContaining('Reason: Proof of payment invalid or unclear.')
    );
  });

  test('rollback map: FULL_PAYMENT_SUBMITTED booking rolls back to APPROVED_FOR_PAYMENT', async () => {
    prismaMock.payment.update.mockResolvedValue({
      id: 'payment-3',
      bookingId: 'booking-1',
      booking: { customerId: 'cust-1', status: 'FULL_PAYMENT_SUBMITTED' },
    } as any);
    prismaMock.booking.update.mockResolvedValue({} as any);

    const res = await rejectRequest('payment-3', { reason: 'Invalid proof' });

    expect(res.status).toBe(200);
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'APPROVED_FOR_PAYMENT' },
    });
  });
});
