import { bookingDateRangeSchema } from '../validation';

// Builds a local-time ISO-ish string in the exact shape the frontend's formatApiDate()
// sends (no timezone marker) — "YYYY-MM-DDTHH:MM:00".
function localDateTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}:00`;
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return dateStr.replace(/^\d{4}-\d{2}-\d{2}/, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
}

describe('bookingDateRangeSchema — 6 AM–6 PM booking window', () => {
  test('accepts a pickup/return time within the window (9:00 AM start, 5:00 PM end next day)', () => {
    const startDate = localDateTime(9, 0);
    const endDate = nextDay(localDateTime(17, 0));

    const result = bookingDateRangeSchema.safeParse({ startDate, endDate });

    expect(result.success).toBe(true);
  });

  test('accepts exactly 6:00 AM and exactly 6:00 PM (inclusive boundary)', () => {
    const startDate = localDateTime(6, 0);
    const endDate = nextDay(localDateTime(18, 0));

    const result = bookingDateRangeSchema.safeParse({ startDate, endDate });

    expect(result.success).toBe(true);
  });

  test('rejects a pickup time before 6:00 AM', () => {
    const startDate = localDateTime(5, 30);
    const endDate = nextDay(localDateTime(12, 0));

    const result = bookingDateRangeSchema.safeParse({ startDate, endDate });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Pickup time must be between 6:00 AM and 6:00 PM.');
      expect(result.error.issues[0].path).toEqual(['startDate']);
    }
  });

  test('rejects a return time after 6:00 PM (6:30 PM)', () => {
    const startDate = localDateTime(9, 0);
    const endDate = nextDay(localDateTime(18, 30));

    const result = bookingDateRangeSchema.safeParse({ startDate, endDate });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Return time must be between 6:00 AM and 6:00 PM.');
      expect(result.error.issues[0].path).toEqual(['endDate']);
    }
  });

  test('still rejects endDate <= startDate (existing date-order check, unaffected by the new window check)', () => {
    const startDate = localDateTime(10, 0);
    const endDate = localDateTime(9, 0); // earlier, same day

    const result = bookingDateRangeSchema.safeParse({ startDate, endDate });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('End date must be after start date');
    }
  });
});
