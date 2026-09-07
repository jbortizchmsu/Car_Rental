import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../prisma';
import { checkVehicleAvailability } from '../booking-availability';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

// Helper: a date safely in the future, with an optional day offset.
function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1); // push a year ahead to avoid any near-term edge cases
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

describe('checkVehicleAvailability', () => {
  test('pickup date in the past returns unavailable with a past-date message', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const returnDate = futureDate(3);

    const result = await checkVehicleAvailability('veh-1', yesterday, returnDate);

    expect(result.available).toBe(false);
    expect(result.message).toBe('Pickup date cannot be in the past.');
    expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
  });

  test('return date equal to pickup date returns unavailable', async () => {
    const pickup = futureDate(1);
    const sameDate = new Date(pickup.getTime());

    const result = await checkVehicleAvailability('veh-1', pickup, sameDate);

    expect(result.available).toBe(false);
    expect(result.message).toBe('Return date must be after pickup date.');
    expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
  });

  test('return date before pickup date returns unavailable', async () => {
    const pickup = futureDate(5);
    const returnDate = futureDate(2); // earlier than pickup

    const result = await checkVehicleAvailability('veh-1', pickup, returnDate);

    expect(result.available).toBe(false);
    expect(result.message).toBe('Return date must be after pickup date.');
    expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
  });

  test('vehicle ID not found returns unavailable with "Vehicle not found." message', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue(null);

    const pickup = futureDate(1);
    const returnDate = futureDate(3);

    const result = await checkVehicleAvailability('nonexistent-vehicle', pickup, returnDate);

    expect(result.available).toBe(false);
    expect(result.message).toBe('Vehicle not found.');
  });

  test('vehicle status UNDER_MAINTENANCE returns unavailable', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'UNDER_MAINTENANCE' } as any);

    const pickup = futureDate(1);
    const returnDate = futureDate(3);

    const result = await checkVehicleAvailability('veh-1', pickup, returnDate);

    expect(result.available).toBe(false);
    expect(result.message).toBe('Vehicle is currently under maintenance.');
  });

  test('vehicle status RETIRED returns unavailable', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'RETIRED' } as any);

    const pickup = futureDate(1);
    const returnDate = futureDate(3);

    const result = await checkVehicleAvailability('veh-1', pickup, returnDate);

    expect(result.available).toBe(false);
    expect(result.message).toBe('Vehicle is currently retired.');
  });

  test('overlapping booking exists (status not in REJECTED/CANCELLED/COMPLETED) returns unavailable with conflict details', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'AVAILABLE' } as any);
    const conflictingBooking = {
      id: 'booking-existing',
      status: 'ACTIVE',
      customer: { fullName: 'Jane Dela Cruz' },
    };
    prismaMock.booking.findFirst.mockResolvedValue(conflictingBooking as any);

    const pickup = futureDate(1);
    const returnDate = futureDate(3);

    const result = await checkVehicleAvailability('veh-1', pickup, returnDate);

    expect(result.available).toBe(false);
    expect(result.message).toBe('This vehicle is already booked for the selected dates.');
    expect((result as any).conflict).toEqual(conflictingBooking);
  });

  test('overlapping booking excluded via excludeBookingId parameter returns available', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'AVAILABLE' } as any);
    // Simulate the DB having excluded the given booking ID from its conflict search, leaving none.
    prismaMock.booking.findFirst.mockResolvedValue(null);

    const pickup = futureDate(1);
    const returnDate = futureDate(3);

    const result = await checkVehicleAvailability('veh-1', pickup, returnDate, 'booking-self');

    expect(result.available).toBe(true);
    expect(result.message).toBe('Vehicle is available.');

    // Verify the function actually constructed the exclusion filter correctly —
    // since Prisma itself is mocked, this is the only way to confirm the exclusion
    // logic is wired up (the mock can't perform real filtering for us).
    expect(prismaMock.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'booking-self' },
        }),
      })
    );
  });

  test('no conflicts, valid dates, active vehicle status returns available', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({ status: 'AVAILABLE' } as any);
    prismaMock.booking.findFirst.mockResolvedValue(null);

    const pickup = futureDate(1);
    const returnDate = futureDate(3);

    const result = await checkVehicleAvailability('veh-1', pickup, returnDate);

    expect(result.available).toBe(true);
    expect(result.message).toBe('Vehicle is available.');
  });
});
