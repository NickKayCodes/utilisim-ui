import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { archiveApi } from '../services/archive';
import { simulationApi } from '../services/simulation';
import { tomesApi } from '../services/tomes';
import { useApiResource } from '../lib/use-api-resource';
import { errorMessage } from '../lib/api';
import {
  sumBalance,
  totalCurrentPayments,
  sumMinimums,
  weightedApr,
} from '../lib/accounts';
import { money, percent, strategyLabel, toNumber } from '../lib/format';
import type { PlanRunRequest, PlanTimeline, PlanType, Scenario, Tome } from '../types/api';
import { PLAN_TYPES } from '../types/api';
import { Alert, EmptyState, Field, PageHeader, Section, Spinner } from '../components/ui';
import { PlanTimelineView } from '../components/PlanTimelineView';

interface SimForm {
  plan: PlanType;
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

function isPlanType(value: string): value is PlanType {
  return (PLAN_TYPES as string[]).includes(value);
}

function scenarioPlan(value: string): PlanType | null {
  if (value === 'MINIMUM_ONLY') return 'MINIMUM';
  return isPlanType(value) ? value : null;
}

function isStrategyPlan(plan: PlanType): boolean {
  return plan === 'SNOWBALL' || plan === 'AVALANCHE' || plan === 'HYBRID';
}

function initialForm(preset?: Scenario): SimForm {
  return {
    plan: preset ? (scenarioPlan(preset.strategy) ?? 'CURRENT') : 'CURRENT',
    startMonth: currentMonth(),
    horizonMonths: '120',
    extraPayment: preset ? String(preset.extraPayment ?? 0) : '0',
    lumpSumPayment: preset ? String(preset.lumpSumPayment ?? 0) : '0',
    lumpSumMonth: '1',
  };
}

function validate(form: SimForm, selectedCount: number): string | null {
  if (selectedCount === 0) return 'Select at least one account to simulate.';
  if (!form.startMonth) return 'Choose a start month.';

  const horizon = toNumber(form.horizonMonths);
  if (!Number.isFinite(horizon) || horizon < 1 || horizon > 600) {
    return 'Horizon must be between 1 and 600 months.';
  }

  if (isStrategyPlan(form.plan)) {
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
  }

  return null;
}

export function SimulatePage() {
  const location = useLocation();
  const preset = (location.state as { scenario?: Scenario } | null)?.scenario;

  const loadTomes = useCallback(() => tomesApi.list(), []);
  const tomes = useApiResource(loadTomes);

  const [form, setForm] = useState<SimForm>(() => initialForm(preset));
  const [deselected, setDeselected] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timeline, setTimeline] = useState<PlanTimeline | null>(null);

  const [scenarioName, setScenarioName] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const accounts = useMemo(() => tomes.data ?? [], [tomes.data]);
  const selected = useMemo(
    () => accounts.filter((account) => !deselected.includes(account.id)),
    [accounts, deselected],
  );
  const strategy = isStrategyPlan(form.plan);

