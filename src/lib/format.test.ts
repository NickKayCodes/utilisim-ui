import { describe, expect, it } from 'vitest';
import {
  dateTime,
  money,
  moneyShort,
  monthsLabel,
  numOr,
  percent,
  shortDate,
  strategyLabel,
  titleCase,
  toNumber,
} from './format';

const DASH = '\u2014';

describe('money', () => {
  it('formats currency', () => {
    expect(money(1234.5)).toBe('$1,234.50');
    expect(moneyShort(1234.5)).toBe('$1,235');
  });

  it('shows a dash for missing or invalid values', () => {
    expect(money(null)).toBe(DASH);
    expect(money(undefined)).toBe(DASH);
    expect(money(Number.NaN)).toBe(DASH);
    expect(moneyShort(null)).toBe(DASH);
    expect(moneyShort(Number.NaN)).toBe(DASH);
  });
});

describe('percent', () => {
  it('formats with the requested precision', () => {
    expect(percent(19.994)).toBe('19.99%');
    expect(percent(19.994, 0)).toBe('20%');
  });

  it('shows a dash for missing or invalid values', () => {
    expect(percent(null)).toBe(DASH);
    expect(percent(Number.NaN)).toBe(DASH);
  });
});

describe('dates', () => {
  it('formats a valid date', () => {
    expect(shortDate('2026-01-15T12:00:00Z')).toMatch(/2026/);
    expect(dateTime('2026-01-15T12:00:00Z')).toMatch(/2026/);
  });

  it('shows a dash for missing or invalid dates', () => {
    expect(shortDate(null)).toBe(DASH);
    expect(shortDate('not-a-date')).toBe(DASH);
    expect(dateTime(undefined)).toBe(DASH);
    expect(dateTime('not-a-date')).toBe(DASH);
  });
});

describe('monthsLabel', () => {
  it('pluralises and rounds', () => {
    expect(monthsLabel(1)).toBe('1 month');
    expect(monthsLabel(1.4)).toBe('1 month');
    expect(monthsLabel(2)).toBe('2 months');
    expect(monthsLabel(0)).toBe('0 months');
  });

  it('shows a dash when the count is not finite', () => {
    expect(monthsLabel(Number.POSITIVE_INFINITY)).toBe(DASH);
    expect(monthsLabel(Number.NaN)).toBe(DASH);
  });
});

describe('number parsing', () => {
  it('parses trimmed input and rejects blanks', () => {
    expect(toNumber(' 42.5 ')).toBe(42.5);
    expect(toNumber('')).toBeNaN();
    expect(toNumber('   ')).toBeNaN();
    expect(toNumber('abc')).toBeNaN();
  });

  it('falls back for invalid input', () => {
    expect(numOr('7', 3)).toBe(7);
    expect(numOr('abc', 3)).toBe(3);
    expect(numOr('', 3)).toBe(3);
  });
});

describe('labels', () => {
  it('title-cases snake case names', () => {
    expect(titleCase('CREDIT_CARD')).toBe('Credit Card');
    expect(titleCase('MORTGAGE')).toBe('Mortgage');
    expect(titleCase('_LEADING')).toBe(' Leading');
  });

  it('labels strategies', () => {
    expect(strategyLabel('MINIMUM_ONLY')).toBe('Minimum Only');
  });
});
