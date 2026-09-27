import { parseNonNegativeNumber, parseLatLng, isBlank } from '../numeric-input';

describe('parseNonNegativeNumber', () => {
  test('accepts a non-negative number', () => {
    expect(parseNonNegativeNumber(1000)).toBe(1000);
  });

  test('accepts zero (number)', () => {
    expect(parseNonNegativeNumber(0)).toBe(0);
  });

  test('accepts zero (string)', () => {
    expect(parseNonNegativeNumber('0')).toBe(0);
  });

  test('accepts a numeric string with a decimal', () => {
    expect(parseNonNegativeNumber('123.5')).toBe(123.5);
  });

  test('accepts a numeric string with surrounding whitespace', () => {
    expect(parseNonNegativeNumber('  42  ')).toBe(42);
  });

  test('rejects a negative number', () => {
    expect(parseNonNegativeNumber(-5)).toBeNull();
  });

  test('rejects a negative numeric string', () => {
    expect(parseNonNegativeNumber('-5')).toBeNull();
  });

  test('rejects an empty string', () => {
    expect(parseNonNegativeNumber('')).toBeNull();
  });

  test('rejects a whitespace-only string', () => {
    expect(parseNonNegativeNumber('   ')).toBeNull();
  });

  test('rejects a non-numeric string', () => {
    expect(parseNonNegativeNumber('abc')).toBeNull();
  });

  test('rejects NaN', () => {
    expect(parseNonNegativeNumber(NaN)).toBeNull();
  });

  test('rejects Infinity', () => {
    expect(parseNonNegativeNumber(Infinity)).toBeNull();
    expect(parseNonNegativeNumber('Infinity')).toBeNull();
  });

  test('rejects null and undefined', () => {
    expect(parseNonNegativeNumber(null)).toBeNull();
    expect(parseNonNegativeNumber(undefined)).toBeNull();
  });

  test('rejects other types', () => {
    expect(parseNonNegativeNumber({} as any)).toBeNull();
    expect(parseNonNegativeNumber([] as any)).toBeNull();
    expect(parseNonNegativeNumber(true as any)).toBeNull();
  });
});

describe('parseLatLng', () => {
  test('accepts valid coordinates', () => {
    expect(parseLatLng(10.7391, 122.9691)).toEqual({ latitude: 10.7391, longitude: 122.9691 });
  });

  test('accepts boundary values', () => {
    expect(parseLatLng(90, 180)).toEqual({ latitude: 90, longitude: 180 });
    expect(parseLatLng(-90, -180)).toEqual({ latitude: -90, longitude: -180 });
  });

  test('rejects latitude out of range', () => {
    expect(parseLatLng(90.1, 0)).toBeNull();
    expect(parseLatLng(-90.1, 0)).toBeNull();
  });

  test('rejects longitude out of range', () => {
    expect(parseLatLng(0, 180.1)).toBeNull();
    expect(parseLatLng(0, -180.1)).toBeNull();
  });

  test('rejects numeric strings (no coercion for coordinates)', () => {
    expect(parseLatLng('10.7391', '122.9691')).toBeNull();
  });

  test('rejects NaN/Infinity', () => {
    expect(parseLatLng(NaN, 0)).toBeNull();
    expect(parseLatLng(0, Infinity)).toBeNull();
  });

  test('rejects null/undefined', () => {
    expect(parseLatLng(null, 0)).toBeNull();
    expect(parseLatLng(0, undefined)).toBeNull();
  });
});

describe('isBlank', () => {
  test('undefined and null are blank', () => {
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(null)).toBe(true);
  });

  test('empty string is blank', () => {
    expect(isBlank('')).toBe(true);
  });

  test('whitespace-only strings are blank', () => {
    expect(isBlank(' ')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank('\t\n')).toBe(true);
  });

  test('a real number, including 0, is not blank', () => {
    expect(isBlank(0)).toBe(false);
    expect(isBlank(1000)).toBe(false);
  });

  test('a non-empty string, including one with surrounding whitespace, is not blank', () => {
    expect(isBlank('0')).toBe(false);
    expect(isBlank('abc')).toBe(false);
    expect(isBlank('  42  ')).toBe(false);
  });
});
