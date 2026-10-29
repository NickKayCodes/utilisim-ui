import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulatePage } from './SimulatePage';
import { ApiError } from '../lib/api';
import { readLastRun } from '../lib/last-run';
import type { Scenario, SimulationResult, Tome } from '../types/api';

vi.mock('../services/tomes', () => ({ tomesApi: { list: vi.fn() } }));
vi.mock('../services/simulation', () => ({ simulationApi: { run: vi.fn() } }));
vi.mock('../services/archive', () => ({ archiveApi: { create: vi.fn() } }));

import { tomesApi } from '../services/tomes';
import { simulationApi } from '../services/simulation';
import { archiveApi } from '../services/archive';

const listTomes = vi.mocked(tomesApi.list);
const runSimulationApi = vi.mocked(simulationApi.run);
const createScenario = vi.mocked(archiveApi.create);

type InitialEntries = ComponentProps<typeof MemoryRouter>['initialEntries'];

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

const result: SimulationResult = {
  id: 'run-1',
  simulationInputId: null,
  userId: null,
  status: 'COMPLETED',
  startedAt: '2026-01-01T00:00:00Z',
  completedAt: '2026-01-01T00:00:00Z',
  totalInterestPaid: 100,
  totalPrincipalPaid: 1000,
  monthsToPayoff: 12,
  payoffDate: '2027-01-01T00:00:00Z',
  savingsComparedToBaseline: 10,
  schedule: [],
  archivedAt: null,
  ledgerEntryId: null,
};

