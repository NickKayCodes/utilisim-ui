import type {
  DebtSnapshot,
  SimulationInput,
  StrategyAnalysis,
  StrategyInput,
  StrategyOutput,
  StrategyType,
} from '../types/api';
import { api } from '../lib/api';

export type ComparisonInput = Pick<SimulationInput, 'extraPayment' | 'lumpSumPayment'>;

export const oracleApi = {
  /** Body is `{ debts, input }` — one object, because Spring allows one @RequestBody. */
  order: (debts: DebtSnapshot[], input: StrategyInput) =>
    api<StrategyOutput>('/api/oracle/strategy/order', {
      method: 'POST',
      body: { debts, input },
    }),

  /** Body is a bare array of debts; response is a bare string. */
  recommend: (debts: DebtSnapshot[]) =>
    api<string>('/api/oracle/strategy/recommend', { method: 'POST', body: debts }),

  analyze: (debts: DebtSnapshot[], strategies: StrategyType[], input: ComparisonInput) =>
    api<StrategyAnalysis>('/api/oracle/strategy/analyze', {
      method: 'POST',
      body: { debts, strategies, input },
    }),

  totalInterest: (debts: DebtSnapshot[]) =>
    api<number>('/api/oracle/strategy/calculate-total-interest', {
      method: 'POST',
      body: debts,
    }),

  isDeterministic: (strategy: StrategyType) =>
    api<boolean>(
      `/api/oracle/strategy/is-deterministic/${encodeURIComponent(strategy)}`,
    ),
};
