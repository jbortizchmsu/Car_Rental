import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { io } from '../index';
import { createNotification } from '../lib/notifications';
import { runGeofenceCheck } from '../lib/geofence-check';

const router = Router();

const MAX_BATCH_SIZE = 500;
// Queued points on an already-returned/completed booking are still saved (for
// historical trail completeness) as long as they were recorded within this many hours
// of the booking's returnedAt — a device that was offline for a very long time
// shouldn't be able to inject arbitrarily old, unverifiable location history.
const RETURNED_BOOKING_GRACE_HOURS = 48;

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

    // 4. Geofence Check — shared with the batch endpoint, see lib/geofence-check.ts
    await runGeofenceCheck({
      booking,
      bookingId,
      vehicleId,
      trackingSessionId,
      latitude,
      longitude,
    });

    res.status(201).json(location);
  } catch (error) {
    console.error('GPS Record Error:', error);
    res.status(500).json({ error: 'Failed to record location' });
  }
});

interface BatchGpsPoint {
  trackingSessionId?: string;
  bookingId?: string;
  vehicleId?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt?: string;
}

interface RejectedPoint {
  point: BatchGpsPoint;
  reason: string;
}

// Mobile: Batch-upload GPS points queued locally while offline. Reuses the exact same
// per-point save + geofence-check logic as POST /location (via runGeofenceCheck) — the
// only new behavior here is: accepting many points at once, processing them in
// chronological order (not array order, since alert dedup correctness depends on
// evaluating points in the order they actually happened), and tolerating a booking
// that's no longer ACTIVE by the time a delayed point finally arrives.
router.post('/location/batch', authenticate, async (req: AuthRequest, res) => {
  const { points } = req.body as { points?: BatchGpsPoint[] };

  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: 'points must be a non-empty array' });
  }
  if (points.length > MAX_BATCH_SIZE) {
    return res.status(400).json({ error: `Batch too large — maximum ${MAX_BATCH_SIZE} points per request` });
  }

  const rejected: RejectedPoint[] = [];
  let saved = 0;

  try {
    // Sort ascending by recordedAt — do not trust array order. A point with a
    // missing/unparseable recordedAt is treated as invalid below, not sorted at all.
    const sorted = [...points].sort((a, b) => {
      const ta = a.recordedAt ? Date.parse(a.recordedAt) : NaN;
      const tb = b.recordedAt ? Date.parse(b.recordedAt) : NaN;
      return (isNaN(ta) ? 0 : ta) - (isNaN(tb) ? 0 : tb);
    });

    // Memoize booking lookups — in practice a single offline period produces points
    // for exactly one booking, but points are validated independently regardless.
    type BookingWithRelations = Prisma.BookingGetPayload<{ include: { trackingSession: true; vehicle: true } }>;
    const bookingCache = new Map<string, BookingWithRelations | null>();

    for (const point of sorted) {
      const { trackingSessionId, bookingId, vehicleId, latitude, longitude, speed, heading, accuracy, recordedAt } = point;

      if (!trackingSessionId || !bookingId || !vehicleId || typeof latitude !== 'number' || typeof longitude !== 'number' || !recordedAt || isNaN(Date.parse(recordedAt))) {
        rejected.push({ point, reason: 'Malformed point — missing or invalid required field' });
        continue;
      }

      try {
        let booking = bookingCache.get(bookingId);
        if (booking === undefined) {
          booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { trackingSession: true, vehicle: true }
          });
          bookingCache.set(bookingId, booking);
        }

        if (!booking || booking.customerId !== req.user!.id) {
          rejected.push({ point, reason: 'Booking not found or not owned by this user' });
          continue;
        }

        const recordedAtDate = new Date(recordedAt);
        let skipGeofenceCheck = false;

        if (booking.status === 'ACTIVE' && booking.trackingSession?.isActive) {
          // Normal case — identical to the single-point endpoint's own gate.
        } else if (booking.returnedAt) {
          // A legitimate backfilled point is normally recorded BEFORE returnedAt (the
          // device was offline in the run-up to drop-off) — that difference is
          // negative under (recordedAt - returnedAt), which is why this compares the
          // absolute difference, not a one-sided one. Anything more than the grace
          // window away from the return moment, in either direction, is too stale/
          // implausible to trust as this booking's real trail data.
          const hoursFromReturn = Math.abs(recordedAtDate.getTime() - booking.returnedAt.getTime()) / (1000 * 60 * 60);
          if (hoursFromReturn > RETURNED_BOOKING_GRACE_HOURS) {
            rejected.push({ point, reason: `Booking already returned — point outside the ${RETURNED_BOOKING_GRACE_HOURS}-hour grace window` });
            continue;
          }
          // Within the grace window: save for historical trail completeness, but an
          // already-returned vehicle shouldn't generate breach/arrival alerts.
          skipGeofenceCheck = true;
        } else {
          rejected.push({ point, reason: `Tracking is not active for this booking (status: ${booking.status})` });
          continue;
        }

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
            recordedAt: recordedAtDate
          }
        });

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

        if (!skipGeofenceCheck) {
          await runGeofenceCheck({
            booking,
            bookingId,
            vehicleId,
            trackingSessionId,
            latitude,
            longitude,
          });
        }

        saved++;
      } catch (pointErr) {
        console.error('[GPS Batch] Failed to process point:', pointErr);
        rejected.push({ point, reason: 'Internal error while processing this point' });
      }
    }

    res.status(201).json({ saved, rejected });
  } catch (error) {
    console.error('GPS Batch Record Error:', error);
    res.status(500).json({ error: 'Failed to record batch' });
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

  // polygonCoordinates arrives as a real array (the frontend already JSON.parse()s its
  // textarea before calling this) — the schema column is a JSON-stringified String, so
  // this must be validated and stringified here, not passed through as-is (passing a
  // raw array straight to Prisma's String field fails at the DB layer).
  if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length < 3) {
    return res.status(400).json({ error: 'polygonCoordinates must be an array of at least 3 {lat,lng} points.' });
  }

  try {
    const zone = await prisma.geofenceZone.create({
      data: {
        name,
        vehicleId: vehicleId || null,
        polygonCoordinates: JSON.stringify(polygonCoordinates),
        isActive: isActive !== undefined ? isActive : true
      }
    });
    res.json(zone);
  } catch (error) {
    console.error('[Geofence] Failed to create zone:', error);
    res.status(500).json({ error: 'Failed to create geofence' });
  }
});

