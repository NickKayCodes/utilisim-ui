import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulatePage } from './SimulatePage';
import { ApiError } from '../lib/api';
import type { PlanTimeline, Scenario, Tome } from '../types/api';

vi.mock('../services/tomes', () => ({ tomesApi: { list: vi.fn() } }));
vi.mock('../services/simulation', () => ({ simulationApi: { runPlan: vi.fn() } }));
vi.mock('../services/archive', () => ({ archiveApi: { create: vi.fn() } }));

import { tomesApi } from '../services/tomes';
import { simulationApi } from '../services/simulation';
import { archiveApi } from '../services/archive';

const listTomes = vi.mocked(tomesApi.list);
const runPlan = vi.mocked(simulationApi.runPlan);
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

const timeline: PlanTimeline = {
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
      utilizationPct: 0,
      interestPaid: 5.5,
      amountToCoverInterest: 5.5,
      debts: [],
    },
  ],
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

async function runPlanFor(user: ReturnType<typeof userEvent.setup>) {
  setValue(/Start month/, '2026-01');
  await user.selectOptions(screen.getByLabelText(/^Plan/), 'AVALANCHE');
  setValue(/Extra per month/, '75');
  await user.click(screen.getByRole('button', { name: 'Run plan' }));
  await waitFor(() => expect(runPlan).toHaveBeenCalledOnce());
}

beforeEach(() => {
  listTomes.mockReset();
  runPlan.mockReset();
  createScenario.mockReset();
  listTomes.mockResolvedValue([tome()]);
  runPlan.mockResolvedValue(timeline);
  createScenario.mockResolvedValue(preset);
});

describe('SimulatePage', () => {
  it('shows an empty state without accounts', async () => {
    listTomes.mockResolvedValue([]);
    renderSimulate();

    await waitFor(() => expect(screen.getByText('No accounts to simulate')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Add an account' })).toBeInTheDocument();
  });

  it('shows a list error and retries', async () => {
    const user = userEvent.setup();
    listTomes
      .mockRejectedValueOnce(new ApiError(500, 'database down'))
      .mockResolvedValueOnce([tome()]);
    renderSimulate();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('database down'));

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    expect(listTomes).toHaveBeenCalledTimes(2);
  });

  it('defaults to CURRENT with extra and lump-sum controls disabled', async () => {
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    expect(screen.getByLabelText(/^Plan/)).toHaveValue('CURRENT');
    expect(screen.getByLabelText(/Extra per month/)).toBeDisabled();
    expect(screen.getByLabelText(/One-time lump sum/)).toBeDisabled();
    expect(screen.getByLabelText(/Lump-sum month/)).toBeDisabled();
    expect(screen.getByText(/1 of 1 selected/)).toHaveTextContent('$1,200.00');
  });

  it('enables budget controls for strategy plans', async () => {
    const user = userEvent.setup();
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/^Plan/), 'SNOWBALL');

    expect(screen.getByLabelText(/Extra per month/)).toBeEnabled();
    expect(screen.getByLabelText(/One-time lump sum/)).toBeEnabled();
    expect(screen.getByLabelText(/Lump-sum month/)).toBeEnabled();
  });

  it('toggles account selection', async () => {
    const user = userEvent.setup();
    listTomes.mockResolvedValue([
      tome(),
      tome({ id: 't2', name: 'Loan', type: 'STUDENT_LOAN' }),
    ]);
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await user.click(screen.getByRole('checkbox', { name: /Visa/ }));
    expect(screen.getByText(/1 of 2 selected/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Loan/ }));
    expect(screen.getByText(/0 of 2 selected/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText(/2 of 2 selected/)).toBeInTheDocument();
  });

  it('validates the form before running', async () => {
    const user = userEvent.setup();
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await user.click(screen.getByRole('checkbox', { name: /Visa/ }));
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one account');

    await user.click(screen.getByRole('checkbox', { name: /Visa/ }));
    setValue(/Horizon \(months\)/, '0');
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Horizon must be between 1 and 600 months.');

    setValue(/Horizon \(months\)/, '120');
    await user.selectOptions(screen.getByLabelText(/^Plan/), 'HYBRID');

    setValue(/Extra per month/, '-1');
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Extra payment must be zero or more.');

    setValue(/Extra per month/, '0');
    setValue(/One-time lump sum/, '-1');
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Lump sum must be zero or more.');

    setValue(/One-time lump sum/, '0');
    setValue(/Lump-sum month/, '121');
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Lump-sum month must be within the horizon.');
    expect(runPlan).not.toHaveBeenCalled();
  });

  it('runs one plan and renders the timeline', async () => {
    const user = userEvent.setup();
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await runPlanFor(user);

    expect(runPlan).toHaveBeenCalledWith({
      tomeIds: ['t1'],
      plan: 'AVALANCHE',
      startMonth: '2026-01-01',
      horizonMonths: 120,
      extraPayment: 75,
      lumpSumPayment: 0,
      lumpSumMonth: 1,
    });

    expect(screen.getByText('Months to payoff').parentElement).toHaveTextContent('2 months');
    expect(screen.getByText('Total interest').parentElement).toHaveTextContent('$15.50');
    expect(screen.getByText('Total paid').parentElement).toHaveTextContent('$1,015.50');
    expect(screen.getByText('Jan 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('Jan 2026')).not.toBeInTheDocument();
  });

  it('shows a run error', async () => {
    const user = userEvent.setup();
    runPlan.mockRejectedValue(new ApiError(500, 'simulation failed'));
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Run plan' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('simulation failed'));
  });

  it('prefills from a scenario passed in navigation state', async () => {
    renderSimulate([{ pathname: '/app/simulate', state: { scenario: preset } }]);

    expect(screen.getByText(/Prefilled plan and payments/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    expect(screen.getByLabelText(/Extra per month/)).toHaveValue(50);
    expect(screen.getByLabelText(/One-time lump sum/)).toHaveValue(100);
    expect(screen.getByLabelText(/^Plan/)).toHaveValue('AVALANCHE');
  });

  it('requires a name before saving a scenario', async () => {
    const user = userEvent.setup();
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Run plan' }));
    await screen.findByText('Jan 2026');

    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Give the scenario a name first.');
    expect(createScenario).not.toHaveBeenCalled();
  });

  it('saves the run inputs as a scenario', async () => {
    const user = userEvent.setup();
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    await runPlanFor(user);

    await user.type(screen.getByLabelText(/Save this plan as a scenario/), '  Plan B  ');
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    await waitFor(() =>
      expect(createScenario).toHaveBeenCalledWith({
        name: 'Plan B',
        strategy: 'AVALANCHE',
        extraPayment: 75,
        lumpSumPayment: 0,
      }),
    );
    expect(await screen.findByText(/Saved "Plan B"/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Save this plan as a scenario/)).toHaveValue('');
  });

  it('shows an error when saving the scenario fails', async () => {
    const user = userEvent.setup();
    createScenario.mockRejectedValue(new ApiError(500, 'could not save scenario'));
    renderSimulate();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    await runPlanFor(user);

    await user.type(screen.getByLabelText(/Save this plan as a scenario/), 'Plan C');
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    await waitFor(() => expect(screen.getByText('could not save scenario')).toBeInTheDocument());
  });
});
