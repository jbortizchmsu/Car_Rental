import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { io } from '../index';
import { createAdminNotification, createNotification } from '../lib/notifications';

const router = Router();

// Mobile: Update Location
router.post('/location', authenticate, async (req: AuthRequest, res) => {
  const { trackingSessionId, bookingId, vehicleId, latitude, longitude, speed, heading, accuracy, recordedAt } = req.body;

  try {
    // 1. Validate Booking & Session
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trackingSession: true, customer: true, vehicle: true }
    });

    if (!booking || booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized booking' });
    }

    if (booking.status !== 'ACTIVE' || !booking.trackingSession?.isActive) {
      return res.status(400).json({ error: 'Tracking is not active for this booking' });
    }

    // 2. Save Location
    const location = await prisma.vehicleLocation.create({
      data: {
        trackingSessionId,
        bookingId,
        vehicleId,
        customerId: req.user!.id,
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date()
      }
    });

    // 3. Emit Real-time Update
    io.emit('vehicle-location-updated', {
      bookingId,
      vehicleId,
      trackingSessionId,
      latitude,
      longitude,
      speed,
      heading,
      recordedAt: location.recordedAt,
      customerName: req.user!.fullName
    });

    // 4. Geofence Check (Basic Placeholder)
    if (booking.geofenceActivatedAt && !booking.geofenceEndedAt) {
      const zones = await prisma.geofenceZone.findMany({
        where: { 
          OR: [
            { bookingId: booking.id },
            { vehicleId: booking.vehicleId },
            { isActive: true, bookingId: null, vehicleId: null }
          ]
        }
      });

      // Mock breach check for demonstration purposes if coordinates are exactly 0,0 or something similar
      // In production, this would use @turf/turf or similar
      const isMockBreach = latitude === 0 && longitude === 0; 
      
      if (isMockBreach) {
        // Prevent duplicate spam: check if there's already an unresolved OUT_OF_ZONE alert for this booking
        const existingAlert = await prisma.geofenceAlert.findFirst({
          where: {
            bookingId,
            alertType: 'OUT_OF_ZONE',
            resolved: false
          }
        });

        if (!existingAlert) {
          const alert = await prisma.geofenceAlert.create({
            data: {
              bookingId,
              vehicleId,
              trackingSessionId,
              message: `Vehicle ${booking.vehicle.brand} ${booking.vehicle.model} left the allowed zone (Dest: ${booking.destinationName || 'Unknown'})!`,
              latitude,
              longitude,
              alertType: 'OUT_OF_ZONE',
              severity: 'CRITICAL'
            }
          });

          // Notify Admin
          await createAdminNotification(
            'Geofence Breach',
            `CRITICAL: ${booking.vehicle.brand} (${booking.vehicle.licensePlate}) is outside the allowed area!`
          );

          io.emit('geofence-alert-created', alert);
        }
      }
    }

    res.status(201).json(location);
  } catch (error) {
    console.error('GPS Record Error:', error);
    res.status(500).json({ error: 'Failed to record location' });
  }
});

// Admin: Get Live Locations
router.get('/live', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const activeRentals = await prisma.booking.findMany({
      where: { status: 'ACTIVE' },
      include: {
        customer: { select: { fullName: true } },
        vehicle: { select: { brand: true, model: true, licensePlate: true } },
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        },
        geofenceAlerts: {
          where: { resolved: false }
        }
      }
    });

    res.json(activeRentals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live locations' });
  }
});

// Admin: Resolve Geofence Alert
router.post('/alerts/:id/resolve', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  try {
    const alert = await prisma.geofenceAlert.update({
      where: { id: req.params.id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedById: req.user!.id
      },
      include: { booking: true, vehicle: true }
    });

    // Notify Customer if applicable (or just log it)
    await createNotification(
      alert.booking.customerId,
      'Security Alert Resolved',
      `The geofence alert for ${alert.vehicle.brand} ${alert.vehicle.model} has been resolved by an administrator.`
    );

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// Admin: Get All Geofence Zones
router.get('/geofences', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const zones = await prisma.geofenceZone.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch geofences' });
  }
});

// Admin: Create Geofence Zone
router.post('/geofences', authenticate, authorizeAdmin, async (req, res) => {
  const { name, vehicleId, polygonCoordinates, isActive } = req.body;
  try {
    const zone = await prisma.geofenceZone.create({
      data: {
        name,
        vehicleId: vehicleId || null,
        polygonCoordinates,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    res.json(zone);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create geofence' });
  }
});

// Admin: Toggle Geofence Status
router.patch('/geofences/:id/toggle', authenticate, authorizeAdmin, async (req, res) => {
  const { active } = req.body;
  try {
    const zone = await prisma.geofenceZone.update({
      where: { id: req.params.id },
      data: { isActive: active }
    });
    res.json(zone);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle geofence' });
  }
});

// Admin: Delete Geofence
router.delete('/geofences/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    await prisma.geofenceZone.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete geofence' });
  }
});

export default router;
