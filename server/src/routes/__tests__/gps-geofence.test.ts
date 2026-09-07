import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// gps.ts imports `{ io } from '../index'` directly (for its own io.emit calls), and
// lib/notifications.ts separately imports `{ io } from '../index'` too. index.ts has real
// side effects at import time (live HTTP server, Socket.IO, background setInterval jobs,
// Supabase calls), so both this and lib/notifications are mocked via explicit factories —
// Jest resolves both '../index' (from lib/) and '../../index' (from this test file) to the
// same absolute module path, so this one mock covers gps.ts's direct usage; lib/notifications
// is mocked separately below purely so its exports are easy jest.fn()s to assert against.
jest.mock('../../index', () => ({
  __esModule: true,
  io: { emit: jest.fn() },
}));

jest.mock('../../lib/notifications', () => ({
  __esModule: true,
  createNotification: jest.fn().mockResolvedValue(undefined),
  createAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../lib/prisma';
import { io } from '../../index';
import { createAdminNotification } from '../../lib/notifications';
import { JWT_SECRET } from '../../lib/config';
import gpsRouter from '../gps';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const ioEmitMock = io.emit as jest.Mock;
const createAdminNotificationMock = createAdminNotification as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/gps', gpsRouter);

const CUSTOMER_USER = { id: 'cust-1', email: 'jane@example.com', role: 'customer', fullName: 'Jane Dela Cruz', isActive: true };
const customerToken = jwt.sign({ id: CUSTOMER_USER.id }, JWT_SECRET, { expiresIn: '1h' });

// SHOP_LOCATION / Talisay coordinates from negros-coords.ts, reused here as a real, known
// "inside the zone" reference point — and Dumaguete's real coordinates (~163km away) as a
// known, genuinely-outside-any-20km-zone reference point.
const INSIDE_POINT = { lat: 10.7391, lng: 122.9691 }; // Talisay / SHOP_LOCATION
const FAR_OUTSIDE_POINT = { lat: 9.3068, lng: 123.3054 }; // Dumaguete

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    status: 'ACTIVE',
    trackingSession: { isActive: true },
    geofenceActivatedAt: new Date(),
    geofenceEndedAt: null,
    destinationName: 'Bacolod',
    vehicle: { brand: 'Toyota', model: 'Vios', licensePlate: 'ABC-1234' },
    customer: { fullName: 'Jane Dela Cruz' },
    ...overrides,
  } as any;
}

function makeCircleZone(overrides: Record<string, any> = {}) {
  return {
    id: 'zone-1',
    bookingId: 'booking-1',
    vehicleId: 'veh-1',
    centerLatitude: INSIDE_POINT.lat,
    centerLongitude: INSIDE_POINT.lng,
    radiusKm: 20,
    ...overrides,
  } as any;
}

function locationRequest(point: { lat: number; lng: number }, overrides: Record<string, any> = {}) {
  return request(app)
    .post('/api/gps/location')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      trackingSessionId: 'session-1',
      bookingId: 'booking-1',
      vehicleId: 'veh-1',
      latitude: point.lat,
      longitude: point.lng,
      speed: 40,
      heading: 90,
      accuracy: 5,
      ...overrides,
    });
}

beforeEach(() => {
  mockReset(prismaMock);
  ioEmitMock.mockClear();
  createAdminNotificationMock.mockClear();
  prismaMock.vehicleLocation.create.mockResolvedValue({ id: 'loc-1', recordedAt: new Date('2026-01-01T00:00:00Z') } as any);
  // authenticate middleware re-fetches the user from the DB on every request.
  prismaMock.user.findUnique.mockResolvedValue(CUSTOMER_USER as any);
});

