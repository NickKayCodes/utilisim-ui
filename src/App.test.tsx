import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { renderWithProviders } from './test/test-utils';

vi.mock('./services/tomes', () => ({ tomesApi: { list: vi.fn() } }));
vi.mock('./services/archive', () => ({ archiveApi: { list: vi.fn() } }));

import { tomesApi } from './services/tomes';
import { archiveApi } from './services/archive';

const listTomes = vi.mocked(tomesApi.list);
const listScenarios = vi.mocked(archiveApi.list);

beforeEach(() => {
  listTomes.mockReset();
  listScenarios.mockReset();
  listTomes.mockResolvedValue([]);
  listScenarios.mockResolvedValue([]);
});

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('App routes', () => {
  it('redirects the root to login when anonymous', async () => {
    renderApp('/');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument());
  });

  it('serves the registration page', async () => {
    renderApp('/register');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument(),
    );
  });

  it('redirects unknown paths to the guarded app', async () => {
    renderApp('/not-a-real-page');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument());
  });

  it('renders the dashboard for an authenticated session', async () => {
    renderWithProviders(<App />, { route: '/app' });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument());
    expect(listTomes).toHaveBeenCalled();
    expect(listScenarios).toHaveBeenCalled();
  });

  it('renders a nested account route for an authenticated session', async () => {
    renderWithProviders(<App />, { route: '/app/accounts' });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument());
  });
});
