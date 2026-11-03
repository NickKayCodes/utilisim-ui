import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { AuthContext } from '../auth/auth-context';
import { makeAuthValue } from '../test/test-utils';
import { ApiError } from '../lib/api';
import type { PlanTimeline, Scenario, Tome } from '../types/api';

vi.mock('../services/tomes', () => ({ tomesApi: { list: vi.fn() } }));
vi.mock('../services/archive', () => ({ archiveApi: { list: vi.fn() } }));
vi.mock('../services/simulation', () => ({ simulationApi: { history: vi.fn() } }));

import { tomesApi } from '../services/tomes';
import { archiveApi } from '../services/archive';
import { simulationApi } from '../services/simulation';

const listTomes = vi.mocked(tomesApi.list);
const listScenarios = vi.mocked(archiveApi.list);
const history = vi.mocked(simulationApi.history);

function tome(overrides: Partial<Tome> = {}): Tome {
  return {
    id: 't1',
    userId: 'u1',
    name: 'Visa',
    currentBalance: 1200,
    apr: 22,
    estimatedApr: 16,
    minimumDebtPayment: 35,
    creditLimit: 3000,
    type: 'CREDIT_CARD',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const scenario: Scenario = {
  id: 's1',
  userId: null,
  name: 'Aggressive payoff',
  strategy: 'AVALANCHE',
  extraPayment: 100,
  lumpSumPayment: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const currentPlan: PlanTimeline = {
  runId: 7,
  plan: 'CURRENT',
  label: 'Current',
  status: 'COMPLETED',
  terminationReason: 'HORIZON_REACHED',
  monthsToPayoff: 12,
  payoffDate: null,
  totalInterest: 210,
  totalPaid: 1300,
  finalBalance: 0,
  peakUtilizationPct: 40,
  months: [
    {
      monthIndex: 1,
      monthLabel: 'Feb 2026',
      periodStart: '2026-02-01',
      startingBalance: 1170,
      monthlyInterest: 21.45,
      minimumDue: 35,
      actualPayment: 100,
      extraPayment: 0,
      lumpSumApplied: 0,
      remainingBalance: 1091.45,
      utilizationPct: 36.38,
      interestPaid: 21.45,
      amountToCoverInterest: 21.45,
      debts: [],
    },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={makeAuthValue()}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/app/simulate" element={<div>simulate page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listTomes.mockReset();
  listScenarios.mockReset();
  history.mockReset();
  history.mockResolvedValue([currentPlan]);
});

describe('DashboardPage', () => {
  it('shows accounts, scenarios and the next month of the current plan', async () => {
    listTomes.mockResolvedValue([
      tome({ currentPayment: 100 }),
      tome({ id: 't2', name: 'Loan', type: 'STUDENT_LOAN', currentBalance: 800, apr: 30 }),
    ]);
    listScenarios.mockResolvedValue([scenario]);

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    expect(screen.getByText('Signed in as user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Loan')).toBeInTheDocument();
    expect(screen.getByText('credit card')).toBeInTheDocument();
    expect(screen.getByText('Aggressive payoff')).toBeInTheDocument();
    expect(screen.getByText('Avalanche')).toBeInTheDocument();
    expect(screen.getByText('+$100.00/mo')).toBeInTheDocument();
    expect(screen.getByText('Accounts tracked').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Average APR').parentElement).toHaveTextContent('25.20%');

    expect(screen.getByText('Next month').parentElement).toHaveTextContent('Feb 2026');
    expect(screen.getByText('Starting balance').parentElement).toHaveTextContent('$1,170.00');
    expect(screen.getByText('Actual payment').parentElement).toHaveTextContent('$100.00');
    expect(screen.getByText('Remaining').parentElement).toHaveTextContent('$1,091.45');
    expect(screen.getByText(/Run #7/)).toBeInTheDocument();

    // The account row shows the current payment alongside the minimum.
    const visaRow = screen.getByText('Visa').closest('tr');
    expect(visaRow).toHaveTextContent('$35.00');
    expect(visaRow).toHaveTextContent('$100.00');
  });

  it('falls back to the minimum when no current payment is set', async () => {
    listTomes.mockResolvedValue([tome()]);
    listScenarios.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    const visaRow = screen.getByText('Visa').closest('tr');
    expect(visaRow?.querySelectorAll('td')).toHaveLength(5);
  });

  it('shows empty states when there is nothing to display', async () => {
    listTomes.mockResolvedValue([]);
    listScenarios.mockResolvedValue([]);
    history.mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => expect(screen.getByText('No accounts yet')).toBeInTheDocument());

    expect(screen.getByText('No current plan yet')).toBeInTheDocument();
    expect(screen.getByText('No scenarios saved')).toBeInTheDocument();
    expect(screen.getByText('Accounts tracked').parentElement).toHaveTextContent('0');
  });

  it('shows a load error and retries', async () => {
    const user = userEvent.setup();
    listTomes
      .mockRejectedValueOnce(new ApiError(500, 'database down'))
      .mockResolvedValueOnce([tome()]);
    listScenarios.mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('database down'));

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    expect(listTomes).toHaveBeenCalledTimes(2);
  });

  it('shows a history error and retries', async () => {
    const user = userEvent.setup();
    listTomes.mockResolvedValue([tome()]);
    listScenarios.mockResolvedValue([]);
    history.mockRejectedValueOnce(new ApiError(500, 'runs unavailable'));

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('runs unavailable'),
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Next month')).toBeInTheDocument());
    expect(history).toHaveBeenCalledTimes(2);
  });

  it('links to the simulator', async () => {
    const user = userEvent.setup();
    listTomes.mockResolvedValue([]);
    listScenarios.mockResolvedValue([]);
    history.mockResolvedValue([]);

    renderDashboard();

    await user.click(screen.getByRole('link', { name: 'Open simulator' }));
    expect(screen.getByText('simulate page')).toBeInTheDocument();
  });
});
