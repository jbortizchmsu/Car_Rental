// Pure, framework-free helpers for grouping a date range into day/week/month "trend"
// periods, all in Asia/Manila calendar terms — used only by the revenue-trend report
// endpoint. Does not touch any existing report's totals or date-filter logic.

const MANILA_TZ = 'Asia/Manila';

const manilaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MANILA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const manilaWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TZ,
  weekday: 'short',
});

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** A bare "YYYY-MM-DD" -> that Manila calendar day's midnight instant. Explicit +08:00
 *  offset (not process.env.TZ) — matches lib/validation.ts's manilaMidnight. */
export function manilaMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}

/** A bare "YYYY-MM-DD" -> the last instant of that Manila calendar day. */
export function manilaEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+08:00`);
}

/** Any JS Date, reduced to its own Manila calendar day, "YYYY-MM-DD". */
export function toManilaDateString(date: Date): string {
  return manilaDateFormatter.format(date);
}

/** 0=Monday .. 6=Sunday, computed from the date's own Manila calendar day. */
function manilaWeekdayIndex(dateStr: string): number {
  return WEEKDAY_INDEX[manilaWeekdayFormatter.format(manilaMidnight(dateStr))];
}

function addDaysToDateString(dateStr: string, days: number): string {
  const instant = manilaMidnight(dateStr).getTime() + days * 24 * 60 * 60 * 1000;
  return toManilaDateString(new Date(instant));
}

/** Last calendar day of the month containing `dateStr` (pure calendar arithmetic — the
 *  Date.UTC() call here is never treated as a real instant, only used for its rollover
 *  behavior to find a month's day count, so it's timezone-independent and safe). */
function lastDayOfMonthContaining(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function firstDayOfNextMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
}

/** Inclusive number of Manila calendar days spanned by [startDate, endDate]. */
export function daySpanInclusive(startDate: string, endDate: string): number {
  const startMs = manilaMidnight(startDate).getTime();
  const endMs = manilaMidnight(endDate).getTime();
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}

export type PeriodGrouping = 'day' | 'week' | 'month';

/** Day for ranges up to 31 days, week (Monday-start) up to ~183 days, month beyond that. */
export function chooseGrouping(startDate: string, endDate: string): PeriodGrouping {
  const span = daySpanInclusive(startDate, endDate);
  if (span <= 31) return 'day';
  if (span <= 183) return 'week';
  return 'month';
}

export interface ReportPeriod {
  label: string;
  /** The Manila calendar date this period starts on, "YYYY-MM-DD". */
  startDateStr: string;
  /** Real instant: Manila midnight of the period's first day. */
  start: Date;
  /** Real instant: Manila end-of-day of the period's last day. */
  end: Date;
}

function formatDayLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${MONTH_ABBR[month - 1]} ${day}`;
}

function formatMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number);
  return `${MONTH_ABBR[month - 1]} ${year}`;
}

/**
 * Splits [startDate, endDate] (inclusive, bare "YYYY-MM-DD", Manila calendar days) into
 * contiguous, non-overlapping periods per `grouping`. Every day in the range is covered
 * by exactly one period — callers that partition an already-fetched, matching record
 * set by these boundaries therefore get a lossless split (the sum across periods equals
 * the total for the whole range).
 *
 * Week periods start on Monday, but the first/last period are truncated to startDate/
 * endDate themselves — the range's own edges are never widened outside what was asked.
 * Month periods are calendar months, likewise truncated at both ends.
 */
export function buildReportPeriods(startDate: string, endDate: string, grouping: PeriodGrouping): ReportPeriod[] {
  const periods: ReportPeriod[] = [];

  if (grouping === 'day') {
    let cursor = startDate;
    while (cursor <= endDate) {
      periods.push({
        label: formatDayLabel(cursor),
        startDateStr: cursor,
        start: manilaMidnight(cursor),
        end: manilaEndOfDay(cursor),
      });
      cursor = addDaysToDateString(cursor, 1);
    }
    return periods;
  }

  if (grouping === 'week') {
    let periodStart = startDate;
    while (periodStart <= endDate) {
      const daysUntilSunday = 6 - manilaWeekdayIndex(periodStart);
      let periodEnd = addDaysToDateString(periodStart, daysUntilSunday);
      if (periodEnd > endDate) periodEnd = endDate;

      periods.push({
        label: formatDayLabel(periodStart),
        startDateStr: periodStart,
        start: manilaMidnight(periodStart),
        end: manilaEndOfDay(periodEnd),
      });
      periodStart = addDaysToDateString(periodEnd, 1);
    }
    return periods;
  }

  // month
  let periodStart = startDate;
  while (periodStart <= endDate) {
    let periodEnd = lastDayOfMonthContaining(periodStart);
    if (periodEnd > endDate) periodEnd = endDate;

    periods.push({
      label: formatMonthLabel(periodStart),
      startDateStr: periodStart,
      start: manilaMidnight(periodStart),
      end: manilaEndOfDay(periodEnd),
    });
    periodStart = firstDayOfNextMonth(periodStart);
  }
  return periods;
}
