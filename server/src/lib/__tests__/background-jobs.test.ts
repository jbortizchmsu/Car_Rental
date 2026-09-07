import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// lib/notifications.ts (called for real here — its message-generation logic is exactly what
// these tests verify) imports `{ io } from '../index'`, and index.ts has real side effects at
// import time (live HTTP server, Socket.IO, background setInterval jobs, Supabase calls).
// Mocked via an explicit factory so the real module is never required.
jest.mock('../../index', () => ({
  __esModule: true,
  io: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
}));

import { prisma } from '../prisma';
import {
  checkOverdueRentals,
  checkMaintenanceDueConflicts,
  checkMaintenanceDueSoon,
} from '../background-jobs';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const ADMIN_USER = { id: 'admin-1' };

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function makeOverdueBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    customerId: 'cust-1',
    status: 'ACTIVE',
    endDate: hoursAgo(1),
    customer: { fullName: 'Jane Dela Cruz' },
    vehicle: { licensePlate: 'ABC-1234', brand: 'Toyota', model: 'Vios' },
    ...overrides,
  } as any;
}

function makeVehicle(overrides: Record<string, any> = {}) {
  return {
    id: 'veh-1',
    brand: 'Toyota',
    model: 'Vios',
    licensePlate: 'ABC-1234',
    status: 'AVAILABLE',
    oilChangeIntervalKm: 5000,
    currentOdometerKm: 0,
    lastOilChangeOdometerKm: 0,
    bookings: [],
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findMany.mockResolvedValue([ADMIN_USER] as any);
});

