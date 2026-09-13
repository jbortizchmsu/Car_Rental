import AsyncStorage from '@react-native-async-storage/async-storage';

// Local, on-device queue for GPS points that couldn't be sent immediately (device
// offline). AsyncStorage (a single JSON-array key) is used rather than SQLite —
// at 15s-interval pings, even several hours offline is only a few hundred points,
// well within what a JSON-array-under-one-key approach handles comfortably.

export interface QueuedGpsPoint {
  trackingSessionId: string;
  bookingId: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt: string;
}

const QUEUE_KEY = 'jd_gps_queue';
// Defensive cap for an extreme/unexpected offline duration — drop the OLDEST points
// once past this, rather than growing unbounded. Unlikely to ever be reached in
// practice (a normal rental period at 15s intervals is nowhere close to this).
const MAX_QUEUE_SIZE = 2000;

export async function getQueue(): Promise<QueuedGpsPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[GPS Queue] Failed to read queue, treating as empty:', err);
    return [];
  }
}

export async function enqueue(point: QueuedGpsPoint): Promise<void> {
  try {
    const queue = await getQueue();
    queue.push(point);
    if (queue.length > MAX_QUEUE_SIZE) {
      queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[GPS Queue] Failed to enqueue point (point is lost):', err);
  }
}

// A point is uniquely identified, for dedup/removal purposes, by (bookingId,
// recordedAt) — this app only ever produces one reading per booking per timestamp.
function pointKey(p: QueuedGpsPoint): string {
  return `${p.bookingId}|${p.recordedAt}`;
}

/**
 * Removes only the given points from the queue — never a blind full-clear. Needed
 * because a batch upload can partially succeed (some points saved, some rejected as
 * stale/malformed); only the confirmed-saved ones should ever be removed locally.
 */
export async function clearSent(sentPoints: QueuedGpsPoint[]): Promise<void> {
  if (sentPoints.length === 0) return;
  try {
    const sentKeys = new Set(sentPoints.map(pointKey));
    const queue = await getQueue();
    const remaining = queue.filter((p) => !sentKeys.has(pointKey(p)));
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch (err) {
    console.error('[GPS Queue] Failed to clear sent points:', err);
  }
}

export async function queueSize(): Promise<number> {
  return (await getQueue()).length;
}
