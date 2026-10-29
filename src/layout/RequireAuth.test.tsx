import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RequireAuth } from './RequireAuth';
import { renderWithProviders } from '../test/test-utils';

function guardedRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<div>login page</div>} />
      <Route
        path="/app/dashboard"
        element={
          <RequireAuth>
            <div>secret content</div>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

describe('RequireAuth', () => {
  it('shows a boot screen while the session is loading', () => {
    renderWithProviders(guardedRoutes(), {
      route: '/app/dashboard',
      auth: { status: 'loading', user: null },
    });

    expect(screen.getByRole('status')).toHaveTextContent(/Restoring your session/);
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('redirects anonymous visitors to login', () => {
    renderWithProviders(guardedRoutes(), {
      route: '/app/dashboard',
      auth: { status: 'anonymous', user: null },
    });

    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders children for authenticated users', () => {
    renderWithProviders(guardedRoutes(), { route: '/app/dashboard' });

    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});

// Keep MemoryRouter imported so the test file fails loudly if the helper stops
// providing a router.
it('uses the shared router helper', () => {
  render(
    <MemoryRouter>
      <div>router ok</div>
    </MemoryRouter>,
  );
  expect(screen.getByText('router ok')).toBeInTheDocument();
});
