/**
 * Parses a value that must be a finite number >= 0. Accepts a real JS number OR a
 * numeric string (matching what web forms actually send — `<input type="number">`'s
 * value is always a string, e.g. odometer/cost/amount fields), so existing callers
 * that used to do `Number(x)`/`parseFloat(x)` unguarded keep accepting the exact same
 * inputs, just with NaN/Infinity/negative/whitespace-only now correctly rejected
 * instead of silently becoming NaN or a bogus negative value.
 *
 * Returns the parsed number, or null if the value is missing, empty/whitespace-only,
 * non-numeric, negative, NaN, or Infinity. Callers decide what "missing" means for
 * their own field (required vs. optional-with-a-default) — this only validates the
 * value's *shape* once presence has already been decided by the caller.
 */
export function parseNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  return null;
}

/**
 * Validates a GPS coordinate pair. Deliberately requires real `number` types (no
 * numeric-string coercion) — this matches the batch endpoint's existing
 * `typeof latitude !== 'number'` check, which it must not weaken, and is the right
 * shape anyway: GPS coordinates come from a device's location API as native numbers,
 * never as user-typed strings.
 *
 * Returns the same {latitude, longitude} pair (unchanged) if both are finite numbers
 * within the valid range (latitude -90..90, longitude -180..180), or null otherwise.
 */
/**
 * True for a value that should be treated as "not provided" for an optional field:
 * undefined, null, or a string that is empty or contains only whitespace. Web forms bind
 * optional numeric inputs to string state and send "" when blank — this lets presence
 * checks treat that the same as the field being omitted entirely, without also accepting
 * a whitespace-only string as a real value.
 */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

export function parseLatLng(
  latitude: unknown,
  longitude: unknown
): { latitude: number; longitude: number } | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
