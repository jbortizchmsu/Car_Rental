// GET /customer/notifications (server/src/routes/customer.ts) returns a paginated
// object shape — { data: Notification[], total, skip, take, hasMore } — not a bare
// array. NotificationsScreen previously set its list state directly to that object,
// so `.map()`/`.length` on it silently resolved to `undefined` and calling
// `undefined()` crashed the whole app on render (Hermes: "undefined is not a
// function"). This normalizer is the one place that ever has to know the response
// shape — everything downstream can assume it always gets a plain array.
export function normalizeNotificationsResponse(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: any[] }).data;
  }
  return [];
}

/** "—" for anything that isn't a valid date, so a malformed/missing createdAt never
 * renders "Invalid Date" or throws. */
export function formatNotificationTime(createdAt: unknown): string {
  if (typeof createdAt !== 'string' && typeof createdAt !== 'number') return '—';
  const date = new Date(createdAt as string | number);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

const DEFAULT_UNREAD_ACCENT = '#7B1FA2';
const DEFAULT_READ_ACCENT = '#F3F4F6';

/** Icon-background color for a notification row — tolerates a missing/non-boolean
 * `isRead` (treated as unread) instead of assuming the field is always present. */
export function getNotificationAccentColor(isRead: unknown): string {
  return isRead === true ? DEFAULT_READ_ACCENT : DEFAULT_UNREAD_ACCENT;
}
