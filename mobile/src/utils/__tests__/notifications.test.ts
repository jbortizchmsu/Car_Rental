import {
  normalizeNotificationsResponse,
  formatNotificationTime,
  getNotificationAccentColor,
} from '../notifications';

describe('normalizeNotificationsResponse', () => {
  test('a bare array: returned as-is', () => {
    const arr = [{ id: '1' }, { id: '2' }];
    expect(normalizeNotificationsResponse(arr)).toBe(arr);
  });

  test('the real paginated shape { data, total, skip, take, hasMore }: unwraps .data', () => {
    const data = [{ id: '1' }];
    expect(
      normalizeNotificationsResponse({ data, total: 1, skip: 0, take: 20, hasMore: false })
    ).toBe(data);
  });

  test('an object with no array anywhere: empty array, never throws', () => {
    expect(normalizeNotificationsResponse({ total: 0 })).toEqual([]);
  });

  test('null: empty array', () => {
    expect(normalizeNotificationsResponse(null)).toEqual([]);
  });

  test('undefined: empty array', () => {
    expect(normalizeNotificationsResponse(undefined)).toEqual([]);
  });

  test('a plain string or number response: empty array, never throws', () => {
    expect(normalizeNotificationsResponse('oops')).toEqual([]);
    expect(normalizeNotificationsResponse(42)).toEqual([]);
  });
});

describe('formatNotificationTime', () => {
  test('a valid ISO string: locale-formatted', () => {
    const result = formatNotificationTime('2026-09-13T10:00:00.000Z');
    expect(result).not.toBe('—');
    expect(typeof result).toBe('string');
  });

  test('an invalid date string: "—"', () => {
    expect(formatNotificationTime('not-a-date')).toBe('—');
  });

  test('missing/undefined: "—"', () => {
    expect(formatNotificationTime(undefined)).toBe('—');
  });

  test('null: "—"', () => {
    expect(formatNotificationTime(null)).toBe('—');
  });

  test('a non-string/number value (e.g. an object): "—", never throws', () => {
    expect(formatNotificationTime({})).toBe('—');
  });
});

describe('getNotificationAccentColor', () => {
  test('isRead true: the read color', () => {
    expect(getNotificationAccentColor(true)).toBe('#F3F4F6');
  });

  test('isRead false: the unread color', () => {
    expect(getNotificationAccentColor(false)).toBe('#7B1FA2');
  });

  test('isRead missing/undefined: treated as unread', () => {
    expect(getNotificationAccentColor(undefined)).toBe('#7B1FA2');
  });

  test('a non-boolean truthy value: still treated as unread (only literal true counts as read)', () => {
    expect(getNotificationAccentColor('true')).toBe('#7B1FA2');
  });
});
