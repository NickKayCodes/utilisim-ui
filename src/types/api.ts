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
  /** Percentage, e.g. 19.99; null when the client did not supply one. */
  apr: number | null;
  /** Percentage; 16.00 when `apr` is absent. */
  estimatedApr: number;
  minimumDebtPayment: number;
  /** What the user actually pays today; defaults to the minimum when omitted. */
  currentPayment?: number;
  creditLimit: number;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface TomeRequest {
  name: string;
  currentBalance: number;
  /** Percentage, e.g. 19.99. `null` stores the 16% estimate. */
  apr: number | null;
  minimumDebtPayment: number;
  /** Optional; the server stores the minimum when omitted. */
  currentPayment?: number | null;
  creditLimit: number;
  type: string;
}

/* ---------------------------------------------------------------- oracle */

export interface DebtSnapshot {
  tomeId: string;
  accountName: string;
  currentBalance: number;
  /** Annual percentage, e.g. 19.99. */
  apr: number;
  /** Annual percentage; used when `apr` is 0. */
  estimatedApr: number;
  minimumPayment: number;
  /** Annual percentage, carried through for display; the server does not use it. */
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
  /**
   * `COMPLETED` only when the final balance reached zero. A plan that runs out
   * of term, or whose payment never reduces principal, is `FAILED`.
   */
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  /** 0 when `status` is not `COMPLETED`; read `remainingBalance` instead. */
  monthsToPayoff: number;
  /** `null` when the plan did not pay the debt off. */
  payoffDate: string | null;
  savingsComparedToBaseline: number;
  /** Unpaid balance at the end of the schedule; 0 for a completed run. */
  remainingBalance: number;
  schedule: AmortizationEntry[];
  archivedAt: string | null;
  ledgerEntryId: string | null;
}

/* ------------------------------------------------------ simulation ledger */

export type PlanType = 'CURRENT' | 'MINIMUM' | 'SNOWBALL' | 'AVALANCHE' | 'HYBRID';

export const PLAN_TYPES: PlanType[] = [
  'CURRENT',
  'MINIMUM',
  'SNOWBALL',
  'AVALANCHE',
  'HYBRID',
];

export type TerminationReason = 'NONE' | 'PAID_OFF' | 'HORIZON_REACHED' | 'STAGNANT';

export interface DebtMonthLedger {
  tomeId: string;
  accountName: string;
  startingBalance: number;
  monthlyInterest: number;
  minimumDue: number;
  actualPayment: number;
  extraPayment: number;
  lumpSumApplied: number;
  remainingBalance: number;
  utilizationPct: number | null;
  interestPaid: number;
  amountToCoverInterest: number;
}

export interface MonthLedger {
  monthIndex: number;
  monthLabel: string;
  periodStart: string;
  startingBalance: number;
  monthlyInterest: number;
  minimumDue: number;
  actualPayment: number;
  extraPayment: number;
  lumpSumApplied: number;
  remainingBalance: number;
  utilizationPct: number | null;
  interestPaid: number;
  amountToCoverInterest: number;
  debts: DebtMonthLedger[];
}

export interface PlanTimeline {
  runId: number;
  plan: PlanType;
  label: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  terminationReason: TerminationReason;
  monthsToPayoff: number;
  payoffDate: string | null;
  totalInterest: number;
  totalPaid: number;
  finalBalance: number;
  peakUtilizationPct: number | null;
  months: MonthLedger[];
}

export interface ComparisonResponse {
  comparisonGroupId: string;
  startMonth: string;
  horizonMonths: number;
  totalBalance: number;
  recommendedPlan: PlanType | null;
  recommendationBasis: string;
  plans: PlanTimeline[];
}

export interface ComparisonRequest {
  tomeIds?: string[];
  extraPayment?: number;
  lumpSumPayment?: number;
  lumpSumMonth?: number;
  startMonth?: string;
  horizonMonths?: number;
  plans?: PlanType[];
}

export interface PlanRunRequest {
  tomeIds?: string[];
  plan: PlanType;
  extraPayment?: number;
  lumpSumPayment?: number;
  lumpSumMonth?: number;
  startMonth?: string;
  horizonMonths?: number;
}

/* ---------------------------------------------------------------- errors */

export interface ApiErrorBody {
  error: string;
  message: string;
}
