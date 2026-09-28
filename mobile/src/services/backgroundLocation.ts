import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gpsApi } from './api';
import { enqueue as enqueueGpsPoint, QueuedGpsPoint } from './gpsQueue';

// Name of the headless task expo-location invokes (foreground or not) once
// Location.startLocationUpdatesAsync has been called with it. Must be defined at
// module top level — see the TaskManager.defineTask call below — and this module
// must be imported once, as early as possible (mobile/index.ts), so the definition
// exists before the OS can redeliver a task event after restarting the app process.
export const BACKGROUND_LOCATION_TASK = 'jd-background-location-task';

const CONTEXT_KEY = 'jd_gps_tracking_context';
const DECLINED_KEY = 'jd_gps_bg_declined_session';
const TOKEN_KEY = 'jd_token'; // same AsyncStorage key api.ts's axios interceptor reads

export interface TrackingContext {
  bookingId: string;
  vehicleId: string;
  trackingSessionId: string;
}

// The exact message POST /gps/location sends (server/src/routes/gps.ts) when a
// booking exists and is owned by the user, but its rental/tracking session is no
// longer active — the "rental ended/returned while backgrounded" case. A 400 can
// also mean something unrelated (e.g. invalid latitude/longitude), which must NOT
// stop tracking, so the background task matches on this exact message rather than
// on the 400 status code alone.
const TRACKING_INACTIVE_MESSAGE = 'Tracking is not active for this booking';

function isTrackingInactiveMessage(message: unknown): boolean {
  return typeof message === 'string' && message.trim().toLowerCase() === TRACKING_INACTIVE_MESSAGE.toLowerCase();
}

/**
 * Shared by both the foreground watcher (App.tsx's watchPositionAsync callback) and
 * the background task below — the one place a GPS fix is either sent or queued
 * offline, so neither path can drift out of sync with the other. `onRejected` lets a
 * caller (the background task) react to the server confirming the booking/session is
 * no longer valid, without the foreground path needing to care about that at all.
 */
export async function sendOrQueueGpsPoint(
  point: QueuedGpsPoint,
  onRejected?: (status: number | undefined, message: unknown) => void | Promise<void>
): Promise<void> {
  try {
    await gpsApi.sendLocation(point);
  } catch (err: any) {
    if (!err?.response) {
      // No response at all (offline, timeout, DNS failure, etc.) — queue for later sync.
      console.error('GPS Upload Error (offline — point queued):', err);
      await enqueueGpsPoint(point);
    } else {
      // Server reachable and actively rejected this point — never queued/retried.
      console.error('GPS Upload Error (server rejected — not queued):', err);
      // Awaited — onRejected (the background task's stop-tracking logic) must
      // complete before this function's own caller considers the point "handled",
      // otherwise a caller processing points in sequence could race past a stop.
      await onRejected?.(err.response?.status, err.response?.data?.error);
    }
  }
}

