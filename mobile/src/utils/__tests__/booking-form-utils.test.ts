import { formatDateOnly, formatExpiryDisplay, calcDays } from '../booking-form-utils';

describe('formatDateOnly', () => {
  test('single-digit month/day are zero-padded', () => {
    const d = new Date(2026, 0, 5); // Jan 5 2026
    expect(formatDateOnly(d)).toBe('2026-01-05');
  });

  test('double-digit month/day are left unchanged', () => {
    const d = new Date(2026, 11, 25); // Dec 25 2026
    expect(formatDateOnly(d)).toBe('2026-12-25');
  });
});

describe('formatExpiryDisplay', () => {
  test('null → placeholder text', () => {
    expect(formatExpiryDisplay(null)).toBe('Select license expiry date...');
  });

  test('a valid Date → correctly localized short date string', () => {
    const d = new Date(2026, 5, 15); // Jun 15 2026
    expect(formatExpiryDisplay(d)).toBe(d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }));
  });
});

describe('calcDays', () => {
  test('normal multi-day range → ceil of the day difference', () => {
    const start = new Date(2026, 5, 1);
    const end = new Date(2026, 5, 4); // 3 days later
    expect(calcDays(start, end)).toBe(3);
  });

  test('same start/end date → clamps to 1 (never returns 0)', () => {
    const d = new Date(2026, 5, 1, 9, 0, 0);
    expect(calcDays(d, d)).toBe(1);
  });

  test('end date before start date → clamps to 1 (does not go negative)', () => {
    const start = new Date(2026, 5, 5);
    const end = new Date(2026, 5, 2); // 3 days earlier
    expect(calcDays(start, end)).toBe(1);
  });

  test('end date only a few hours after start on the same calendar day → still rounds up to 1 full day', () => {
    const start = new Date(2026, 5, 1, 9, 0, 0);
    const end = new Date(2026, 5, 1, 20, 0, 0); // 11 hours later, same day
    expect(calcDays(start, end)).toBe(1);
  });
});