describe('checkOverdueRentals', () => {
  test('tier 1 (30min-3hr overdue): exactly 1 hour overdue produces singular "hour" wording in the customer message', async () => {
    const booking = makeOverdueBooking({ endDate: hoursAgo(1) }); // safely inside tier1's window, floors to 1
    prismaMock.booking.findMany
      .mockResolvedValueOnce([booking]) // tier1 query
      .mockResolvedValueOnce([])        // tier2 query
      .mockResolvedValueOnce([]);       // tier3 query

    await checkOverdueRentals();

    const customerCall = prismaMock.notification.create.mock.calls.find(
      (call: any) => call[0].data.targetRole === 'customer'
    );
    expect(customerCall).toBeDefined();
    expect(customerCall![0].data.type).toBe('BOOKING_RETURN_OVERDUE_T1');
    expect(customerCall![0].data.title).toBe('Return Reminder');
    expect(customerCall![0].data.message).toContain('was due 1 hour ago'); // singular, no trailing 's'
    expect(customerCall![0].data.message).not.toContain('1 hours');

    const adminCall = prismaMock.notification.create.mock.calls.find(
      (call: any) => call[0].data.targetRole === 'admin'
    );
    expect(adminCall).toBeDefined();
    expect(adminCall![0].data.type).toBe('BOOKING_RETURN_OVERDUE_T1');
  });

  test('tier 2 (3hr-24hr overdue): correct tier-appropriate "Urgent" notification', async () => {
    const booking = makeOverdueBooking({ endDate: hoursAgo(5) }); // safely inside tier2's window
    prismaMock.booking.findMany
      .mockResolvedValueOnce([])       // tier1
      .mockResolvedValueOnce([booking]) // tier2
      .mockResolvedValueOnce([]);      // tier3

    await checkOverdueRentals();

    const customerCall = prismaMock.notification.create.mock.calls.find(
      (call: any) => call[0].data.targetRole === 'customer'
    );
    expect(customerCall![0].data.type).toBe('BOOKING_RETURN_OVERDUE_T2');
    expect(customerCall![0].data.title).toBe('Urgent: Return Overdue');
    expect(customerCall![0].data.message).toContain('now 5 hours overdue');

    const adminCall = prismaMock.notification.create.mock.calls.find(
      (call: any) => call[0].data.targetRole === 'admin'
    );
    expect(adminCall![0].data.type).toBe('BOOKING_RETURN_OVERDUE_T2');
  });

  test('tier 3 (24hr+ overdue): correct "Critical" notification, fixed wording (no dynamic hour count in this tier)', async () => {
    const booking = makeOverdueBooking({ endDate: hoursAgo(30) }); // safely beyond 24hr
    prismaMock.booking.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([booking]);

    await checkOverdueRentals();

    const customerCall = prismaMock.notification.create.mock.calls.find(
      (call: any) => call[0].data.targetRole === 'customer'
    );
    expect(customerCall![0].data.type).toBe('BOOKING_RETURN_OVERDUE_T3');
    expect(customerCall![0].data.title).toBe('Critical: Return Overdue');
    // Confirmed against the actual code: tier 3's message is fixed text with no interpolated
    // hour count at all ("more than 24 hours overdue"), unlike tier 1's dynamic singular/plural
    // count — there is no plural-vs-singular branch to test here because none exists.
    expect(customerCall![0].data.message).toContain('more than 24 hours overdue');

    const adminCall = prismaMock.notification.create.mock.calls.find(
      (call: any) => call[0].data.targetRole === 'admin'
    );
    expect(adminCall![0].data.type).toBe('BOOKING_RETURN_OVERDUE_T3');
  });

  test('no overdue rentals in any tier → no notifications created, function completes cleanly', async () => {
    prismaMock.booking.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(checkOverdueRentals()).resolves.not.toThrow();

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

describe('checkMaintenanceDueConflicts', () => {
  test('vehicle within the due-soon threshold AND a conflicting upcoming booking exists → conflict alert triggered', async () => {
    const vehicle = makeVehicle({
      oilChangeIntervalKm: 5000,
      currentOdometerKm: 4600,
      lastOilChangeOdometerKm: 0, // kmUntilService = 5000 - (4600 - 0) = 400 (within 0 < x <= 500)
      bookings: [{ id: 'booking-conflict', startDate: new Date() }],
    });
    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);

    await checkMaintenanceDueConflicts();

    const call = prismaMock.notification.create.mock.calls.find(
      (c: any) => c[0].data.type === 'MAINTENANCE_DUE_CONFLICT'
    );
    expect(call).toBeDefined();
    expect(call![0].data.message).toContain('due for service but has an upcoming booking');
  });

  test('vehicle within the threshold window but NO conflicting booking → no conflict alert', async () => {
    const vehicle = makeVehicle({
      oilChangeIntervalKm: 5000,
      currentOdometerKm: 4600,
      lastOilChangeOdometerKm: 0, // same kmUntilService = 400, within window
      bookings: [], // no upcoming booking
    });
    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);

    await checkMaintenanceDueConflicts();

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  test('vehicle outside the threshold window entirely (even with a conflicting booking) → no alert', async () => {
    const vehicle = makeVehicle({
      oilChangeIntervalKm: 5000,
      currentOdometerKm: 4000,
      lastOilChangeOdometerKm: 0, // kmUntilService = 1000, outside the <=500 window
      bookings: [{ id: 'booking-conflict', startDate: new Date() }],
    });
    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);

    await checkMaintenanceDueConflicts();

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

describe('checkMaintenanceDueSoon', () => {
  test('vehicle within the due-soon threshold → notification triggered', async () => {
    const vehicle = makeVehicle({
      oilChangeIntervalKm: 5000,
      currentOdometerKm: 4700,
      lastOilChangeOdometerKm: 0, // kmUntilService = 300, within window
    });
    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);

    await checkMaintenanceDueSoon();

    const call = prismaMock.notification.create.mock.calls.find(
      (c: any) => c[0].data.type === 'MAINTENANCE_DUE_SOON'
    );
    expect(call).toBeDefined();
    expect(call![0].data.message).toContain('300 km from service threshold');
  });

  test('vehicle outside the due-soon threshold → no notification', async () => {
    const vehicle = makeVehicle({
      oilChangeIntervalKm: 5000,
      currentOdometerKm: 3000,
      lastOilChangeOdometerKm: 0, // kmUntilService = 2000, well outside window
    });
    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);

    await checkMaintenanceDueSoon();

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});
