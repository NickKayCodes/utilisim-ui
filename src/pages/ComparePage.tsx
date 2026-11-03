import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { tomesApi } from '../services/tomes';
import { simulationApi } from '../services/simulation';
import { useApiResource } from '../lib/use-api-resource';
import { errorMessage } from '../lib/api';
import { sumBalance, totalCurrentPayments } from '../lib/accounts';
import { money, monthsLabel, percent, strategyLabel, toNumber } from '../lib/format';
import type { ComparisonResponse, PlanType } from '../types/api';
import { PLAN_TYPES } from '../types/api';
import { Alert, Badge, EmptyState, Field, PageHeader, Section, Spinner } from '../components/ui';
import { PlanTimelineView } from '../components/PlanTimelineView';

interface CompareForm {
  startMonth: string;
  horizonMonths: string;
  extraPayment: string;
  lumpSumPayment: string;
  lumpSumMonth: string;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function validate(form: CompareForm, selectedCount: number): string | null {
  if (selectedCount === 0) return 'Select at least one account to compare.';
  if (!form.startMonth) return 'Choose a start month.';

  const horizon = toNumber(form.horizonMonths);
  if (!Number.isFinite(horizon) || horizon < 1 || horizon > 600) {
    return 'Horizon must be between 1 and 600 months.';
  }
  const extra = toNumber(form.extraPayment || '0');
  if (!Number.isFinite(extra) || extra < 0) {
    return 'Extra payment must be zero or more.';
  }
  const lump = toNumber(form.lumpSumPayment || '0');
  if (!Number.isFinite(lump) || lump < 0) {
    return 'Lump sum must be zero or more.';
  }
  const lumpMonth = toNumber(form.lumpSumMonth);
  if (!Number.isFinite(lumpMonth) || lumpMonth < 1 || lumpMonth > horizon) {
    return 'Lump-sum month must be within the horizon.';
  }
  return null;
}

export function ComparePage() {
  const loadTomes = useCallback(() => tomesApi.list(), []);
  const tomes = useApiResource(loadTomes);

  const [deselected, setDeselected] = useState<string[]>([]);
  const [form, setForm] = useState<CompareForm>({
    startMonth: currentMonth(),
    horizonMonths: '120',
    extraPayment: '75',
    lumpSumPayment: '0',
    lumpSumMonth: '1',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);

  const accounts = useMemo(() => tomes.data ?? [], [tomes.data]);
  const selected = useMemo(
    () => accounts.filter((account) => !deselected.includes(account.id)),
    [accounts, deselected],
  );

  function update<K extends keyof CompareForm>(key: K, value: CompareForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleAccount(id: string) {
    setDeselected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function handleCompare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problem = validate(form, selected.length);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await simulationApi.compare({
        tomeIds: selected.map((account) => account.id),
        startMonth: `${form.startMonth}-01`,
        horizonMonths: Math.round(toNumber(form.horizonMonths)),
        extraPayment: toNumber(form.extraPayment || '0'),
        lumpSumPayment: toNumber(form.lumpSumPayment || '0'),
        lumpSumMonth: Math.round(toNumber(form.lumpSumMonth)),
        plans: PLAN_TYPES,
      });
      setComparison(response);
      setSelectedPlan(response.recommendedPlan ?? response.plans[0]?.plan ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const selectedTimeline =
    comparison?.plans.find((plan) => plan.plan === selectedPlan) ??
    comparison?.plans[0] ??
    null;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Compare plans"
        subtitle="Five payoff timelines over the same accounts and budget."
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
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No accounts to compare"
          description="Add at least one account first — the ledger needs balances, APRs and minimums."
          action={
            <Link className="btn btn-primary btn-sm" to="/app/accounts">
              Add an account
            </Link>
          }
        />
      ) : (
        <>
          <Section
            title="Accounts"
            description={`${selected.length} of ${accounts.length} selected · ${money(
              sumBalance(selected),
            )} balance · ${money(totalCurrentPayments(selected))} current`}
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
                      onChange={() => toggleAccount(account.id)}
                    />
                    <span className="check-main">
                      <span className="cell-strong">{account.name}</span>
                      <span className="cell-sub">
                        {percent(account.apr ?? account.estimatedApr)} APR ·{' '}
                        {money(account.currentBalance)}
                      </span>
                    </span>
                    <span className="muted small">
                      {money(account.currentPayment ?? account.minimumDebtPayment)}/mo
                    </span>
                  </label>
                );
              })}
            </div>
          </Section>

          <Section
            title="Budget"
            description="Extra and lump sums are allocated by the three strategy plans; CURRENT and MINIMUM ignore them."
          >
            <form className="stack" onSubmit={handleCompare} noValidate>
              <div className="grid grid-3">
                <Field label="Start month">
                  <input
                    className="input"
                    type="month"
                    value={form.startMonth}
                    onChange={(event) => update('startMonth', event.target.value)}
                    required
                  />
                </Field>
                <Field label="Horizon (months)" hint="Maximum 600">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="600"
                    step="1"
                    value={form.horizonMonths}
                    onChange={(event) => update('horizonMonths', event.target.value)}
                    required
                  />
                </Field>
                <Field label="Extra per month">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.extraPayment}
                    onChange={(event) => update('extraPayment', event.target.value)}
                  />
                </Field>
                <Field label="One-time lump sum">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.lumpSumPayment}
                    onChange={(event) => update('lumpSumPayment', event.target.value)}
                  />
                </Field>
                <Field label="Lump-sum month">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    value={form.lumpSumMonth}
                    onChange={(event) => update('lumpSumMonth', event.target.value)}
                  />
                </Field>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Comparing…' : 'Compare plans'}
                </button>
              </div>
            </form>
          </Section>

          {comparison ? (
            <>
              <Section
                title="Plans"
                description={
                  comparison.recommendedPlan
                    ? `${strategyLabel(comparison.recommendedPlan)} recommended — ${comparison.recommendationBasis}`
                    : comparison.recommendationBasis
                }
              >
                <div className="grid grid-3">
                  {comparison.plans.map((plan) => {
                    const recommended = comparison.recommendedPlan === plan.plan;
                    return (
                      <button
                        key={plan.plan}
                        type="button"
                        className={`stat plan-card${
                          selectedTimeline?.plan === plan.plan ? ' plan-card-on' : ''
                        }`}
                        aria-pressed={selectedTimeline?.plan === plan.plan}
                        onClick={() => setSelectedPlan(plan.plan)}
                      >
                        <span className="stat-label">
                          {strategyLabel(plan.plan)}{' '}
                          {recommended ? <Badge tone="ok">recommended</Badge> : null}
                        </span>
                        <span className="stat-value">
                          {plan.terminationReason === 'PAID_OFF'
                            ? monthsLabel(plan.monthsToPayoff)
                            : 'Not repaid'}
                        </span>
                        <span className="stat-hint">
                          Interest {money(plan.totalInterest)} · final {money(plan.finalBalance)}
                        </span>
                        <span className="stat-hint">
                          {plan.peakUtilizationPct === null
                            ? 'No credit limit'
                            : `Peak ${percent(plan.peakUtilizationPct)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="muted small">
                  Ordering only changes the total when the plan pays more than the minimums. With
                  extra at zero, equal totals are expected and the server tie-break picks Avalanche.
                </p>
              </Section>

              {selectedTimeline ? (
                <Section
                  title={`${strategyLabel(selectedTimeline.plan)} timeline`}
                  description={`POST /api/simulate/compare · ${selectedTimeline.status}`}
                >
                  <PlanTimelineView timeline={selectedTimeline} />
                </Section>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
