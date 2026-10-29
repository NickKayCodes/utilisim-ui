import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SimulationResultView } from './SimulationResultView';
import type { SimulationResult } from '../types/api';

function makeResult(rows: number): SimulationResult {
  return {
    id: 'run-1',
    simulationInputId: null,
    userId: null,
    status: 'COMPLETED',
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-02T00:00:00Z',
    totalInterestPaid: 100,
    totalPrincipalPaid: 1000,
    monthsToPayoff: rows,
    payoffDate: '2026-12-01T00:00:00Z',
    savingsComparedToBaseline: 10,
    schedule: Array.from({ length: rows }, (_, index) => ({
      monthIndex: index + 1,
      date: '2026-01-01T00:00:00Z',
      payment: 100,
      principalPaid: 90,
      interestPaid: 10,
      remainingBalance: 1000 - index * 90,
    })),
    archivedAt: null,
    ledgerEntryId: null,
  };
}

describe('SimulationResultView', () => {
  it('shows the summary and a preview of the schedule', () => {
    render(<SimulationResultView result={makeResult(5)} />);

    expect(screen.getByText('Months to payoff')).toBeInTheDocument();
    expect(screen.getByText('5 months')).toBeInTheDocument();
    expect(screen.getAllByText('$100.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/5 rows/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // Header row plus five schedule rows.
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('collapses a long schedule to twelve rows and expands it again', async () => {
    const user = userEvent.setup();
    render(<SimulationResultView result={makeResult(20)} />);

    expect(screen.getAllByRole('row')).toHaveLength(13);

    await user.click(screen.getByRole('button', { name: 'Show all 20 months' }));
    expect(screen.getAllByRole('row')).toHaveLength(21);

    await user.click(screen.getByRole('button', { name: 'Show first 12 months' }));
    expect(screen.getAllByRole('row')).toHaveLength(13);
  });
});
