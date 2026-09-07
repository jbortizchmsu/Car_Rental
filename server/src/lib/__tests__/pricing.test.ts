import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../prisma';
import { calculateBookingPrice } from '../pricing';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

// ---- Fixture helpers ----

function makeVehicle(overrides: Record<string, any> = {}) {
  return {
    id: 'veh-1',
    dailyRate: 1000,
    category: 'Sedan',
    ...overrides,
  } as any;
}

function makeRule(overrides: Record<string, any> = {}) {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    type: 'SEASONAL',
    multiplier: 1.2,
    startDate: null,
    endDate: null,
    vehicleCategory: null,
    utilizationThreshold: null,
    isActive: true,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

// Local-time date constructor to avoid any UTC/local timezone parsing ambiguity
// around day-of-week (weekend) calculations across different test machines.
function d(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day);
}

// Mocks prisma.vehicle.count for the DEMAND branch, which calls it twice:
// once for total non-retired vehicles, once for currently-occupied vehicles.
function mockVehicleCounts(total: number, occupied: number) {
  prismaMock.vehicle.count.mockImplementation(((args: any) => {
    if (args?.where?.status?.not) {
      return Promise.resolve(total);
    }
    return Promise.resolve(occupied);
  }) as any);
}

describe('calculateBookingPrice', () => {
  test('no active pricing rules → multiplier 1.0, totalPrice equals subtotal', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    prismaMock.pricingRule.findMany.mockResolvedValue([]);

    const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4)); // Mon->Wed, 2 days

    expect(result.rentalDays).toBe(2);
    expect(result.subtotal).toBe(2000);
    expect(result.multiplier).toBe(1.0);
    expect(result.totalPrice).toBe(2000);
    expect(result.appliedRuleName).toBeNull();
    expect(result.pricingRuleId).toBeNull();
  });

  test('SEASONAL rule: rental date range fully outside the rule range does not apply', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    const seasonalRule = makeRule({
      type: 'SEASONAL',
      multiplier: 1.3,
      startDate: d(2025, 11, 20), // Dec 20 2025
      endDate: d(2026, 0, 5),     // Jan 5 2026
    });
    prismaMock.pricingRule.findMany.mockResolvedValue([seasonalRule]);

    const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4)); // June, outside season

    expect(result.multiplier).toBe(1.0);
    expect(result.appliedRuleName).toBeNull();
    expect(result.totalPrice).toBe(result.subtotal);
  });

  test('SEASONAL rule: rental date range partially overlapping the rule range applies', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    const seasonalRule = makeRule({
      type: 'SEASONAL',
      name: 'Holiday Season',
      multiplier: 1.3,
      startDate: d(2025, 11, 20), // Dec 20 2025
      endDate: d(2026, 0, 5),     // Jan 5 2026
    });
    prismaMock.pricingRule.findMany.mockResolvedValue([seasonalRule]);

    // Dec 18 -> Dec 22: overlaps the first two days of the season (Dec 20-22)
    const result = await calculateBookingPrice('veh-1', d(2025, 11, 18), d(2025, 11, 22));

    expect(result.rentalDays).toBe(4);
    expect(result.subtotal).toBe(4000);
    expect(result.multiplier).toBe(1.3);
    expect(result.appliedRuleName).toBe('Holiday Season');
    expect(result.totalPrice).toBe(5200);
  });

  test('WEEKEND rule: date range containing zero weekend days does not apply', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    const weekendRule = makeRule({ type: 'WEEKEND', multiplier: 1.25 });
    prismaMock.pricingRule.findMany.mockResolvedValue([weekendRule]);

    // Mon Jun 2 -> Wed Jun 4 2025: Mon, Tue, Wed only, no Sat/Sun
    const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4));

    expect(result.multiplier).toBe(1.0);
    expect(result.appliedRuleName).toBeNull();
  });

  test('WEEKEND rule: date range containing exactly one weekend day applies', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    const weekendRule = makeRule({ type: 'WEEKEND', name: 'Weekend Surge', multiplier: 1.25 });
    prismaMock.pricingRule.findMany.mockResolvedValue([weekendRule]);

    // Fri Jun 6 -> Sat Jun 7 2025: contains exactly one weekend day (Saturday)
    const result = await calculateBookingPrice('veh-1', d(2025, 5, 6), d(2025, 5, 7));

    expect(result.rentalDays).toBe(1);
    expect(result.multiplier).toBe(1.25);
    expect(result.appliedRuleName).toBe('Weekend Surge');
    expect(result.totalPrice).toBe(1250);
  });

  test('WEEKEND rule: date range spanning multiple weekends still applies (loop breaks on first match)', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    const weekendRule = makeRule({ type: 'WEEKEND', name: 'Weekend Surge', multiplier: 1.25 });
    prismaMock.pricingRule.findMany.mockResolvedValue([weekendRule]);

    // Mon Jun 2 -> Mon Jun 16 2025: spans two full weekends (Jun 7-8 and Jun 14-15)
    const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 16));

    expect(result.rentalDays).toBe(14);
    expect(result.multiplier).toBe(1.25);
    expect(result.appliedRuleName).toBe('Weekend Surge');
    expect(result.totalPrice).toBe(1000 * 14 * 1.25);
  });

  test('CATEGORY rule: vehicleCategory of "all" / "any" / empty applies regardless of the vehicle\'s actual category', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle({ category: 'Van' }));

    for (const categoryValue of ['all', 'any', '']) {
      prismaMock.pricingRule.findMany.mockResolvedValue([
        makeRule({ type: 'CATEGORY', name: `Category (${categoryValue || 'empty'})`, multiplier: 1.1, vehicleCategory: categoryValue }),
      ]);

      const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4));

      expect(result.multiplier).toBe(1.1);
      expect(result.appliedRuleName).toBe(`Category (${categoryValue || 'empty'})`);
    }
  });

  test('CATEGORY rule: specific category matching (case-insensitive/trimmed) applies; non-matching does not', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle({ category: 'SUV' }));

    // Matching case: rule category has different case + surrounding whitespace
    prismaMock.pricingRule.findMany.mockResolvedValue([
      makeRule({ type: 'CATEGORY', name: 'SUV Surcharge', multiplier: 1.15, vehicleCategory: '  suv  ' }),
    ]);
    const matchResult = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4));
    expect(matchResult.multiplier).toBe(1.15);
    expect(matchResult.appliedRuleName).toBe('SUV Surcharge');

    // Non-matching case: rule targets a different category
    prismaMock.pricingRule.findMany.mockResolvedValue([
      makeRule({ type: 'CATEGORY', name: 'Sedan Surcharge', multiplier: 1.15, vehicleCategory: 'Sedan' }),
    ]);
    const noMatchResult = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4));
    expect(noMatchResult.multiplier).toBe(1.0);
    expect(noMatchResult.appliedRuleName).toBeNull();
  });

  test('DEMAND rule: utilization >= threshold applies', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    const demandRule = makeRule({ type: 'DEMAND', name: 'High Demand', multiplier: 1.4, utilizationThreshold: 0.8 });
    prismaMock.pricingRule.findMany.mockResolvedValue([demandRule]);
    mockVehicleCounts(10, 8); // utilization = 0.8, exactly at threshold

    const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4));

    expect(result.multiplier).toBe(1.4);
    expect(result.appliedRuleName).toBe('High Demand');
  });

  test('DEMAND rule: utilization < threshold does not apply', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    const demandRule = makeRule({ type: 'DEMAND', name: 'High Demand', multiplier: 1.4, utilizationThreshold: 0.8 });
    prismaMock.pricingRule.findMany.mockResolvedValue([demandRule]);
    mockVehicleCounts(10, 5); // utilization = 0.5, below threshold

    const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4));

    expect(result.multiplier).toBe(1.0);
    expect(result.appliedRuleName).toBeNull();
  });

  test('DEMAND rule: zero total vehicles calculates utilization as 0 (division-by-zero guard), rule does not incorrectly apply', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle());
    const demandRule = makeRule({ type: 'DEMAND', name: 'High Demand', multiplier: 1.4, utilizationThreshold: 0.8 });
    prismaMock.pricingRule.findMany.mockResolvedValue([demandRule]);
    mockVehicleCounts(0, 0); // no vehicles at all -> guarded utilization = 0

    const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 4));

    expect(result.multiplier).toBe(1.0);
    expect(result.appliedRuleName).toBeNull();
  });

  test('multiple simultaneously-applicable rules: highest multiplier wins, others discarded', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle({ category: 'SUV' }));
    const categoryRule = makeRule({ id: 'rule-category', type: 'CATEGORY', name: 'SUV Surcharge', multiplier: 1.2, vehicleCategory: 'SUV' });
    const weekendRule = makeRule({ id: 'rule-weekend', type: 'WEEKEND', name: 'Weekend Surge', multiplier: 1.5 });
    prismaMock.pricingRule.findMany.mockResolvedValue([categoryRule, weekendRule]);

    // Fri Jun 6 -> Sat Jun 7 2025: satisfies both the CATEGORY rule (vehicle is SUV) and the WEEKEND rule
    const result = await calculateBookingPrice('veh-1', d(2025, 5, 6), d(2025, 5, 7));

    expect(result.multiplier).toBe(1.5);
    expect(result.pricingRuleId).toBe('rule-weekend');
    expect(result.appliedRuleName).toBe('Weekend Surge');
  });

  test('vehicle not found throws Error("Vehicle not found")', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      calculateBookingPrice('nonexistent-vehicle', d(2025, 5, 2), d(2025, 5, 4))
    ).rejects.toThrow('Vehicle not found');
  });

  test('rounding: a non-terminating calculation rounds correctly to 2 decimal places', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle({ dailyRate: 333.33, category: 'Van' }));
    const categoryRule = makeRule({ type: 'CATEGORY', name: 'All Vehicles', multiplier: 1.2, vehicleCategory: 'all' });
    prismaMock.pricingRule.findMany.mockResolvedValue([categoryRule]);

    // Mon Jun 2 -> Thu Jun 5 2025: 3 days, no weekend involved
    const result = await calculateBookingPrice('veh-1', d(2025, 5, 2), d(2025, 5, 5));

    expect(result.rentalDays).toBe(3);
    expect(result.subtotal).toBe(999.99); // 333.33 * 3
    // raw total = 999.99 * 1.2 = 1199.988 -> rounds to 1199.99
    expect(result.totalPrice).toBe(1199.99);
  });
});
