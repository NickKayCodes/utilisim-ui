import type {
  ComparisonRequest,
  ComparisonResponse,
  PlanRunRequest,
  PlanTimeline,
  SimulationInput,
  SimulationResult,
} from '../types/api';
import { api } from '../lib/api';

export const simulationApi = {
  /** Legacy single-balance endpoint; scheduled for removal. */
  run: (body: SimulationInput) =>
    api<SimulationResult>('/api/assemble/run', { method: 'POST', body }),

  /** Run one plan over a debt set. */
  runPlan: (body: PlanRunRequest) =>
    api<PlanTimeline>('/api/simulate/run', { method: 'POST', body }),

  /** Run the requested plans (default five) over one debt set. */
  compare: (body: ComparisonRequest) =>
    api<ComparisonResponse>('/api/simulate/compare', { method: 'POST', body }),

  getRun: (runId: number) =>
    api<PlanTimeline>(`/api/simulate/runs/${runId}`),

  getComparison: (comparisonGroupId: string) =>
    api<ComparisonResponse>(`/api/simulate/comparisons/${encodeURIComponent(comparisonGroupId)}`),

  history: (limit = 20) =>
    api<PlanTimeline[]>(`/api/simulate/runs?limit=${limit}`),
};
