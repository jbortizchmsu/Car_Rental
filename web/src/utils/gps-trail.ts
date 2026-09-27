// Shared trail-rendering helpers for the two GPS map views (AdminLiveMapPage, AdminGpsTrackingPage).
// Purely a display-layer concern: builds the point array/segments passed to <Polyline>. Does not
// touch the ingestion endpoint, Socket.IO broadcast payloads, or any geofence/alerting logic.

import { distanceMeters, MIN_MOVEMENT_METERS } from './heading';

export interface ShopLocation {
  lat: number;
  lng: number;
}

/**
 * Mobile polls GPS every 15s (or 30m of movement, whichever first) — see
 * mobile/App.tsx's `Location.watchPositionAsync({ timeInterval: 15000, distanceInterval: 30 })`.
 * A 60s threshold (4x the normal interval) comfortably absorbs ordinary network/GPS jitter, brief
 * backgrounding, and the distance-interval occasionally stretching the real time between pings —
 * while still catching genuine signal-loss periods (app killed, connectivity lost, GPS disabled).
 */
export const GAP_THRESHOLD_MS = 60_000;

export interface RawGpsPoint {
  latitude?: number | null;
  longitude?: number | null;
  recordedAt?: string | null;
  accuracy?: number | null;
  speed?: number | null;
}

interface NormalizedPoint {
  lat: number;
  lng: number;
  t: number | null;
}

export interface TrailSegment {
  path: { lat: number; lng: number }[];
  isGap: boolean;
}

export interface GapMarker {
  lat: number;
  lng: number;
  fromTime: number;
  toTime: number;
}

export interface BuiltTrail {
  segments: TrailSegment[];
  gapMarkers: GapMarker[];
  /** The synthetic shop-departure point, if one was prepended (null when either `releasedAt` or
   *  `shopLocation` was missing/invalid). Callers render an explicit marker for it — a
   *  single-point trail (booking just released, zero real pings yet) draws no visible Polyline,
   *  so this is what makes that state show as a marker rather than nothing at all. */
  shopPoint: { lat: number; lng: number } | null;
}

/**
 * Prepends a synthetic shop-location point (timestamped at/just before `releasedAt`) to a raw
 * ping list, then splits the result into alternating solid/gap segments for rendering as
 * separate <Polyline>s.
 *
 * `shopLocation` must be the admin's actually-configured shop coordinates (Admin Settings →
 * Default Map Center, `map.centerLat`/`map.centerLng`), fetched by the caller — this function
 * has no hardcoded fallback location of its own. If it's `null` (settings fetch failed, or the
 * admin simply hasn't configured a shop location yet), no shop point is prepended at all — the
 * trail degrades to its pre-existing behavior (starts from the first real ping), exactly as it
 * already does when `releasedAt` is missing. This is deliberate: a missing/failed setting must
 * never silently fall back to *some* location, since that location wouldn't be real.
 *
 * Design decision: the shop → first-real-ping segment is ALWAYS rendered solid, never treated as
 * a "gap", regardless of how much time elapsed between release and the first real GPS fix. That
 * gap is a known, deliberate artifact of the synthetic starting point (the vehicle needs real
 * travel time to reach its first GPS fix after leaving the shop) — not a signal-loss event, so
 * flagging it as one would be misleading on every single session.
 *
 * Null-safe throughout: malformed/missing lat/lng/timestamp fields are filtered out rather than
 * causing a crash; a missing/invalid `releasedAt` or `shopLocation` simply skips the shop-prepend.
 */
