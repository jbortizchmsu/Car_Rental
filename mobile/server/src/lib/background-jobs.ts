import { prisma } from './prisma';
import { NotificationType } from './notification-types';
import { createTypedNotification, createTypedUserNotification } from './notifications';

/**
 * Background jobs for operational alerts
 * Runs on intervals to check system state and generate notifications
 */

/**
 * Check for overdue rentals (past return date, rental still active).
 * Grace period: 30 minutes before any alert fires.
 * Three severity tiers — each uses a distinct notification type so the 24hr
 * dedup guard fires independently per tier.
 * Runs every 15 minutes.
 */
export async function checkOverdueRentals() {
  try {
    const now = new Date();
    const gracePeriod    = new Date(now.getTime() - 30 * 60 * 1000);        // 30 min
    const tier2Threshold = new Date(now.getTime() - 3 * 60 * 60 * 1000);   // 3 hours
    const tier3Threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);  // 24 hours

    const getHoursOverdue = (endDate: Date): number =>
      Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60));

    const baseInclude = {
      customer: { select: { fullName: true } },
      vehicle:  { select: { licensePlate: true, brand: true, model: true } }
    };

    // Tier 1 — 30 min to 3 hrs overdue (Warning)
    const tier1 = await prisma.booking.findMany({
      where: { status: 'ACTIVE', endDate: { lt: gracePeriod, gte: tier2Threshold } },
      include: baseInclude
    });

    // Tier 2 — 3 hrs to 24 hrs overdue (Urgent)
    const tier2 = await prisma.booking.findMany({
      where: { status: 'ACTIVE', endDate: { lt: tier2Threshold, gte: tier3Threshold } },
      include: baseInclude
    });

    // Tier 3 — more than 24 hrs overdue (Critical)
    const tier3 = await prisma.booking.findMany({
      where: { status: 'ACTIVE', endDate: { lt: tier3Threshold } },
      include: baseInclude
    });

    for (const booking of tier1) {
      const hoursOverdue = getHoursOverdue(booking.endDate);
      await createTypedNotification(
        NotificationType.BOOKING_RETURN_OVERDUE_T1,
        { bookingId: booking.id, customerName: booking.customer?.fullName || 'Unknown', licensePlate: booking.vehicle?.licensePlate || 'Unknown', hoursOverdue },
        booking.id, 'booking'
      );
      await createTypedUserNotification(
        booking.customerId,
        NotificationType.BOOKING_RETURN_OVERDUE_T1,
        'Return Reminder',
        `Your rental of ${booking.vehicle?.brand} ${booking.vehicle?.model} (${booking.vehicle?.licensePlate}) was due ${hoursOverdue} hour${hoursOverdue !== 1 ? 's' : ''} ago. Please return the vehicle as soon as possible to avoid additional charges.`,
        booking.id, 'booking'
      );
    }

    for (const booking of tier2) {
      const hoursOverdue = getHoursOverdue(booking.endDate);
      await createTypedNotification(
        NotificationType.BOOKING_RETURN_OVERDUE_T2,
        { bookingId: booking.id, customerName: booking.customer?.fullName || 'Unknown', licensePlate: booking.vehicle?.licensePlate || 'Unknown', hoursOverdue },
        booking.id, 'booking'
      );
      await createTypedUserNotification(
        booking.customerId,
        NotificationType.BOOKING_RETURN_OVERDUE_T2,
        'Urgent: Return Overdue',
        `URGENT: Your rental of ${booking.vehicle?.brand} ${booking.vehicle?.model} is now ${hoursOverdue} hours overdue. Please contact us immediately or return the vehicle now.`,
        booking.id, 'booking'
      );
    }

    for (const booking of tier3) {
      const hoursOverdue = getHoursOverdue(booking.endDate);
      await createTypedNotification(
        NotificationType.BOOKING_RETURN_OVERDUE_T3,
        { bookingId: booking.id, customerName: booking.customer?.fullName || 'Unknown', licensePlate: booking.vehicle?.licensePlate || 'Unknown', hoursOverdue },
        booking.id, 'booking'
      );
      await createTypedUserNotification(
        booking.customerId,
        NotificationType.BOOKING_RETURN_OVERDUE_T3,
        'Critical: Return Overdue',
        `CRITICAL: Your rental of ${booking.vehicle?.brand} ${booking.vehicle?.model} is more than 24 hours overdue. Additional charges are being applied. Please contact us immediately.`,
        booking.id, 'booking'
      );
    }

    const total = tier1.length + tier2.length + tier3.length;
    if (total > 0) {
      console.log(`[ALERT] Overdue rentals — T1: ${tier1.length}, T2: ${tier2.length}, T3: ${tier3.length}`);
    }
  } catch (error) {
    console.error('Error checking overdue rentals:', error);
  }
}

/**
 * Check for bookings with pickup due in ≤24 hours, no confirmed payment
 * Runs every 1 hour
 */
