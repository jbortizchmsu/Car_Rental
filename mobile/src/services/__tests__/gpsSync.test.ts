import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockFetch = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: (...args: any[]) => mockFetch(...args), addEventListener: jest.fn() },
}));

const mockSendLocationBatch = jest.fn();
jest.mock('../api', () => ({
  __esModule: true,
  gpsApi: { sendLocationBatch: (...args: any[]) => mockSendLocationBatch(...args) },
}));

import { enqueue, getQueue, QueuedGpsPoint } from '../gpsQueue';
import { flushGpsQueue } from '../gpsSync';

function makePoint(overrides: Partial<QueuedGpsPoint> = {}): QueuedGpsPoint {
  return {
    trackingSessionId: 'session-1',
    bookingId: 'booking-1',
    vehicleId: 'vehicle-1',
    latitude: 10.7391,
    longitude: 122.9691,
    recordedAt: '2026-09-13T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFetch.mockReset();
  mockSendLocationBatch.mockReset();
});

describe('flushGpsQueue', () => {
  test('empty queue: does nothing, never calls the batch API', async () => {
    mockFetch.mockResolvedValue({ isConnected: true });
    await flushGpsQueue();
    expect(mockSendLocationBatch).not.toHaveBeenCalled();
  });

  test('still offline: does not attempt the batch call, queue untouched', async () => {
    const p1 = makePoint();
    await enqueue(p1);
    mockFetch.mockResolvedValue({ isConnected: false });

    await flushGpsQueue();

    expect(mockSendLocationBatch).not.toHaveBeenCalled();
    expect(await getQueue()).toEqual([p1]);
  });

  test('full success: all points cleared from the local queue', async () => {
    const p1 = makePoint({ recordedAt: '2026-09-13T10:00:00.000Z' });
    const p2 = makePoint({ recordedAt: '2026-09-13T10:00:15.000Z' });
    await enqueue(p1);
    await enqueue(p2);
    mockFetch.mockResolvedValue({ isConnected: true });
    mockSendLocationBatch.mockResolvedValue({ data: { saved: 2, rejected: [] } });

    await flushGpsQueue();

    expect(mockSendLocationBatch).toHaveBeenCalledWith([p1, p2]);
    expect(await getQueue()).toEqual([]);
  });

  test('partial success: only the confirmed-saved points are cleared, rejected ones remain queued', async () => {
    const p1 = makePoint({ recordedAt: '2026-09-13T10:00:00.000Z' });
    const p2 = makePoint({ recordedAt: '2026-09-13T10:00:15.000Z' }); // will be "rejected"
    await enqueue(p1);
    await enqueue(p2);
    mockFetch.mockResolvedValue({ isConnected: true });
    mockSendLocationBatch.mockResolvedValue({
      data: { saved: 1, rejected: [{ point: p2, reason: 'stale' }] },
    });

    await flushGpsQueue();

    expect(await getQueue()).toEqual([p2]);
  });

  test('sends points in chronological order regardless of queue insertion order', async () => {
    const later = makePoint({ recordedAt: '2026-09-13T10:05:00.000Z', latitude: 2 });
    const earlier = makePoint({ recordedAt: '2026-09-13T10:00:00.000Z', latitude: 1 });
    await enqueue(later);
    await enqueue(earlier);
    mockFetch.mockResolvedValue({ isConnected: true });
    mockSendLocationBatch.mockResolvedValue({ data: { saved: 2, rejected: [] } });

    await flushGpsQueue();

    const sentArg = mockSendLocationBatch.mock.calls[0][0];
    expect(sentArg.map((p: QueuedGpsPoint) => p.latitude)).toEqual([1, 2]);
  });

  test('flush failure (network error mid-upload): queue left completely intact', async () => {
    const p1 = makePoint();
    await enqueue(p1);
    mockFetch.mockResolvedValue({ isConnected: true });
    mockSendLocationBatch.mockRejectedValue(new Error('Network Error'));

    await flushGpsQueue();

    expect(await getQueue()).toEqual([p1]);
  });

  test('concurrent flush calls: only one actually runs at a time (in-flight guard)', async () => {
    const p1 = makePoint();
    await enqueue(p1);
    mockFetch.mockResolvedValue({ isConnected: true });
    let resolveBatch: (v: any) => void;
    mockSendLocationBatch.mockReturnValue(new Promise((resolve) => { resolveBatch = resolve; }));

    const flush1 = flushGpsQueue();
    const flush2 = flushGpsQueue(); // should be a no-op, flush1 still in flight

    resolveBatch!({ data: { saved: 1, rejected: [] } });
    await Promise.all([flush1, flush2]);

    expect(mockSendLocationBatch).toHaveBeenCalledTimes(1);
  });
});
