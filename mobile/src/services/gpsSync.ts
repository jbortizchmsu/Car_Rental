import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { gpsApi } from './api';
import { getQueue, clearSent, QueuedGpsPoint } from './gpsQueue';

// Simple in-flight guard — prevents overlapping flush attempts from rapid
// online/offline/online connectivity flaps or a foreground event firing while a
// NetInfo-triggered flush is already running.
let flushInFlight = false;

function pointKey(p: QueuedGpsPoint): string {
  return `${p.bookingId}|${p.recordedAt}`;
}

/**
 * Uploads whatever is currently queued, via the batch endpoint, then removes only the
 * points the backend actually confirms as saved (never a blind full-clear — a batch
 * can partially succeed, e.g. some points now too stale per the server's grace-window
 * check). If the flush itself fails (e.g. reconnected only briefly), the queue is left
 * completely untouched for the next attempt.
 */
export async function flushGpsQueue(): Promise<void> {
  if (flushInFlight) return;
  flushInFlight = true;

  try {
    const queue = await getQueue();
    if (queue.length === 0) return;

    const net = await NetInfo.fetch();
    if (!net.isConnected) return; // still offline — nothing to do yet

    // Defense in depth — the backend also sorts, but sending in order costs nothing.
    const sorted = [...queue].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    const response = await gpsApi.sendLocationBatch(sorted);
    const rejectedPoints: QueuedGpsPoint[] = response.data?.rejected?.map((r: any) => r.point) ?? [];
    const rejectedKeys = new Set(rejectedPoints.map(pointKey));
    const confirmedSaved = sorted.filter((p) => !rejectedKeys.has(pointKey(p)));

    await clearSent(confirmedSaved);
  } catch (err) {
    // Network/server error during the flush itself — leave the queue intact,
    // the next reconnect or foreground event will retry.
    console.error('[GPS Sync] Flush failed, queue left intact for retry:', err);
  } finally {
    flushInFlight = false;
  }
}

/**
 * Starts listening for (a) connectivity transitioning from offline to online, and
 * (b) the app returning to the foreground — both trigger a flush attempt, covering
 * the case where a connectivity-change event was missed while backgrounded. Also
 * flushes once immediately on start, to cover the app-was-just-launched case. Returns
 * an unsubscribe function.
 */
export function startGpsSyncListener(): () => void {
  let wasConnected: boolean | null = null;

  const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const isConnected = !!state.isConnected;
    if (isConnected && wasConnected === false) {
      flushGpsQueue();
    }
    wasConnected = isConnected;
  });

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      flushGpsQueue();
    }
  };
  const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Opportunistic flush on start — covers app launch with a queue left over from
  // a previous session (e.g. the app was force-closed while offline).
  flushGpsQueue();

  return () => {
    netInfoUnsubscribe();
    appStateSubscription.remove();
  };
}