describe('POST /api/gps/location — geofence-breach alerting block', () => {
  test('geofence check skipped when geofenceActivatedAt is not set (tracking active, but geofencing itself never armed) — location still saved, 201', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking({ geofenceActivatedAt: null }));

    const res = await locationRequest(FAR_OUTSIDE_POINT);

    expect(res.status).toBe(201);
    expect(prismaMock.geofenceZone.findMany).not.toHaveBeenCalled();
    expect(prismaMock.geofenceAlert.findFirst).not.toHaveBeenCalled();
    expect(createAdminNotificationMock).not.toHaveBeenCalled();
    // Location save + the plain location-update emit still happen regardless of geofencing.
    expect(prismaMock.vehicleLocation.create).toHaveBeenCalledTimes(1);
    expect(ioEmitMock).toHaveBeenCalledTimes(1);
    expect(ioEmitMock).toHaveBeenCalledWith('vehicle-location-updated', expect.objectContaining({ bookingId: 'booking-1' }));
  });

  test('geofence check also skipped when geofenceEndedAt is already set (tracking ended)', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBooking({ geofenceActivatedAt: new Date(), geofenceEndedAt: new Date() })
    );

    const res = await locationRequest(FAR_OUTSIDE_POINT);

    expect(res.status).toBe(201);
    expect(prismaMock.geofenceZone.findMany).not.toHaveBeenCalled();
  });

  test('point inside a CIRCLE-type zone → no breach, no alert', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    prismaMock.geofenceZone.findMany.mockResolvedValue([makeCircleZone()]);

    const res = await locationRequest(INSIDE_POINT);

    expect(res.status).toBe(201);
    expect(prismaMock.geofenceAlert.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.geofenceAlert.create).not.toHaveBeenCalled();
    expect(createAdminNotificationMock).not.toHaveBeenCalled();
    expect(ioEmitMock).not.toHaveBeenCalledWith('geofence-alert-created', expect.anything());
  });

  test('point outside a CIRCLE-type zone (genuine breach) → alert created, io.emit and createAdminNotification called', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    prismaMock.geofenceZone.findMany.mockResolvedValue([makeCircleZone()]);
    prismaMock.geofenceAlert.findFirst.mockResolvedValue(null); // no existing unresolved alert
    const createdAlert = { id: 'alert-1', bookingId: 'booking-1', alertType: 'OUT_OF_ZONE' };
    prismaMock.geofenceAlert.create.mockResolvedValue(createdAlert as any);

    const res = await locationRequest(FAR_OUTSIDE_POINT);

    expect(res.status).toBe(201);
    expect(prismaMock.geofenceAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          alertType: 'OUT_OF_ZONE',
          severity: 'CRITICAL',
          message: expect.stringContaining('Toyota Vios is outside the allowed zone (Dest: Bacolod)'),
        }),
      })
    );
    expect(createAdminNotificationMock).toHaveBeenCalledWith(
      'Geofence Breach',
      expect.stringContaining('Toyota (ABC-1234) is outside the allowed area near Bacolod')
    );
    expect(ioEmitMock).toHaveBeenCalledWith('geofence-alert-created', createdAlert);
  });

  test('POLYGON-type zone (no center coordinates): point genuinely inside the polygon → no breach, no alert', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    prismaMock.geofenceZone.findMany.mockResolvedValue([
      {
        id: 'zone-poly-1',
        bookingId: 'booking-1',
        vehicleId: 'veh-1',
        centerLatitude: null,
        centerLongitude: null,
        radiusKm: null,
        // Small square polygon in Bacolod, using the real {lat, lng} object shape POST
        // /geofences and generateCirclePolygon() both actually produce.
        polygonCoordinates: JSON.stringify([
          { lat: 10.68, lng: 122.95 },
          { lat: 10.68, lng: 122.96 },
          { lat: 10.67, lng: 122.96 },
          { lat: 10.67, lng: 122.95 },
        ]),
      } as any,
    ]);

    // Point comfortably inside the square above.
    const res = await locationRequest({ lat: 10.675, lng: 122.955 });

    expect(res.status).toBe(201);
    expect(prismaMock.geofenceAlert.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.geofenceAlert.create).not.toHaveBeenCalled();
    expect(createAdminNotificationMock).not.toHaveBeenCalled();
  });

  test('multiple zones: point outside the first zone but inside a second zone → still no breach (loop checks all zones, not just the first)', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    const farZone = makeCircleZone({ id: 'zone-far', centerLatitude: 50, centerLongitude: 50, radiusKm: 5 }); // point won't be inside this one
    const containingZone = makeCircleZone({ id: 'zone-containing' }); // centered on INSIDE_POINT
    prismaMock.geofenceZone.findMany.mockResolvedValue([farZone, containingZone]);

    const res = await locationRequest(INSIDE_POINT);

    expect(res.status).toBe(201);
    expect(prismaMock.geofenceAlert.findFirst).not.toHaveBeenCalled();
    expect(createAdminNotificationMock).not.toHaveBeenCalled();
  });

  test('DEDUP: an already-unresolved alert for this booking suppresses a duplicate alert on a repeat breach', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    prismaMock.geofenceZone.findMany.mockResolvedValue([makeCircleZone()]);
    prismaMock.geofenceAlert.findFirst.mockResolvedValue({ id: 'existing-alert', resolved: false } as any);

    const res = await locationRequest(FAR_OUTSIDE_POINT);

    expect(res.status).toBe(201);
    expect(prismaMock.geofenceAlert.create).not.toHaveBeenCalled();
    expect(createAdminNotificationMock).not.toHaveBeenCalled();
    expect(ioEmitMock).not.toHaveBeenCalledWith('geofence-alert-created', expect.anything());
    // Only the plain location-update emit fires — the duplicate breach is silently suppressed.
    expect(ioEmitMock).toHaveBeenCalledTimes(1);
  });

  test('a previously-breaching vehicle reporting a position back inside the zone → stays silent, no dedup check even performed', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    prismaMock.geofenceZone.findMany.mockResolvedValue([makeCircleZone()]);

    const res = await locationRequest(INSIDE_POINT);

    expect(res.status).toBe(201);
    // Confirmed against the actual code: there is no session/history-aware "was breaching"
    // state. Each request is evaluated independently on the CURRENT point only — once the
    // point is inside a zone, the entire alert block (including the dedup lookup itself) is
    // skipped entirely. Nothing resolves or clears any prior unresolved alert automatically;
    // that would require a separate admin action via POST /alerts/:id/resolve.
    expect(prismaMock.geofenceAlert.findFirst).not.toHaveBeenCalled();
    expect(createAdminNotificationMock).not.toHaveBeenCalled();
  });

  test('SUSPECTED SAFETY GAP: polygon-only zone (no center/radius) — vehicle dramatically outside it should still be detected as a breach', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBooking());
    // Matches exactly what POST /geofences actually produces: only polygonCoordinates set,
    // no centerLatitude/centerLongitude/radiusKm. This polygon describes a small area in
    // Bacolod (Negros Occidental, Philippines).
    prismaMock.geofenceZone.findMany.mockResolvedValue([
      {
        id: 'zone-poly-real',
        bookingId: 'booking-1',
        vehicleId: 'veh-1',
        centerLatitude: null,
        centerLongitude: null,
        radiusKm: null,
        polygonCoordinates: JSON.stringify([
          { lat: 10.68, lng: 122.95 },
          { lat: 10.68, lng: 122.96 },
          { lat: 10.67, lng: 122.96 },
          { lat: 10.67, lng: 122.95 },
        ]),
      } as any,
    ]);
    prismaMock.geofenceAlert.findFirst.mockResolvedValue(null);
    const createdAlert = { id: 'alert-safety-gap', bookingId: 'booking-1', alertType: 'OUT_OF_ZONE' };
    prismaMock.geofenceAlert.create.mockResolvedValue(createdAlert as any);

    // Tokyo, Japan — unambiguously, dramatically outside a small polygon in Bacolod,
    // Philippines (thousands of km away, not a boundary edge case).
    const DRAMATICALLY_OUTSIDE_POINT = { lat: 35.6762, lng: 139.6503 };

    const res = await locationRequest(DRAMATICALLY_OUTSIDE_POINT);

    expect(res.status).toBe(201);

    // Intended/expected behavior: a vehicle this far outside the polygon must be detected
    // as a breach — an alert should be created and broadcast, and admins notified.
    expect(prismaMock.geofenceAlert.create).toHaveBeenCalled();
    expect(createAdminNotificationMock).toHaveBeenCalled();
    expect(ioEmitMock).toHaveBeenCalledWith('geofence-alert-created', expect.anything());
  });
});
