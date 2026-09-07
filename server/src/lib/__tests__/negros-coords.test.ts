import {
  computeGeofence,
  isPointInCircle,
  SHOP_LOCATION,
  NEGROS_MUNICIPALITY_COORDS,
} from '../negros-coords';

describe('computeGeofence', () => {
  test('returns null when destination name is not in NEGROS_MUNICIPALITY_COORDS', () => {
    const result = computeGeofence('Atlantis');
    expect(result).toBeNull();
  });

  test('uses a valid shopCenter argument instead of the default SHOP_LOCATION', () => {
    const customShopCenter = { lat: 9.3068, lng: 123.3054 }; // Dumaguete, used only as a stand-in custom center
    const result = computeGeofence('Bacolod', customShopCenter);

    expect(result).not.toBeNull();
    expect(result!.centerLat).toBe(customShopCenter.lat);
    expect(result!.centerLng).toBe(customShopCenter.lng);
  });

  test('falls back to default SHOP_LOCATION when shopCenter has NaN lat/lng', () => {
    const invalidShopCenter = { lat: NaN, lng: NaN };
    const result = computeGeofence('Bacolod', invalidShopCenter);

    expect(result).not.toBeNull();
    expect(result!.centerLat).toBe(SHOP_LOCATION.lat);
    expect(result!.centerLng).toBe(SHOP_LOCATION.lng);
  });

  test('radius floors at GEOFENCE_BUFFER_KM (20) when destination is essentially at the shop location', () => {
    // Talisay's coordinates in NEGROS_MUNICIPALITY_COORDS are identical to SHOP_LOCATION,
    // so distance is 0 and the radius should floor at the 20km buffer.
    const result = computeGeofence('Talisay');

    expect(result).not.toBeNull();
    expect(NEGROS_MUNICIPALITY_COORDS['Talisay']).toEqual({ lat: SHOP_LOCATION.lat, lng: SHOP_LOCATION.lng });
    expect(result!.radiusKm).toBe(20);
  });

  test('radius grows correctly with distance — a far municipality yields a meaningfully larger radius than a near one', () => {
    const nearResult = computeGeofence('Bacolod'); // ~7.2km from shop
    const farResult = computeGeofence('Dumaguete'); // ~163km from shop

    expect(nearResult).not.toBeNull();
    expect(farResult).not.toBeNull();

    // Near: distance ~7.24km -> ceil(7.24 + 20) = 28
    expect(nearResult!.radiusKm).toBe(28);
    // Far: distance ~163.47km -> ceil(163.47 + 20) = 184
    expect(farResult!.radiusKm).toBe(184);

    expect(farResult!.radiusKm).toBeGreaterThan(nearResult!.radiusKm);
  });
});

describe('isPointInCircle', () => {
  const center = { lat: SHOP_LOCATION.lat, lng: SHOP_LOCATION.lng };

  test('point exactly at the center is inside the circle', () => {
    expect(isPointInCircle(center.lat, center.lng, center.lat, center.lng, 5)).toBe(true);
  });

  test('point just inside the radius boundary is inside the circle', () => {
    // ~1.0008km north of center; radius 1.5km comfortably contains it
    const point = { lat: 10.7481, lng: 122.9691 };
    expect(isPointInCircle(point.lat, point.lng, center.lat, center.lng, 1.5)).toBe(true);
  });

  test('point just outside the radius boundary is outside the circle', () => {
    // Same ~1.0008km-away point, but radius shrunk below that distance
    const point = { lat: 10.7481, lng: 122.9691 };
    expect(isPointInCircle(point.lat, point.lng, center.lat, center.lng, 0.5)).toBe(false);
  });

  test('point far outside the circle returns false', () => {
    // Dumaguete is ~163km from the shop location — far outside a 20km radius
    const dumaguete = NEGROS_MUNICIPALITY_COORDS['Dumaguete'];
    expect(isPointInCircle(dumaguete.lat, dumaguete.lng, center.lat, center.lng, 20)).toBe(false);
  });
});
