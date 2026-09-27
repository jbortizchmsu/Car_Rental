// Pure helpers for direction-of-travel arrows on the GPS tracking map(s). Kept
// framework-free (no React) so they're trivial to unit test in isolation — the
// animation/state that actually uses them lives in the map component itself.

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Initial great-circle bearing from point 1 to point 2, in degrees clockwise from
 * north, normalized to [0, 360). Two identical/near-identical points produce an
 * arbitrary (but stable) value — callers should gate on distanceMeters() first
 * (see MIN_MOVEMENT_METERS) rather than trust this alone when the vehicle hasn't
 * actually moved.
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

const EARTH_RADIUS_METERS = 6371000;

/** Haversine distance between two points, in meters. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// Below this movement, a computed bearing is too noisy to trust (GPS jitter while
// parked would otherwise spin the arrow) — matches the task's "more than 5 meters"
// guidance.
export const MIN_MOVEMENT_METERS = 5;

/**
 * Returns a new "continuous" angle — may fall outside [0, 360) or be negative —
 * that represents the same compass direction as `toDegrees` (mod 360) but is
 * numerically as close as possible to `fromContinuous` (differs by at most 180°).
 *
 * Animating/interpolating linearly from `fromContinuous` to this returned value
 * always turns the shortest way around the circle: e.g. shortestRotationTarget(350, 10)
 * returns 370 (a +20° turn, arriving at the same facing as 10°), not a -340° turn.
 */
export function shortestRotationTarget(fromContinuous: number, toDegrees: number): number {
  const normalizedTo = ((toDegrees % 360) + 360) % 360;
  const fromMod = ((fromContinuous % 360) + 360) % 360;

  let delta = normalizedTo - fromMod;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  return fromContinuous + delta;
}

/**
 * True when `reportedHeading` is a real, usable heading value — GPS APIs commonly
 * use -1 (or null/undefined) to mean "no heading available", which must not be
 * treated as due-north.
 */
export function isValidReportedHeading(reportedHeading: unknown): reportedHeading is number {
  return typeof reportedHeading === 'number' && Number.isFinite(reportedHeading) && reportedHeading !== -1;
}
