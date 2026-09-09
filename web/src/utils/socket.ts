import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:4000';

/**
 * Opens a socket connection and joins the caller's authenticated room(s).
 * The server verifies the JWT itself and joins the socket to the server-derived
 * user id (and 'admin' room, if applicable) — the client never dictates which
 * room it lands in, it only supplies the token. Re-joins automatically on every
 * reconnect (including transient network drops), since Socket.IO rooms are not
 * preserved across a reconnect.
 */
export function connectAuthedSocket(): Socket {
  const socket = io(SOCKET_URL);

  const joinRoom = () => {
    const token = localStorage.getItem('jd_token');
    if (token) {
      socket.emit('join-room', { token });
    }
  };

  socket.on('connect', joinRoom);

  return socket;
}

/**
 * Re-fetches page data whenever a relevant real-time notification arrives for this
 * user (booking created/approved/rejected/released/returned/completed, payment
 * submitted/verified/rejected all already push a 'notification-created' event server
 * side — see server/src/lib/notifications.ts). Deliberately payload-agnostic: rather
 * than parsing the notification for booking-specific fields (fragile — the generic
 * notification helpers used at these call sites don't carry a structured type or
 * referenceId), it just re-runs the caller's existing fetch function, which is both
 * simpler and inherently null-safe against any payload shape.
 *
 * Also re-runs the fetch once after a reconnect (a dropped connection may have missed
 * events), and cleans up all listeners + disconnects the socket on unmount so remounts
 * never accumulate duplicate handlers.
 */
export function useNotificationRefresh(onEvent: () => void, enabled: boolean = true): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    const socket = connectAuthedSocket();
    const trigger = () => onEventRef.current();

    socket.on('notification-created', trigger);

    let hadDisconnected = false;
    const markDisconnected = () => { hadDisconnected = true; };
    const maybeResync = () => {
      if (hadDisconnected) {
        hadDisconnected = false;
        trigger();
      }
    };
    socket.on('disconnect', markDisconnected);
    socket.on('connect', maybeResync);

    return () => {
      socket.off('notification-created', trigger);
      socket.off('disconnect', markDisconnected);
      socket.off('connect', maybeResync);
      socket.disconnect();
    };
  }, [enabled]);
}
