import type { SimulationInput, SimulationResult } from '../types/api';
import { api } from '../lib/api';

export const simulationApi = {
  run: (body: SimulationInput) =>
    api<SimulationResult>('/api/assemble/run', { method: 'POST', body }),
};
