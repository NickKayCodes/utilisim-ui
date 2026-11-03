import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparePage } from './ComparePage';
import { ApiError } from '../lib/api';
import type { ComparisonResponse, PlanTimeline, PlanType, Tome } from '../types/api';
import { PLAN_TYPES } from '../types/api';

vi.mock('../services/tomes', () => ({ tomesApi: { list: vi.fn() } }));
vi.mock('../services/simulation', () => ({ simulationApi: { compare: vi.fn() } }));

import { tomesApi } from '../services/tomes';
import { simulationApi } from '../services/simulation';

const listTomes = vi.mocked(tomesApi.list);
const compare = vi.mocked(simulationApi.compare);

function tome(overrides: Partial<Tome> = {}): Tome {
  return {
    id: 't1',
    userId: 'u1',
    name: 'Visa',
    currentBalance: 1200,
    apr: 22,
    estimatedApr: 22,
    minimumDebtPayment: 35,
    creditLimit: 3000,
    type: 'CREDIT_CARD',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function plan(
  planType: PlanType,
  overrides: Partial<PlanTimeline> = {},
): PlanTimeline {
  return {
    runId: 1,
    plan: planType,
    label: planType,
    status: 'COMPLETED',
    terminationReason: 'PAID_OFF',
    monthsToPayoff: 2,
    payoffDate: '2026-03-01',
    totalInterest: 12,
    totalPaid: 1012,
    finalBalance: 0,
    peakUtilizationPct: 40,
    months: [
      {
        monthIndex: 1,
        monthLabel: `${planType} month 1`,
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
        debts: [],
      },
      {
        monthIndex: 2,
        monthLabel: `${planType} month 2`,
        periodStart: '2026-02-01',
        startingBalance: 510,
        monthlyInterest: 2,
        minimumDue: 20,
        actualPayment: 512,
        extraPayment: 0,
        lumpSumApplied: 0,
        remainingBalance: 0,
        utilizationPct: 0,
        interestPaid: 2,
        amountToCoverInterest: 2,
        debts: [],
      },
    ],
    ...overrides,
  };
}

const comparison: ComparisonResponse = {
  comparisonGroupId: 'group-1',
  startMonth: '2026-01-01',
  horizonMonths: 120,
  totalBalance: 2000,
  recommendedPlan: 'AVALANCHE',
  recommendationBasis: 'Lowest total interest',
  plans: PLAN_TYPES.map((planType) => plan(planType)),
};

function renderCompare() {
  return render(
    <MemoryRouter>
      <ComparePage />
    </MemoryRouter>,
  );
}

async function renderLoaded() {
  const rendered = renderCompare();
  await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
  return rendered;
}

function setValue(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  listTomes.mockReset();
  compare.mockReset();
  listTomes.mockResolvedValue([
    tome(),
    tome({
      id: 't2',
      name: 'Loan',
      apr: 6,
      estimatedApr: 6,
      currentBalance: 800,
      minimumDebtPayment: 20,
    }),
  ]);
  compare.mockResolvedValue(comparison);
});

describe('ComparePage', () => {
  it('shows an empty state without accounts', async () => {
    listTomes.mockResolvedValue([]);
    renderCompare();

    await waitFor(() => expect(screen.getByText('No accounts to compare')).toBeInTheDocument());
  });

  it('shows a list error and retries', async () => {
    const user = userEvent.setup();
    listTomes
      .mockRejectedValueOnce(new ApiError(500, 'database down'))
      .mockResolvedValueOnce([tome()]);
    renderCompare();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('database down'));

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    expect(listTomes).toHaveBeenCalledTimes(2);
  });

  it('shows the selection summary and toggles accounts', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    expect(screen.getByText(/2 of 2 selected/)).toHaveTextContent('$2,000.00 balance');

    await user.click(screen.getByRole('checkbox', { name: /Visa/ }));
    expect(screen.getByText(/1 of 2 selected/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Loan/ }));
    expect(screen.getByText(/0 of 2 selected/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Compare plans' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one account');

    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText(/2 of 2 selected/)).toBeInTheDocument();
  });

  it('compares all five plans and shows the server recommendation', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    setValue(/Start month/, '2026-01');
    await user.click(screen.getByRole('button', { name: 'Compare plans' }));

    await waitFor(() => expect(compare).toHaveBeenCalledOnce());
    expect(compare).toHaveBeenCalledWith({
      tomeIds: ['t1', 't2'],
      startMonth: '2026-01-01',
      horizonMonths: 120,
      extraPayment: 75,
      lumpSumPayment: 0,
      lumpSumMonth: 1,
      plans: PLAN_TYPES,
    });

    expect(screen.getByText(/Avalanche recommended/)).toHaveTextContent('Lowest total interest');
    expect(screen.getByText('recommended')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /recommended/ })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Avalanche timeline' })).toBeInTheDocument();
    expect(screen.getByText('AVALANCHE month 1')).toBeInTheDocument();
  });

  it('switches the timeline to another plan card', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Compare plans' }));
    await waitFor(() => expect(screen.getByText('recommended')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Snowball/ }));

    expect(screen.getByRole('heading', { name: 'Snowball timeline' })).toBeInTheDocument();
    expect(screen.getByText('SNOWBALL month 1')).toBeInTheDocument();
    expect(screen.queryByText('AVALANCHE month 1')).not.toBeInTheDocument();
  });

  it('falls back to the first plan when nothing is recommended', async () => {
    const user = userEvent.setup();
    compare.mockResolvedValue({ ...comparison, recommendedPlan: null });
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Compare plans' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Current timeline' })).toBeInTheDocument(),
    );
    expect(screen.queryByText('recommended')).not.toBeInTheDocument();
  });

  it('shows a comparison error', async () => {
    const user = userEvent.setup();
    compare.mockRejectedValue(new ApiError(500, 'ledger failed'));
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Compare plans' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ledger failed'));
  });
});
