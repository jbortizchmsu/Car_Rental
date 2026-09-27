import { describe, test, expect } from 'vitest';
import { getTodayRange, getThisMonthRange, toManilaDateString } from '../report-date-ranges';

// Each `now` below is a real UTC instant (via `new Date(isoUtcString)`), chosen so its
// Manila calendar date (UTC+8) is exactly what each test name says — this is the whole
// point of the helper: it must react to the Manila day, not the UTC day.

describe('getTodayRange', () => {
  test('a normal mid-month time (Manila afternoon) → today to today, in Manila', () => {
    // 2026-09-15T06:00:00Z = 2026-09-15 14:00 in Manila.
    const now = new Date('2026-09-15T06:00:00.000Z');
    expect(getTodayRange(now)).toEqual({ startDate: '2026-09-15', endDate: '2026-09-15' });
  });

  test('the 1st of a month', () => {
    // 2026-03-01T04:00:00Z = 2026-03-01 12:00 in Manila.
    const now = new Date('2026-03-01T04:00:00.000Z');
    expect(getTodayRange(now)).toEqual({ startDate: '2026-03-01', endDate: '2026-03-01' });
  });

  test('late at night in Manila, where UTC is still the previous day', () => {
    // 2026-09-15T23:30:00Z = 2026-09-16 07:30 in Manila — UTC says the 15th, Manila the 16th.
    const now = new Date('2026-09-15T23:30:00.000Z');
    expect(toManilaDateString(now)).toBe('2026-09-16');
    expect(getTodayRange(now)).toEqual({ startDate: '2026-09-16', endDate: '2026-09-16' });
  });

  test('early morning in Manila, where UTC is already the next day', () => {
    // 2026-09-16T17:00:00Z = 2026-09-17 01:00 in Manila — UTC says the 16th, Manila the 17th.
    const now = new Date('2026-09-16T17:00:00.000Z');
    expect(toManilaDateString(now)).toBe('2026-09-17');
    expect(getTodayRange(now)).toEqual({ startDate: '2026-09-17', endDate: '2026-09-17' });
  });

  test('December to January (a Manila New Year\'s Eve/Day boundary)', () => {
    // 2026-12-31T17:00:00Z = 2027-01-01 01:00 in Manila.
    const now = new Date('2026-12-31T17:00:00.000Z');
    expect(getTodayRange(now)).toEqual({ startDate: '2027-01-01', endDate: '2027-01-01' });
  });
});

describe('getThisMonthRange', () => {
  test('a normal mid-month date → the 1st of that month to today', () => {
    const now = new Date('2026-09-15T06:00:00.000Z'); // Sep 15 in Manila
    expect(getThisMonthRange(now)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-15' });
  });

  test('the 1st of a month → "this month" is just that one day', () => {
    const now = new Date('2026-03-01T04:00:00.000Z'); // Mar 1 in Manila
    expect(getThisMonthRange(now)).toEqual({ startDate: '2026-03-01', endDate: '2026-03-01' });
  });

  test('late at night in Manila (UTC still previous day) does not shift the month start', () => {
    const now = new Date('2026-09-15T23:30:00.000Z'); // Sep 16 in Manila
    expect(getThisMonthRange(now)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-16' });
  });

  test('early morning in Manila (UTC already next day) does not shift the month start', () => {
    const now = new Date('2026-09-16T17:00:00.000Z'); // Sep 17 in Manila
    expect(getThisMonthRange(now)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-17' });
  });

  test('December to January — the month start rolls over to the new year, not December', () => {
    const now = new Date('2026-12-31T17:00:00.000Z'); // Jan 1, 2027 in Manila
    expect(getThisMonthRange(now)).toEqual({ startDate: '2027-01-01', endDate: '2027-01-01' });
  });
});
