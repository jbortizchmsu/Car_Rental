import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// users.ts imports sendApprovalEmail from lib/email.ts, which constructs a real Resend
// client at module-load time — same reasoning as every other route test file that
// touches lib/email (see auth.test.ts). Mocked so no real network call is ever made and
// so the "email throws" test can force a rejection deterministically.
jest.mock('../../lib/email', () => ({
  __esModule: true,
  sendApprovalEmail: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../lib/prisma';
import { sendApprovalEmail } from '../../lib/email';
import { JWT_SECRET } from '../../lib/config';
import usersRouter from '../users';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const sendApprovalEmailMock = sendApprovalEmail as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/admin/users', usersRouter);

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin', fullName: 'Admin User', isActive: true, approvalStatus: 'approved' };
const CUSTOMER_USER = { id: 'cust-caller', email: 'notadmin@example.com', role: 'customer', fullName: 'Not An Admin', isActive: true, approvalStatus: 'approved' };

const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });
const customerToken = jwt.sign({ id: CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function approvalRequest(token: string | null, targetId: string, body: any) {
  const req = request(app).patch(`/api/admin/users/${targetId}/approval`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body);
}

// Every test needs prisma.user.findUnique to resolve the CALLING user first (the
// authenticate/authorizeAdmin middleware chain that router.use()'s the whole users.ts
// router looks that up by the JWT's id), and most tests also need the route handler's
// own separate lookup of the TARGET user (by req.params.id) to resolve correctly. Tests
// branch on args.where.id exactly like payments.test.ts's existing convention.
function mockUsers(byId: Record<string, any>) {
  prismaMock.user.findUnique.mockImplementation(((args: any) => {
    return Promise.resolve(byId[args?.where?.id] ?? null);
  }) as any);
}

beforeEach(() => {
  mockReset(prismaMock);
  sendApprovalEmailMock.mockReset();
  sendApprovalEmailMock.mockResolvedValue(undefined);
});

describe('GET /api/admin/users', () => {
  test('list response includes approvalStatus and rejectionReason for each user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ADMIN_USER as any); // authenticate's own lookup
    const listedUser = {
      id: 'cust-1', fullName: 'Jane Dela Cruz', email: 'jane@example.com', role: 'customer',
      isActive: true, approvalStatus: 'pending', rejectionReason: null,
      createdAt: new Date(), lastLoginAt: null, emailDeliveryStatus: 'delivered',
      _count: { bookings: 2 },
    };
    prismaMock.user.findMany.mockResolvedValue([listedUser] as any);

    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ approvalStatus: true, rejectionReason: true }),
      })
    );
    expect(res.body[0].approvalStatus).toBe('pending');
    expect(res.body[0]).toHaveProperty('rejectionReason', null);
  });
});

