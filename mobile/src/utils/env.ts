// Central place to read the two URL-shaped env vars, so every consumer (axios's
// baseURL, image URLs, the Supabase client) sees the same trimmed, trailing-slash-free
// value — a leading/trailing space or a trailing slash in eas.json should never be
// able to silently break a URL built by string concatenation.
//
// The normalize/strip helpers are exported and pure (no process.env access) so they
// can be unit tested directly — reading process.env in a test is unreliable here:
// Jest can schedule multiple test files in the same worker process, and process.env
// is a genuine OS-level global shared by all of them, so one file's env mutation can
// leak into another's assertions.

export function normalizeBaseUrl(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\/+$/, '');
}

/** Strips a trailing /rest/v1, /auth/v1, or /storage/v1 path — the part of a
 * Supabase URL that's meant for direct REST/auth/storage calls, not for
 * supabase-js's own client constructor, which needs the bare project URL. */
export function stripSupabaseVersionedPath(value: string): string {
  return value.replace(/\/(rest|auth|storage)\/v1$/i, '');
}

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';

/** Trimmed, trailing-slash-free API base URL (e.g. ".../api"), or the local dev
 * fallback if EXPO_PUBLIC_API_URL is unset. */
export function getApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL) || DEFAULT_API_BASE_URL;
}

/** Trimmed, trailing-slash-free value of EXPO_PUBLIC_API_URL exactly as configured,
 * or null if unset — unlike getApiBaseUrl(), never substitutes the localhost
 * fallback, for callers that need to know whether it's genuinely configured. */
export function getRawApiBaseUrl(): string | null {
  return normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL) || null;
}

/**
 * The bare Supabase project URL (https://<project>.supabase.co), derived safely
 * from whatever EXPO_PUBLIC_SUPABASE_URL currently holds — including a value that
 * (like the one presently in eas.json) has a trailing /rest/v1 path, which the
 * supabase-js client must never be given directly. Works unchanged for a future
 * corrected value too, since stripping a path that isn't there is a no-op.
 */
export function getSupabaseBaseUrl(): string {
  return stripSupabaseVersionedPath(normalizeBaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL));
}
