import type { Scenario, ScenarioInput } from '../types/api';
import { api } from '../lib/api';

function scenarioPath(id: string): string {
  return `/api/archive/scenarios/${encodeURIComponent(id)}`;
}

export const archiveApi = {
  list: () => api<Scenario[]>('/api/archive/scenarios'),

  get: (id: string) => api<Scenario>(scenarioPath(id)),

  create: (body: ScenarioInput) =>
    api<Scenario>('/api/archive/scenarios', { method: 'POST', body }),

  update: (id: string, body: ScenarioInput) =>
    api<Scenario>(scenarioPath(id), { method: 'PUT', body }),

  remove: (id: string) => api<void>(scenarioPath(id), { method: 'DELETE' }),
};
