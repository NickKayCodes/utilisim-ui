import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';
import { AuthContext } from '../auth/auth-context';
import type { AuthContextValue } from '../auth/auth-context';
import { ApiError } from '../lib/api';
import { makeAuthValue } from '../test/test-utils';

type InitialEntries = ComponentProps<typeof MemoryRouter>['initialEntries'];

function renderRegister(entry: InitialEntries, auth: Partial<AuthContextValue> = {}) {
  const value = makeAuthValue({ status: 'anonymous', user: null, ...auth });

  return {
    ...render(
      <MemoryRouter initialEntries={entry}>
        <AuthContext.Provider value={value}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/app/dashboard" element={<div>dashboard page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    ),
    auth: value,
  };
}

describe('RegisterPage', () => {
  it('redirects users who are already signed in', () => {
    renderRegister(['/register'], { status: 'authenticated', user: makeAuthValue().user });

    expect(screen.getByText('dashboard page')).toBeInTheDocument();
  });

  it('walks through each validation rule and then registers', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockResolvedValue(undefined);
    renderRegister(['/register'], { register });

    const submit = screen.getByRole('button', { name: 'Create account' });

    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a username.');

    await user.type(screen.getByLabelText(/Username/), 'user');
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');

    await user.type(screen.getByLabelText(/Email/), 'user@example.com');
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters');

    await user.type(screen.getByLabelText(/^Password/), 'short');
    await user.type(screen.getByLabelText(/Confirm password/), 'different');
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters');

    await user.clear(screen.getByLabelText(/^Password/));
    await user.type(screen.getByLabelText(/^Password/), 'password1');
    await user.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('passwords do not match');

    await user.clear(screen.getByLabelText(/Confirm password/));
    await user.type(screen.getByLabelText(/Confirm password/), 'password1');
    await user.click(submit);

    await waitFor(() => expect(screen.getByText('dashboard page')).toBeInTheDocument());
    expect(register).toHaveBeenCalledWith('user', 'user@example.com', 'password1');
  });

  it('shows a registration error', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockRejectedValue(new ApiError(400, 'Email already in use'));
    renderRegister(['/register'], { register });

    await user.type(screen.getByLabelText(/Username/), 'user');
    await user.type(screen.getByLabelText(/Email/), 'user@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'password1');
    await user.type(screen.getByLabelText(/Confirm password/), 'password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email already in use'),
    );
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });

  it('links to sign in', () => {
    renderRegister(['/register']);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