  function update<K extends keyof SimForm>(key: K, value: SimForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleAccount(id: string) {
    setDeselected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problem = validate(form, selected.length);
    if (problem) {
      setFormError(problem);
      return;
    }

    setBusy(true);
    setFormError(null);
    setSaveNotice(null);
    setSaveError(null);
    try {
      const request: PlanRunRequest = {
        tomeIds: selected.map((account) => account.id),
        plan: form.plan,
        startMonth: `${form.startMonth}-01`,
        horizonMonths: Math.round(toNumber(form.horizonMonths)),
        extraPayment: strategy ? toNumber(form.extraPayment || '0') : 0,
        lumpSumPayment: strategy ? toNumber(form.lumpSumPayment || '0') : 0,
        lumpSumMonth: strategy ? Math.round(toNumber(form.lumpSumMonth)) : 1,
      };
      setTimeline(await simulationApi.runPlan(request));
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!timeline) return;

    const name = scenarioName.trim();
    if (!name) {
      setSaveError('Give the scenario a name first.');
      return;
    }

    setSaveBusy(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      await archiveApi.create({
        name,
        strategy: timeline.plan,
        extraPayment: strategy ? toNumber(form.extraPayment || '0') : 0,
        lumpSumPayment: strategy ? toNumber(form.lumpSumPayment || '0') : 0,
      });
      setScenarioName('');
      setSaveNotice(`Saved "${name}". Scenarios store the plan and payments, not balances.`);
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Simulate"
        subtitle="A month-by-month payoff timeline for your accounts."
      />

      {tomes.error ? (
        <Alert>
          {tomes.error}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={tomes.reload}>
            Retry
          </button>
        </Alert>
      ) : null}

      {preset ? (
        <Alert tone="info">
          Prefilled plan and payments from <strong>{preset.name}</strong>. Choose the accounts and
          confirm the horizon.
        </Alert>
      ) : null}

      {tomes.loading ? (
        <Spinner label="Loading accounts…" />
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No accounts to simulate"
          description="Add a card, loan or line of credit first."
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
              selected.reduce((total, account) => total + account.currentBalance, 0),
            )} balance`}
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
              {accounts.map((account: Tome) => {
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
                        {money(account.minimumDebtPayment)} min ·{' '}
                        {money(account.currentPayment ?? account.minimumDebtPayment)} current
                      </span>
                    </span>
                    <span className="muted small">{money(account.currentBalance)}</span>
                  </label>
                );
              })}
            </div>
            <p className="muted small">
              Selected: {money(sumBalance(selected))} balance · {money(sumMinimums(selected))}{' '}
              minimums · {money(totalCurrentPayments(selected))} current ·{' '}
              {percent(weightedApr(selected))} avg APR.
            </p>
          </Section>

          <Section
            title="Plan"
            description="Strategies only change how surplus above the minimums is allocated."
          >
            <form className="stack" onSubmit={handleSubmit} noValidate>
              <div className="grid grid-3">
                <Field label="Plan">
                  <select
                    className="input"
                    value={form.plan}
                    onChange={(event) => update('plan', event.target.value as PlanType)}
                  >
                    {PLAN_TYPES.map((plan) => (
                      <option key={plan} value={plan}>
                        {strategyLabel(plan)}
                      </option>
                    ))}
                  </select>
                </Field>

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

                <Field
                  label="Extra per month"
                  hint={strategy ? 'Added to the minimums' : 'Ignored by this plan'}
                >
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.extraPayment}
                    onChange={(event) => update('extraPayment', event.target.value)}
                    disabled={!strategy}
                  />
                </Field>

                <Field
                  label="One-time lump sum"
                  hint={strategy ? 'Applied once' : 'Ignored by this plan'}
                >
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.lumpSumPayment}
                    onChange={(event) => update('lumpSumPayment', event.target.value)}
                    disabled={!strategy}
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
                    disabled={!strategy}
                  />
                </Field>
              </div>

              {formError ? <Alert>{formError}</Alert> : null}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Running…' : 'Run plan'}
                </button>
              </div>
            </form>
          </Section>

          {timeline ? (
            <Section
              title="Timeline"
              description={`POST /api/simulate/run · ${strategyLabel(timeline.plan)}`}
              actions={
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTimeline(null)}
                >
                  Clear
                </button>
              }
            >
              <div className="stack">
                <PlanTimelineView timeline={timeline} />

                <div className="save-row">
                  <form className="save-form" onSubmit={handleSaveScenario}>
                    <Field label="Save this plan as a scenario">
                      <input
                        className="input"
                        type="text"
                        value={scenarioName}
                        onChange={(event) => setScenarioName(event.target.value)}
                        placeholder="e.g. Avalanche at $75/mo"
                      />
                    </Field>
                    <button type="submit" className="btn btn-ghost" disabled={saveBusy}>
                      {saveBusy ? 'Saving…' : 'Save scenario'}
                    </button>
                  </form>
                </div>

                {saveError ? <Alert>{saveError}</Alert> : null}
                {saveNotice ? <Alert tone="success">{saveNotice}</Alert> : null}
              </div>
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
