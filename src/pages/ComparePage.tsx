import { useCallback, useMemo, useState } from 'react';
import { tomesApi } from '../services/tomes';
import { oracleApi } from '../services/oracle';
import { useApiResource } from '../lib/use-api-resource';
import { errorMessage } from '../lib/api';
import { effectiveApr, toDebtSnapshot } from '../lib/accounts';
import { money, percent, strategyLabel } from '../lib/format';
import type { StrategyAnalysis, StrategyOutput, StrategyType } from '../types/api';
import { STRATEGY_TYPES } from '../types/api';
import { Alert, Badge, EmptyState, PageHeader, Section, Spinner } from '../components/ui';

type BusyAction = 'recommend' | 'order' | 'analyze' | null;

export function ComparePage() {
  const loadTomes = useCallback(() => tomesApi.list(), []);
  const tomes = useApiResource(loadTomes);

  // Selection is stored as "deselected" so every account is included by default
  // without needing to sync state once the list arrives.
  const [deselected, setDeselected] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<StrategyType[]>(['SNOWBALL', 'AVALANCHE']);
  const [orderStrategy, setOrderStrategy] = useState<StrategyType>('SNOWBALL');

  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [order, setOrder] = useState<StrategyOutput | null>(null);
  const [analysis, setAnalysis] = useState<StrategyAnalysis | null>(null);

  const accounts = tomes.data;

  const selected = useMemo(
    () => (accounts ?? []).filter((account) => !deselected.includes(account.id)),
    [accounts, deselected],
  );

  const debts = useMemo(() => selected.map(toDebtSnapshot), [selected]);

  function toggleDebt(id: string) {
    setDeselected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleStrategy(strategy: StrategyType) {
    setStrategies((current) =>
      current.includes(strategy)
        ? current.filter((value) => value !== strategy)
        : [...current, strategy],
    );
  }

  async function handleRecommend() {
    if (debts.length === 0) return;
    setBusy('recommend');
    setError(null);
    setRecommendation(null);
    try {
      setRecommendation(await oracleApi.recommend(debts));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleOrder() {
    if (debts.length === 0) return;
    setBusy('order');
    setError(null);
    setOrder(null);
    try {
      setOrder(
        await oracleApi.order(debts, {
          strategyType: orderStrategy,
          extraPayment: 0,
          lumpSumPayment: 0,
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleAnalyze() {
    if (debts.length === 0 || strategies.length === 0) return;
    setBusy('analyze');
    setError(null);
    setAnalysis(null);
    try {
      setAnalysis(
        await oracleApi.analyze(debts, strategies, { extraPayment: 0, lumpSumPayment: 0 }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const totalBalance = selected.reduce((total, account) => total + account.currentBalance, 0);

  return (
    <div className="stack-lg">
      <PageHeader
        title="Compare strategies"
        subtitle="Order your real accounts with the Oracle endpoints, then compare projections."
      />

      {tomes.error ? (
        <Alert>
          {tomes.error}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={tomes.reload}>
            Retry
          </button>
        </Alert>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}

      {tomes.loading ? (
        <Spinner label="Loading accounts…" />
      ) : !accounts || accounts.length === 0 ? (
        <EmptyState
          title="No accounts to compare"
          description="Add at least one account first — the Oracle needs balances, APRs and minimum payments."
        />
      ) : (
        <>
          <div className="grid grid-2 grid-align-start">
            <Section
              title="Debts in play"
              description={`${selected.length} of ${accounts.length} selected · ${money(totalBalance)} total`}
              actions={
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDeselected([])}
                  disabled={deselected.length === 0}
                >
                  Select all
                </button>
              }
            >
              <div className="check-list">
                {accounts.map((account) => {
                  const checked = !deselected.includes(account.id);
                  return (
                    <label
                      key={account.id}
                      className={`check-row${checked ? ' check-row-on' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDebt(account.id)}
                      />
                      <span className="check-main">
                        <span className="cell-strong">{account.name}</span>
                        <span className="cell-sub">
                          {percent(effectiveApr(account))} APR · {money(account.currentBalance)}
                        </span>
                      </span>
                      <span className="muted small">{money(account.minimumDebtPayment)}/mo</span>
                    </label>
                  );
                })}
              </div>
            </Section>

            <Section title="Strategies to compare" description="Used by the analyze endpoint">
              <div className="pill-row">
                {STRATEGY_TYPES.map((strategy) => {
                  const active = strategies.includes(strategy);
                  return (
                    <button
                      key={strategy}
                      type="button"
                      className={`pill${active ? ' pill-on' : ''}`}
                      aria-pressed={active}
                      onClick={() => toggleStrategy(strategy)}
                    >
                      {strategyLabel(strategy)}
                    </button>
                  );
                })}
              </div>

              <div className="divider" />

              <div className="inline-actions">
                <label className="field field-inline">
                  <span className="field-label">Order by</span>
                  <select
                    className="input"
                    value={orderStrategy}
                    onChange={(event) => setOrderStrategy(event.target.value as StrategyType)}
                  >
                    {STRATEGY_TYPES.map((strategy) => (
                      <option key={strategy} value={strategy}>
                        {strategyLabel(strategy)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRecommend}
                  disabled={busy !== null || debts.length === 0}
                >
                  {busy === 'recommend' ? 'Working…' : 'Recommend'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleOrder}
                  disabled={busy !== null || debts.length === 0}
                >
                  {busy === 'order' ? 'Working…' : 'Order debts'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleAnalyze}
                  disabled={busy !== null || debts.length === 0 || strategies.length === 0}
                >
                  {busy === 'analyze' ? 'Working…' : 'Analyze'}
                </button>
              </div>

              {debts.length === 0 ? (
                <p className="muted small">Select at least one account to enable these actions.</p>
              ) : null}
              {strategies.length === 0 ? (
                <p className="muted small">Pick at least one strategy for the analysis.</p>
              ) : null}
            </Section>
          </div>

          {recommendation ? (
            <Section title="Recommended strategy" description="POST /api/oracle/strategy/recommend">
              <div className="recommendation">
                <span className="recommendation-label">Oracle suggests</span>
                <span className="recommendation-value">{recommendation}</span>
                <Badge tone="ok">based on {debts.length} account(s)</Badge>
              </div>
            </Section>
          ) : null}

          {order ? (
            <Section
              title={`Payoff order — ${strategyLabel(order.strategyName)}`}
              description={order.description}
            >
              <ol className="order-list">
                {order.orderedDebts.map((debt, index) => (
                  <li key={debt.tomeId} className="order-row">
                    <span className="order-rank">{index + 1}</span>
                    <span className="order-main">
                      <span className="cell-strong">{debt.accountName}</span>
                      <span className="cell-sub">
                        {percent(debt.interestRate)} APR · min {money(debt.minimumPayment)}
                      </span>
                    </span>
                    <span className="order-balance">{money(debt.currentBalance)}</span>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {analysis ? (
            <Section
              title="Strategy comparison"
              description="POST /api/oracle/strategy/analyze"
              actions={
                analysis.recommendedStrategy ? (
                  <Badge tone="ok">Recommended: {analysis.recommendedStrategy}</Badge>
                ) : null
              }
            >
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th className="num">Projected interest</th>
                      <th className="num">Debts</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.comparisons.map((comparison) => (
                      <tr key={comparison.strategyName}>
                        <td>
                          <span className="cell-strong">{strategyLabel(comparison.strategyName)}</span>
                          {analysis.recommendedStrategy === comparison.strategyName ? (
                            <Badge tone="ok">best</Badge>
                          ) : null}
                        </td>
                        <td className="num">{money(comparison.projectedInterest)}</td>
                        <td className="num">{comparison.debtCount}</td>
                        <td className="muted small">{comparison.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="muted small">
                Heads up: the backend currently returns the same projected interest for every
                strategy (the projection is not strategy-sensitive yet). Use this view to check
                payoff ordering, not to promise savings.
              </p>
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
