import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PlanTimelineView } from './PlanTimelineView';
import type { PlanTimeline } from '../types/api';

function timeline(overrides: Partial<PlanTimeline> = {}): PlanTimeline {
  return {
    runId: 7,
    plan: 'AVALANCHE',
    label: 'Avalanche',
    status: 'COMPLETED',
    terminationReason: 'PAID_OFF',
    monthsToPayoff: 2,
    payoffDate: '2026-03-01',
    totalInterest: 15.5,
    totalPaid: 1015.5,
    finalBalance: 0,
    peakUtilizationPct: 40,
    months: [
      {
        monthIndex: 1,
        monthLabel: 'Jan 2026',
        periodStart: '2026-01-01',
        startingBalance: 1000,
        monthlyInterest: 10,
        minimumDue: 35,
        actualPayment: 500,
        extraPayment: 0,
        lumpSumApplied: 0,
        remainingBalance: 510,
        utilizationPct: 40,
        interestPaid: 10,
        amountToCoverInterest: 10,
        debts: [
          {
            tomeId: 't1',
            accountName: 'Visa',
            startingBalance: 1000,
            monthlyInterest: 10,
            minimumDue: 35,
            actualPayment: 500,
            extraPayment: 0,
            lumpSumApplied: 0,
            remainingBalance: 510,
            utilizationPct: 40,
            interestPaid: 10,
            amountToCoverInterest: 10,
          },
        ],
      },
      {
        monthIndex: 2,
        monthLabel: 'Feb 2026',
        periodStart: '2026-02-01',
        startingBalance: 510,
        monthlyInterest: 5.5,
        minimumDue: 20,
        actualPayment: 515.5,
        extraPayment: 0,
        lumpSumApplied: 0,
        remainingBalance: 0,
        utilizationPct: null,
        interestPaid: 5.5,
        amountToCoverInterest: 5.5,
        debts: [],
      },
    ],
    ...overrides,
  };
}

describe('PlanTimelineView', () => {
  it('renders the summary and the workbook month columns', () => {
    render(<PlanTimelineView timeline={timeline()} />);

    expect(screen.getByText('Months to payoff').parentElement).toHaveTextContent('2 months');
    expect(screen.getByText('Total interest').parentElement).toHaveTextContent('$15.50');
    expect(screen.getByText('Total paid').parentElement).toHaveTextContent('$1,015.50');
    expect(screen.getByText('Peak utilization').parentElement).toHaveTextContent('40.00%');

    for (const header of [
      'Month',
      'Starting',
      'Interest',
      'Min due',
      'Actual',
      'Extra',
      'Lump sum',
      'Remaining',
      'Utilization',
      'Interest paid',
      'Interest cover',
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });

  it('highlights the first month and warns above the utilization threshold', () => {
    render(<PlanTimelineView timeline={timeline()} />);

    const firstRow = screen.getByText('Jan 2026').closest('tr');
    const secondRow = screen.getByText('Feb 2026').closest('tr');

    expect(firstRow).toHaveClass('month-row-first');
    expect(secondRow).not.toHaveClass('month-row-first');
    expect(within(firstRow as HTMLElement).getByText('40.00%')).toHaveClass('badge-warn');
    expect(firstRow).toHaveTextContent('$1,000.00');
    expect(secondRow).toHaveTextContent('—');
  });

  it('expands and collapses the per-debt rows', async () => {
    const user = userEvent.setup();
    render(<PlanTimelineView timeline={timeline()} />);

    const month = screen.getByRole('button', { name: /Jan 2026/ });
    expect(month).toHaveAttribute('aria-expanded', 'false');

    await user.click(month);

    expect(month).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/↳ Visa/).closest('tr')).toHaveClass('debt-row');

    await user.click(month);
    expect(screen.queryByText(/↳ Visa/)).not.toBeInTheDocument();
  });

  it('warns when the plan does not pay the debt off', () => {
    render(
      <PlanTimelineView
        timeline={timeline({
          status: 'COMPLETED',
          terminationReason: 'HORIZON_REACHED',
          finalBalance: 510,
        })}
      />,
    );

    expect(screen.getByText(/does not pay the debt off/)).toHaveTextContent('$510.00');
    expect(screen.getByText('Months to payoff').parentElement).toHaveTextContent('Not repaid');
  });

  it('shows an empty state when the engine returns no months', () => {
    render(<PlanTimelineView timeline={timeline({ months: [], monthsToPayoff: 0 })} />);

    expect(screen.getByText('No months')).toBeInTheDocument();
  });
});
