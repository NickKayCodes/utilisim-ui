import type { PlanTimeline, PlanType, StrategyBudget, Tome } from '../types/api';
import { sumMinimums, totalCurrentPayments } from '../lib/accounts';
import { money, strategyLabel } from '../lib/format';
import { Field } from './ui';

/**
 * FEAT-006 budget selector plus the two labels that report the resolved budget.
 * Only components are exported: this file must stay a component module.
 */

const BUDGET_OPTIONS: { value: StrategyBudget; label: string }[] = [
  { value: 'REQUIRED_MINIMUM', label: 'Required Minimum Payments' },
  { value: 'CURRENT_PAYMENTS', label: 'My Current Payments' },
];

/** AC-6: every selected account already pays exactly its minimum. */
const NO_SURPLUS_MESSAGE =
  'No amount above minimums. This is the same as Required Minimum Payments.';

function isStrategyPlan(plan: PlanType): boolean {
  return plan === 'SNOWBALL' || plan === 'AVALANCHE' || plan === 'HYBRID';
}

/** Σ max(0, current - minimum): what the user already pays above the minimums. */
function surplusAboveMinimums(tomes: Tome[]): number {
  return tomes.reduce((total, tome) => {
    const minimum = Number(tome.minimumDebtPayment) || 0;
    const current = Number(tome.currentPayment ?? tome.minimumDebtPayment) || 0;
    return total + Math.max(0, current - minimum);
  }, 0);
}

/** `My Current Payments ($2,092.64)` or `Required Minimum Payments + $301.00 Extra`. */
function budgetClause(timeline: PlanTimeline, extraPayment: number): string {
  if (timeline.strategyBudget === 'CURRENT_PAYMENTS') {
    return `My Current Payments (${money(timeline.totalCurrent)})`;
  }
  return extraPayment > 0
    ? `Required Minimum Payments + ${money(extraPayment)} Extra`
    : 'Required Minimum Payments';
}

function budgetExplanation(input: {
  budget: StrategyBudget;
  totalMinimum: number;
  totalCurrent: number;
  surplus: number;
  extraPayment: number;
  allocatedBy: string;
}): string {
  if (input.budget === 'REQUIRED_MINIMUM') {
    return `Minimums of ${money(input.totalMinimum)} plus ${money(
      input.extraPayment,
    )} extra, allocated by ${input.allocatedBy}.`;
  }
  if (input.surplus <= 0) return NO_SURPLUS_MESSAGE;
  return `${money(input.totalCurrent)} of current payments (${money(
    input.surplus,
  )} above the minimums), allocated by ${input.allocatedBy}.`;
}

export function StrategyBudgetSelector({
  value,
  selected,
  extraPayment,
  allocatedBy,
  onChange,
}: {
  value: StrategyBudget;
  selected: Tome[];
  extraPayment: number;
  allocatedBy: string;
  onChange: (value: StrategyBudget) => void;
}) {
  const totalMinimum = sumMinimums(selected);
  const totalCurrent = totalCurrentPayments(selected);
  const surplus = surplusAboveMinimums(selected);

  return (
    <Field
      label="Budget"
      hint={budgetExplanation({
        budget: value,
        totalMinimum,
        totalCurrent,
        surplus,
        extraPayment,
        allocatedBy,
      })}
    >
      <select
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value as StrategyBudget)}
      >
        {BUDGET_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * The results header line (AC-7): the plan and the budget it spent. CURRENT and
 * MINIMUM have no budget, so they render nothing.
 */
export function BudgetSummary({
  timeline,
  extraPayment,
}: {
  timeline: PlanTimeline;
  extraPayment: number;
}) {
  if (!isStrategyPlan(timeline.plan)) return null;
  return (
    <p className="muted small">
      {strategyLabel(timeline.plan)} · {budgetClause(timeline, extraPayment)}
    </p>
  );
}

/** The budget clause on a plan card; baselines are unlabelled (AC-8). */
export function BudgetHint({
  timeline,
  extraPayment,
}: {
  timeline: PlanTimeline;
  extraPayment: number;
}) {
  if (!isStrategyPlan(timeline.plan)) return null;
  return <span className="stat-hint">{budgetClause(timeline, extraPayment)}</span>;
}
