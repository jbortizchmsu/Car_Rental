import {
  chooseGrouping,
  buildReportPeriods,
  daySpanInclusive,
  toManilaDateString,
  manilaMidnight,
  manilaEndOfDay,
} from '../report-periods';

describe('daySpanInclusive', () => {
  test('same day → span of 1', () => {
    expect(daySpanInclusive('2026-09-28', '2026-09-28')).toBe(1);
  });

  test('two consecutive days → span of 2', () => {
    expect(daySpanInclusive('2026-09-28', '2026-09-29')).toBe(2);
  });

  test('a full 31-day month → span of 31', () => {
    expect(daySpanInclusive('2026-01-01', '2026-01-31')).toBe(31);
  });
});

describe('chooseGrouping', () => {
  test('today (1 day) → day', () => {
    expect(chooseGrouping('2026-09-28', '2026-09-28')).toBe('day');
  });

  test('exactly 31 days → day', () => {
    expect(chooseGrouping('2026-01-01', '2026-01-31')).toBe('day');
  });

  test('32 days → week', () => {
    expect(chooseGrouping('2026-01-01', '2026-02-01')).toBe('week');
  });

  test('exactly 183 days → week', () => {
    // 183 days inclusive starting 2026-01-01 ends 2026-07-02 (2026 is not a leap year).
    expect(daySpanInclusive('2026-01-01', '2026-07-02')).toBe(183);
    expect(chooseGrouping('2026-01-01', '2026-07-02')).toBe('week');
  });

  test('184 days → month', () => {
    expect(daySpanInclusive('2026-01-01', '2026-07-03')).toBe(184);
    expect(chooseGrouping('2026-01-01', '2026-07-03')).toBe('month');
  });

  test('a multi-year range → month', () => {
    expect(chooseGrouping('2024-01-01', '2026-12-31')).toBe('month');
  });
});

describe('buildReportPeriods — day grouping', () => {
  test('one period per calendar day', () => {
    const periods = buildReportPeriods('2026-09-26', '2026-09-28', 'day');
    expect(periods).toHaveLength(3);
    expect(periods.map((p) => p.startDateStr)).toEqual(['2026-09-26', '2026-09-27', '2026-09-28']);
    expect(periods.map((p) => p.label)).toEqual(['Sep 26', 'Sep 27', 'Sep 28']);
  });

  test('a single day → one period, start/end are the same Manila calendar day', () => {
    const periods = buildReportPeriods('2026-09-28', '2026-09-28', 'day');
    expect(periods).toHaveLength(1);
    expect(toManilaDateString(periods[0].start)).toBe('2026-09-28');
    expect(toManilaDateString(periods[0].end)).toBe('2026-09-28');
  });

  test('period boundaries are exact Manila midnight / end-of-day instants', () => {
    const periods = buildReportPeriods('2026-09-28', '2026-09-28', 'day');
    expect(periods[0].start.getTime()).toBe(manilaMidnight('2026-09-28').getTime());
    expect(periods[0].end.getTime()).toBe(manilaEndOfDay('2026-09-28').getTime());
  });
});

describe('buildReportPeriods — week grouping (Monday-start)', () => {
  test('a range starting mid-week and ending mid-week produces truncated first/last periods without exceeding the requested range', () => {
    // 2026-09-28 is a Monday; the range below spans exactly 3 full weeks.
    const periods = buildReportPeriods('2026-09-16', '2026-10-05', 'week');
    // First requested day, and last requested day, must never be widened outside the range.
    expect(periods[0].startDateStr).toBe('2026-09-16');
    expect(toManilaDateString(periods[periods.length - 1].end)).toBe('2026-10-05');
  });

  test('a range that is exactly one Monday-to-Sunday week produces exactly one period', () => {
    const periods = buildReportPeriods('2026-09-21', '2026-09-27', 'week'); // Mon..Sun
    expect(periods).toHaveLength(1);
    expect(periods[0].startDateStr).toBe('2026-09-21');
    expect(toManilaDateString(periods[0].end)).toBe('2026-09-27');
  });

  test('every day in the range is covered by exactly one period (no gaps, no overlaps)', () => {
    const periods = buildReportPeriods('2026-08-01', '2026-09-15', 'week');
    for (let i = 1; i < periods.length; i++) {
      const prevEnd = toManilaDateString(periods[i - 1].end);
      const currStart = periods[i].startDateStr;
      const dayAfterPrevEnd = toManilaDateString(new Date(manilaMidnight(prevEnd).getTime() + 24 * 60 * 60 * 1000));
      expect(currStart).toBe(dayAfterPrevEnd);
    }
  });
});

describe('buildReportPeriods — month grouping', () => {
  test('a range crossing a year boundary produces one period per calendar month, each labeled with its year', () => {
    const periods = buildReportPeriods('2025-11-15', '2026-02-10', 'month');
    expect(periods.map((p) => p.label)).toEqual(['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026']);
  });

  test('first and last periods are truncated to the requested range, not the full calendar month', () => {
    const periods = buildReportPeriods('2025-11-15', '2026-02-10', 'month');
    expect(periods[0].startDateStr).toBe('2025-11-15');
    expect(toManilaDateString(periods[periods.length - 1].end)).toBe('2026-02-10');
  });

  test('a range of exactly one full calendar month → one period', () => {
    const periods = buildReportPeriods('2026-02-01', '2026-02-28', 'month');
    expect(periods).toHaveLength(1);
    expect(periods[0].label).toBe('Feb 2026');
  });

  test('February month-end boundary is computed correctly (28 days, non-leap year)', () => {
    const periods = buildReportPeriods('2026-02-01', '2026-03-31', 'month');
    expect(toManilaDateString(periods[0].end)).toBe('2026-02-28');
  });
});

describe('buildReportPeriods — no-data / boundary cases', () => {
  test('a range with zero matching data still produces the full period list (callers show 0)', () => {
    // The function itself never looks at any data — it always returns the full period
    // shape for the requested range, regardless of whether anything happened in it.
    const periods = buildReportPeriods('2026-09-28', '2026-09-28', 'day');
    expect(periods).toHaveLength(1);
  });
});
