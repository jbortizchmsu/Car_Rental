// Asia/Manila-aware date-range helpers for the Reports page's "Today" / "This Month"
// quick filters. Pure and framework-free — returns the same "YYYY-MM-DD" string format
// the page already sends to the server (AdminReportsPage.tsx's own `.toISOString()
// .split('T')[0]` convention), but computed via the actual Manila calendar day instead
// of a UTC conversion, which drifts a day off near midnight (e.g. 2am Manila is still
// the previous day in UTC).

const MANILA_TZ = 'Asia/Manila';

const manilaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MANILA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Any JS Date -> its own Manila calendar day, "YYYY-MM-DD" (en-CA formats this way). */
export function toManilaDateString(date: Date): string {
  return manilaDateFormatter.format(date);
}

export interface ReportDateRange {
  startDate: string;
  endDate: string;
}

/** Today's date to today's date, in Asia/Manila. */
export function getTodayRange(now: Date = new Date()): ReportDateRange {
  const today = toManilaDateString(now);
  return { startDate: today, endDate: today };
}

/** The 1st of the current Manila calendar month to today (also Manila). */
export function getThisMonthRange(now: Date = new Date()): ReportDateRange {
  const today = toManilaDateString(now);
  const [year, month] = today.split('-');
  return { startDate: `${year}-${month}-01`, endDate: today };
}
