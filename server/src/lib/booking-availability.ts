import { prisma } from './prisma';

/**
 * Checks if a vehicle is available for a given date range.
 * A conflict exists if: (NewStart < ExistingEnd) AND (NewEnd > ExistingStart)
 *
 * @param vehicleId ID of the vehicle to check
 * @param pickupDate Proposed pickup date
 * @param returnDate Proposed return date
 * @param excludeBookingId Optional booking ID to exclude (used during updates/approvals)
 * @param skipPastDateCheck Skip the "pickup date cannot be in the past" guard. This guard is
 *   meant to validate a NEW proposed date range (booking creation, payment submission) — it
 *   does not apply when re-checking an EXISTING booking's original, unmodified startDate for
 *   real scheduling conflicts (e.g. a release happening after the scheduled pickup date has
 *   already legitimately passed). Defaults to false so every existing call site keeps its
 *   current behavior unchanged.
 * @returns Object with availability status and conflicting booking if any
 */
export async function checkVehicleAvailability(
  vehicleId: string,
  pickupDate: Date,
  returnDate: Date,
  excludeBookingId?: string,
  skipPastDateCheck: boolean = false
) {
  const now = new Date();

  // 1. Basic Date Validation
  if (!skipPastDateCheck && pickupDate < new Date(now.setHours(0, 0, 0, 0))) {
    return {
      available: false,
      message: 'Pickup date cannot be in the past.'
    };
  }

  if (returnDate <= pickupDate) {
    return {
      available: false,
      message: 'Return date must be after pickup date.'
    };
  }

  // 2. Status Check
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId }
  });

  if (!vehicle) {
    return {
      available: false,
      message: 'Vehicle not found.'
    };
  }

  if (vehicle.status === 'UNDER_MAINTENANCE' || vehicle.status === 'RETIRED') {
    return {
      available: false,
      message: `Vehicle is currently ${vehicle.status.replace('_', ' ').toLowerCase()}.`
    };
  }

  // 3. Conflict Query
  // We check for overlapping bookings that are NOT Rejected, Cancelled, or Completed.
  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      vehicleId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: {
        notIn: ['REJECTED', 'CANCELLED', 'COMPLETED']
      },
      // Overlap logic: (NewStart < ExistingEnd) AND (NewEnd > ExistingStart)
      AND: [
        { startDate: { lt: returnDate } },
        { endDate: { gt: pickupDate } }
      ]
    },
    include: {
      customer: {
        select: { fullName: true }
      }
    }
  });

  if (conflictingBooking) {
    return {
      available: false,
      message: 'This vehicle is already booked for the selected dates.',
      conflict: conflictingBooking
    };
  }

  return {
    available: true,
    message: 'Vehicle is available.'
  };
}
