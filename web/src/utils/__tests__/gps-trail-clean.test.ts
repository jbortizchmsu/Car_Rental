import { describe, test, expect } from 'vitest';
import {
  cleanTrackPoints,
  flattenCleanedSegments,
  MAX_ACCURACY_METERS,
  MIN_TRAIL_POINT_DISTANCE_METERS,
  TRAIL_GAP_SPLIT_MS,
} from '../gps-trail';
import type { RawGpsPoint } from '../gps-trail';

// Near the equator so small degree deltas map to easy-to-reason-about meter distances
// (~111,320 m per degree of latitude).
const BASE_LAT = 0;
const BASE_LNG = 0;
const T0 = new Date('2026-01-01T00:00:00.000Z').getTime();

function point(overrides: Partial<RawGpsPoint> & { tOffsetMs?: number } = {}): RawGpsPoint {
  const { tOffsetMs = 0, ...rest } = overrides;
  return {
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    recordedAt: new Date(T0 + tOffsetMs).toISOString(),
    ...rest,
  };
}

/** Roughly `meters` north of BASE_LAT (111,320 m per degree of latitude at the equator). */
function latOffsetForMeters(meters: number): number {
  return meters / 111320;
}

describe('cleanTrackPoints — empty/single-point inputs', () => {
  test('empty array → no segments', () => {
    expect(cleanTrackPoints([])).toEqual([]);
  });

  test('null/undefined → no segments, does not throw', () => {
    expect(cleanTrackPoints(null)).toEqual([]);
    expect(cleanTrackPoints(undefined)).toEqual([]);
  });

  test('a single valid point → one segment containing that one point', () => {
    const result = cleanTrackPoints([point()]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0]).toMatchObject({ lat: BASE_LAT, lng: BASE_LNG });
  });

  test('all points filtered out (e.g. every point has bad accuracy) → no segments', () => {
    const result = cleanTrackPoints([
      point({ accuracy: MAX_ACCURACY_METERS + 1, tOffsetMs: 0 }),
      point({ accuracy: MAX_ACCURACY_METERS + 50, tOffsetMs: 15000 }),
    ]);
    expect(result).toEqual([]);
  });
});

describe('cleanTrackPoints — sorting and duplicates', () => {
  test('out-of-order points are returned in chronological order', () => {
    const p1 = point({ latitude: 0, tOffsetMs: 0 });
    const p2 = point({ latitude: latOffsetForMeters(100), tOffsetMs: 15000 });
    const p3 = point({ latitude: latOffsetForMeters(200), tOffsetMs: 30000 });

    const result = flattenCleanedSegments(cleanTrackPoints([p3, p1, p2]));

    expect(result.map((p) => p.recordedAt)).toEqual([p1.recordedAt, p2.recordedAt, p3.recordedAt]);
  });

  test('an exact duplicate point (same coordinates and timestamp) is removed', () => {
    const p1 = point({ tOffsetMs: 0 });
    const duplicate = point({ tOffsetMs: 0 }); // identical lat/lng/recordedAt

    const result = cleanTrackPoints([p1, duplicate]);

    expect(flattenCleanedSegments(result)).toHaveLength(1);
  });

  test('duplicated + out-of-order points together do not flip ordering or double-count', () => {
    const p1 = point({ latitude: 0, tOffsetMs: 0 });
    const p2 = point({ latitude: latOffsetForMeters(100), tOffsetMs: 15000 });

    const result = flattenCleanedSegments(cleanTrackPoints([p2, p1, p1, p2]));

    expect(result).toHaveLength(2);
    expect(result[0].recordedAt).toBe(p1.recordedAt);
    expect(result[1].recordedAt).toBe(p2.recordedAt);
  });
});

describe('cleanTrackPoints — accuracy filter', () => {
  test('a point with accuracy worse than the threshold is dropped', () => {
    const good = point({ accuracy: 10, tOffsetMs: 0 });
    const bad = point({ latitude: latOffsetForMeters(100), accuracy: MAX_ACCURACY_METERS + 1, tOffsetMs: 15000 });

    const result = flattenCleanedSegments(cleanTrackPoints([good, bad]));

    expect(result).toHaveLength(1);
    expect(result[0].recordedAt).toBe(good.recordedAt);
  });

  test('accuracy exactly at the threshold is kept (only worse than the threshold is dropped)', () => {
    const p1 = point({ accuracy: MAX_ACCURACY_METERS, tOffsetMs: 0 });
    const p2 = point({ latitude: latOffsetForMeters(100), accuracy: MAX_ACCURACY_METERS, tOffsetMs: 15000 });

    const result = cleanTrackPoints([p1, p2]);

    expect(flattenCleanedSegments(result)).toHaveLength(2);
  });

  test('missing accuracy field is not treated as bad accuracy — the point is kept', () => {
    const p1 = point({ tOffsetMs: 0 }); // no `accuracy` at all
    const p2 = point({ latitude: latOffsetForMeters(100), tOffsetMs: 15000 }); // also none

    const result = cleanTrackPoints([p1, p2]);

    expect(flattenCleanedSegments(result)).toHaveLength(2);
  });
});

