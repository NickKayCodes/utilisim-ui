import type { ComponentProps } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { AuthContext } from '../auth/auth-context';
import type { AuthContextValue } from '../auth/auth-context';
import { ApiError } from '../lib/api';
import { makeAuthValue } from '../test/test-utils';

type InitialEntries = ComponentProps<typeof MemoryRouter>['initialEntries'];

function renderLogin(entry: InitialEntries, auth: Partial<AuthContextValue> = {}) {
  const value = makeAuthValue({ status: 'anonymous', user: null, ...auth });

  return {
    ...render(
      <MemoryRouter initialEntries={entry}>
        <AuthContext.Provider value={value}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app/dashboard" element={<div>dashboard page</div>} />
            <Route path="/app/accounts" element={<div>accounts page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    ),
    auth: value,
  };
}

describe('LoginPage', () => {
  it('redirects users who are already signed in', () => {
    renderLogin(['/login'], { status: 'authenticated', user: makeAuthValue().user });

    expect(screen.getByText('dashboard page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('signs in and navigates to the dashboard', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(['/login'], { login });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
    expect(login).toHaveBeenCalledWith('user@example.com', 'secret');
  });

  it('returns to the guarded page recorded in location state', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin([{ pathname: '/login', state: { from: '/app/accounts' } }], { login });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('accounts page')).toBeInTheDocument());
  });

  it('ignores a non-app redirect target', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin([{ pathname: '/login', state: { from: 'https://evil.example' } }], { login });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
  });

  it('shows a sign-in error and re-enables the button', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    renderLogin(['/login'], { login });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'),
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows a busy label while signing in', async () => {
    const user = userEvent.setup();
    let resolveLogin: (() => void) | undefined;
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    renderLogin(['/login'], { login });

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('button', { name: /Signing in/ })).toBeDisabled();

    await act(async () => {
      resolveLogin?.();
    });
    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
  });

  it('links to registration', () => {
    renderLogin(['/login']);

    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register',
    );
  });
});
