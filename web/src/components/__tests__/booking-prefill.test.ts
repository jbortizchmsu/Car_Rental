import { describe, test, expect } from 'vitest';
import { buildPrefill } from '../BookingRequestModal';

// A fixed "now" well before any date under test unless a test overrides it, so results never
// depend on when the suite runs.
const EARLY = new Date(2026, 8, 1, 8, 0, 0); // Sep 1 2026, 8:00 AM

describe('buildPrefill — dates carried over from the vehicle list', () => {
  test('future pickup and return get the 9 AM / 5 PM defaults', () => {
    expect(buildPrefill('2026-09-10', '2026-09-13', EARLY)).toEqual({
      start: '2026-09-10T09:00:00',
      end: '2026-09-13T17:00:00',
    });
  });

  test('pickup only: pickup is prefilled, return is left for the customer to choose', () => {
    expect(buildPrefill('2026-09-10', '', EARLY)).toEqual({ start: '2026-09-10T09:00:00', end: '' });
  });

  test('no dates at all: opens blank, exactly as before this feature', () => {
    expect(buildPrefill('', '', EARLY)).toEqual({ start: '', end: '' });
    expect(buildPrefill(undefined, undefined, EARLY)).toEqual({ start: '', end: '' });
  });

  test('malformed input never seeds anything', () => {
    expect(buildPrefill('not-a-date', '2026-09-13', EARLY)).toEqual({ start: '', end: '' });
    expect(buildPrefill('2026-09-10T09:00:00', '2026-09-13', EARLY)).toEqual({ start: '', end: '' });
  });

  test('return before pickup is not seeded (return left blank)', () => {
    expect(buildPrefill('2026-09-13', '2026-09-10', EARLY)).toEqual({ start: '2026-09-13T09:00:00', end: '' });
  });

  test('same-day rental: 9 AM to 5 PM', () => {
    expect(buildPrefill('2026-09-10', '2026-09-10', EARLY)).toEqual({
      start: '2026-09-10T09:00:00',
      end: '2026-09-10T17:00:00',
    });
  });
});

describe('buildPrefill — pickup on today, when 9 AM may already be in the past', () => {
  test('before 9 AM: the plain 9 AM default is still in the future, so it is kept', () => {
    const now = new Date(2026, 8, 10, 7, 15, 0);
    expect(buildPrefill('2026-09-10', '2026-09-12', now).start).toBe('2026-09-10T09:00:00');
  });

  test('2:10 PM: rolls to the next half-hour slot (2:30 PM) rather than seeding a past time', () => {
    const now = new Date(2026, 8, 10, 14, 10, 0);
    expect(buildPrefill('2026-09-10', '2026-09-12', now)).toEqual({
      start: '2026-09-10T14:30:00',
      end: '2026-09-12T17:00:00',
    });
  });

  test('exactly on a slot boundary (2:30 PM sharp) keeps that slot', () => {
    const now = new Date(2026, 8, 10, 14, 30, 0);
    expect(buildPrefill('2026-09-10', '', now).start).toBe('2026-09-10T14:30:00');
  });

  test('after the 6 PM cutoff: nothing valid is left today, so no prefill at all', () => {
    const now = new Date(2026, 8, 10, 18, 5, 0);
    expect(buildPrefill('2026-09-10', '2026-09-12', now)).toEqual({ start: '', end: '' });
  });

  test('late same-day pickup (5:30 PM): return moves to 6 PM instead of a 5 PM return before the pickup', () => {
    const now = new Date(2026, 8, 10, 17, 20, 0);
    expect(buildPrefill('2026-09-10', '2026-09-10', now)).toEqual({
      start: '2026-09-10T17:30:00',
      end: '2026-09-10T18:00:00',
    });
  });

  test('same-day pickup at the very end of the window (6:00 PM): no valid return, so return stays blank', () => {
    const now = new Date(2026, 8, 10, 17, 45, 0);
    expect(buildPrefill('2026-09-10', '2026-09-10', now)).toEqual({ start: '2026-09-10T18:00:00', end: '' });
  });
});
