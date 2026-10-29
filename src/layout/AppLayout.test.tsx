import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { renderWithProviders } from '../test/test-utils';

beforeEach(() => {
  window.scrollTo = vi.fn();
});

function layoutRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<div>login page</div>} />
      <Route element={<AppLayout />}>
        <Route path="/app/dashboard" element={<div>dashboard page</div>} />
      </Route>
    </Routes>
  );
}

describe('AppLayout', () => {
  it('renders navigation, the current user and the outlet', () => {
    renderWithProviders(layoutRoutes(), { route: '/app/dashboard' });

    expect(screen.getByText('dashboard page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveClass('nav-link-active');
    expect(screen.getByRole('link', { name: /Accounts/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Scenarios/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Simulate/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Compare/ })).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('opens and closes the mobile menu with the toggle, Escape and the backdrop', async () => {
    const user = userEvent.setup();
    renderWithProviders(layoutRoutes(), { route: '/app/dashboard' });

    const toggle = screen.getByRole('button', { name: /Menu/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the menu when a navigation link is used', async () => {
    const user = userEvent.setup();
    renderWithProviders(layoutRoutes(), { route: '/app/dashboard' });

    await user.click(screen.getByRole('button', { name: /Menu/ }));
    await user.click(screen.getByRole('link', { name: /Accounts/ }));

    expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument();
  });

  it('signs out and navigates to login', async () => {
    const user = userEvent.setup();
    const { auth } = renderWithProviders(layoutRoutes(), { route: '/app/dashboard' });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('falls back to a placeholder when there is no user', () => {
    renderWithProviders(layoutRoutes(), {
      route: '/app/dashboard',
      auth: { user: null },
    });

    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
