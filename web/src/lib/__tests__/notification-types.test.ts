import { describe, test, expect } from 'vitest';
import { getRelativeTime } from '../notification-types';

function secondsAgo(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000);
}
function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describe('getRelativeTime', () => {
  test('30 seconds ago → "just now"', () => {
    expect(getRelativeTime(secondsAgo(30))).toBe('just now');
  });

  test('45 minutes ago → "45m ago"', () => {
    expect(getRelativeTime(minutesAgo(45))).toBe('45m ago');
  });

  test('5 hours ago → "5h ago"', () => {
    expect(getRelativeTime(hoursAgo(5))).toBe('5h ago');
  });

  test('3 days ago → "3d ago"', () => {
    expect(getRelativeTime(daysAgo(3))).toBe('3d ago');
  });

  test('10 days ago → falls through to locale date string', () => {
    const date = daysAgo(10);
    expect(getRelativeTime(date)).toBe(date.toLocaleDateString());
  });

  test('accepts both a string and a Date input for the same instant → identical output', () => {
    const instant = hoursAgo(2);
    const asDate = getRelativeTime(instant);
    const asString = getRelativeTime(instant.toISOString());
    expect(asString).toBe(asDate);
  });
});
