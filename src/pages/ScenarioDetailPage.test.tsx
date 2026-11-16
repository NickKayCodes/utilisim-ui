import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScenarioDetailPage } from './ScenarioDetailPage';
import { ApiError } from '../lib/api';
import type { Scenario } from '../types/api';

vi.mock('../services/archive', () => ({
  archiveApi: { get: vi.fn() },
}));

import { archiveApi } from '../services/archive';

const getScenario = vi.mocked(archiveApi.get);

const scenario: Scenario = {
  id: 's1',
  userId: null,
  name: 'Aggressive payoff',
  strategy: 'SNOWBALL',
  extraPayment: 100,
  lumpSumPayment: 500,
  createdAt: '2026-06-15T12:00:00Z',
  updatedAt: '2026-07-20T12:00:00Z',
};

/** Stands in for SimulatePage so the router state it receives can be asserted. */
function SimulateStub() {
  const location = useLocation();
  const preset = (location.state as { scenario?: Scenario } | null)?.scenario;
  return <div>simulate page for {preset ? preset.name : 'no preset'}</div>;
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/app/scenarios/s1']}>
      <Routes>
        <Route path="/app/scenarios" element={<div>scenarios page</div>} />
        <Route path="/app/scenarios/:id" element={<ScenarioDetailPage />} />
        <Route path="/app/simulate" element={<SimulateStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getScenario.mockReset();
});

describe('ScenarioDetailPage', () => {
  it('loads the scenario named by the route and shows every stored field', async () => {
    getScenario.mockResolvedValue(scenario);
    renderDetail();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Aggressive payoff' })).toBeInTheDocument(),
    );

    expect(getScenario).toHaveBeenCalledWith('s1');
    expect(screen.getByText('Snowball')).toBeInTheDocument();
    expect(screen.getByText('Extra per month')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('One-time lump sum')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText(/Jun 1[56], 2026/)).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.getByText(/Jul 2[01], 2026/)).toBeInTheDocument();
    expect(screen.getByText(/does not store a debt set/i)).toBeInTheDocument();
  });

  it('opens the simulator with the scenario in router state', async () => {
    const user = userEvent.setup();
    getScenario.mockResolvedValue(scenario);
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Aggressive payoff' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Open in Simulate' }));

    expect(await screen.findByText('simulate page for Aggressive payoff')).toBeInTheDocument();
  });

  it('links back to the scenarios list', async () => {
    const user = userEvent.setup();
    getScenario.mockResolvedValue(scenario);
    renderDetail();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Aggressive payoff' })).toBeInTheDocument(),
    );

    const backLink = screen.getByRole('link', { name: /Back to scenarios/i });
    expect(backLink).toHaveAttribute('href', '/app/scenarios');

    await user.click(backLink);
    expect(await screen.findByText('scenarios page')).toBeInTheDocument();
  });

  it('shows a not-found state for a missing scenario', async () => {
    getScenario.mockRejectedValue(new ApiError(404, 'scenario not found'));
    renderDetail();

    expect(await screen.findByText('Scenario not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scenarios' })).toHaveAttribute(
      'href',
      '/app/scenarios',
    );
  });

  it('shows a not-found state for another account’s scenario', async () => {
    getScenario.mockRejectedValue(new ApiError(403, 'access forbidden'));
    renderDetail();

    expect(await screen.findByText('Scenario not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scenarios' })).toBeInTheDocument();
  });

  it('returns to the list from the not-found state', async () => {
    const user = userEvent.setup();
    getScenario.mockRejectedValue(new ApiError(404, 'scenario not found'));
    renderDetail();

    await user.click(await screen.findByRole('link', { name: 'Back to scenarios' }));

    expect(await screen.findByText('scenarios page')).toBeInTheDocument();
  });

  it('shows the transport error instead of the not-found copy when the API is unreachable', async () => {
    getScenario.mockRejectedValue(
      new ApiError(0, 'Cannot reach the UtiliSim API. Is the backend running on port 8080?'),
    );
    renderDetail();

    expect(
      await screen.findByText(/Cannot reach the UtiliSim API/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the UtiliSim API');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('Scenario not found')).not.toBeInTheDocument();
  });

  it('shows the server error and retries the load', async () => {
    const user = userEvent.setup();
    getScenario
      .mockRejectedValueOnce(new ApiError(500, 'database down'))
      .mockResolvedValueOnce(scenario);
    renderDetail();

    await waitFor(() => expect(screen.getByText('database down')).toBeInTheDocument());
    expect(screen.queryByText('Scenario not found')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('heading', { name: 'Aggressive payoff' }),
    ).toBeInTheDocument();
    expect(getScenario).toHaveBeenCalledTimes(2);
  });

  it('renders the not-found state when the route carries no scenario id', async () => {
    render(
      <MemoryRouter initialEntries={['/app/unknown']}>
        <Routes>
          <Route path="/app/unknown" element={<ScenarioDetailPage />} />
          <Route path="/app/scenarios" element={<div>scenarios page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Scenario not found')).toBeInTheDocument();
    expect(getScenario).not.toHaveBeenCalled();
  });

  it('shows a spinner while the scenario loads', async () => {
    let resolveGet: (value: Scenario) => void = () => {};
    getScenario.mockImplementation(
      () =>
        new Promise<Scenario>((resolve) => {
          resolveGet = resolve;
        }),
    );
    renderDetail();

    expect(screen.getByRole('status')).toHaveTextContent('Loading scenario…');

    resolveGet(scenario);
    expect(await screen.findByRole('heading', { name: 'Aggressive payoff' })).toBeInTheDocument();
  });
});
