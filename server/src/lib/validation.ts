import { z } from 'zod';

// PH mobile numbers as the frontend already enforces them (RegisterPage.tsx:
// inputMode="numeric" pattern="[0-9]{11}" maxLength={11}) — 11 digits, no spaces/dashes.
export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, 'Phone number must be exactly 11 digits');

// Registration: validates ONLY what the existing manual checks in auth.ts don't already
// cover (email format, phone format, required name/address) — deliberately does not
// duplicate the existing required/length/match checks for email/password/confirmPassword,
// so those keep their exact existing error messages for the cases they already catch.
export const registerSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address'),
  fullName: z.string().trim().min(1, 'Full name is required'),
  phoneNumber: phoneNumberSchema,
  address: z.string().trim().min(1, 'Address is required'),
});

// Booking creation: validates ONLY what the existing manual checks in bookings.ts
// don't already cover. The existing checks already verify every field is present
// (non-empty) — this adds the check they're missing: that startDate/endDate are
// actually parseable dates and that endDate is after startDate. Without this,
// a garbage date string reaches calculateBookingPrice() (NaN math) and Prisma's
// insert (Invalid Date), surfacing as an opaque 500 instead of a clear 400.
// Pickup/return handover window — 6:00 AM through 6:00 PM, inclusive of both endpoints
// (mirrors a typical "business hours" closed interval: 6 PM sharp is still a valid
// handover moment, 6:01 PM is not). Reads the Date's local hour/minute directly — the
// frontend's formatApiDate() sends startDate/endDate as timezone-less local datetime
// strings ("2026-09-23T14:30:00"), so `new Date(str)` parses them as local wall-clock
// time in whatever timezone this process runs in, and .getHours()/.getMinutes() read
// that same wall-clock value back — self-consistent regardless of server timezone
// config, since parsing and reading both use the same local reference frame.
const isWithinBookingWindow = (dateStr: string): boolean => {
  const d = new Date(dateStr);
  const minutesSinceMidnight = d.getHours() * 60 + d.getMinutes();
  return minutesSinceMidnight >= 6 * 60 && minutesSinceMidnight <= 18 * 60;
};

export const bookingDateRangeSchema = z
  .object({
    startDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Start date is invalid' }),
    endDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'End date is invalid' }),
  })
  .refine((data) => new Date(data.endDate).getTime() > new Date(data.startDate).getTime(), {
    message: 'End date must be after start date',
    path: ['endDate'],
  })
  .refine((data) => isWithinBookingWindow(data.startDate), {
    message: 'Pickup time must be between 6:00 AM and 6:00 PM.',
    path: ['startDate'],
  })
  .refine((data) => isWithinBookingWindow(data.endDate), {
    message: 'Return time must be between 6:00 AM and 6:00 PM.',
    path: ['endDate'],
  });

// Payment submission: the existing code has NO check on paymentType at all today —
// an unrecognized value silently falls through the `=== 'DOWNPAYMENT_GCASH'` check
// and gets treated as a full payment (wrong amount charged), and a missing value
// throws inside `paymentType.replace(...)` a few lines later (uncaught TypeError,
// surfaces as an opaque 500). PaymentSubmissionPage.tsx's own TS type already
// constrains the real client to exactly these two values — this only rejects what
// was never a legitimate value to begin with.
export const paymentTypeSchema = z.enum(['FULL_GCASH', 'DOWNPAYMENT_GCASH'], {
  message: 'Payment type must be either FULL_GCASH or DOWNPAYMENT_GCASH',
});

// Admin approval decision on a customer registration (PATCH /api/admin/users/:id/approval).
export const userApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    message: 'status must be either approved or rejected',
  }),
  reason: z.string().trim().min(1).optional(),
});

// Profile update (PUT /api/customer/profile): registerSchema/RegisterPage.tsx don't
// actually define a max length for fullName or address today (only non-empty is
// enforced) — these are new, minimal limits introduced here, not reused from an
// existing constant, chosen to comfortably fit a real PH name/address (DB columns are
// unbounded — no @db.VarChar — so this is the only length limit that will exist).
export const PROFILE_FULL_NAME_MAX_LENGTH = 100;
export const PROFILE_ADDRESS_MAX_LENGTH = 200;

