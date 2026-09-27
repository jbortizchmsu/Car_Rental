import {
  bookingDateRangeSchema,
  normalizeLicenseNumber,
  licenseNumberSchema,
  licenseExpirySchema,
  toManilaDateString,
} from '../validation';

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

describe('normalizeLicenseNumber', () => {
  test('already correctly formatted → unchanged', () => {
    expect(normalizeLicenseNumber('N01-12-345678')).toBe('N01-12-345678');
  });

  test('lowercase, no hyphens → uppercased and hyphenated', () => {
    expect(normalizeLicenseNumber('n0112345678')).toBe('N01-12-345678');
  });

  test('lowercase with spaces, no hyphens → uppercased, spaces stripped, hyphenated', () => {
    expect(normalizeLicenseNumber('n01 12 345678')).toBe('N01-12-345678');
  });

  test('lowercase, already hyphenated, with stray spaces around hyphens → uppercased, spaces stripped', () => {
    expect(normalizeLicenseNumber(' n01-12-345678 ')).toBe('N01-12-345678');
  });

  test('whitespace-only → empty string (not a valid 11-char compact form)', () => {
    expect(normalizeLicenseNumber('   ')).toBe('');
  });

  test('wrong length, no hyphens → left as compact form, not hyphenated (fails the pattern check downstream)', () => {
    expect(normalizeLicenseNumber('N011234567')).toBe('N011234567'); // 10 chars, one short
  });
});

describe('licenseNumberSchema', () => {
  test('valid, already formatted → accepted, value unchanged', () => {
    const result = licenseNumberSchema.safeParse('N01-12-345678');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('N01-12-345678');
  });

  test('lowercase, no hyphens → accepted and normalized', () => {
    const result = licenseNumberSchema.safeParse('n0112345678');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('N01-12-345678');
  });

  test('lowercase with spaces → accepted and normalized', () => {
    const result = licenseNumberSchema.safeParse('  n01 12 345678  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('N01-12-345678');
  });

  test('wrong letter count (two letters) → rejected', () => {
    const result = licenseNumberSchema.safeParse('NN01-12-345678');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'License number must follow the format A00-00-000000 (e.g., N01-12-345678)'
      );
    }
  });

  test('wrong digit count (last group too short) → rejected', () => {
    const result = licenseNumberSchema.safeParse('N01-12-34567');
    expect(result.success).toBe(false);
  });

  test('extra trailing character → rejected', () => {
    const result = licenseNumberSchema.safeParse('N01-12-345678X');
    expect(result.success).toBe(false);
  });

  test('whitespace-only → rejected', () => {
    const result = licenseNumberSchema.safeParse('   ');
    expect(result.success).toBe(false);
  });
});

describe('licenseExpirySchema', () => {
  function manilaOffsetDateString(days: number): string {
    return toManilaDateString(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
  }

  function addYears(dateStr: string, years: number): string {
    const [y, m, d] = dateStr.split('-');
    return `${Number(y) + years}-${m}-${d}`;
  }

  function addDays(dateStr: string, days: number): string {
    const instant = new Date(`${dateStr}T00:00:00+08:00`).getTime() + days * 24 * 60 * 60 * 1000;
    return toManilaDateString(new Date(instant));
  }

  test('expiry exactly today → accepted (not yet in the past)', () => {
    const result = licenseExpirySchema.safeParse(manilaOffsetDateString(0));
    expect(result.success).toBe(true);
  });

  test('expiry yesterday → rejected as expired', () => {
    const result = licenseExpirySchema.safeParse(manilaOffsetDateString(-1));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Your driver's license has expired.");
    }
  });

  test('expiry one year from now → accepted', () => {
    const result = licenseExpirySchema.safeParse(manilaOffsetDateString(365));
    expect(result.success).toBe(true);
  });

  test('invalid date string → rejected', () => {
    const result = licenseExpirySchema.safeParse('not-a-date');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('License expiry date is invalid.');
    }
  });

  test('impossible calendar date (month 13) → rejected as invalid', () => {
    const result = licenseExpirySchema.safeParse('2026-13-01');
    expect(result.success).toBe(false);
  });

  test('exactly 10 years from today → accepted (boundary inclusive)', () => {
    const tenYearsOut = addYears(manilaOffsetDateString(0), 10);
    const result = licenseExpirySchema.safeParse(tenYearsOut);
    expect(result.success).toBe(true);
  });

  test('10 years and 1 day from today → rejected as too far in the future', () => {
    const beyondTenYears = addDays(addYears(manilaOffsetDateString(0), 10), 1);
    const result = licenseExpirySchema.safeParse(beyondTenYears);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'License expiry date cannot be more than 10 years in the future.'
      );
    }
  });
});