describe('cleanTrackPoints — impossible-speed filter', () => {
  test('a point implying more than 150 km/h from the previous kept point is dropped', () => {
    const p1 = point({ tOffsetMs: 0 });
    // 1000m in 1 second => 3600 km/h implied speed, far over the 150 km/h cap.
    const impossible = point({ latitude: latOffsetForMeters(1000), tOffsetMs: 1000 });

    const result = flattenCleanedSegments(cleanTrackPoints([p1, impossible]));

    expect(result).toHaveLength(1);
    expect(result[0].recordedAt).toBe(p1.recordedAt);
  });

  test('a plausible speed under the cap is kept', () => {
    const p1 = point({ tOffsetMs: 0 });
    // 500m in 15s => 120 km/h, under the 150 km/h cap, and over the min-distance floor.
    const plausible = point({ latitude: latOffsetForMeters(500), tOffsetMs: 15000 });

    const result = flattenCleanedSegments(cleanTrackPoints([p1, plausible]));

    expect(result).toHaveLength(2);
  });

  test('an impossible-speed point is dropped, but the next genuinely-reachable point after it is still kept (compared against the last point actually kept, not the dropped one)', () => {
    const p1 = point({ tOffsetMs: 0 });
    const impossible = point({ latitude: latOffsetForMeters(50000), tOffsetMs: 1000 }); // dropped
    const reasonable = point({ latitude: latOffsetForMeters(500), tOffsetMs: 16000 }); // reachable from p1

    const result = flattenCleanedSegments(cleanTrackPoints([p1, impossible, reasonable]));

    expect(result).toHaveLength(2);
    expect(result[1].recordedAt).toBe(reasonable.recordedAt);
  });
});

describe('cleanTrackPoints — minimum distance filter (parked jitter)', () => {
  test('a point closer than the minimum distance to the previous kept point is dropped', () => {
    const p1 = point({ tOffsetMs: 0 });
    const jitter = point({ latitude: latOffsetForMeters(1), tOffsetMs: 15000 }); // 1m — under the 5m floor

    const result = flattenCleanedSegments(cleanTrackPoints([p1, jitter]));

    expect(result).toHaveLength(1);
  });

  test('a point at or beyond the minimum distance is kept', () => {
    const p1 = point({ tOffsetMs: 0 });
    const moved = point({ latitude: latOffsetForMeters(MIN_TRAIL_POINT_DISTANCE_METERS + 1), tOffsetMs: 15000 });

    const result = flattenCleanedSegments(cleanTrackPoints([p1, moved]));

    expect(result).toHaveLength(2);
  });
});

describe('cleanTrackPoints — gap splitting', () => {
  test('consecutive kept points more than 2 minutes apart start a new segment', () => {
    const p1 = point({ tOffsetMs: 0 });
    const p2 = point({ latitude: latOffsetForMeters(100), tOffsetMs: TRAIL_GAP_SPLIT_MS + 1000 });

    const segments = cleanTrackPoints([p1, p2]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(1);
    expect(segments[1]).toHaveLength(1);
  });

  test('a gap of exactly 2 minutes does not split (only strictly over the threshold does)', () => {
    const p1 = point({ tOffsetMs: 0 });
    const p2 = point({ latitude: latOffsetForMeters(100), tOffsetMs: TRAIL_GAP_SPLIT_MS });

    const segments = cleanTrackPoints([p1, p2]);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(2);
  });

  test('multiple gaps produce multiple segments, each internally still ordered and cleaned', () => {
    const p1 = point({ tOffsetMs: 0 });
    const p2 = point({ latitude: latOffsetForMeters(100), tOffsetMs: 15000 });
    const p3 = point({ latitude: latOffsetForMeters(200), tOffsetMs: 15000 + TRAIL_GAP_SPLIT_MS + 1000 });
    const p4 = point({ latitude: latOffsetForMeters(300), tOffsetMs: 15000 + TRAIL_GAP_SPLIT_MS + 16000 });

    const segments = cleanTrackPoints([p1, p2, p3, p4]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(2);
    expect(segments[1]).toHaveLength(2);
  });
});
