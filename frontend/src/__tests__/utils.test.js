import { formatDate, formatMoney, initials, todayISO } from '../utils/format';
import { passwordRules } from '../utils/validation';

test('formatDate shows the same calendar day regardless of timezone', () => {
  expect(formatDate('2026-11-02')).toBe('02 Nov 2026');
  expect(formatDate('2025-01-01')).toBe('01 Jan 2025');
  expect(formatDate('2024-09-02')).toBe('02 Sep 2024');
});

test('formatDate handles missing or bad values', () => {
  expect(formatDate(undefined)).toBe('—');
  expect(formatDate('not a date')).toBe('—');
});

test('formatMoney adds thousand separators', () => {
  expect(formatMoney(450000)).toBe('450,000');
  expect(formatMoney(null)).toBe('0');
});

test('initials uses first and last name', () => {
  expect(initials('Amna Yousaf')).toBe('AY');
  expect(initials('Madonna')).toBe('M');
  expect(initials('  ali   raza khan ')).toBe('AK');
  expect(initials('')).toBe('?');
});

test('todayISO is YYYY-MM-DD', () => {
  expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('password rule requires letters and numbers', () => {
  expect(passwordRules.validate('abcdefgh')).not.toBe(true);
  expect(passwordRules.validate('12345678')).not.toBe(true);
  expect(passwordRules.validate('abc12345')).toBe(true);
});
