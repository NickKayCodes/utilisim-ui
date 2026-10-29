import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparePage } from './ComparePage';
import { ApiError } from '../lib/api';
import type { StrategyAnalysis, StrategyOutput, Tome } from '../types/api';

vi.mock('../services/tomes', () => ({ tomesApi: { list: vi.fn() } }));
vi.mock('../services/oracle', () => ({
  oracleApi: {
    order: vi.fn(),
    recommend: vi.fn(),
    analyze: vi.fn(),
    totalInterest: vi.fn(),
    isDeterministic: vi.fn(),
  },
}));

import { tomesApi } from '../services/tomes';
import { oracleApi } from '../services/oracle';

const listTomes = vi.mocked(tomesApi.list);
const recommend = vi.mocked(oracleApi.recommend);
const order = vi.mocked(oracleApi.order);
const analyze = vi.mocked(oracleApi.analyze);

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

const visaDebt = {
  tomeId: 't1',
  accountName: 'Visa',
  currentBalance: 1200,
  apr: 22,
  estimatedApr: 22,
  minimumPayment: 35,
  interestRate: 22,
};

const loanDebt = {
  tomeId: 't2',
  accountName: 'Loan',
  currentBalance: 800,
  apr: 6,
  estimatedApr: 6,
  minimumPayment: 20,
  interestRate: 6,
};

const ordered: StrategyOutput = {
  strategyName: 'SNOWBALL',
  orderedDebts: [visaDebt, loanDebt],
  description: 'Smallest balance first',
};

const analysis: StrategyAnalysis = {
  comparisons: [
    {
      strategyName: 'SNOWBALL',
      projectedInterest: 100,
      debtCount: 2,
      description: 'Smallest balance first',
    },
    {
      strategyName: 'AVALANCHE',
      projectedInterest: 100,
      debtCount: 2,
      description: 'Highest rate first',
    },
  ],
  recommendedStrategy: 'AVALANCHE',
  analysisNotes: null,
};

beforeEach(() => {
  listTomes.mockReset();
  recommend.mockReset();
  order.mockReset();
  analyze.mockReset();
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
  recommend.mockResolvedValue('AVALANCHE');
  order.mockResolvedValue(ordered);
  analyze.mockResolvedValue(analysis);
});

async function renderLoaded() {
  const rendered = render(<ComparePage />);
  await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
  return rendered;
}

describe('ComparePage', () => {
  it('shows an empty state without accounts', async () => {
    listTomes.mockResolvedValue([]);
    render(<ComparePage />);

    await waitFor(() => expect(screen.getByText('No accounts to compare')).toBeInTheDocument());
  });

  it('shows a list error and retries', async () => {
    const user = userEvent.setup();
    listTomes
      .mockRejectedValueOnce(new ApiError(500, 'database down'))
      .mockResolvedValueOnce([tome()]);
    render(<ComparePage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('database down'));

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    expect(listTomes).toHaveBeenCalledTimes(2);
  });

  it('shows the selection summary and toggles accounts and strategies', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    expect(screen.getByText(/2 of 2 selected/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Visa/ }));
    expect(screen.getByText(/1 of 2 selected/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Loan/ }));
    expect(screen.getByText(/0 of 2 selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recommend' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Order debts' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
    expect(screen.getByText('Select at least one account to enable these actions.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('button', { name: 'Recommend' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Snowball' }));
    await user.click(screen.getByRole('button', { name: 'Avalanche' }));
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
    expect(screen.getByText('Pick at least one strategy for the analysis.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hybrid' }));
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeEnabled();
  });

  it('recommends a strategy', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Recommend' }));

    await waitFor(() => expect(screen.getByText('Recommended strategy')).toBeInTheDocument());
    expect(screen.getByText('AVALANCHE')).toBeInTheDocument();
    expect(recommend).toHaveBeenCalledWith([visaDebt, loanDebt]);
  });

  it('shows a recommendation error', async () => {
    const user = userEvent.setup();
    recommend.mockRejectedValue(new ApiError(500, 'oracle down'));
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Recommend' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('oracle down'));
  });

  it('orders debts with the selected strategy', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.selectOptions(screen.getByLabelText(/Order by/), 'AVALANCHE');
    await user.click(screen.getByRole('button', { name: 'Order debts' }));

    await waitFor(() => expect(screen.getByText(/Payoff order/)).toBeInTheDocument());
    expect(screen.getByText('Smallest balance first')).toBeInTheDocument();
    expect(order).toHaveBeenCalledWith([visaDebt, loanDebt], {
      strategyType: 'AVALANCHE',
      extraPayment: 0,
      lumpSumPayment: 0,
    });
  });

  it('shows an ordering error', async () => {
    const user = userEvent.setup();
    order.mockRejectedValue(new ApiError(500, 'order failed'));
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Order debts' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('order failed'));
  });

  it('analyzes the selected strategies', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    await waitFor(() => expect(screen.getByText('Strategy comparison')).toBeInTheDocument());
    expect(screen.getByText('Recommended: AVALANCHE')).toBeInTheDocument();
    expect(screen.getByText('Highest rate first')).toBeInTheDocument();
    expect(screen.getByText('best')).toBeInTheDocument();
    expect(analyze).toHaveBeenCalledWith([visaDebt, loanDebt], ['SNOWBALL', 'AVALANCHE'], {
      extraPayment: 0,
      lumpSumPayment: 0,
    });
  });

  it('hides the recommendation badge when no strategy is recommended', async () => {
    const user = userEvent.setup();
    analyze.mockResolvedValue({ ...analysis, recommendedStrategy: '' });
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    await waitFor(() => expect(screen.getByText('Strategy comparison')).toBeInTheDocument());
    expect(screen.queryByText(/Recommended:/)).not.toBeInTheDocument();
  });

  it('shows an analysis error', async () => {
    const user = userEvent.setup();
    analyze.mockRejectedValue(new ApiError(500, 'analysis failed'));
    await renderLoaded();

    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('analysis failed'));
  });
});
