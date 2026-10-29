import { useState } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './auth-context';
import { ApiError, api, errorMessage, readToken } from '../lib/api';

vi.mock('../services/auth', () => ({
  authApi: { login: vi.fn(), register: vi.fn() },
}));

vi.mock('../services/archive', () => ({
  archiveApi: { list: vi.fn() },
}));

import { authApi } from '../services/auth';

const loginMock = vi.mocked(authApi.login);
const registerMock = vi.mocked(authApi.register);

function Probe() {
  const { user, status, login, register, logout } = useAuth();
  const [error, setError] = useState('');

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.email ?? 'none'}</span>
      <span data-testid="error">{error}</span>
      <button
        type="button"
        onClick={() => void login('user@example.com', 'secret').catch((e) => setError(errorMessage(e)))}
      >
        do-login
      </button>
      <button
        type="button"
        onClick={() =>
          void register('user', 'user@example.com', 'secret').catch((e) => setError(errorMessage(e)))
        }
      >
        do-register
      </button>
      <button type="button" onClick={logout}>
        do-logout
      </button>
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuthProvider', () => {
  it('starts anonymous when there is no stored session', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('logs in and persists the session', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      id: 'u1',
      username: 'user@example.com',
      email: 'user@example.com',
      token: 'token-1',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'do-login' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    expect(readToken()).toBe('token-1');
    expect(loginMock).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret' });
  });

  it('surfaces login failures without authenticating', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new ApiError(401, 'Invalid email or password'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'do-login' }));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password'),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(readToken()).toBeNull();
  });

  it('registers and then signs in', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue({
      id: 'u1',
      username: 'user',
      email: 'user@example.com',
    });
    loginMock.mockResolvedValue({
      id: 'u1',
      username: 'user@example.com',
      email: 'user@example.com',
      token: 'token-2',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'do-register' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(registerMock).toHaveBeenCalledWith({
      username: 'user',
      email: 'user@example.com',
      password: 'secret',
    });
    expect(loginMock).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret' });
  });

  it('logs out and clears the session', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      id: 'u1',
      username: 'user@example.com',
      email: 'user@example.com',
      token: 'token-3',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'do-login' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await user.click(screen.getByRole('button', { name: 'do-logout' }));

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(readToken()).toBeNull();
  });

  it('signs out when any request returns 401', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      id: 'u1',
      username: 'user@example.com',
      email: 'user@example.com',
      token: 'token-4',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'do-login' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
        text: async () => '{"message":"expired"}',
      }),
    );

    await act(async () => {
      await expect(api('/api/private')).rejects.toBeInstanceOf(ApiError);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(readToken()).toBeNull();
  });

  it('throws when useAuth is used without a provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used inside <AuthProvider>',
    );
  });
});
