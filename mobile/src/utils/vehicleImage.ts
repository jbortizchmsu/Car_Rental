import { getApiBaseUrl } from './env';

export interface VehicleImageSource {
  id?: string | null;
  imageUrl?: string | null;
}

/**
 * The single place every vehicle image URI in the app is built. Mirrors what
 * server/src/routes/vehicles.ts's GET /vehicles/:id/image already does (redirect
 * straight to a stored absolute URL, or serve a local upload otherwise), but reads
 * vehicle.imageUrl directly when it's already a usable absolute URL — saving the
 * extra redirect hop — and only falls back to the proxied /vehicles/:id/image
 * endpoint (built against the trimmed API host, same as the web app) for a relative/
 * local-upload path or when imageUrl isn't available at all.
 */
export function getVehicleImageUri(
  vehicle: VehicleImageSource | null | undefined,
  // Overridable (rather than read internally on every call) so tests can supply a
  // fixed value without mutating the shared process.env global — see env.ts's note
  // on why that's unreliable across test files. Production call sites never pass
  // this; it defaults to the real, trimmed API base URL.
  apiBaseUrl: string = getApiBaseUrl()
): string | null {
  if (!vehicle) return null;

  const raw = typeof vehicle.imageUrl === 'string' ? vehicle.imageUrl.trim() : '';
  if (raw) {
    if (raw.startsWith('https://')) return raw;
    if (raw.startsWith('http://')) return `https://${raw.slice('http://'.length)}`;
    // Anything else (a relative/local-upload path) falls through to the proxy below.
  }

  if (!vehicle.id) return null;
  return `${apiBaseUrl}/vehicles/${vehicle.id}/image`;
}