export function buildTrail(
  rawPoints: RawGpsPoint[] | null | undefined,
  releasedAt: string | null | undefined,
  shopLocation: ShopLocation | null | undefined
): BuiltTrail {
  const cleaned: NormalizedPoint[] = (rawPoints || [])
    .filter(
      (p): p is RawGpsPoint =>
        typeof p?.latitude === 'number' &&
        typeof p?.longitude === 'number' &&
        !isNaN(p.latitude) &&
        !isNaN(p.longitude)
    )
    .map((p) => {
      const parsed = p.recordedAt ? new Date(p.recordedAt).getTime() : NaN;
      return { lat: p.latitude as number, lng: p.longitude as number, t: isNaN(parsed) ? null : parsed };
    });

  const releasedMs = releasedAt ? new Date(releasedAt).getTime() : NaN;
  const hasValidRelease = !isNaN(releasedMs);
  const hasValidShopLocation =
    !!shopLocation &&
    typeof shopLocation.lat === 'number' &&
    typeof shopLocation.lng === 'number' &&
    !isNaN(shopLocation.lat) &&
    !isNaN(shopLocation.lng);

  let points: NormalizedPoint[] = cleaned;
  let shopPrepended = false;

  if (hasValidRelease && hasValidShopLocation) {
    const firstRealTime = cleaned[0]?.t ?? releasedMs;
    const shopTime = Math.min(releasedMs, firstRealTime);
    points = [{ lat: shopLocation!.lat, lng: shopLocation!.lng, t: shopTime }, ...cleaned];
    shopPrepended = true;
  }

  const shopPoint = shopPrepended ? { lat: shopLocation!.lat, lng: shopLocation!.lng } : null;

  if (points.length === 0) {
    return { segments: [], gapMarkers: [], shopPoint };
  }
  if (points.length === 1) {
    return {
      segments: [{ path: [{ lat: points[0].lat, lng: points[0].lng }], isGap: false }],
      gapMarkers: [],
      shopPoint,
    };
  }

  const segments: TrailSegment[] = [];
  const gapMarkers: GapMarker[] = [];
  let currentSolid: { lat: number; lng: number }[] = [{ lat: points[0].lat, lng: points[0].lng }];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const isShopToFirstPing = shopPrepended && i === 1;
    const delta = prev.t !== null && curr.t !== null ? curr.t - prev.t : 0;
    const isGap = !isShopToFirstPing && delta > GAP_THRESHOLD_MS;

    if (isGap) {
      segments.push({ path: currentSolid, isGap: false });
      segments.push({
        path: [
          { lat: prev.lat, lng: prev.lng },
          { lat: curr.lat, lng: curr.lng },
        ],
        isGap: true,
      });
      gapMarkers.push({
        lat: (prev.lat + curr.lat) / 2,
        lng: (prev.lng + curr.lng) / 2,
        fromTime: prev.t as number,
        toTime: curr.t as number,
      });
      currentSolid = [{ lat: curr.lat, lng: curr.lng }];
    } else {
      currentSolid.push({ lat: curr.lat, lng: curr.lng });
    }
  }
  segments.push({ path: currentSolid, isGap: false });

  return { segments, gapMarkers, shopPoint };
}

/**
 * Standard Google Maps JS API dashed-polyline technique (repeating a short line symbol along an
 * invisible base line via `icons`) — the officially documented way to render a dashed stroke,
 * since Polyline options have no native dash-array property. Muted gray, intentionally decoupled
 * from either page's own solid-route brand color, since "signal lost" is a neutral/warning state
 * rather than part of the normal route styling.
 */
export const GAP_POLYLINE_OPTIONS: google.maps.PolylineOptions = {
  strokeOpacity: 0,
  strokeColor: '#9CA3AF',
  zIndex: 1,
  icons: [
    {
      icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#9CA3AF', scale: 3 },
      offset: '0',
      repeat: '12px',
    },
  ],
};

// --- Point cleaning (cleanTrackPoints) ---
//
// A display-layer cleanup pass that runs BEFORE buildTrail(), so a handful of bad GPS
// fixes (poor accuracy, a jump implying an impossible speed, or GPS jitter while
// parked) can't distort buildTrail's own gap detection or draw a misleading kink in
// the line. Never touches stored data — this only reshapes what gets handed to
// <Polyline>.

/** Points with a reported accuracy worse than this (meters) are dropped. */
export const MAX_ACCURACY_METERS = 100;

/** A point implying more than this speed (km/h) from the previous *kept* point is dropped. */
export const MAX_IMPLIED_SPEED_KMH = 150;

/** Points closer than this to the previous *kept* point are dropped (parked-vehicle jitter). */
export const MIN_TRAIL_POINT_DISTANCE_METERS = MIN_MOVEMENT_METERS;

/** Consecutive kept points more than this far apart in time start a new segment. */
export const TRAIL_GAP_SPLIT_MS = 2 * 60 * 1000;

export interface CleanedTrackPoint {
  lat: number;
  lng: number;
  /** recordedAt, as epoch milliseconds — always present and valid for every point this
   *  function returns (a point with no parseable recordedAt is dropped entirely, since
   *  sorting and gap-splitting are meaningless without one). */
  t: number;
}

/**
 * Cleans a raw, possibly unsorted/duplicated/noisy list of GPS points for trail
 * rendering, and splits the result into segments wherever consecutive kept points are
 * more than TRAIL_GAP_SPLIT_MS apart. Each returned sub-array is meant to be drawn as
 * its own <Polyline>, with a thin dashed connector between them (buildTrail's existing
 * GAP_POLYLINE_OPTIONS already renders exactly this for any gap over its own, stricter
 * GAP_THRESHOLD_MS, so callers that flatten these segments back into one array before
 * calling buildTrail get that connector "for free" — see AdminLiveMapPage/
 * AdminGpsTrackingPage for that composition).
 *
 * Steps, in order: normalize + drop anything unusable → sort by recordedAt → drop
 * exact duplicates → drop points failing the accuracy/speed/distance checks (each
 * check is skipped, not failed, when the field it needs is missing or there's no
 * previous kept point yet to compare against) → split into segments at >2min gaps.
 */
