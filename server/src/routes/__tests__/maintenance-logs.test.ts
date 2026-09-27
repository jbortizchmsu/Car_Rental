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
import maintenanceRouter from '../maintenance';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.use('/api/admin/maintenance', maintenanceRouter);

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin', fullName: 'Admin User', isActive: true };
const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findUnique.mockResolvedValue(ADMIN_USER as any);
});

const VALID_LOG_BODY = { vehicleId: 'veh-1', serviceType: 'OIL_CHANGE', description: 'Routine oil change' };

describe('POST /api/admin/maintenance/logs', () => {
  function createLogRequest(body: Record<string, any>) {
    return request(app)
      .post('/api/admin/maintenance/logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  test('cost non-numeric string → 400, log never created', async () => {
    const res = await createLogRequest({ ...VALID_LOG_BODY, cost: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cost must be a valid, non-negative number.');
    expect(prismaMock.maintenanceLog.create).not.toHaveBeenCalled();
  });

  test('cost negative → 400', async () => {
    const res = await createLogRequest({ ...VALID_LOG_BODY, cost: '-100' });

    expect(res.status).toBe(400);
  });

  test('cost omitted → optional, defaults to null', async () => {
    prismaMock.maintenanceLog.create.mockResolvedValue({ id: 'log-1', vehicle: { currentOdometerKm: 5000 } } as any);

    const res = await createLogRequest(VALID_LOG_BODY);

    expect(res.status).toBe(201);
    expect(prismaMock.maintenanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: null }) })
    );
  });

  test('cost as a whitespace-only string is treated as not provided (defaults to null, not a 400)', async () => {
    prismaMock.maintenanceLog.create.mockResolvedValue({ id: 'log-1', vehicle: { currentOdometerKm: 5000 } } as any);

    const res = await createLogRequest({ ...VALID_LOG_BODY, cost: '   ' });

    expect(res.status).toBe(201);
    expect(prismaMock.maintenanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: null }) })
    );
  });

  test('cost as a valid numeric string is accepted and coerced', async () => {
    prismaMock.maintenanceLog.create.mockResolvedValue({ id: 'log-1', vehicle: { currentOdometerKm: 5000 } } as any);

    const res = await createLogRequest({ ...VALID_LOG_BODY, cost: '1500.50' });

    expect(res.status).toBe(201);
    expect(prismaMock.maintenanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 1500.5 }) })
    );
  });

  test('odometerKm non-numeric string → 400', async () => {
    const res = await createLogRequest({ ...VALID_LOG_BODY, odometerKm: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Odometer reading must be a valid, non-negative number.');
  });

  test('odometerKm of exactly 0 is accepted (not treated as missing)', async () => {
    prismaMock.maintenanceLog.create.mockResolvedValue({ id: 'log-1', vehicle: { currentOdometerKm: 5000 } } as any);

    const res = await createLogRequest({ ...VALID_LOG_BODY, odometerKm: '0' });

    expect(res.status).toBe(201);
    expect(prismaMock.maintenanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ odometerKm: 0 }) })
    );
  });

  test('odometerKm as a whitespace-only string is treated as not provided (defaults to null, not a 400)', async () => {
    prismaMock.maintenanceLog.create.mockResolvedValue({ id: 'log-1', vehicle: { currentOdometerKm: 5000 } } as any);

    const res = await createLogRequest({ ...VALID_LOG_BODY, odometerKm: '  ' });

    expect(res.status).toBe(201);
    expect(prismaMock.maintenanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ odometerKm: null }) })
    );
  });
});

describe('PUT /api/admin/maintenance/logs/:id', () => {
  function updateLogRequest(body: Record<string, any>) {
    return request(app)
      .put('/api/admin/maintenance/logs/log-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  test('cost present but invalid → 400, update never called', async () => {
    const res = await updateLogRequest({ cost: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cost must be a valid, non-negative number.');
    expect(prismaMock.maintenanceLog.update).not.toHaveBeenCalled();
  });

  test('cost omitted → left undefined (no-op), existing partial-update behavior preserved', async () => {
    prismaMock.maintenanceLog.update.mockResolvedValue({ id: 'log-1', vehicle: { currentOdometerKm: 5000 } } as any);

    const res = await updateLogRequest({ description: 'Updated' });

    expect(res.status).toBe(200);
    expect(prismaMock.maintenanceLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: undefined }) })
    );
  });

  test('cost as a whitespace-only string is treated as not provided (left undefined, not a 400)', async () => {
    prismaMock.maintenanceLog.update.mockResolvedValue({ id: 'log-1', vehicle: { currentOdometerKm: 5000 } } as any);

    const res = await updateLogRequest({ cost: '   ' });

    expect(res.status).toBe(200);
    expect(prismaMock.maintenanceLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: undefined }) })
    );
  });

  test('odometerKm present but invalid → 400', async () => {
    const res = await updateLogRequest({ odometerKm: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Odometer reading must be a valid, non-negative number.');
  });

  test('odometerKm as a whitespace-only string is treated as not provided (left undefined, not a 400)', async () => {
    prismaMock.maintenanceLog.update.mockResolvedValue({ id: 'log-1', vehicle: { currentOdometerKm: 5000 } } as any);

    const res = await updateLogRequest({ odometerKm: '  ' });

    expect(res.status).toBe(200);
    expect(prismaMock.maintenanceLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ odometerKm: undefined }) })
    );
  });
});

describe('POST /api/admin/maintenance/vehicles/:vehicleId/mark-maintenance', () => {
  function markMaintenanceRequest(body: Record<string, any>) {
    return request(app)
      .post('/api/admin/maintenance/vehicles/veh-1/mark-maintenance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  test('odometerKm non-numeric string → 400, vehicle status never changed', async () => {
    const res = await markMaintenanceRequest({ reason: 'Brake check', odometerKm: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Odometer reading must be a valid, non-negative number.');
    expect(prismaMock.vehicle.update).not.toHaveBeenCalled();
  });

  test('odometerKm omitted → falls back to vehicle.currentOdometerKm', async () => {
    prismaMock.vehicle.update.mockResolvedValue({ id: 'veh-1', currentOdometerKm: 12345 } as any);
    prismaMock.maintenanceLog.create.mockResolvedValue({} as any);

    const res = await markMaintenanceRequest({ reason: 'Brake check' });

    expect(res.status).toBe(200);
    expect(prismaMock.maintenanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ odometerKm: 12345 }) })
    );
  });

  test('odometerKm of 0 is accepted, not treated as missing', async () => {
    prismaMock.vehicle.update.mockResolvedValue({ id: 'veh-1', currentOdometerKm: 12345 } as any);
    prismaMock.maintenanceLog.create.mockResolvedValue({} as any);

    const res = await markMaintenanceRequest({ reason: 'Brake check', odometerKm: '0' });

    expect(res.status).toBe(200);
    expect(prismaMock.maintenanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ odometerKm: 0 }) })
    );
  });

  test('odometerKm as a whitespace-only string is treated as not provided (falls back to vehicle.currentOdometerKm, not a 400)', async () => {
    prismaMock.vehicle.update.mockResolvedValue({ id: 'veh-1', currentOdometerKm: 12345 } as any);
    prismaMock.maintenanceLog.create.mockResolvedValue({} as any);

    const res = await markMaintenanceRequest({ reason: 'Brake check', odometerKm: '   ' });

    expect(res.status).toBe(200);
    expect(prismaMock.maintenanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ odometerKm: 12345 }) })
    );
  });
});
