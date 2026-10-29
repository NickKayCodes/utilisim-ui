import type { SimulationResult } from '../types/api';

const KEY = 'utilisim.lastRun';

/**
 * `POST /api/assemble/run` does not persist anything, and there is no endpoint to
 * fetch a result later, so the most recent run is kept in sessionStorage.
 */
export function saveLastRun(result: SimulationResult): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    /* ignore quota/private-mode failures */
  }
}

export function readLastRun(): SimulationResult | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SimulationResult>;
    if (!Array.isArray(parsed?.schedule)) return null;
    return parsed as SimulationResult;
  } catch {
    return null;
  }
}
