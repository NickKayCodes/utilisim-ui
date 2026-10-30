import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScenariosPage } from './ScenariosPage';
import { ApiError } from '../lib/api';
import type { Scenario } from '../types/api';

vi.mock('../services/archive', () => ({
  archiveApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

import { archiveApi } from '../services/archive';

const listScenarios = vi.mocked(archiveApi.list);
const createScenario = vi.mocked(archiveApi.create);
const removeScenario = vi.mocked(archiveApi.remove);

const scenario: Scenario = {
  id: 's1',
  userId: null,
  name: 'Aggressive payoff',
  strategy: 'SNOWBALL',
  extraPayment: 100,
  lumpSumPayment: 500,
  createdAt: '2026-06-15T12:00:00Z',
  updatedAt: '2026-06-15T12:00:00Z',
};

function renderScenarios() {
  return render(
    <MemoryRouter initialEntries={['/app/scenarios']}>
      <Routes>
        <Route path="/app/scenarios" element={<ScenariosPage />} />
        <Route path="/app/simulate" element={<div>simulate page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listScenarios.mockReset();
  createScenario.mockReset();
  removeScenario.mockReset();
  listScenarios.mockResolvedValue([scenario]);
});

describe('ScenariosPage', () => {
  it('lists saved scenarios and states that they are private', async () => {
    renderScenarios();

    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());

    // Both the strategy dropdown option and the table badge say "Snowball".
    expect(
      screen.getAllByText('Snowball').some((element) => element.classList.contains('badge')),
    ).toBe(true);
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText(/private to your account/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    listScenarios.mockResolvedValue([]);
    renderScenarios();

    await waitFor(() => expect(screen.getByText('No scenarios yet')).toBeInTheDocument());
  });

  it('validates the form', async () => {
    const user = userEvent.setup();
    renderScenarios();
    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());

    const submit = screen.getByRole('button', { name: 'Save scenario' });

    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Give the scenario a name.');

    await user.type(screen.getByLabelText(/Name/), 'New plan');
    fireEvent.change(screen.getByLabelText(/Extra per month/), { target: { value: '-1' } });
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Extra payment must be zero or more.');

    fireEvent.change(screen.getByLabelText(/Extra per month/), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/One-time lump sum/), { target: { value: '-1' } });
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Lump sum must be zero or more.');
  });

  it('creates a scenario, trims the name and reloads', async () => {
    const user = userEvent.setup();
    createScenario.mockResolvedValue(scenario);
    renderScenarios();
    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/Name/), '  New plan  ');
    fireEvent.change(screen.getByLabelText(/Extra per month/), { target: { value: '75' } });
    fireEvent.change(screen.getByLabelText(/One-time lump sum/), { target: { value: '250' } });
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    await waitFor(() =>
      expect(createScenario).toHaveBeenCalledWith({
        name: 'New plan',
        strategy: 'SNOWBALL',
        extraPayment: 75,
        lumpSumPayment: 250,
      }),
    );
    await waitFor(() => expect(listScenarios).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(/Name/)).toHaveValue('');
  });

  it('shows a create error and keeps the values', async () => {
    const user = userEvent.setup();
    createScenario.mockRejectedValue(new ApiError(500, 'could not save'));
    renderScenarios();
    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/Name/), 'New plan');
    await user.click(screen.getByRole('button', { name: 'Save scenario' }));

    await waitFor(() => expect(screen.getByText('could not save')).toBeInTheDocument());
    expect(screen.getByLabelText(/Name/)).toHaveValue('New plan');
  });

  it('does not delete when the confirmation is dismissed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderScenarios();
    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(removeScenario).not.toHaveBeenCalled();
  });

  it('deletes after confirmation and reloads', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    removeScenario.mockResolvedValue(undefined);
    renderScenarios();
    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(removeScenario).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(listScenarios).toHaveBeenCalledTimes(2));
  });

  it('shows a delete error', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    removeScenario.mockRejectedValue(new ApiError(404, 'scenario not found'));
    renderScenarios();
    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getByText('scenario not found')).toBeInTheDocument());
  });

  it('opens the simulator with the scenario preset', async () => {
    const user = userEvent.setup();
    renderScenarios();
    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Simulate' }));

    expect(screen.getByText('simulate page')).toBeInTheDocument();
  });

  it('shows a list error and retries', async () => {
    const user = userEvent.setup();
    listScenarios
      .mockRejectedValueOnce(new ApiError(500, 'database down'))
      .mockResolvedValueOnce([scenario]);
    renderScenarios();

    await waitFor(() => expect(screen.getByText('database down')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Aggressive payoff')).toBeInTheDocument());
    expect(listScenarios).toHaveBeenCalledTimes(2);
  });
});
