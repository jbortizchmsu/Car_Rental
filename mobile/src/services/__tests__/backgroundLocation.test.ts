import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Each factory below creates its own jest.fn()s inline (rather than closing over
// consts declared in this file) because babel-plugin-jest-hoist only hoists the
// jest.mock() calls themselves above this file's imports — not any outer `const`
// declarations they reference — so a factory that reads an outer `const mockX =
// jest.fn()` sees it as still-undefined at require time. Grabbing the references
// back out via `jest.requireMock` after the imports sidesteps that entirely.
jest.mock('../api', () => ({
  __esModule: true,
  gpsApi: { sendLocation: jest.fn() },
}));

jest.mock('expo-task-manager', () => ({
  __esModule: true,
  defineTask: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

jest.mock('expo-location', () => ({
  __esModule: true,
  Accuracy: { Balanced: 3 },
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
}));

import {
  buildGpsPayload,
  sendOrQueueGpsPoint,
  startBackgroundTracking,
  stopBackgroundTracking,
  hasDeclinedBackgroundFor,
  markDeclinedBackgroundFor,
  isBackgroundLocationSupported,
  BACKGROUND_LOCATION_TASK,
  TrackingContext,
} from '../backgroundLocation';
import { getQueue } from '../gpsQueue';
import { gpsApi } from '../api';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const mockSendLocation = gpsApi.sendLocation as jest.Mock;
const mockDefineTask = TaskManager.defineTask as jest.Mock;
const mockIsAvailableAsync = TaskManager.isAvailableAsync as jest.Mock;
const mockHasStarted = Location.hasStartedLocationUpdatesAsync as jest.Mock;
const mockStart = Location.startLocationUpdatesAsync as jest.Mock;
const mockStop = Location.stopLocationUpdatesAsync as jest.Mock;
const mockGetBackgroundPermissions = Location.getBackgroundPermissionsAsync as jest.Mock;

const context: TrackingContext = {
  bookingId: 'booking-1',
  vehicleId: 'vehicle-1',
  trackingSessionId: 'session-1',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSendLocation.mockReset();
  mockIsAvailableAsync.mockReset();
  mockHasStarted.mockReset();
  mockStart.mockReset();
  mockStop.mockReset();
  mockGetBackgroundPermissions.mockReset();
});

describe('backgroundLocation task registration', () => {
  test('defines the task at module load, once, at the expected task name', () => {
    // The module under test calls TaskManager.defineTask at top level on import,
    // which already happened once when this file's imports were evaluated.
    expect(mockDefineTask).toHaveBeenCalledTimes(1);
    expect(mockDefineTask.mock.calls[0][0]).toBe(BACKGROUND_LOCATION_TASK);
    expect(typeof mockDefineTask.mock.calls[0][1]).toBe('function');
  });
});

describe('buildGpsPayload', () => {
  test('maps a LocationObject into the same payload shape the foreground path sends', () => {
    const location: any = {
      timestamp: Date.parse('2026-09-13T10:00:00.000Z'),
      coords: {
        latitude: 10.7391,
        longitude: 122.9691,
        speed: 5,
        heading: 90,
        accuracy: 12,
      },
    };
    expect(buildGpsPayload(context, location)).toEqual({
      trackingSessionId: 'session-1',
      bookingId: 'booking-1',
      vehicleId: 'vehicle-1',
      latitude: 10.7391,
      longitude: 122.9691,
      speed: 5,
      heading: 90,
      accuracy: 12,
      recordedAt: '2026-09-13T10:00:00.000Z',
    });
  });

  test('passes coords.heading through as-is (including -1 for "unavailable"), matching today\'s foreground behavior', () => {
    const location: any = {
      timestamp: Date.parse('2026-09-13T10:00:00.000Z'),
      coords: { latitude: 1, longitude: 2, speed: null, heading: -1, accuracy: null },
    };
    expect(buildGpsPayload(context, location).heading).toBe(-1);
  });
});

describe('sendOrQueueGpsPoint', () => {
  const point = buildGpsPayload(context, {
    timestamp: Date.parse('2026-09-13T10:00:00.000Z'),
    coords: { latitude: 1, longitude: 2, speed: 0, heading: 0, accuracy: 5 },
  } as any);

  test('success: sends the point, never queues it', async () => {
    mockSendLocation.mockResolvedValue({ data: {} });
    await sendOrQueueGpsPoint(point);
    expect(mockSendLocation).toHaveBeenCalledWith(point);
    expect(await getQueue()).toEqual([]);
  });

  test('offline (no response): queues the point locally', async () => {
    mockSendLocation.mockRejectedValue(new Error('Network Error'));
    await sendOrQueueGpsPoint(point);
    expect(await getQueue()).toEqual([point]);
  });

  test('server rejected (has a response): does not queue, and reports the status and message via onRejected', async () => {
    const onRejected = jest.fn();
    mockSendLocation.mockRejectedValue({ response: { status: 403, data: { error: 'Unauthorized booking' } } });
    await sendOrQueueGpsPoint(point, onRejected);
    expect(await getQueue()).toEqual([]);
    expect(onRejected).toHaveBeenCalledWith(403, 'Unauthorized booking');
  });

  test('server rejected with no response body: reports the status with an undefined message', async () => {
    const onRejected = jest.fn();
    mockSendLocation.mockRejectedValue({ response: { status: 500 } });
    await sendOrQueueGpsPoint(point, onRejected);
    expect(onRejected).toHaveBeenCalledWith(500, undefined);
  });
});

describe('declined-background bookkeeping', () => {
  test('not declined by default', async () => {
    expect(await hasDeclinedBackgroundFor('session-1')).toBe(false);
  });

  test('remembers a decline for the exact session it was recorded for', async () => {
    await markDeclinedBackgroundFor('session-1');
    expect(await hasDeclinedBackgroundFor('session-1')).toBe(true);
  });

  test('does not carry a decline over to a different (new) rental session', async () => {
    await markDeclinedBackgroundFor('session-1');
    expect(await hasDeclinedBackgroundFor('session-2')).toBe(false);
  });
});

describe('isBackgroundLocationSupported', () => {
  test('reflects TaskManager.isAvailableAsync()', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    expect(await isBackgroundLocationSupported()).toBe(true);
  });

  test('returns false (never throws) if TaskManager.isAvailableAsync() rejects — e.g. Expo Go', async () => {
    mockIsAvailableAsync.mockRejectedValue(new Error('not supported in Expo Go'));
    expect(await isBackgroundLocationSupported()).toBe(false);
  });
});

describe('startBackgroundTracking', () => {
  test('not supported (Expo Go): returns false, never calls startLocationUpdatesAsync', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    const started = await startBackgroundTracking(context);
    expect(started).toBe(false);
    expect(mockStart).not.toHaveBeenCalled();
  });

  test('background permission not granted: returns false, never calls startLocationUpdatesAsync', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetBackgroundPermissions.mockResolvedValue({ status: 'denied' });
    const started = await startBackgroundTracking(context);
    expect(started).toBe(false);
    expect(mockStart).not.toHaveBeenCalled();
  });

  test('supported + granted + not already started: starts with the same accuracy/interval as the foreground path', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetBackgroundPermissions.mockResolvedValue({ status: 'granted' });
    mockHasStarted.mockResolvedValue(false);
    mockStart.mockResolvedValue(undefined);

    const started = await startBackgroundTracking(context);

    expect(started).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(1);
    const [taskName, options] = mockStart.mock.calls[0];
    expect(taskName).toBe(BACKGROUND_LOCATION_TASK);
    expect(options).toMatchObject({
      accuracy: 3,
      timeInterval: 15000,
      distanceInterval: 30,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    expect(options.foregroundService).toBeDefined();
  });

  test('already started: returns true without calling startLocationUpdatesAsync again (never double-starts)', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetBackgroundPermissions.mockResolvedValue({ status: 'granted' });
    mockHasStarted.mockResolvedValue(true);

    const started = await startBackgroundTracking(context);

    expect(started).toBe(true);
    expect(mockStart).not.toHaveBeenCalled();
  });

  test('native start failure: returns false instead of throwing, and clears the stored context', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetBackgroundPermissions.mockResolvedValue({ status: 'granted' });
    mockHasStarted.mockResolvedValue(false);
    mockStart.mockRejectedValue(new Error('native module failure'));

    const started = await startBackgroundTracking(context);

    expect(started).toBe(false);
    expect(await AsyncStorage.getItem('jd_gps_tracking_context')).toBeNull();
  });
});

