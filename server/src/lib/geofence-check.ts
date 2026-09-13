import { prisma } from './prisma';
import { io } from '../index';
import { createAdminNotification } from './notifications';
import { isPointInCircle, isPointInPolygon } from './negros-coords';

interface GeofenceCheckBooking {
  id: string;
  geofenceActivatedAt: Date | null;
  geofenceEndedAt: Date | null;
  destinationName: string | null;
  vehicle: { brand: string; model: string; licensePlate: string };
}

interface GeofenceCheckParams {
  booking: GeofenceCheckBooking;
  bookingId: string;
  vehicleId: string;
  trackingSessionId: string;
  latitude: number;
  longitude: number;
}

/**
 * Shared geofence breach/arrival check — extracted unchanged from gps.ts's original
 * single-point POST /location handler so both that endpoint and the new batch endpoint
 * (POST /location/batch) run byte-identical logic. Never called for a point whose
 * booking isn't in the geofence-active window, or that the caller has decided should
 * skip alerting (e.g. a backdated point on an already-returned booking) — that decision
 * is made by the caller, not here.
 */
export async function runGeofenceCheck({
  booking,
  bookingId,
  vehicleId,
  trackingSessionId,
  latitude,
  longitude,
}: GeofenceCheckParams): Promise<void> {
  if (!booking.geofenceActivatedAt || booking.geofenceEndedAt) return;

  const zones = await prisma.geofenceZone.findMany({
    where: {
      isActive: true,
      OR: [
        { bookingId: booking.id },
        { vehicleId, bookingId: null },
      ]
    }
  });

  // Check if vehicle is outside ALL active geofence zones (circle OR polygon — being
  // inside either one counts as "fine", only failing every zone is a breach). A
  // booking released to a destination with a template has BOTH a circle (enforcement)
  // and a polygon (the real destination shape) zone, so we deliberately do NOT break
  // on the first match — every zone is checked, both to confirm the OR-across-zones
  // result and to detect a polygon-specific "arrived at destination" match below.
  let isOutsideAllZones = zones.length > 0;
  let arrivedZone: typeof zones[number] | null = null;
  for (const zone of zones) {
    if (zone.centerLatitude !== null && zone.centerLongitude !== null && zone.radiusKm !== null) {
      // Circle-based check (used for auto-created zones)
      if (isPointInCircle(latitude, longitude, zone.centerLatitude, zone.centerLongitude, zone.radiusKm)) {
        isOutsideAllZones = false;
      }
    } else {
      // Polygon-based zones (no center/radius): real point-in-polygon containment check.
      let polygon: Array<{ lat: number; lng: number }> | null = null;
      try {
        const parsed = zone.polygonCoordinates ? JSON.parse(zone.polygonCoordinates) : null;
        polygon = Array.isArray(parsed) ? parsed : null;
      } catch (parseErr) {
        console.error(`[Geofence] Failed to parse polygonCoordinates for zone ${zone.id}:`, parseErr);
      }

      // A zone we can't validate (malformed JSON, or fewer than 3 points) can't prove
      // the vehicle is safe — err toward treating it as a potential breach rather than
      // silently defaulting to "safe".
      if (polygon && isPointInPolygon(latitude, longitude, polygon)) {
        isOutsideAllZones = false;
        arrivedZone = zone;
      }
    }
  }

  // "Arrived at destination" — fires once per booking, the first time a ping lands
  // inside the destination POLYGON specifically (not the circle). Reuses the existing
  // GeofenceAlert table (no schema change) as "already notified" tracking: a distinct
  // alertType, created resolved:true so it never shows up as an outstanding item in
  // the admin alerts list or the /live red-marker check (both only look at
  // resolved: false). The existence check has no `resolved` filter, so the very first
  // arrival record permanently satisfies it — re-entering later does NOT re-trigger.
  if (arrivedZone) {
    const existingArrival = await prisma.geofenceAlert.findFirst({
      where: { bookingId, alertType: 'ARRIVED_AT_DESTINATION' }
    });

    if (!existingArrival) {
      const arrivalAlert = await prisma.geofenceAlert.create({
        data: {
          bookingId,
          vehicleId,
          trackingSessionId,
          geofenceZoneId: arrivedZone.id,
          message: `Vehicle ${booking.vehicle.licensePlate} has arrived at ${booking.destinationName || 'the destination'}.`,
          latitude,
          longitude,
          alertType: 'ARRIVED_AT_DESTINATION',
          severity: 'INFO',
          resolved: true
        }
      });

      await createAdminNotification(
        'Vehicle Arrived at Destination',
        `${booking.vehicle.brand} ${booking.vehicle.model} (${booking.vehicle.licensePlate}) has arrived at ${booking.destinationName || 'the destination'}.`
      );

      io.emit('geofence-alert-created', arrivalAlert);
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
