// Payment.paymentType is a plain String column with exactly three real values ever
// written anywhere in this codebase: FULL_GCASH, DOWNPAYMENT_GCASH, REMAINING_CASH
// (see schema.postgres.prisma's own comment on the field). The admin Payment Ledger's
// filter dropdown offers the grouped values GCASH/CASH (plus ALL), previously matched
// with Prisma's `contains`, which incorrectly matched "CASH" against "FULL_GCASH" and
// "DOWNPAYMENT_GCASH" too (both contain the substring "CASH"), and let a since-removed
// "BANK" option always return zero rows without ever being an intentional, validated
// case.
//
// Returns:
// - null            -> no filter should be applied (ALL, missing, or empty).
// - a string array   -> exact-match `{ in: [...] }` filter. An unrecognized value
//   (e.g. a legacy "BANK" still cached client-side during a rolling deploy) resolves
//   to an empty array, which Prisma's `in: []` correctly treats as "match nothing"
//   rather than throwing or silently ignoring the filter.
const REAL_PAYMENT_TYPES = ['FULL_GCASH', 'DOWNPAYMENT_GCASH', 'REMAINING_CASH'] as const;

export function resolvePaymentTypeFilter(raw: unknown): string[] | null {
  if (typeof raw !== 'string' || raw === '' || raw === 'ALL') return null;

  if (raw === 'GCASH') return ['FULL_GCASH', 'DOWNPAYMENT_GCASH'];
  if (raw === 'CASH') return ['REMAINING_CASH'];

  if ((REAL_PAYMENT_TYPES as readonly string[]).includes(raw)) return [raw];

  return [];
}
