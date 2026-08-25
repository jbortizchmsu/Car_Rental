import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { io } from '../index';
import { createAdminNotification, createNotification } from '../lib/notifications';
import { isPointInCircle } from '../lib/negros-coords';

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

    // 4. Geofence Check
    if (booking.geofenceActivatedAt && !booking.geofenceEndedAt) {
      const zones = await prisma.geofenceZone.findMany({
        where: {
          isActive: true,
          OR: [
            { bookingId: booking.id },
            { vehicleId: booking.vehicleId, bookingId: null },
          ]
        }
      });

      // Check if vehicle is outside ALL active geofence zones
      let isOutsideAllZones = zones.length > 0;
      for (const zone of zones) {
        if (
          zone.centerLatitude !== null && zone.centerLongitude !== null && zone.radiusKm !== null
        ) {
          // Circle-based check (used for auto-created zones)
          if (isPointInCircle(latitude, longitude, zone.centerLatitude, zone.centerLongitude, zone.radiusKm)) {
            isOutsideAllZones = false;
            break;
          }
        }
        // Polygon-based zones without center coords: treated as "inside" for now
        // (full polygon check can be added with @turf/turf later)
        else {
          isOutsideAllZones = false;
          break;
        }
      }

      if (isOutsideAllZones) {
        // Prevent duplicate spam: only create a new alert if no unresolved one exists
        const existingAlert = await prisma.geofenceAlert.findFirst({
          where: { bookingId, alertType: 'OUT_OF_ZONE', resolved: false }
        });

        if (!existingAlert) {
          const alert = await prisma.geofenceAlert.create({
            data: {
              bookingId,
              vehicleId,
              trackingSessionId,
              geofenceZoneId: zones[0]?.id ?? null,
              message: `Vehicle ${booking.vehicle.brand} ${booking.vehicle.model} is outside the allowed zone (Dest: ${booking.destinationName || 'Unknown'})!`,
              latitude,
              longitude,
              alertType: 'OUT_OF_ZONE',
              severity: 'CRITICAL'
            }
          });

          await createAdminNotification(
            'Geofence Breach',
            `CRITICAL: ${booking.vehicle.brand} (${booking.vehicle.licensePlate}) is outside the allowed area near ${booking.destinationName || 'destination'}!`
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

// Admin: Get Active Geofence Zones (for map display)
router.get('/active-geofence-zones', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const zones = await prisma.geofenceZone.findMany({
      where: {
        isActive: true,
        OR: [
          { booking: { status: 'ACTIVE' } },
          { bookingId: null }
        ]
      },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            vehicle: { select: { brand: true, model: true, licensePlate: true } },
            customer: { select: { fullName: true } }
          }
        }
      },
      orderBy: { activatedAt: 'desc' }
    });
    res.json({ zones });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active geofence zones' });
  }
});

// Admin: GPS Stats (total location records + completed sessions with GPS data)
router.get('/stats', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const [locationCount, sessionCount] = await Promise.all([
      prisma.vehicleLocation.count(),
      prisma.booking.count({
        where: { status: 'COMPLETED', locations: { some: {} } }
      })
    ]);
    res.json({ locationCount, sessionCount });
  } catch (error) {
    console.error('GPS stats error:', error);
    res.status(500).json({ error: 'Failed to fetch GPS stats' });
  }
});

// Admin: Session Playback — all location points for a booking in chronological order
router.get('/session/:bookingId', authenticate, authorizeAdmin, async (req, res) => {
  const { bookingId } = req.params;
  try {
    const locations = await prisma.vehicleLocation.findMany({
      where: { bookingId },
      orderBy: { recordedAt: 'asc' },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        accuracy: true,
        recordedAt: true
      }
    });
    res.json({ locations, count: locations.length });
  } catch (error) {
    console.error('GPS session error:', error);
    res.status(500).json({ error: 'Failed to fetch session locations' });
  }
});

// Admin: Export Session GPS Logs as CSV
router.get('/session/:bookingId/export', authenticate, authorizeAdmin, async (req, res) => {
  const { bookingId } = req.params;
  try {
    const locations = await prisma.vehicleLocation.findMany({
      where: { bookingId },
      orderBy: { recordedAt: 'asc' },
      select: {
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        accuracy: true,
        recordedAt: true
      }
    });

    if (!locations.length) {
      return res.status(404).json({ error: 'No GPS data found for this booking.' });
    }

    const headers = ['Timestamp', 'Latitude', 'Longitude', 'Speed (km/h)', 'Heading (deg)', 'Accuracy (m)'];
    const rows = locations.map(l => [
      new Date(l.recordedAt).toISOString(),
      l.latitude,
      l.longitude,
      l.speed ?? '',
      l.heading ?? '',
      l.accuracy ?? ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gps-session-${bookingId}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('GPS export error:', error);
    res.status(500).json({ error: 'Failed to export GPS data' });
  }
});

export default router;
