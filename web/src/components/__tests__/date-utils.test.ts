import { describe, test, expect } from 'vitest';
import { formatApiDate, getLocalStartOfToday, isToday } from '../BookingRequestModal';

describe('formatApiDate', () => {
  test('single-digit month/day/hour/minute/second are correctly zero-padded', () => {
    const d = new Date(2026, 0, 5, 3, 4, 5); // Jan 5 2026, 03:04:05
    expect(formatApiDate(d)).toBe('2026-01-05T03:04:05');
  });

  test('all double-digit components produce no extra padding', () => {
    const d = new Date(2026, 11, 25, 23, 45, 30); // Dec 25 2026, 23:45:30
    expect(formatApiDate(d)).toBe('2026-12-25T23:45:30');
  });
});

describe('getLocalStartOfToday', () => {
  test('returns a Date with hours/minutes/seconds/ms all zero, matching today\'s Y/M/D', () => {
    const result = getLocalStartOfToday();
    const now = new Date();

    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
    expect(result.getDate()).toBe(now.getDate());
  });
});

describe('isToday', () => {
  test('null input → false', () => {
    expect(isToday(null)).toBe(false);
  });

  test('a date matching today\'s calendar date (different time-of-day) → true', () => {
    const now = new Date();
    const laterToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    expect(isToday(laterToday)).toBe(true);
  });

  test('a date one day before today → false', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });

  test('a date one day after today → false', () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    expect(isToday(tomorrow)).toBe(false);
  });
});
