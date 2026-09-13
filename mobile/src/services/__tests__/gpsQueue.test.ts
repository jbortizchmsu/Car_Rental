import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueue, getQueue, clearSent, queueSize, QueuedGpsPoint } from '../gpsQueue';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

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
});

describe('gpsQueue', () => {
  test('empty queue by default', async () => {
    expect(await getQueue()).toEqual([]);
    expect(await queueSize()).toBe(0);
  });

  test('enqueue persists a point, survives a fresh read (simulating app restart)', async () => {
    const point = makePoint();
    await enqueue(point);
    expect(await getQueue()).toEqual([point]);
    expect(await queueSize()).toBe(1);
  });

  test('multiple enqueues accumulate in order', async () => {
    const p1 = makePoint({ recordedAt: '2026-09-13T10:00:00.000Z' });
    const p2 = makePoint({ recordedAt: '2026-09-13T10:00:15.000Z' });
    await enqueue(p1);
    await enqueue(p2);
    expect(await getQueue()).toEqual([p1, p2]);
  });

  test('clearSent removes only the specified points, leaves the rest (partial-batch-success)', async () => {
    const p1 = makePoint({ recordedAt: '2026-09-13T10:00:00.000Z' });
    const p2 = makePoint({ recordedAt: '2026-09-13T10:00:15.000Z' });
    const p3 = makePoint({ recordedAt: '2026-09-13T10:00:30.000Z' });
    await enqueue(p1);
    await enqueue(p2);
    await enqueue(p3);

    // Simulate: backend confirmed p1 and p3 saved, rejected p2.
    await clearSent([p1, p3]);

    expect(await getQueue()).toEqual([p2]);
  });

  test('clearSent with an empty list is a no-op', async () => {
    const p1 = makePoint();
    await enqueue(p1);
    await clearSent([]);
    expect(await getQueue()).toEqual([p1]);
  });

  test('queue caps at MAX_QUEUE_SIZE by dropping the OLDEST points', async () => {
    // Push more than the 2000 cap and confirm the oldest ones are the ones dropped.
    for (let i = 0; i < 2005; i++) {
      await enqueue(makePoint({ recordedAt: `2026-09-13T10:${String(i % 60).padStart(2, '0')}:00.000Z`, latitude: i }));
    }
    const queue = await getQueue();
    expect(queue.length).toBe(2000);
    // The first 5 pushed (latitude 0-4) should have been dropped as the oldest.
    expect(queue[0].latitude).toBe(5);
    expect(queue[queue.length - 1].latitude).toBe(2004);
  });
});
