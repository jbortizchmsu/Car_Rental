import { getVehicleImageUri } from '../vehicleImage';

// A fixed, explicit base URL is passed to every call below instead of relying on
// (or mutating) process.env — see env.ts's note on why mutating that shared global
// is unreliable across test files. Production call sites never pass this argument;
// it defaults to the real getApiBaseUrl().
const API_BASE_URL = 'https://jdcarrental-api-e7abgrc4fpb8efcm.malaysiawest-01.azurewebsites.net/api';

describe('getVehicleImageUri', () => {
  test('null/undefined vehicle: null', () => {
    expect(getVehicleImageUri(null, API_BASE_URL)).toBeNull();
    expect(getVehicleImageUri(undefined, API_BASE_URL)).toBeNull();
  });

  test('a full https imageUrl (e.g. Supabase storage): kept as-is', () => {
    const uri = getVehicleImageUri(
      { id: 'v1', imageUrl: 'https://project.supabase.co/storage/v1/object/public/vehicles/car.jpg' },
      API_BASE_URL
    );
    expect(uri).toBe('https://project.supabase.co/storage/v1/object/public/vehicles/car.jpg');
  });

  test('a full http imageUrl: upgraded to https', () => {
    const uri = getVehicleImageUri(
      { id: 'v1', imageUrl: 'http://project.supabase.co/storage/v1/object/public/vehicles/car.jpg' },
      API_BASE_URL
    );
    expect(uri).toBe('https://project.supabase.co/storage/v1/object/public/vehicles/car.jpg');
  });

  test('an http Azure API host URL: upgraded to https', () => {
    const uri = getVehicleImageUri(
      { id: 'v1', imageUrl: 'http://jdcarrental-api-e7abgrc4fpb8efcm.malaysiawest-01.azurewebsites.net/uploads/car.jpg' },
      API_BASE_URL
    );
    expect(uri).toBe('https://jdcarrental-api-e7abgrc4fpb8efcm.malaysiawest-01.azurewebsites.net/uploads/car.jpg');
  });

  test('a relative/local-upload path: built against the (trimmed) API host, same as the web app', () => {
    const uri = getVehicleImageUri({ id: 'v1', imageUrl: 'uploads/car.jpg' }, API_BASE_URL);
    expect(uri).toBe(`${API_BASE_URL}/vehicles/v1/image`);
  });

  test('no imageUrl at all: built against the API host', () => {
    expect(getVehicleImageUri({ id: 'v1' }, API_BASE_URL)).toBe(`${API_BASE_URL}/vehicles/v1/image`);
  });

  test('empty-string imageUrl: treated the same as no imageUrl', () => {
    expect(getVehicleImageUri({ id: 'v1', imageUrl: '' }, API_BASE_URL)).toBe(`${API_BASE_URL}/vehicles/v1/image`);
  });

  test('imageUrl with leading/trailing spaces: trimmed before the https:// check', () => {
    const uri = getVehicleImageUri({ id: 'v1', imageUrl: '  https://project.supabase.co/car.jpg  ' }, API_BASE_URL);
    expect(uri).toBe('https://project.supabase.co/car.jpg');
  });

  test('no id and no usable imageUrl: null (nothing to build a URI from)', () => {
    expect(getVehicleImageUri({ imageUrl: '' }, API_BASE_URL)).toBeNull();
    expect(getVehicleImageUri({}, API_BASE_URL)).toBeNull();
  });

  test('an old/dead host in imageUrl (e.g. shut-down Railway) is still returned as-is — a data problem, not a URI-building bug', () => {
    const uri = getVehicleImageUri(
      { id: 'v1', imageUrl: 'https://carrental-production-8eae.up.railway.app/uploads/car.jpg' },
      API_BASE_URL
    );
    expect(uri).toBe('https://carrental-production-8eae.up.railway.app/uploads/car.jpg');
  });

  test('uses whatever (already-normalized) base URL it is given, including one with a trailing slash', () => {
    const uri = getVehicleImageUri({ id: 'v1' }, 'https://example.com/api/');
    expect(uri).toBe('https://example.com/api//vehicles/v1/image');
  });

  test('defaults to the real getApiBaseUrl() when no override is passed', () => {
    // No env var set in this test environment, so it falls back to the documented
    // local-dev default rather than throwing or returning undefined.
    const uri = getVehicleImageUri({ id: 'v1' });
    expect(uri).toBe('http://localhost:4000/api/vehicles/v1/image');
  });
});
