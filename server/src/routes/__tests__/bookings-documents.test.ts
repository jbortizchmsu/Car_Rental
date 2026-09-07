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
  uploadToSupabaseStorage: jest.fn().mockResolvedValue('https://example.test/fake-doc.jpg'),
  deleteFromSupabaseStorage: jest.fn().mockResolvedValue(undefined),
  extractSupabaseFilePath: jest.fn((url: string) => `extracted/${url}`),
  BUCKETS: { BOOKING_DOCUMENTS: 'booking-documents', PAYMENT_PROOFS: 'payment-proofs' },
}));

import { prisma } from '../../lib/prisma';
import { uploadToSupabaseStorage, deleteFromSupabaseStorage } from '../../lib/supabase';
import { JWT_SECRET } from '../../lib/config';
import bookingsRouter from '../bookings';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const uploadMock = uploadToSupabaseStorage as jest.Mock;
const deleteMock = deleteFromSupabaseStorage as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/bookings', bookingsRouter);

const CUSTOMER_USER = { id: 'cust-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz', isActive: true };
const OTHER_CUSTOMER_USER = { id: 'cust-2', email: 'other@example.com', role: 'customer', fullName: 'Other Customer', isActive: true };
const customerToken = jwt.sign({ id: CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });
const otherCustomerToken = jwt.sign({ id: OTHER_CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    customerId: 'cust-1',
    status: 'PENDING_REVIEW',
    documents: [],
    ...overrides,
  } as any;
}

function uploadRequest(token: string, opts: { type?: string; filename?: string; noFile?: boolean } = {}) {
  const { type = 'valid_id', filename = 'photo.jpg', noFile = false } = opts;
  let req = request(app)
    .post('/api/bookings/booking-1/documents')
    .set('Authorization', `Bearer ${token}`)
    .field('type', type);
  if (!noFile) {
    req = req.attach('file', Buffer.from('fake-image-bytes'), filename);
  }
  return req;
}

beforeEach(() => {
  mockReset(prismaMock);
  uploadMock.mockClear();
  deleteMock.mockClear();
  uploadMock.mockResolvedValue('https://example.test/fake-doc.jpg');
  prismaMock.user.findUnique.mockImplementation(((args: any) => {
    if (args?.where?.id === CUSTOMER_USER.id) return Promise.resolve(CUSTOMER_USER as any);
    if (args?.where?.id === OTHER_CUSTOMER_USER.id) return Promise.resolve(OTHER_CUSTOMER_USER as any);
    return Promise.resolve(null);
  }) as any);
});

describe('POST /api/bookings/:id/documents', () => {
  test('booking not found → 404', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);

    const res = await uploadRequest(customerToken);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Booking not found');
  });

  test('ownership check fails (uploading customer does not own this booking) → 403', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ customerId: 'cust-1' }));

    const res = await uploadRequest(otherCustomerToken); // logged in as cust-2

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Unauthorized to upload for this booking');
  });

  test('booking status not in the allowed whitelist (e.g. APPROVED_FOR_PAYMENT) → 400', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status: 'APPROVED_FOR_PAYMENT' }));

    const res = await uploadRequest(customerToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot upload documents for booking in current status');
  });

  test('attempting to replace an existing document while booking is still PENDING_REVIEW (not REJECTED) → 403', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({
      status: 'PENDING_REVIEW',
      documents: [{ id: 'doc-1', documentType: 'valid_id', fileUrl: 'https://example.test/old-doc.jpg' }],
    }));

    const res = await uploadRequest(customerToken, { type: 'valid_id' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(
      'Document has already been submitted and cannot be modified while pending review or approved. Re-upload is only allowed if rejected by admin.'
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  test('replacing a document when the booking status is REJECTED → succeeds, old file deleted, old DB row deleted, new doc created', async () => {
    const existingDoc = { id: 'doc-old', documentType: 'valid_id', fileUrl: 'https://example.test/old-doc.jpg' };
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({
      status: 'REJECTED',
      documents: [existingDoc],
    }));
    prismaMock.bookingDocument.delete.mockResolvedValue(existingDoc as any);
    prismaMock.bookingDocument.create.mockResolvedValue({ id: 'doc-new', documentType: 'valid_id', fileUrl: 'https://example.test/fake-doc.jpg' } as any);

    const res = await uploadRequest(customerToken, { type: 'valid_id' });

    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('booking-documents', 'extracted/https://example.test/old-doc.jpg');
    expect(prismaMock.bookingDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-old' } });
    expect(prismaMock.bookingDocument.create).toHaveBeenCalledWith({
      data: { bookingId: 'booking-1', documentType: 'valid_id', fileUrl: 'https://example.test/fake-doc.jpg' },
    });
  });

  test('first-time upload of a document type with no prior document → succeeds without triggering replacement logic', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status: 'PENDING_REVIEW', documents: [] }));
    prismaMock.bookingDocument.create.mockResolvedValue({ id: 'doc-new', documentType: 'drivers_license', fileUrl: 'https://example.test/fake-doc.jpg' } as any);

    const res = await uploadRequest(customerToken, { type: 'drivers_license' });

    expect(res.status).toBe(200);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(prismaMock.bookingDocument.delete).not.toHaveBeenCalled();
    expect(prismaMock.bookingDocument.create).toHaveBeenCalledWith({
      data: { bookingId: 'booking-1', documentType: 'drivers_license', fileUrl: 'https://example.test/fake-doc.jpg' },
    });
  });

  test('file with no recognizable extension in its filename never reaches the route\'s own ext-fallback code — rejected upstream by multer\'s fileFilter', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ status: 'PENDING_REVIEW', documents: [] }));
    prismaMock.bookingDocument.create.mockResolvedValue({ id: 'doc-new', documentType: 'valid_id', fileUrl: 'https://example.test/fake-doc.jpg' } as any);

    // 'photo' has no dot at all, so path.extname() on it returns ''.
    const res = await uploadRequest(customerToken, { type: 'valid_id', filename: 'photo' });

    // Confirmed against actual (empirically observed) behavior: the shared `upload` multer
    // middleware (middleware/upload.ts) validates BOTH extension and mimetype via its own
    // fileFilter *before* the route handler ever runs. A filename with no extension fails
    // that filter's regex and multer calls back with an Error, which — since this minimal
    // test app registers no custom error-handling middleware — falls through to Express's
    // default HTML error handler: 500, with the multer fileFilter's own error message.
    // This means the route's own `path.extname(...) || '.png'` fallback line is DEAD CODE:
    // it can never actually execute via this endpoint, because any upload that would produce
    // an empty extname is already rejected one layer earlier, before req.file is ever set.
    expect(res.status).toBe(500);
    expect(res.text).toContain('Only images (jpeg, jpg, png, webp) and PDFs up to 10MB are allowed');
    expect(prismaMock.bookingDocument.create).not.toHaveBeenCalled();
  });
});
