import type { Tome, TomeRequest } from '../types/api';
import { api } from '../lib/api';

export const tomesApi = {
  list: () => api<Tome[]>('/api/tomes'),

  create: (body: TomeRequest) => api<Tome>('/api/tomes', { method: 'POST', body }),

  remove: (id: string) =>
    api<void>(`/api/tomes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
