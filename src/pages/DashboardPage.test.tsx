import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { AuthContext } from '../auth/auth-context';
import { makeAuthValue } from '../test/test-utils';
import { saveLastRun } from '../lib/last-run';
import { ApiError } from '../lib/api';
import type { Scenario, SimulationResult, Tome } from '../types/api';

vi.mock('../services/tomes', () => ({ tomesApi: { list: vi.fn() } }));
vi.mock('../services/archive', () => ({ archiveApi: { list: vi.fn() } }));

import { tomesApi } from '../services/tomes';
import { archiveApi } from '../services/archive';

const listTomes = vi.mocked(tomesApi.list);
const listScenarios = vi.mocked(archiveApi.list);

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
});

describe('DashboardPage', () => {
  it('shows accounts, scenarios and the last run', async () => {
    listTomes.mockResolvedValue([
      tome(),
      tome({ id: 't2', name: 'Loan', type: 'STUDENT_LOAN', currentBalance: 800, apr: 30 }),
    ]);
    listScenarios.mockResolvedValue([scenario]);
    saveLastRun({
      monthsToPayoff: 18,
      totalInterestPaid: 250,
      totalPrincipalPaid: 2000,
      payoffDate: '2027-01-01T00:00:00Z',
      status: 'COMPLETED',
      schedule: [],
    } as unknown as SimulationResult);

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    expect(screen.getByText('Signed in as user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Loan')).toBeInTheDocument();
    expect(screen.getByText('credit card')).toBeInTheDocument();
    expect(screen.getByText('Aggressive payoff')).toBeInTheDocument();
    expect(screen.getByText('Avalanche')).toBeInTheDocument();
    expect(screen.getByText('+$100.00/mo')).toBeInTheDocument();
    expect(screen.getByText('18 months')).toBeInTheDocument();
    expect(screen.getByText(/Ran against a \$2,000 principal/)).toBeInTheDocument();
    expect(screen.getByText('Accounts tracked').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Average APR').parentElement).toHaveTextContent('25.20%');
    expect(
      screen.getByText('Average APR').parentElement?.querySelector('.stat-value-warning'),
    ).not.toBeNull();
  });

  it('shows empty states when there is nothing to display', async () => {
    listTomes.mockResolvedValue([]);
    listScenarios.mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => expect(screen.getByText('No accounts yet')).toBeInTheDocument());

    expect(screen.getByText('No simulation yet')).toBeInTheDocument();
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

  it('links to the simulator', async () => {
    const user = userEvent.setup();
    listTomes.mockResolvedValue([]);
    listScenarios.mockResolvedValue([]);

    renderDashboard();

    await user.click(screen.getByRole('link', { name: 'Open simulator' }));
    expect(screen.getByText('simulate page')).toBeInTheDocument();
  });
});