const preset: Scenario = {
  id: 's1',
  userId: null,
  name: 'Plan A',
  strategy: 'AVALANCHE',
  extraPayment: 50,
  lumpSumPayment: 100,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderSimulate(entry: InitialEntries = ['/app/simulate']) {
  return render(
    <MemoryRouter initialEntries={entry}>
      <Routes>
        <Route path="/app/simulate" element={<SimulatePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setValue(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValidInputs() {
  setValue(/Starting balance/, '1000');
  setValue(/APR %/, '20');
  setValue(/Term \(months\)/, '12');
  setValue(/Minimum payment/, '100');
  setValue(/Extra per month/, '0');
  setValue(/One-time lump sum/, '0');
}

async function runValidSimulation(user: ReturnType<typeof userEvent.setup>) {
  fillValidInputs();
  await user.click(screen.getByRole('button', { name: 'Run simulation' }));
  await waitFor(() => expect(screen.getByText('Amortization schedule')).toBeInTheDocument());
}

beforeEach(() => {
  listTomes.mockReset();
  runSimulationApi.mockReset();
  createScenario.mockReset();
  listTomes.mockResolvedValue([]);
  runSimulationApi.mockResolvedValue(result);
  createScenario.mockResolvedValue(preset);
});

describe('SimulatePage', () => {
  it('renders the default form and disables account prefilling without accounts', async () => {
    renderSimulate();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Fill from my accounts' })).toBeDisabled(),
    );
    expect(screen.getByLabelText(/Term \(months\)/)).toHaveValue(60);
    expect(screen.getByLabelText(/Strategy/)).toHaveValue('SNOWBALL');
  });

  it('fills the form from the current accounts', async () => {
    const user = userEvent.setup();
    listTomes.mockResolvedValue([
      tome({ currentBalance: 1200, apr: 22, minimumDebtPayment: 35 }),
      tome({ id: 't2', currentBalance: 800, apr: 30, minimumDebtPayment: 20 }),
    ]);

    renderSimulate();
    await waitFor(() => expect(screen.getByText(/From your accounts/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Fill from my accounts' }));

    expect(screen.getByLabelText(/Starting balance/)).toHaveValue(2000);
    expect(screen.getByLabelText(/Minimum payment/)).toHaveValue(55);
    expect(screen.getByLabelText(/APR %/)).toHaveValue(25.2);
  });

  it('validates every input before running', async () => {
    const user = userEvent.setup();
    renderSimulate();
    const run = screen.getByRole('button', { name: 'Run simulation' });

    await user.click(run);
    expect(screen.getByRole('alert')).toHaveTextContent('Starting balance must be greater than zero.');

    setValue(/Starting balance/, '1000');
    await user.click(run);
    expect(screen.getByRole('alert')).toHaveTextContent('APR must be zero or more.');

    setValue(/APR %/, '20');
    setValue(/Term \(months\)/, '');
    await user.click(run);
    expect(screen.getByRole('alert')).toHaveTextContent('Term must be at least 1 month.');

    setValue(/Term \(months\)/, '12');
    await user.click(run);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Minimum payment must be greater than zero.',
    );

    setValue(/Minimum payment/, '-1');
    await user.click(run);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Minimum payment must be greater than zero.',
    );

    setValue(/Minimum payment/, '100');
    setValue(/Extra per month/, '-1');
    await user.click(run);
    expect(screen.getByRole('alert')).toHaveTextContent('Extra payment must be zero or more.');

    setValue(/Extra per month/, '0');
    setValue(/One-time lump sum/, '-1');
    await user.click(run);
    expect(screen.getByRole('alert')).toHaveTextContent('Lump sum must be zero or more.');

    setValue(/One-time lump sum/, '0');
    await user.click(run);

    await waitFor(() => expect(runSimulationApi).toHaveBeenCalledOnce());
    expect(runSimulationApi.mock.calls[0][0]).toMatchObject({
      principal: 1000,
      interestRate: 0.2,
      termMonths: 12,
      minimumPayment: 100,
      extraPayment: 0,
      lumpSumPayment: 0,
      strategy: 'SNOWBALL',
    });
  });

  it('rejects a payment that does not cover monthly interest', async () => {
    const user = userEvent.setup();
    renderSimulate();

    fillValidInputs();
    setValue(/Minimum payment/, '1');
    await user.click(screen.getByRole('button', { name: 'Run simulation' }));

    expect(screen.getByRole('alert')).toHaveTextContent('does not cover');
    expect(runSimulationApi).not.toHaveBeenCalled();
  });

  it('runs a simulation, stores the result and clears it', async () => {
    const user = userEvent.setup();
    renderSimulate();
    await runValidSimulation(user);

    expect(screen.getByText('Months to payoff')).toBeInTheDocument();
    expect(screen.getByText('12 months')).toBeInTheDocument();
    expect(readLastRun()).toMatchObject({ id: 'run-1' });

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('Amortization schedule')).not.toBeInTheDocument();
  });

  it('shows a simulation error', async () => {
    const user = userEvent.setup();
    runSimulationApi.mockRejectedValue(new ApiError(500, 'simulation failed'));
    renderSimulate();

    fillValidInputs();
    await user.click(screen.getByRole('button', { name: 'Run simulation' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('simulation failed'));
  });

  it('prefills from a scenario passed in navigation state', async () => {
    renderSimulate([{ pathname: '/app/simulate', state: { scenario: preset } }]);

    expect(screen.getByText(/Prefilled strategy and extra payments/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Extra per month/)).toHaveValue(50);
    expect(screen.getByLabelText(/One-time lump sum/)).toHaveValue(100);
    expect(screen.getByLabelText(/Strategy/)).toHaveValue('AVALANCHE');
  });

  it('requires a name before saving a scenario', async () => {
    const user = userEvent.setup();
    renderSimulate();
    await runValidSimulation(user);

    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Give the scenario a name first.');
    expect(createScenario).not.toHaveBeenCalled();
  });

  it('saves the run inputs as a scenario', async () => {
    const user = userEvent.setup();
    renderSimulate();
    await runValidSimulation(user);

    await user.type(screen.getByLabelText(/Save these inputs as a scenario/), '  Plan B  ');
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    await waitFor(() =>
      expect(createScenario).toHaveBeenCalledWith({
        name: 'Plan B',
        strategy: 'SNOWBALL',
        extraPayment: 0,
        lumpSumPayment: 0,
      }),
    );
    expect(await screen.findByText(/Saved "Plan B"/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Save these inputs as a scenario/)).toHaveValue('');
  });

  it('shows an error when saving the scenario fails', async () => {
    const user = userEvent.setup();
    createScenario.mockRejectedValue(new ApiError(500, 'could not save scenario'));
    renderSimulate();
    await runValidSimulation(user);

    await user.type(screen.getByLabelText(/Save these inputs as a scenario/), 'Plan C');
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    await waitFor(() =>
      expect(screen.getByText('could not save scenario')).toBeInTheDocument(),
    );
  });
});
