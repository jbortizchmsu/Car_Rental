import { normalizeBaseUrl, stripSupabaseVersionedPath } from '../env';

// getApiBaseUrl/getRawApiBaseUrl/getSupabaseBaseUrl themselves are one-line
// process.env reads plus a call to these pure helpers — the actual normalization
// logic (and the bugs this task fixes: leading/trailing whitespace, trailing
// slashes, the /rest/v1 suffix) lives here, so it's tested directly rather than by
// mutating the shared process.env global, which Jest can leak across test files
// scheduled in the same worker.

describe('normalizeBaseUrl', () => {
  test('trims leading and trailing whitespace (the actual eas.json preview bug)', () => {
    expect(
      normalizeBaseUrl('   https://jdcarrental-api-e7abgrc4fpb8efcm.malaysiawest-01.azurewebsites.net/api  ')
    ).toBe('https://jdcarrental-api-e7abgrc4fpb8efcm.malaysiawest-01.azurewebsites.net/api');
  });

  test('strips a trailing slash', () => {
    expect(normalizeBaseUrl('https://example.com/api/')).toBe('https://example.com/api');
  });

  test('strips multiple trailing slashes', () => {
    expect(normalizeBaseUrl('https://example.com/api///')).toBe('https://example.com/api');
  });

  test('empty string for null/undefined/empty input', () => {
    expect(normalizeBaseUrl(null)).toBe('');
    expect(normalizeBaseUrl(undefined)).toBe('');
    expect(normalizeBaseUrl('')).toBe('');
  });

  test('a whitespace-only value normalizes to empty string', () => {
    expect(normalizeBaseUrl('   ')).toBe('');
  });

  test('a value with no trailing slash is left as-is', () => {
    expect(normalizeBaseUrl('https://example.com/api')).toBe('https://example.com/api');
  });
});

describe('stripSupabaseVersionedPath', () => {
  test('strips a trailing /rest/v1 path (the actual eas.json value today)', () => {
    expect(stripSupabaseVersionedPath('https://elrhgtqzaeysguckaaxg.supabase.co/rest/v1')).toBe(
      'https://elrhgtqzaeysguckaaxg.supabase.co'
    );
  });

  test('strips a trailing /auth/v1 path', () => {
    expect(stripSupabaseVersionedPath('https://example.supabase.co/auth/v1')).toBe('https://example.supabase.co');
  });

  test('strips a trailing /storage/v1 path', () => {
    expect(stripSupabaseVersionedPath('https://example.supabase.co/storage/v1')).toBe('https://example.supabase.co');
  });

  test('is a no-op for an already-bare project URL — a future corrected value works too', () => {
    expect(stripSupabaseVersionedPath('https://example.supabase.co')).toBe('https://example.supabase.co');
  });

  test('is case-insensitive', () => {
    expect(stripSupabaseVersionedPath('https://example.supabase.co/REST/V1')).toBe('https://example.supabase.co');
  });
});