// All fields optional so the route can validate only what's present (partial update) —
// .trim() before .min(1) means a whitespace-only value is rejected the same as empty.
export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(PROFILE_FULL_NAME_MAX_LENGTH, `Full name must be at most ${PROFILE_FULL_NAME_MAX_LENGTH} characters`)
    .optional(),
  phoneNumber: phoneNumberSchema.optional(),
  address: z
    .string()
    .trim()
    .min(1, 'Location is required')
    .max(PROFILE_ADDRESS_MAX_LENGTH, `Location must be at most ${PROFILE_ADDRESS_MAX_LENGTH} characters`)
    .optional(),
});

// Booking creation (POST /api/bookings): PH LTO driver's license number and expiry.
// Both web (<input type="date">) and mobile (formatDateOnly) send licenseExpiry as a
// bare "YYYY-MM-DD" string — the Prisma column itself is a plain String, not a
// DateTime, so nothing upstream ever parses or validates it today.
const MANILA_TZ = 'Asia/Manila';
const manilaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MANILA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// A bare "YYYY-MM-DD" -> that calendar day's midnight instant in Asia/Manila. Uses an
// explicit +08:00 offset rather than relying on process.env.TZ (only forced to
// Asia/Manila by index.ts's top line, which route/lib unit tests never import) — same
// approach as lib/availability-window.ts's parseAvailabilityBound.
function manilaMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}

// Any JS Date, reduced to its own calendar day as seen in Asia/Manila ("YYYY-MM-DD").
// Lets a bare license-expiry date and a full booking-end datetime be compared on equal
// footing — both reduced to "which Manila calendar day is this" — via plain string
// comparison (zero-padded ISO date strings sort lexically in chronological order).
export function toManilaDateString(date: Date): string {
  return manilaDateFormatter.format(date);
}

const LICENSE_NUMBER_PATTERN = /^[A-Z]\d{2}-\d{2}-\d{6}$/;
const LICENSE_EXPIRY_MAX_YEARS_AHEAD = 10;

// trim -> uppercase -> strip all whitespace -> if that leaves exactly one letter
// followed by 10 digits (no hyphens), insert them to produce A00-00-000000. Anything
// else (wrong lengths, extra characters, already-hyphenated input) is passed through
// as-is for the pattern check below to accept or reject.
export function normalizeLicenseNumber(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z]\d{10}$/.test(compact)) {
    return `${compact.slice(0, 3)}-${compact.slice(3, 5)}-${compact.slice(5)}`;
  }
  return compact;
}

export const licenseNumberSchema = z
  .string()
  .transform((v) => normalizeLicenseNumber(v))
  .refine((v) => LICENSE_NUMBER_PATTERN.test(v), {
    message: 'License number must follow the format A00-00-000000 (e.g., N01-12-345678)',
  });

// Only the self-contained rules: valid date, not already expired, not absurdly far out.
// Whether it covers a specific booking's end date depends on that booking's own dates,
// so bookings.ts checks that separately, after this schema and bookingDateRangeSchema
// have both already passed.
export const licenseExpirySchema = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(manilaMidnight(v).getTime()), {
    message: 'License expiry date is invalid.',
  })
  .refine((v) => manilaMidnight(v).getTime() >= manilaMidnight(toManilaDateString(new Date())).getTime(), {
    message: "Your driver's license has expired.",
  })
  .refine(
    (v) => {
      const maxDate = manilaMidnight(toManilaDateString(new Date()));
      maxDate.setUTCFullYear(maxDate.getUTCFullYear() + LICENSE_EXPIRY_MAX_YEARS_AHEAD);
      return manilaMidnight(v).getTime() <= maxDate.getTime();
    },
    { message: `License expiry date cannot be more than ${LICENSE_EXPIRY_MAX_YEARS_AHEAD} years in the future.` }
  );
