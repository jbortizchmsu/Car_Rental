import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { createNotification } from '../lib/notifications';

const router = Router();

// Admin: Release Vehicle (Pick up)
router.post('/bookings/:id/release', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { 
        status: 'ACTIVE', 
        releasedAt: new Date(),
        // Also start tracking session
        trackingSession: {
          create: { isActive: true }
        }
      },
      include: { vehicle: true }
    });

    // Mark vehicle as RENTED
    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: 'RENTED' }
    });

    // Notify Customer
    await createNotification(
      booking.customerId,
      'Vehicle Released',
      `Your rental for ${booking.vehicle.brand} ${booking.vehicle.model} is now ACTIVE. GPS tracking has started.`
    );

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Release failed' });
  }
});

// Admin: Process Return
router.post('/bookings/:id/return', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { 
        status: 'RETURNED', 
        returnedAt: new Date(),
        trackingSession: {
          update: { isActive: false, endTime: new Date() }
        }
      }
    });

    // Notify Customer
    await createNotification(
      booking.customerId,
      'Vehicle Returned',
      'The vehicle has been successfully returned and is awaiting final inspection.'
    );

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Return processing failed' });
  }
});

// Admin: Complete Rental
router.post('/bookings/:id/complete', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { 
        status: 'COMPLETED', 
        completedAt: new Date()
      },
      include: { vehicle: true }
    });

    // Mark vehicle back to AVAILABLE
    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: 'AVAILABLE' }
    });

    // Notify Customer
    await createNotification(
      booking.customerId,
      'Rental Completed',
      `Your rental of ${booking.vehicle.brand} ${booking.vehicle.model} is now officially COMPLETED. Thank you for choosing JD Car Rental!`
    );

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Completion failed' });
  }
});

export default router;
