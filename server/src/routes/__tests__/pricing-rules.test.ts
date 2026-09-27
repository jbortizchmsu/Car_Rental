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
import pricingRouter from '../pricing';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.use('/api/admin/pricing', pricingRouter);

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin', fullName: 'Admin User', isActive: true };
const adminToken = jwt.sign({ id: ADMIN_USER.id }, JWT_SECRET, { expiresIn: '1h' });

function createRuleRequest(body: Record<string, any>) {
  return request(app)
    .post('/api/admin/pricing/admin/rules')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
}

function updateRuleRequest(body: Record<string, any>) {
  return request(app)
    .put('/api/admin/pricing/admin/rules/rule-1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
}

const VALID_BODY = { name: 'Weekend surcharge', type: 'WEEKEND', multiplier: 1.5 };

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findUnique.mockResolvedValue(ADMIN_USER as any);
});

describe('POST /admin/rules', () => {
  test('multiplier as a non-numeric string → 400', async () => {
    const res = await createRuleRequest({ ...VALID_BODY, multiplier: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Multiplier must be a number greater than 0 and at most 10.');
    expect(prismaMock.pricingRule.create).not.toHaveBeenCalled();
  });

  test('multiplier of 0 → 400 (must be greater than 0)', async () => {
    const res = await createRuleRequest({ ...VALID_BODY, multiplier: 0 });

    expect(res.status).toBe(400);
  });

  test('negative multiplier → 400', async () => {
    const res = await createRuleRequest({ ...VALID_BODY, multiplier: -1 });

    expect(res.status).toBe(400);
  });

  test('multiplier above 10 → 400', async () => {
    const res = await createRuleRequest({ ...VALID_BODY, multiplier: 10.5 });

    expect(res.status).toBe(400);
  });

  test('multiplier of exactly 10 → accepted', async () => {
    prismaMock.pricingRule.create.mockResolvedValue({ id: 'rule-1', multiplier: 10 } as any);

    const res = await createRuleRequest({ ...VALID_BODY, multiplier: 10 });

    expect(res.status).toBe(201);
    expect(prismaMock.pricingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ multiplier: 10 }) })
    );
  });

  test('multiplier as a numeric string is accepted and coerced to a number', async () => {
    prismaMock.pricingRule.create.mockResolvedValue({ id: 'rule-1', multiplier: 0.9 } as any);

    const res = await createRuleRequest({ ...VALID_BODY, multiplier: '0.9' });

    expect(res.status).toBe(201);
    expect(prismaMock.pricingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ multiplier: 0.9 }) })
    );
  });

  test('type not one of the recognized values → 400', async () => {
    const res = await createRuleRequest({ ...VALID_BODY, type: 'BOGUS_TYPE' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Type must be one of SEASONAL, WEEKEND, DEMAND, CATEGORY.');
    expect(prismaMock.pricingRule.create).not.toHaveBeenCalled();
  });

  test.each(['SEASONAL', 'WEEKEND', 'DEMAND', 'CATEGORY'])('type %s is accepted', async (type) => {
    prismaMock.pricingRule.create.mockResolvedValue({ id: 'rule-1' } as any);

    const res = await createRuleRequest({ ...VALID_BODY, type });

    expect(res.status).toBe(201);
  });
});

describe('PUT /admin/rules/:id — partial updates', () => {
  test('multiplier omitted → not validated, existing behavior (no-op field) preserved', async () => {
    prismaMock.pricingRule.update.mockResolvedValue({ id: 'rule-1' } as any);

    const res = await updateRuleRequest({ description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(prismaMock.pricingRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ multiplier: undefined }) })
    );
  });

  test('multiplier present but invalid → 400, update never called', async () => {
    const res = await updateRuleRequest({ multiplier: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Multiplier must be a number greater than 0 and at most 10.');
    expect(prismaMock.pricingRule.update).not.toHaveBeenCalled();
  });

  test('multiplier present and valid → coerced and applied', async () => {
    prismaMock.pricingRule.update.mockResolvedValue({ id: 'rule-1', multiplier: 2 } as any);

    const res = await updateRuleRequest({ multiplier: '2' });

    expect(res.status).toBe(200);
    expect(prismaMock.pricingRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ multiplier: 2 }) })
    );
  });

  test('type omitted → not validated', async () => {
    prismaMock.pricingRule.update.mockResolvedValue({ id: 'rule-1' } as any);

    const res = await updateRuleRequest({ description: 'Updated description' });

    expect(res.status).toBe(200);
  });

  test('type present but invalid → 400', async () => {
    const res = await updateRuleRequest({ type: 'BOGUS_TYPE' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Type must be one of SEASONAL, WEEKEND, DEMAND, CATEGORY.');
    expect(prismaMock.pricingRule.update).not.toHaveBeenCalled();
  });
});
