import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsPage } from './AccountsPage';
import { ApiError } from '../lib/api';
import type { Tome } from '../types/api';

vi.mock('../services/tomes', () => ({
  tomesApi: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
}));

import { tomesApi } from '../services/tomes';

const listTomes = vi.mocked(tomesApi.list);
const createTome = vi.mocked(tomesApi.create);
const removeTome = vi.mocked(tomesApi.remove);

function tome(overrides: Partial<Tome> = {}): Tome {
  return {
    id: 't1',
    userId: 'u1',
    name: 'Visa',
    currentBalance: 1200,
    apr: 25,
    estimatedApr: 25,
    minimumDebtPayment: 35,
    creditLimit: 3000,
    type: 'CREDIT_CARD',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderAccounts() {
  return render(<AccountsPage />);
}

beforeEach(() => {
  listTomes.mockReset();
  createTome.mockReset();
  removeTome.mockReset();
  listTomes.mockResolvedValue([tome()]);
});

describe('AccountsPage', () => {
  it('lists accounts with totals, utilisation and estimated APR', async () => {
    listTomes.mockResolvedValue([
      tome({ currentBalance: 1200, creditLimit: 3000 }),
      tome({
        id: 't2',
        name: 'Store card',
        apr: null,
        estimatedApr: 16,
        currentBalance: 500,
        creditLimit: 0,
        minimumDebtPayment: 20,
        type: 'OTHER',
      }),
    ]);

    renderAccounts();

    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    expect(screen.getByText('Store card')).toBeInTheDocument();
    expect(screen.getByText('Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('estimated')).toBeInTheDocument();
    expect(screen.getByText('Total balance').parentElement).toHaveTextContent('$1,700.00');
    expect(screen.getByText('Total minimums').parentElement).toHaveTextContent('$55.00');
    expect(screen.getByText('Credit utilisation').parentElement).toHaveTextContent('56.7%');
    // The second row has no credit limit, so its utilisation cell shows a dash.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText(/PUT \/api\/tomes/)).toBeInTheDocument();
  });

  it('marks high utilisation', async () => {
    listTomes.mockResolvedValue([tome({ currentBalance: 2900, creditLimit: 3000 })]);

    const { container } = renderAccounts();

    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    expect(container.querySelector('.bar-fill-high')).not.toBeNull();
    expect(screen.getByText('Credit utilisation').parentElement).toHaveTextContent('96.7%');
  });

  it('shows an empty state that opens the form', async () => {
    const user = userEvent.setup();
    listTomes.mockResolvedValue([]);

    renderAccounts();

    await waitFor(() => expect(screen.getByText('No accounts yet')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(screen.getByRole('heading', { name: 'New account' })).toBeInTheDocument();
  });

  it('opens, closes and cancels the form', async () => {
    const user = userEvent.setup();

    renderAccounts();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Add account' }));
    expect(screen.getByRole('heading', { name: 'New account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close form' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'New account' })).not.toBeInTheDocument();
  });

  it('validates each field', async () => {
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    const name = screen.getByLabelText(/Account name/);
    const balance = screen.getByLabelText(/Current balance/);
    const apr = screen.getByLabelText(/APR/);
    const minimum = screen.getByLabelText(/Minimum payment/);
    const limit = screen.getByLabelText(/Credit limit/);
    const submit = screen.getByRole('button', { name: 'Save account' });

    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Give the account a name.');

    await user.type(name, 'Visa');
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Balance must be zero or more.');

    fireEvent.change(balance, { target: { value: '-1' } });
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Balance must be zero or more.');

    fireEvent.change(balance, { target: { value: '1000' } });
    fireEvent.change(apr, { target: { value: '150' } });
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('APR must be between 0 and 100.');

    fireEvent.change(apr, { target: { value: '20' } });
    fireEvent.change(minimum, { target: { value: '-1' } });
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Minimum payment must be zero or more.');

    fireEvent.change(minimum, { target: { value: '25' } });
    fireEvent.change(limit, { target: { value: '-1' } });
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Credit limit must be zero or more.');
  });

  it('creates an account, sends a null APR when blank and reloads the list', async () => {
    const user = userEvent.setup();
    createTome.mockResolvedValue(tome());
    renderAccounts();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    await user.type(screen.getByLabelText(/Account name/), '  New card  ');
    fireEvent.change(screen.getByLabelText(/Current balance/), { target: { value: '1200.50' } });
    fireEvent.change(screen.getByLabelText(/Minimum payment/), { target: { value: '35' } });
    fireEvent.change(screen.getByLabelText(/Credit limit/), { target: { value: '5000' } });
    await user.click(screen.getByRole('button', { name: 'Save account' }));

    await waitFor(() =>
      expect(createTome).toHaveBeenCalledWith({
        name: 'New card',
        type: 'CREDIT_CARD',
        currentBalance: 1200.5,
        apr: null,
        minimumDebtPayment: 35,
        creditLimit: 5000,
      }),
    );
    await waitFor(() => expect(listTomes).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('heading', { name: 'New account' })).not.toBeInTheDocument();
  });

  it('keeps the form open and shows an API error', async () => {
    const user = userEvent.setup();
    createTome.mockRejectedValue(new ApiError(500, 'could not save'));
    renderAccounts();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    await user.type(screen.getByLabelText(/Account name/), 'New card');
    fireEvent.change(screen.getByLabelText(/Current balance/), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/APR/), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Minimum payment/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Credit limit/), { target: { value: '100' } });
    await user.click(screen.getByRole('button', { name: 'Save account' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not save'));
    expect(screen.getByRole('heading', { name: 'New account' })).toBeInTheDocument();
  });

  it('does not delete when the confirmation is dismissed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAccounts();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(removeTome).not.toHaveBeenCalled();
  });

  it('deletes after confirmation and reloads', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    removeTome.mockResolvedValue(undefined);
    renderAccounts();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(removeTome).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(listTomes).toHaveBeenCalledTimes(2));
  });

  it('shows a delete error', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    removeTome.mockRejectedValue(new ApiError(404, 'account not found'));
    renderAccounts();
    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('account not found'),
    );
  });

  it('shows a list error and retries', async () => {
    const user = userEvent.setup();
    listTomes
      .mockRejectedValueOnce(new ApiError(500, 'database down'))
      .mockResolvedValueOnce([tome()]);
    renderAccounts();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('database down'));

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Visa')).toBeInTheDocument());
    expect(listTomes).toHaveBeenCalledTimes(2);
  });
});
