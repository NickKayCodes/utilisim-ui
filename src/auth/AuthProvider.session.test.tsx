import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from './auth-context';
import { writeSession } from '../lib/api';

const { archiveList } = vi.hoisted(() => ({ archiveList: vi.fn() }));

vi.mock('../services/archive', () => ({ archiveApi: { list: archiveList } }));
vi.mock('../services/auth', () => ({ authApi: { login: vi.fn(), register: vi.fn() } }));

function makeProbe(useAuth: () => AuthContextValue) {
  return function Probe() {
    const { user, status } = useAuth();
    return (
      <>
        <span data-testid="status">{status}</span>
        <span data-testid="user">{user?.email ?? 'none'}</span>
      </>
    );
  };
}

async function loadModules() {
  const [{ AuthProvider }, { useAuth }] = await Promise.all([
    import('./AuthProvider'),
    import('./auth-context'),
  ]);
  return { AuthProvider, useAuth };
}

beforeEach(() => {
  vi.resetModules();
  archiveList.mockReset();
});

describe('AuthProvider session restore', () => {
  it('validates a stored session and becomes authenticated', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'token');
    archiveList.mockResolvedValue([]);

    const { AuthProvider, useAuth } = await loadModules();
    const Probe = makeProbe(useAuth);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('u@example.com');
  });

  it('clears the session when validation returns 401', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'token');
    const { ApiError, readToken } = await import('../lib/api');
    archiveList.mockRejectedValue(new ApiError(401, 'expired'));

    const { AuthProvider, useAuth } = await loadModules();
    const Probe = makeProbe(useAuth);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(readToken()).toBeNull();
  });

  it('keeps the user signed in when validation fails for another reason', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'token');
    archiveList.mockRejectedValue(new Error('backend down'));

    const { AuthProvider, useAuth } = await loadModules();
    const Probe = makeProbe(useAuth);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('u@example.com');
  });

  it('ignores a validation response that arrives after unmount', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'token');
    let resolveList: ((value: []) => void) | undefined;
    archiveList.mockReturnValue(
      new Promise<[]>((resolve) => {
        resolveList = resolve;
      }),
    );

    const { AuthProvider, useAuth } = await loadModules();
    const Probe = makeProbe(useAuth);

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    unmount();

    await expect(Promise.resolve(resolveList?.([]))).resolves.toBeUndefined();
  });

  it('ignores a validation failure that arrives after unmount', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'token');
    let rejectList: ((reason: Error) => void) | undefined;
    archiveList.mockReturnValue(
      new Promise<[]>((_resolve, reject) => {
        rejectList = reject;
      }),
    );

    const { AuthProvider, useAuth } = await loadModules();
    const Probe = makeProbe(useAuth);

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    unmount();

    rejectList?.(new Error('late failure'));
  });
});
