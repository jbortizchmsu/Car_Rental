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
import customerRouter from '../customer';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.use('/api/customer', customerRouter);

const CUSTOMER_USER = { id: 'cust-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz', isActive: true };
const customerToken = jwt.sign({ id: CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function updateProfileRequest(body: Record<string, any>) {
  return request(app)
    .put('/api/customer/profile')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(body);
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findUnique.mockResolvedValue(CUSTOMER_USER as any);
});

describe('PUT /api/customer/profile', () => {
  test('valid full update → 200, all fields passed through trimmed', async () => {
    prismaMock.user.update.mockResolvedValue({
      id: 'cust-1', email: 'jane@example.com', fullName: 'Jane Dela Cruz', role: 'customer',
      phoneNumber: '09123456789', address: 'Bacolod City', avatarUrl: null,
    } as any);

    const res = await updateProfileRequest({
      fullName: 'Jane Dela Cruz',
      phoneNumber: '09123456789',
      address: 'Bacolod City',
    });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { fullName: 'Jane Dela Cruz', phoneNumber: '09123456789', address: 'Bacolod City' },
      })
    );
  });

  test('phone number containing letters → 400, update never called', async () => {
    const res = await updateProfileRequest({
      fullName: 'Jane Dela Cruz',
      phoneNumber: '0912abc6789',
      address: 'Bacolod City',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Phone number must be exactly 11 digits');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('phone number wrong length → 400', async () => {
    const res = await updateProfileRequest({
      fullName: 'Jane Dela Cruz',
      phoneNumber: '0912345',
      address: 'Bacolod City',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Phone number must be exactly 11 digits');
  });

  test('whitespace-only full name → 400, not silently accepted', async () => {
    const res = await updateProfileRequest({
      fullName: '   ',
      phoneNumber: '09123456789',
      address: 'Bacolod City',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Full name is required');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('whitespace-only address → 400', async () => {
    const res = await updateProfileRequest({
      fullName: 'Jane Dela Cruz',
      phoneNumber: '09123456789',
      address: '   ',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Location is required');
  });

  test('over-length full name → 400', async () => {
    const res = await updateProfileRequest({
      fullName: 'A'.repeat(101),
      phoneNumber: '09123456789',
      address: 'Bacolod City',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Full name must be at most 100 characters');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('over-length address → 400', async () => {
    const res = await updateProfileRequest({
      fullName: 'Jane Dela Cruz',
      phoneNumber: '09123456789',
      address: 'A'.repeat(201),
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Location must be at most 200 characters');
  });

  test('partial update: only fullName sent → other fields left as no-ops, existing behavior preserved', async () => {
    prismaMock.user.update.mockResolvedValue({
      id: 'cust-1', email: 'jane@example.com', fullName: 'Updated Name', role: 'customer',
      phoneNumber: '09123456789', address: 'Bacolod City', avatarUrl: null,
    } as any);

    const res = await updateProfileRequest({ fullName: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { fullName: 'Updated Name', phoneNumber: undefined, address: undefined },
      })
    );
  });

  test('partial update: only phoneNumber sent, invalid → 400, name/address untouched', async () => {
    const res = await updateProfileRequest({ phoneNumber: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Phone number must be exactly 11 digits');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('leading/trailing whitespace in fullName and address is trimmed before saving', async () => {
    prismaMock.user.update.mockResolvedValue({} as any);

    await updateProfileRequest({
      fullName: '  Jane Dela Cruz  ',
      phoneNumber: '09123456789',
      address: '  Bacolod City  ',
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fullName: 'Jane Dela Cruz', address: 'Bacolod City' }),
      })
    );
  });
});
