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
export const bookingDateRangeSchema = z
  .object({
    startDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Start date is invalid' }),
    endDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'End date is invalid' }),
  })
  .refine((data) => new Date(data.endDate).getTime() > new Date(data.startDate).getTime(), {
    message: 'End date must be after start date',
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
