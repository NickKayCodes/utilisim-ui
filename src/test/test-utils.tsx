import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthContext } from '../auth/auth-context';
import type { AuthContextValue } from '../auth/auth-context';

export const TEST_USER = {
  id: 'user-1',
  username: 'user@example.com',
  email: 'user@example.com',
};

export interface RenderOptions {
  route?: string;
  auth?: Partial<AuthContextValue>;
}

export function makeAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: TEST_USER,
    status: 'authenticated',
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    ...overrides,
  };
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const { route = '/app/dashboard', auth = {} } = options;
  const value = makeAuthValue(auth);

  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );

  return { ...result, auth: value };
}
