export type DateDisplayStyle = 'long' | 'short' | 'datetime';

const OPTIONS: Record<DateDisplayStyle, Intl.DateTimeFormatOptions> = {
  // "September 22, 2026" — cards, detail panels, banners, timeline entries, notification text
  long: { month: 'long', day: 'numeric', year: 'numeric' },
  // "Sep 22, 2026" — dense table columns, map tooltips
  short: { month: 'short', day: 'numeric', year: 'numeric' },
  // "Sep 22, 2026, 2:30 PM" — timestamps: last login, GPS points, notification detail, status timeline
  datetime: { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true },
};

/**
 * The one shared date-display helper — replaces ad-hoc toLocaleDateString()/
 * toLocaleString() calls across the app so every UI spells out the month name
 * consistently instead of showing numeric dates. Returns '—' for a null/undefined/
 * invalid date rather than throwing, so callers that don't already guard with their
 * own fallback text (e.g. 'Never', 'N/A') still render something sensible.
 */
export function formatDate(date: string | Date | null | undefined, style: DateDisplayStyle = 'long'): string {
  if (date === null || date === undefined || date === '') return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', OPTIONS[style]);
}
