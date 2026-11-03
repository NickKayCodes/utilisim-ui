import type { Tome, DebtSnapshot } from '../types/api';

export function sumBalance(tomes: Tome[]): number {
  return tomes.reduce((total, tome) => total + (Number(tome.currentBalance) || 0), 0);
}

export function sumMinimums(tomes: Tome[]): number {
  return tomes.reduce((total, tome) => total + (Number(tome.minimumDebtPayment) || 0), 0);
}

/** Total the user pays today; falls back to the minimum when unspecified. */
export function totalCurrentPayments(tomes: Tome[]): number {
  return tomes.reduce(
    (total, tome) =>
      total + (Number(tome.currentPayment ?? tome.minimumDebtPayment) || 0),
    0,
  );
}

export function sumLimits(tomes: Tome[]): number {
  return tomes.reduce((total, tome) => total + (Number(tome.creditLimit) || 0), 0);
}

/** Effective APR for one account: the real APR when set, else the estimate. */
export function effectiveApr(tome: Tome): number {
  return tome.apr ?? tome.estimatedApr ?? 0;
}

/** Balance-weighted average APR, in percent. */
export function weightedApr(tomes: Tome[]): number {
  const balance = sumBalance(tomes);
  if (balance <= 0) return 0;
  const weighted = tomes.reduce((total, tome) => {
    return total + effectiveApr(tome) * (Number(tome.currentBalance) || 0);
  }, 0);
  return weighted / balance;
}

/** Credit utilisation in percent (0 when no limits are set). */
export function utilization(tomes: Tome[]): number {
  const limits = sumLimits(tomes);
  if (limits <= 0) return 0;
  return (sumBalance(tomes) / limits) * 100;
}

/** Maps a stored account to the shape the Oracle endpoints expect. */
export function toDebtSnapshot(tome: Tome): DebtSnapshot {
  const apr = effectiveApr(tome);
  return {
    tomeId: tome.id,
    accountName: tome.name,
    currentBalance: Number(tome.currentBalance) || 0,
    apr,
    estimatedApr: tome.estimatedApr ?? apr,
    minimumPayment: Number(tome.minimumDebtPayment) || 0,
    interestRate: apr,
  };
}

/** Interest accrued on a balance in one month, for a decimal annual rate. */
export function monthlyInterest(principal: number, annualRate: number): number {
  return (principal * annualRate) / 12;
}

/**
 * Annual APR as a percent (19.99) -> annual decimal (0.1999).
 *
 * `SimulationInput.interestRate` is the one API field that takes a decimal;
 * everything else (`Tome.apr`, `DebtSnapshot.apr`) is a percentage.
 */
export function aprPercentToDecimal(aprPercent: number): number {
  return aprPercent / 100;
}