/** Pure — builds the exact same payload shape the foreground path has always sent. */
export function buildGpsPayload(
  context: TrackingContext,
  location: Location.LocationObject
): QueuedGpsPoint {
  return {
    trackingSessionId: context.trackingSessionId,
    bookingId: context.bookingId,
    vehicleId: context.vehicleId,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    speed: location.coords.speed,
    heading: location.coords.heading,
    accuracy: location.coords.accuracy,
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

async function readTrackingContext(): Promise<TrackingContext | null> {
  try {
    const raw = await AsyncStorage.getItem(CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.bookingId && parsed.vehicleId && parsed.trackingSessionId) {
      return parsed as TrackingContext;
    }
    return null;
  } catch {
    return null;
  }
}

async function setTrackingContext(context: TrackingContext): Promise<void> {
  await AsyncStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
}

async function clearTrackingContext(): Promise<void> {
  await AsyncStorage.removeItem(CONTEXT_KEY);
}

async function readAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

// --- The background task itself ---------------------------------------------------
//
// Defined at module top level (never inside a component/function), per Expo's
// requirement that a task be registered before any event for it can be delivered —
// including the case where the OS has restarted the app process to redeliver a
// location update to an already-running background task.
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.warn('[GPS Background Task] TaskManager reported an error:', error.message);
    return;
  }

  try {
    const [context, token] = await Promise.all([readTrackingContext(), readAuthToken()]);

    if (!context || !token) {
      console.warn('[GPS Background Task] No tracking context or auth token in storage — stopping.');
      await stopBackgroundTracking();
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    if (!locations || locations.length === 0) return;

    for (const location of locations) {
      const point = buildGpsPayload(context, location);
      await sendOrQueueGpsPoint(point, async (status, message) => {
        // POST /gps/location's actual responses (server/src/routes/gps.ts): 403 for
        // an unauthorized/unknown booking, 401 for an expired/invalid token — neither
        // will ever succeed again for this session, so stop. A 400 is ambiguous: it's
        // also returned for a plain invalid-coordinates point (which should just be
        // dropped and tracking kept running), so only the exact "Tracking is not
        // active for this booking" message — the real rental-ended/returned case —
        // stops tracking; any other 400 just drops this one point. (404 is included
        // defensively — this endpoint doesn't currently return it, but it would mean
        // the same thing as 403.)
        if (status === 401 || status === 403 || status === 404) {
          console.warn(`[GPS Background Task] Server responded ${status} — stopping background tracking.`);
          await stopBackgroundTracking();
        } else if (status === 400 && isTrackingInactiveMessage(message)) {
          console.warn('[GPS Background Task] Booking tracking is no longer active — stopping background tracking.');
          await stopBackgroundTracking();
        }
        // Any other 400 (e.g. invalid coordinates): point already dropped, not
        // queued, above — tracking continues.
      });
    }
  } catch (err: any) {
    // Never let the task crash the app / the OS's view of the process.
    console.warn('[GPS Background Task] Unexpected error, continuing without crashing:', err?.message ?? err);
  }
});

/** False in Expo Go and any environment without the native TaskManager module. */
export async function isBackgroundLocationSupported(): Promise<boolean> {
  try {
    return await TaskManager.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function isBackgroundTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Starts Android/iOS background location updates for the given rental context.
 * Never throws — returns false for any reason the caller should fall back to
 * foreground-only tracking instead (Expo Go, permission not granted, or any
 * unexpected native failure).
 */
export async function startBackgroundTracking(context: TrackingContext): Promise<boolean> {
  try {
    if (!(await isBackgroundLocationSupported())) {
      console.warn('[GPS Background] TaskManager unavailable (likely Expo Go) — falling back to foreground tracking.');
      return false;
    }

    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }

    await setTrackingContext(context);

    if (await isBackgroundTrackingActive()) {
      // Already running (e.g. this effect re-ran on a routine 30s poll) — never
      // start it twice, and never restart it just because the caller asked again.
      return true;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000,
      distanceInterval: 30,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'JD Car Rental – Trip tracking active',
        notificationBody: "Your rented vehicle's location is being shared during this rental.",
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (err) {
    console.warn('[GPS Background] Failed to start background tracking, falling back to foreground:', err);
    await clearTrackingContext();
    return false;
  }
}

/** Safe to call any number of times, including when nothing is running. */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    if (await isBackgroundTrackingActive()) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    console.warn('[GPS Background] Failed to stop background tracking:', err);
  } finally {
    await clearTrackingContext();
  }
}

// "Not now" memory, scoped to one rental's tracking session — so the explanation
// screen is shown at most once per rental, never on every 30s poll, but is offered
// again for the next new rental (a different trackingSessionId).
export async function hasDeclinedBackgroundFor(trackingSessionId: string): Promise<boolean> {
  try {
    const declined = await AsyncStorage.getItem(DECLINED_KEY);
    return declined === trackingSessionId;
  } catch {
    return false;
  }
}

export async function markDeclinedBackgroundFor(trackingSessionId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DECLINED_KEY, trackingSessionId);
  } catch {
    // Best-effort only — worst case the explanation is shown again next poll.
  }
}
