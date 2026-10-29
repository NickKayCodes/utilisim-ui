/**
 * DTOs mirroring the verified API contract in `../../API_CONTRACT.md`.
 * Field names are exactly what the Spring controllers serialise.
 */

export type StrategyType =
  | 'SNOWBALL'
  | 'AVALANCHE'
  | 'HYBRID'
  | 'CUSTOM'
  | 'MINIMUM_ONLY';

export const STRATEGY_TYPES: StrategyType[] = [
  'SNOWBALL',
  'AVALANCHE',
  'HYBRID',
  'MINIMUM_ONLY',
];

/* ------------------------------------------------------------------ auth */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  username: string;
  email: string;
  token: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
}

export interface RegisterResponse {
  id: string;
  username: string;
  email: string;
}

/* -------------------------------------------------------------- scenarios */

export interface Scenario {
  id: string;
  userId: string | null;
  name: string;
  strategy: string;
  extraPayment: number;
  lumpSumPayment: number;
  createdAt: string;
  updatedAt: string;
}

/** Only these fields are read by `POST /api/archive/scenarios`. */
export interface ScenarioInput {
  name: string;
  strategy: string;
  extraPayment: number;
  lumpSumPayment: number;
}

/* ----------------------------------------------------------------- tomes */

export interface Tome {
  id: string;
  userId: string | null;
  name: string;
  currentBalance: number;
  /** Percentage, e.g. 19.99. Always numeric in responses today. */
  apr: number | null;
  /** Percentage. Mirrors `apr`; the server-side estimate path is currently broken. */
  estimatedApr: number;
  minimumDebtPayment: number;
  creditLimit: number;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface TomeRequest {
  name: string;
  currentBalance: number;
  /** Percentage, e.g. 19.99. `null` is typed but currently returns 500 from the API. */
  apr: number | null;
  minimumDebtPayment: number;
  creditLimit: number;
  type: string;
}

/* ---------------------------------------------------------------- oracle */

export interface DebtSnapshot {
  tomeId: string;
  accountName: string;
  currentBalance: number;
  apr: number;
  estimatedApr: number;
  minimumPayment: number;
  interestRate: number;
}

export interface StrategyInput {
  strategyType: StrategyType;
  /** Only used by the CUSTOM strategy. */
  customDebtOrder?: string[];
  extraPayment: number;
  lumpSumPayment: number;
}

export interface StrategyOutput {
  strategyName: string;
  orderedDebts: DebtSnapshot[];
  description: string;
}

export interface StrategyComparison {
  strategyName: string;
  projectedInterest: number;
  debtCount: number;
  description: string;
}

export interface StrategyAnalysis {
  comparisons: StrategyComparison[];
  recommendedStrategy: string | null;
  analysisNotes: string | null;
}

/* ------------------------------------------------------------ simulation */

export interface SimulationInput {
  principal: number;
  /** Annual decimal, e.g. 0.1999 for 19.99%. */
  interestRate: number;
  termMonths: number;
  minimumPayment: number;
  extraPayment: number;
  lumpSumPayment: number;
  strategy: StrategyType;
}

export interface AmortizationEntry {
  monthIndex: number;
  date: string;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
}

export interface SimulationResult {
  id: string;
  simulationInputId: string | null;
  userId: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  monthsToPayoff: number;
  payoffDate: string;
  savingsComparedToBaseline: number;
  schedule: AmortizationEntry[];
  archivedAt: string | null;
  ledgerEntryId: string | null;
}

/* ---------------------------------------------------------------- errors */

export interface ApiErrorBody {
  error: string;
  message: string;
}