export function cleanTrackPoints(rawPoints: RawGpsPoint[] | null | undefined): CleanedTrackPoint[][] {
  type Working = { lat: number; lng: number; t: number; accuracy: number | null };

  const normalized: Working[] = (rawPoints || [])
    .map((p) => {
      const t = p?.recordedAt ? new Date(p.recordedAt).getTime() : NaN;
      const accuracy = typeof p?.accuracy === 'number' && !isNaN(p.accuracy) ? p.accuracy : null;
      return {
        lat: typeof p?.latitude === 'number' ? p.latitude : NaN,
        lng: typeof p?.longitude === 'number' ? p.longitude : NaN,
        t,
        accuracy,
      };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lng) && !isNaN(p.t));

  normalized.sort((a, b) => a.t - b.t);

  const deduped: Working[] = [];
  for (const p of normalized) {
    const last = deduped[deduped.length - 1];
    if (last && last.t === p.t && last.lat === p.lat && last.lng === p.lng) continue;
    deduped.push(p);
  }

  const kept: Working[] = [];
  for (const p of deduped) {
    // Accuracy filter — skipped entirely when this point has no accuracy reading.
    if (p.accuracy !== null && p.accuracy > MAX_ACCURACY_METERS) continue;

    const prev = kept[kept.length - 1];
    if (prev) {
      const distance = distanceMeters(prev.lat, prev.lng, p.lat, p.lng);
      const dtSeconds = (p.t - prev.t) / 1000;

      // Implied-speed filter — only meaningful with a positive elapsed time (always
      // true here in practice, since both timestamps are valid and points are
      // deduped/sorted, but guarded to never divide by zero).
      if (dtSeconds > 0) {
        const impliedKmh = (distance / dtSeconds) * 3.6;
        if (impliedKmh > MAX_IMPLIED_SPEED_KMH) continue;
      }

      // Minimum-distance filter — parked-vehicle jitter declutter.
      if (distance < MIN_TRAIL_POINT_DISTANCE_METERS) continue;
    }

    kept.push(p);
  }

  if (kept.length === 0) return [];

  const segments: CleanedTrackPoint[][] = [];
  let current: CleanedTrackPoint[] = [{ lat: kept[0].lat, lng: kept[0].lng, t: kept[0].t }];
  for (let i = 1; i < kept.length; i++) {
    const prev = kept[i - 1];
    const curr = kept[i];
    if (curr.t - prev.t > TRAIL_GAP_SPLIT_MS) {
      segments.push(current);
      current = [];
    }
    current.push({ lat: curr.lat, lng: curr.lng, t: curr.t });
  }
  segments.push(current);

  return segments;
}

/**
 * Flattens cleanTrackPoints()'s segments back into a single, already-sorted
 * RawGpsPoint[] — the shape buildTrail() expects. See cleanTrackPoints()'s own doc
 * comment for why callers compose it with buildTrail this way instead of rendering
 * each cleaned segment as its own independent trail.
 */
export function flattenCleanedSegments(segments: CleanedTrackPoint[][]): RawGpsPoint[] {
  return segments.flat().map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
    recordedAt: new Date(p.t).toISOString(),
  }));
}

/**
 * Enhanced solid-route styling: the existing brand color, a touch thicker, with a
 * white "casing" polyline underneath for contrast on satellite view, and small
 * direction arrows repeated along the line — the standard Google Maps JS API recipe
 * for a repeating icon along a Polyline (no paid API involved). Only ever call this
 * once the Maps script has actually loaded (same rule as GAP_POLYLINE_OPTIONS's
 * sibling marker icons elsewhere in these pages) — unlike that constant, this touches
 * `google.maps.SymbolPath` as a real value, not just a type, so it's a function
 * (called at render time) rather than a module-level constant.
 */
export function buildTrailPolylineOptions(color: string): {
  outline: google.maps.PolylineOptions;
  line: google.maps.PolylineOptions;
} {
  return {
    outline: {
      strokeColor: '#FFFFFF',
      strokeOpacity: 0.9,
      strokeWeight: 7,
      geodesic: true,
      zIndex: 1,
    },
    line: {
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 4,
      geodesic: true,
      zIndex: 2,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            strokeColor: color,
            strokeWeight: 1,
            fillColor: '#FFFFFF',
            fillOpacity: 1,
          },
          offset: '0',
          repeat: '100px',
        },
      ],
    },
  };
}
