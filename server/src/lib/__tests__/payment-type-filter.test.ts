import { resolvePaymentTypeFilter } from '../payment-type-filter';

describe('resolvePaymentTypeFilter', () => {
  test('ALL → no filter (null)', () => {
    expect(resolvePaymentTypeFilter('ALL')).toBeNull();
  });

  test('missing/empty → no filter (null)', () => {
    expect(resolvePaymentTypeFilter(undefined)).toBeNull();
    expect(resolvePaymentTypeFilter('')).toBeNull();
  });

  test('GCASH → FULL_GCASH and DOWNPAYMENT_GCASH only', () => {
    expect(resolvePaymentTypeFilter('GCASH')).toEqual(['FULL_GCASH', 'DOWNPAYMENT_GCASH']);
  });

  test('CASH → REMAINING_CASH only (not FULL_GCASH/DOWNPAYMENT_GCASH)', () => {
    const result = resolvePaymentTypeFilter('CASH');
    expect(result).toEqual(['REMAINING_CASH']);
    expect(result).not.toContain('FULL_GCASH');
    expect(result).not.toContain('DOWNPAYMENT_GCASH');
  });

  test('BANK (legacy/unknown value) → matches nothing (empty array, not an error)', () => {
    expect(resolvePaymentTypeFilter('BANK')).toEqual([]);
  });

  test('any other unrecognized string → matches nothing (empty array)', () => {
    expect(resolvePaymentTypeFilter('CRYPTO')).toEqual([]);
  });

  test('full literal values are still accepted individually', () => {
    expect(resolvePaymentTypeFilter('FULL_GCASH')).toEqual(['FULL_GCASH']);
    expect(resolvePaymentTypeFilter('DOWNPAYMENT_GCASH')).toEqual(['DOWNPAYMENT_GCASH']);
    expect(resolvePaymentTypeFilter('REMAINING_CASH')).toEqual(['REMAINING_CASH']);
  });

  test('non-string input → no filter (null)', () => {
    expect(resolvePaymentTypeFilter(['GCASH'])).toBeNull();
    expect(resolvePaymentTypeFilter(123)).toBeNull();
  });
});
