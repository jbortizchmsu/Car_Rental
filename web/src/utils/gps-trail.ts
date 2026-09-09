// Shared trail-rendering helpers for the two GPS map views (AdminLiveMapPage, AdminGpsTrackingPage).
// Purely a display-layer concern: builds the point array/segments passed to <Polyline>. Does not
// touch the ingestion endpoint, Socket.IO broadcast payloads, or any geofence/alerting logic.

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
