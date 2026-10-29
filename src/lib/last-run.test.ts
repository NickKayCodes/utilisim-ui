import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLastRun, saveLastRun } from './last-run';
import type { SimulationResult } from '../types/api';

const result = {
  id: 'run-1',
  monthsToPayoff: 12,
  schedule: [{ monthIndex: 1, date: '2026-01-01T00:00:00Z' }],
} as unknown as SimulationResult;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('last run storage', () => {
  it('round-trips a result through sessionStorage', () => {
    saveLastRun(result);

    expect(readLastRun()).toEqual(result);
  });

  it('returns null when nothing is stored', () => {
    expect(readLastRun()).toBeNull();
  });

  it('rejects malformed JSON and payloads without a schedule', () => {
    window.sessionStorage.setItem('utilisim.lastRun', '{oops');
    expect(readLastRun()).toBeNull();

    window.sessionStorage.setItem('utilisim.lastRun', JSON.stringify({ id: 'x' }));
    expect(readLastRun()).toBeNull();
  });

  it('ignores storage failures', () => {
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => saveLastRun(result)).not.toThrow();
    expect(readLastRun()).toBeNull();
  });
});
