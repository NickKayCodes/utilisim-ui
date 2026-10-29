import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../types/api';
import { api } from '../lib/api';

export const authApi = {
  login: (body: LoginRequest) =>
    api<LoginResponse>('/api/auth/login', { method: 'POST', body, auth: false }),

  // Returns no token: the caller logs in afterwards.
  register: (body: RegisterRequest) =>
    api<RegisterResponse>('/api/auth/register', { method: 'POST', body, auth: false }),
};
