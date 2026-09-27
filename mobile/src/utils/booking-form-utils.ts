// Pure date/duration helpers extracted from BookingFormScreen.tsx so they can be unit-tested
// without importing that screen (which pulls in native modules that can't run outside a real
// app/device runtime, e.g. @react-native-async-storage/async-storage).

export const formatDateOnly = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatExpiryDisplay = (d: Date | null): string => {
  if (!d) return 'Select license expiry date...';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const calcDays = (start: Date, end: Date) => {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// PH LTO driver's license number: 1 uppercase letter, 2 digits, hyphen, 2 digits,
// hyphen, 6 digits — e.g. N01-12-345678. Mirrors server/src/lib/validation.ts's
// licenseNumberSchema/normalizeLicenseNumber and web/src/utils/license.ts (kept in
// sync manually — no shared validation module between server/web/mobile).
export const LICENSE_NUMBER_PATTERN = /^[A-Z]\d{2}-\d{2}-\d{6}$/;
export const LICENSE_NUMBER_MAX_LENGTH = 13; // "A00-00-000000"

/**
 * Formats a driver's license number as the user types: uppercases, strips anything
 * that isn't a letter or digit (including any hyphen the user typed themselves), then
 * re-inserts hyphens at the correct positions as enough characters are typed.
 */
export const formatLicenseNumberInput = (raw: string): string => {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letter = cleaned.slice(0, 1);
  const digits = cleaned.slice(1, 11);

  let out = letter;
  if (digits.length > 0) out += digits.slice(0, 2);
  if (digits.length > 2) out += '-' + digits.slice(2, 4);
  if (digits.length > 4) out += '-' + digits.slice(4, 10);
  return out;
};

export const isValidLicenseNumber = (value: string): boolean => LICENSE_NUMBER_PATTERN.test(value);
