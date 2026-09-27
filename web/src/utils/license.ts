// PH LTO driver's license number: 1 uppercase letter, 2 digits, hyphen, 2 digits,
// hyphen, 6 digits — e.g. N01-12-345678. Mirrors server/src/lib/validation.ts's
// licenseNumberSchema/normalizeLicenseNumber (kept in sync manually, same as other
// client-side mirrors of server validation in this codebase).
export const LICENSE_NUMBER_PATTERN = /^[A-Z]\d{2}-\d{2}-\d{6}$/;
export const LICENSE_NUMBER_MAX_LENGTH = 13; // "A00-00-000000"

/**
 * Formats a driver's license number as the user types: uppercases, strips anything
 * that isn't a letter or digit (including any hyphen the user typed themselves, so
 * pasted/partial input can't end up with a hyphen in the wrong place), then re-inserts
 * hyphens at the correct positions as enough characters are typed.
 */
export function formatLicenseNumberInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letter = cleaned.slice(0, 1);
  const digits = cleaned.slice(1, 11);

  let out = letter;
  if (digits.length > 0) out += digits.slice(0, 2);
  if (digits.length > 2) out += '-' + digits.slice(2, 4);
  if (digits.length > 4) out += '-' + digits.slice(4, 10);
  return out;
}

export function isValidLicenseNumber(value: string): boolean {
  return LICENSE_NUMBER_PATTERN.test(value);
}
