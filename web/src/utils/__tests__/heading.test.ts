import { describe, test, expect } from 'vitest';
import { calculateBearing, distanceMeters, shortestRotationTarget, isValidReportedHeading, MIN_MOVEMENT_METERS } from '../heading';

describe('calculateBearing', () => {
  // A reference point near the equator/prime meridian so 1 degree of lat/lng is a
  // clean, easy-to-reason-about distance in roughly the cardinal directions.
  const ORIGIN = { lat: 0, lon: 0 };

  test('due north', () => {
    expect(calculateBearing(ORIGIN.lat, ORIGIN.lon, ORIGIN.lat + 1, ORIGIN.lon)).toBeCloseTo(0, 0);
  });

  test('due east', () => {
    expect(calculateBearing(ORIGIN.lat, ORIGIN.lon, ORIGIN.lat, ORIGIN.lon + 1)).toBeCloseTo(90, 0);
  });

  test('due south', () => {
    expect(calculateBearing(ORIGIN.lat, ORIGIN.lon, ORIGIN.lat - 1, ORIGIN.lon)).toBeCloseTo(180, 0);
  });

  test('due west', () => {
    expect(calculateBearing(ORIGIN.lat, ORIGIN.lon, ORIGIN.lat, ORIGIN.lon - 1)).toBeCloseTo(270, 0);
  });

  test('always returns a value in [0, 360)', () => {
    const bearing = calculateBearing(10.7391, 122.9691, 9.3068, 123.3054);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });

  test('identical points do not throw and return a finite number', () => {
    const bearing = calculateBearing(10.7391, 122.9691, 10.7391, 122.9691);
    expect(Number.isFinite(bearing)).toBe(true);
  });
});

describe('distanceMeters', () => {
  test('identical points → 0', () => {
    expect(distanceMeters(10.7391, 122.9691, 10.7391, 122.9691)).toBe(0);
  });

  test('a known ~1 degree of latitude is roughly 111km', () => {
    const d = distanceMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  test('a tiny movement (a few meters) is small and below the movement threshold', () => {
    // ~0.00003 degrees of latitude is roughly 3-4 meters.
    const d = distanceMeters(10.7391, 122.9691, 10.73913, 122.9691);
    expect(d).toBeLessThan(MIN_MOVEMENT_METERS);
  });
});

describe('shortestRotationTarget', () => {
  test('350 -> 10 turns +20 degrees (not -340)', () => {
    const target = shortestRotationTarget(350, 10);
    expect(target - 350).toBeCloseTo(20, 5);
  });

  test('10 -> 350 turns -20 degrees (not +340)', () => {
    const target = shortestRotationTarget(10, 350);
    expect(target - 10).toBeCloseTo(-20, 5);
  });

  test('north (0) -> east (90) turns +90', () => {
    expect(shortestRotationTarget(0, 90) - 0).toBeCloseTo(90, 5);
  });

  test('east (90) -> south (180) turns +90', () => {
    expect(shortestRotationTarget(90, 180) - 90).toBeCloseTo(90, 5);
  });

  test('south (180) -> west (270) turns +90', () => {
    expect(shortestRotationTarget(180, 270) - 180).toBeCloseTo(90, 5);
  });

  test('west (270) -> north (0, i.e. 360) turns +90, not -270', () => {
    const target = shortestRotationTarget(270, 0);
    expect(target - 270).toBeCloseTo(90, 5);
  });

  test('identical heading -> zero-degree turn', () => {
    expect(shortestRotationTarget(123, 123)).toBeCloseTo(123, 5);
  });

  test('exactly 180 degrees apart resolves to a consistent (not undefined) direction', () => {
    const target = shortestRotationTarget(0, 180);
    expect(Math.abs(target - 0)).toBeCloseTo(180, 5);
  });

  test('continuous input outside [0,360) is still handled (e.g. animating from a previous 370)', () => {
    const target = shortestRotationTarget(370, 350);
    // 370 is equivalent to 10; the shortest turn from 10 to 350 is -20, so target = 370 - 20 = 350.
    expect(target).toBeCloseTo(350, 5);
  });
});

describe('isValidReportedHeading', () => {
  test('a normal numeric heading is valid', () => {
    expect(isValidReportedHeading(45)).toBe(true);
    expect(isValidReportedHeading(0)).toBe(true);
    expect(isValidReportedHeading(359.9)).toBe(true);
  });

  test('-1 (the common "no heading" GPS sentinel) is not valid', () => {
    expect(isValidReportedHeading(-1)).toBe(false);
  });

  test('null/undefined are not valid', () => {
    expect(isValidReportedHeading(null)).toBe(false);
    expect(isValidReportedHeading(undefined)).toBe(false);
  });

  test('NaN and non-numeric values are not valid', () => {
    expect(isValidReportedHeading(NaN)).toBe(false);
    expect(isValidReportedHeading('45')).toBe(false);
  });
});