describe('stopBackgroundTracking', () => {
  test('calls stopLocationUpdatesAsync only when actually running', async () => {
    mockHasStarted.mockResolvedValue(true);
    mockStop.mockResolvedValue(undefined);
    await stopBackgroundTracking();
    expect(mockStop).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  });

  test('is a no-op on the native side when nothing is running, but still clears context', async () => {
    mockHasStarted.mockResolvedValue(false);
    await AsyncStorage.setItem('jd_gps_tracking_context', JSON.stringify(context));
    await stopBackgroundTracking();
    expect(mockStop).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('jd_gps_tracking_context')).toBeNull();
  });

  test('never throws even if the native stop call fails', async () => {
    mockHasStarted.mockResolvedValue(true);
    mockStop.mockRejectedValue(new Error('native failure'));
    await expect(stopBackgroundTracking()).resolves.toBeUndefined();
  });
});

describe('background task executor — 400 handling', () => {
  // The function passed to TaskManager.defineTask() at module load — invoked
  // directly here to simulate the OS delivering a location-update task event.
  const taskExecutor = mockDefineTask.mock.calls[0][1];

  const location: any = {
    timestamp: Date.parse('2026-09-13T10:00:00.000Z'),
    coords: { latitude: 10.7391, longitude: 122.9691, speed: 1, heading: 90, accuracy: 8 },
  };

  beforeEach(async () => {
    await AsyncStorage.setItem('jd_gps_tracking_context', JSON.stringify(context));
    await AsyncStorage.setItem('jd_token', 'a-valid-token');
    mockHasStarted.mockResolvedValue(true); // so stopBackgroundTracking's stop-check passes
  });

  test('400 "Tracking is not active for this booking" (rental ended): stops background tracking', async () => {
    mockSendLocation.mockRejectedValue({
      response: { status: 400, data: { error: 'Tracking is not active for this booking' } },
    });

    await taskExecutor({ data: { locations: [location] }, error: null });

    expect(mockStop).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
    expect(await AsyncStorage.getItem('jd_gps_tracking_context')).toBeNull();
  });

  test('the same message, different case/whitespace, still stops tracking (case-insensitive match)', async () => {
    mockSendLocation.mockRejectedValue({
      response: { status: 400, data: { error: '  TRACKING IS NOT ACTIVE FOR THIS BOOKING  ' } },
    });

    await taskExecutor({ data: { locations: [location] }, error: null });

    expect(mockStop).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  });

  test('a different 400 (e.g. invalid coordinates) drops the point but keeps tracking running', async () => {
    mockSendLocation.mockRejectedValue({
      response: {
        status: 400,
        data: { error: 'latitude and longitude must be finite numbers within valid range (-90 to 90, -180 to 180).' },
      },
    });

    await taskExecutor({ data: { locations: [location] }, error: null });

    expect(mockStop).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('jd_gps_tracking_context')).not.toBeNull();
    expect(await getQueue()).toEqual([]); // dropped, never queued — it would never be accepted
  });

  test('403 (unauthorized booking) still stops tracking regardless of message', async () => {
    mockSendLocation.mockRejectedValue({ response: { status: 403, data: { error: 'Unauthorized booking' } } });

    await taskExecutor({ data: { locations: [location] }, error: null });

    expect(mockStop).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  });

  test('401 (expired/invalid token) still stops tracking', async () => {
    mockSendLocation.mockRejectedValue({ response: { status: 401, data: {} } });

    await taskExecutor({ data: { locations: [location] }, error: null });

    expect(mockStop).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  });
});
