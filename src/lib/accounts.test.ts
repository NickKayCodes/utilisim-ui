import { describe, expect, it } from 'vitest';
import {
  effectiveApr,
  monthlyInterest,
  sumBalance,
  sumLimits,
  sumMinimums,
  toDebtSnapshot,
  utilization,
  weightedApr,
} from './accounts';
import type { Tome } from '../types/api';

function tome(overrides: Partial<Tome> = {}): Tome {
  return {
    id: 't1',
    userId: 'u1',
    name: 'Card',
    currentBalance: 100,
    apr: 20,
    estimatedApr: 16,
    minimumDebtPayment: 10,
    creditLimit: 1000,
    type: 'CREDIT_CARD',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('sums', () => {
  it('adds the requested fields', () => {
    const tomes = [
      tome({ currentBalance: 100, minimumDebtPayment: 10, creditLimit: 1000 }),
      tome({ id: 't2', currentBalance: 250, minimumDebtPayment: 25, creditLimit: 500 }),
    ];

    expect(sumBalance(tomes)).toBe(350);
    expect(sumMinimums(tomes)).toBe(35);
    expect(sumLimits(tomes)).toBe(1500);
  });

  it('treats non-numeric values as zero', () => {
    const broken = [tome({ currentBalance: 'nope' as unknown as number })];

    expect(sumBalance(broken)).toBe(0);
    expect(sumMinimums(broken)).toBe(10);
  });

  it('returns zero for an empty list', () => {
    expect(sumBalance([])).toBe(0);
    expect(sumMinimums([])).toBe(0);
    expect(sumLimits([])).toBe(0);
  });
});

describe('effectiveApr', () => {
  it('prefers a real APR and falls back to the estimate', () => {
    expect(effectiveApr(tome({ apr: 24, estimatedApr: 16 }))).toBe(24);
    expect(effectiveApr(tome({ apr: null, estimatedApr: 16 }))).toBe(16);
    expect(effectiveApr(tome({ apr: null, estimatedApr: undefined as unknown as number }))).toBe(0);
  });
});

describe('weightedApr', () => {
  it('weights APR by balance', () => {
    const tomes = [
      tome({ apr: 20, currentBalance: 100 }),
      tome({ id: 't2', apr: 10, currentBalance: 300 }),
    ];

    expect(weightedApr(tomes)).toBeCloseTo(12.5);
  });

  it('returns zero when there is no balance', () => {
    expect(weightedApr([tome({ currentBalance: 0 })])).toBe(0);
    expect(weightedApr([])).toBe(0);
  });
});

describe('utilization', () => {
  it('returns the balance over the limit as a percentage', () => {
    const tomes = [tome({ currentBalance: 500, creditLimit: 1000 })];

    expect(utilization(tomes)).toBe(50);
  });

  it('returns zero without limits', () => {
    expect(utilization([tome({ creditLimit: 0 })])).toBe(0);
    expect(utilization([])).toBe(0);
  });
});

describe('toDebtSnapshot', () => {
  it('maps a tome using the effective APR', () => {
    const snapshot = toDebtSnapshot(tome({ id: 'abc', name: 'Visa', apr: null, estimatedApr: 16 }));

    expect(snapshot).toEqual({
      tomeId: 'abc',
      accountName: 'Visa',
      currentBalance: 100,
      apr: 16,
      estimatedApr: 16,
      minimumPayment: 10,
      interestRate: 16,
    });
  });

  it('uses the real APR when present and tolerates non-numeric fields', () => {
    const snapshot = toDebtSnapshot(
      tome({
        apr: 22,
        currentBalance: 'bad' as unknown as number,
        minimumDebtPayment: 'bad' as unknown as number,
      }),
    );

    expect(snapshot.apr).toBe(22);
    expect(snapshot.currentBalance).toBe(0);
    expect(snapshot.minimumPayment).toBe(0);
    expect(snapshot.estimatedApr).toBe(16);
  });
});

describe('monthlyInterest', () => {
  it('divides the annual rate by twelve', () => {
    expect(monthlyInterest(1200, 0.12)).toBeCloseTo(12);
    expect(monthlyInterest(0, 0.5)).toBe(0);
  });
});
