import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { createNotification } from '../lib/notifications';
import {
  computeGeofence,
  getMunicipalityCoords,
  generateCirclePolygon,
  getDistanceKm,
  SHOP_LOCATION,
} from '../lib/negros-coords';

const router = Router();

async function getShopCenterFromSettings(): Promise<{ lat: number; lng: number } | null> {
  try {
    const settings = await prisma.systemSettings.findMany({
      where: { key: { in: ['map.centerLat', 'map.centerLng'] } }
    });
    const latStr = settings.find(s => s.key === 'map.centerLat')?.value;
    const lngStr = settings.find(s => s.key === 'map.centerLng')?.value;
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  } catch (err) {
    console.warn('[Geofence] Failed to fetch shop center settings, using fallback:', err);
  }
  return null;
}

// Admin: Release Vehicle (Pick up)
router.post('/bookings/:id/release', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        status: 'ACTIVE',
        releasedAt: new Date(),
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

    // Create geofence zone if destination is set
    if (booking.destinationName) {
      try {
        const shopCenter = await getShopCenterFromSettings();
        const geo = computeGeofence(booking.destinationName, shopCenter);

        if (!geo) {
          console.warn(`[Geofence] No coordinates for "${booking.destinationName}" — skipping zone creation.`);
        } else {
          // Deactivate any existing active zone for this vehicle
          await prisma.geofenceZone.updateMany({
            where: { vehicleId: booking.vehicleId, isActive: true },
            data: { isActive: false },
          });

          const circlePolygon = generateCirclePolygon(geo.centerLat, geo.centerLng, geo.radiusKm);

          const geofenceZone = await prisma.geofenceZone.create({
            data: {
              bookingId: booking.id,
              vehicleId: booking.vehicleId,
              name: booking.destinationName,
              polygonCoordinates: JSON.stringify(circlePolygon),
              centerLatitude: geo.centerLat,
              centerLongitude: geo.centerLng,
              radiusKm: geo.radiusKm,
              isActive: true,
              activatedAt: new Date(),
            },
          });

          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              approvedGeofenceZoneId: geofenceZone.id,
              geofenceActivatedAt: new Date(),
            },
          });

          const originLat = geo.centerLat;
          const originLng = geo.centerLng;
          const dest = getMunicipalityCoords(booking.destinationName);
          const distKm = dest ? getDistanceKm(originLat, originLng, dest.lat, dest.lng) : 0;
          console.log(
            `[Geofence] Shop (${originLat}, ${originLng}) → ${booking.destinationName}: ${distKm.toFixed(1)}km, radius: ${geo.radiusKm}km` +
            ` (booking ${booking.id})`
          );
        }
      } catch (geofenceErr) {
        // Non-critical — never block the release
        console.error('[Geofence] Failed to create geofence zone:', geofenceErr);
      }
    }

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

    // Deactivate the booking's geofence zone on return
    await prisma.geofenceZone.updateMany({
      where: {
        OR: [
          { bookingId: booking.id },
          { vehicleId: booking.vehicleId }
        ],
        isActive: true
      },
      data: { isActive: false },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { geofenceEndedAt: new Date() },
    });

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
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: { vehicle: true }
    });

    // Deactivate the booking's geofence zone on completion
    await prisma.geofenceZone.updateMany({
      where: {
        OR: [
          { bookingId: booking.id },
          { vehicleId: booking.vehicleId }
        ],
        isActive: true
      },
      data: { isActive: false },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { geofenceEndedAt: new Date() },
    });

    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: 'AVAILABLE' }
    });

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

// Admin: Backfill / re-center geofence zones for active bookings
// Deletes any existing zones for active bookings and recreates them with the
// correct shop-centered, distance-based radius.
router.post('/backfill-geofences', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  try {
    // 1. Delete existing zones for active bookings (old destination-centered zones)
    await prisma.geofenceZone.deleteMany({
      where: { booking: { status: 'ACTIVE' } },
    });

    // 2. Reset geofence fields on all active bookings
    await prisma.booking.updateMany({
      where: { status: 'ACTIVE' },
      data: { approvedGeofenceZoneId: null, geofenceActivatedAt: null },
    });

    // 3. Fetch active bookings that have a destination set
    const activeBookings = await prisma.booking.findMany({
      where: { status: 'ACTIVE', destinationName: { not: null } },
    });

    const shopCenter = await getShopCenterFromSettings();

    const results: Array<{
      bookingId: string;
      destination: string;
      status: string;
      radiusKm?: number;
      distanceKm?: number;
      reason?: string;
    }> = [];

    for (const booking of activeBookings) {
      try {
        const geo = computeGeofence(booking.destinationName!, shopCenter);
        if (!geo) {
          results.push({ bookingId: booking.id, destination: booking.destinationName!, status: 'skipped', reason: 'No coordinates' });
          continue;
        }

        const polygon = generateCirclePolygon(geo.centerLat, geo.centerLng, geo.radiusKm);

        const zone = await prisma.geofenceZone.create({
          data: {
            bookingId: booking.id,
            vehicleId: booking.vehicleId,
            name: booking.destinationName!,
            centerLatitude: geo.centerLat,
            centerLongitude: geo.centerLng,
            radiusKm: geo.radiusKm,
            polygonCoordinates: JSON.stringify(polygon),
            isActive: true,
            activatedAt: new Date(),
          },
        });

        await prisma.booking.update({
          where: { id: booking.id },
          data: { approvedGeofenceZoneId: zone.id, geofenceActivatedAt: new Date() },
        });

        const destCoords = getMunicipalityCoords(booking.destinationName!)!;
        const distanceKm = getDistanceKm(
          geo.centerLat, geo.centerLng,
          destCoords.lat, destCoords.lng
        );

        console.log(`[Backfill] ${booking.destinationName}: dist=${distanceKm.toFixed(1)}km radius=${geo.radiusKm}km`);
        results.push({ bookingId: booking.id, destination: booking.destinationName!, status: 'created', radiusKm: geo.radiusKm, distanceKm: Math.round(distanceKm * 10) / 10 });
      } catch (err: any) {
        console.error(`[Backfill] Failed for booking ${booking.id}:`, err.message);
        results.push({ bookingId: booking.id, destination: booking.destinationName!, status: 'error', reason: err.message });
      }
    }

    return res.json({ processed: activeBookings.length, results });
  } catch (err) {
    return res.status(500).json({ error: 'Backfill failed' });
  }
});

export default router;