export async function checkPickupDueBookings() {
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const dueSoonBookings = await prisma.booking.findMany({
      where: {
        AND: [
          { startDate: { gte: now, lte: in24Hours } },        // Pickup in next 24 hours
          {
            OR: [
              { status: 'PENDING_REVIEW' },
              { status: 'APPROVED_FOR_PAYMENT' },
              { status: 'DOWNPAYMENT_SUBMITTED' }
            ]
          }
        ]
      },
      include: {
        customer: { select: { fullName: true } },
        vehicle: { select: { licensePlate: true, brand: true, model: true } }
      }
    });

    for (const booking of dueSoonBookings) {
      const hoursUntilPickup = Math.floor(
        (booking.startDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      );

      await createTypedNotification(
        NotificationType.BOOKING_PICKUP_DUE,
        {
          bookingId: booking.id,
          customerName: booking.customer?.fullName || 'Unknown',
          vehicleModel: `${booking.vehicle?.brand} ${booking.vehicle?.model}`,
          hoursUntilPickup
        },
        booking.id,
        'booking'
      );
    }

    if (dueSoonBookings.length > 0) {
      console.log(`[ALERT] Found ${dueSoonBookings.length} bookings due for pickup soon`);
    }
  } catch (error) {
    console.error('Error checking pickup due bookings:', error);
  }
}

/**
 * Check vehicle maintenance due conflicts
 * Vehicle is due for service but has an upcoming booking
 * Runs every 6 hours
 */
export async function checkMaintenanceDueConflicts() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: { not: 'RETIRED' } },
      include: {
        bookings: {
          where: {
            startDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
            },
            status: { in: ['RESERVED', 'READY_FOR_PICKUP', 'APPROVED_FOR_PAYMENT'] }
          },
          take: 1
        }
      }
    });

    for (const vehicle of vehicles) {
      // Check if vehicle is due for service (within 500km threshold)
      const kmUntilService =
        vehicle.oilChangeIntervalKm -
        (vehicle.currentOdometerKm - vehicle.lastOilChangeOdometerKm);

      if (kmUntilService <= 500 && kmUntilService > 0 && vehicle.bookings.length > 0) {
        const nextBooking = vehicle.bookings[0];

        await createTypedNotification(
          NotificationType.MAINTENANCE_DUE_CONFLICT,
          {
            vehicleName: `${vehicle.brand} ${vehicle.model}`,
            vehicleId: vehicle.id,
            bookingId: nextBooking.id,
            bookingDate: nextBooking.startDate.toLocaleDateString(),
            kmUntilService:  Math.round(kmUntilService)
          },
          vehicle.id,
          'vehicle'
        );
      }
    }
  } catch (error) {
    console.error('Error checking maintenance conflicts:', error);
  }
}

/**
 * Check for maintenance due soon (vehicle within 500km of service threshold)
 * Runs every 6 hours
 */
export async function checkMaintenanceDueSoon() {
  try {
    const vehiclesDueSoon = await prisma.vehicle.findMany({
      where: {
        status: { not: 'RETIRED' },
        oilChangeIntervalKm: { gt: 0 }
      }
    });

    for (const vehicle of vehiclesDueSoon) {
      const kmUntilService =
        vehicle.oilChangeIntervalKm -
        (vehicle.currentOdometerKm - vehicle.lastOilChangeOdometerKm);

      if (kmUntilService <= 500 && kmUntilService > 0) {
        await createTypedNotification(
          NotificationType.MAINTENANCE_DUE_SOON,
          {
            vehicleName: `${vehicle.brand} ${vehicle.model}`,
            licensePlate: vehicle.licensePlate,
            kmUntilService: Math.round(kmUntilService)
          },
          vehicle.id,
          'vehicle'
        );
      }
    }
  } catch (error) {
    console.error('Error checking maintenance due soon:', error);
  }
}

/**
 * Initialize all background jobs with appropriate intervals
 */
export function initializeBackgroundJobs() {
  console.log('[JOBS] Initializing background alert jobs...');

  // Check overdue rentals every 15 minutes
  setInterval(() => {
    console.log('[JOBS] Running: checkOverdueRentals');
    checkOverdueRentals();
  }, 15 * 60 * 1000);

  // Check pickup due bookings every 1 hour
  setInterval(() => {
    console.log('[JOBS] Running: checkPickupDueBookings');
    checkPickupDueBookings();
  }, 60 * 60 * 1000);

  // Check maintenance conflicts every 6 hours
  setInterval(() => {
    console.log('[JOBS] Running: checkMaintenanceDueConflicts');
    checkMaintenanceDueConflicts();
  }, 6 * 60 * 60 * 1000);

  // Check maintenance due soon every 6 hours
  setInterval(() => {
    console.log('[JOBS] Running: checkMaintenanceDueSoon');
    checkMaintenanceDueSoon();
  }, 6 * 60 * 60 * 1000);

  // Run initial checks on startup after a brief delay
  setTimeout(() => {
    console.log('[JOBS] Running initial alert checks on startup...');
    checkOverdueRentals();
    checkPickupDueBookings();
    checkMaintenanceDueConflicts();
    checkMaintenanceDueSoon();
  }, 3000);
}