describe('PATCH /api/admin/users/:id/approval', () => {
  test('no token → 401', async () => {
    const res = await approvalRequest(null, 'cust-1', { status: 'approved' });

    expect(res.status).toBe(401);
  });

  test('non-admin caller → 403, never reaches the target lookup', async () => {
    mockUsers({ [CUSTOMER_USER.id]: CUSTOMER_USER });

    const res = await approvalRequest(customerToken, 'cust-1', { status: 'approved' });

    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('invalid body (status is not "approved" or "rejected") → 400', async () => {
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER });

    const res = await approvalRequest(adminToken, 'cust-1', { status: 'not-a-real-status' });

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('unknown target user → 404', async () => {
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER }); // target id resolves to nothing

    const res = await approvalRequest(adminToken, 'does-not-exist', { status: 'approved' });

    expect(res.status).toBe(404);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('targeting another admin account → blocked, no update', async () => {
    const otherAdmin = { id: 'admin-2', email: 'other-admin@example.com', fullName: 'Other Admin', role: 'admin', approvalStatus: 'approved' };
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER, [otherAdmin.id]: otherAdmin });

    const res = await approvalRequest(adminToken, otherAdmin.id, { status: 'approved' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin accounts are not subject to approval.');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(sendApprovalEmailMock).not.toHaveBeenCalled();
  });

  test('admin targeting their own account → blocked by the same admin-role guard, no update', async () => {
    // The caller lookup and the target lookup both resolve to ADMIN_USER here (same id) —
    // proving self-targeting is blocked as a direct consequence of role === 'admin', with
    // no separate "is this me" check needed.
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER });

    const res = await approvalRequest(adminToken, ADMIN_USER.id, { status: 'approved' });

    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('pending → approved sends the approval email exactly once', async () => {
    const target = { id: 'cust-1', email: 'jane@example.com', fullName: 'Jane Dela Cruz', role: 'customer', approvalStatus: 'pending' };
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER, [target.id]: target });
    prismaMock.user.update.mockResolvedValue({ id: target.id, email: target.email, fullName: target.fullName, role: target.role, approvalStatus: 'approved', rejectionReason: null } as any);

    const res = await approvalRequest(adminToken, target.id, { status: 'approved' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: target.id },
      data: { approvalStatus: 'approved', rejectionReason: null },
      select: { id: true, email: true, fullName: true, role: true, approvalStatus: true, rejectionReason: true },
    });
    expect(sendApprovalEmailMock).toHaveBeenCalledTimes(1);
    expect(sendApprovalEmailMock).toHaveBeenCalledWith(target.email, target.fullName);
  });

  test('already approved → approved sends NO second email', async () => {
    const target = { id: 'cust-1', email: 'jane@example.com', fullName: 'Jane Dela Cruz', role: 'customer', approvalStatus: 'approved' };
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER, [target.id]: target });
    prismaMock.user.update.mockResolvedValue({ id: target.id, email: target.email, fullName: target.fullName, role: target.role, approvalStatus: 'approved', rejectionReason: null } as any);

    const res = await approvalRequest(adminToken, target.id, { status: 'approved' });

    expect(res.status).toBe(200);
    expect(sendApprovalEmailMock).not.toHaveBeenCalled();
  });

  test('rejected → approved works and sends the email (rejected → approved transition is allowed)', async () => {
    const target = { id: 'cust-1', email: 'jane@example.com', fullName: 'Jane Dela Cruz', role: 'customer', approvalStatus: 'rejected' };
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER, [target.id]: target });
    prismaMock.user.update.mockResolvedValue({ id: target.id, email: target.email, fullName: target.fullName, role: target.role, approvalStatus: 'approved', rejectionReason: null } as any);

    const res = await approvalRequest(adminToken, target.id, { status: 'approved' });

    expect(res.status).toBe(200);
    expect(sendApprovalEmailMock).toHaveBeenCalledTimes(1);
  });

  test('pending → rejected with a reason stores the reason and sends NO email', async () => {
    const target = { id: 'cust-1', email: 'jane@example.com', fullName: 'Jane Dela Cruz', role: 'customer', approvalStatus: 'pending' };
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER, [target.id]: target });
    prismaMock.user.update.mockResolvedValue({ id: target.id, email: target.email, fullName: target.fullName, role: target.role, approvalStatus: 'rejected', rejectionReason: 'Invalid documents provided' } as any);

    const res = await approvalRequest(adminToken, target.id, { status: 'rejected', reason: 'Invalid documents provided' });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: target.id },
      data: { approvalStatus: 'rejected', rejectionReason: 'Invalid documents provided' },
      select: { id: true, email: true, fullName: true, role: true, approvalStatus: true, rejectionReason: true },
    });
    expect(sendApprovalEmailMock).not.toHaveBeenCalled();
  });

  test('approval email throwing still returns 200 and keeps the status change (email failure must not fail the approval)', async () => {
    const target = { id: 'cust-1', email: 'jane@example.com', fullName: 'Jane Dela Cruz', role: 'customer', approvalStatus: 'pending' };
    mockUsers({ [ADMIN_USER.id]: ADMIN_USER, [target.id]: target });
    prismaMock.user.update.mockResolvedValue({ id: target.id, email: target.email, fullName: target.fullName, role: target.role, approvalStatus: 'approved', rejectionReason: null } as any);
    sendApprovalEmailMock.mockRejectedValue(new Error('Simulated Resend failure'));

    const res = await approvalRequest(adminToken, target.id, { status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe('approved');
  });
});