// Admin: Update Geofence Zone (name/vehicleId/polygonCoordinates) — deliberately never
// touches destinationName, so editing one of the 56 destination-template zones (e.g.
// to refine its imported polygon) can never accidentally null it out and orphan the
// zone from the release-time destination lookup.
router.put('/geofences/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { name, vehicleId, polygonCoordinates } = req.body;

  if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length < 3) {
    return res.status(400).json({ error: 'polygonCoordinates must be an array of at least 3 {lat,lng} points.' });
  }

  try {
    const zone = await prisma.geofenceZone.update({
      where: { id: req.params.id },
      data: {
        name,
        vehicleId: vehicleId || null,
        polygonCoordinates: JSON.stringify(polygonCoordinates),
      }
    });
    res.json(zone);
  } catch (error) {
    console.error('[Geofence] Failed to update zone:', error);
    res.status(500).json({ error: 'Failed to update geofence' });
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
          // bookingId: null also matches the 56 inert destination-template rows
          // (scripts/import-destination-geofences.ts) — those exist only to be looked
          // up and cloned at release time, never to be displayed on their own, so
          // exclude any row that also has destinationName set. A genuine pre-existing
          // global zone (created via AdminGeofencePage.tsx, which never sets
          // destinationName) still matches and still displays as before.
          { bookingId: null, destinationName: null }
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
