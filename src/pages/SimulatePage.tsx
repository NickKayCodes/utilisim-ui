import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { archiveApi } from '../services/archive';
import { simulationApi } from '../services/simulation';
import { tomesApi } from '../services/tomes';
import { useApiResource } from '../lib/use-api-resource';
import { errorMessage } from '../lib/api';
import { monthlyInterest, sumBalance, sumMinimums, weightedApr } from '../lib/accounts';
import { money, percent, strategyLabel, toNumber } from '../lib/format';
import { saveLastRun } from '../lib/last-run';
import type { Scenario, SimulationInput, SimulationResult, StrategyType } from '../types/api';
import { STRATEGY_TYPES } from '../types/api';
import { Alert, Field, PageHeader, Section } from '../components/ui';
import { SimulationResultView } from '../components/SimulationResultView';

interface SimForm {
  principal: string;
  aprPct: string;
  termMonths: string;
  minimumPayment: string;
  extraPayment: string;
  lumpSumPayment: string;
  strategy: StrategyType;
}

function isStrategyType(value: string): value is StrategyType {
  return (STRATEGY_TYPES as string[]).includes(value);
}

function initialForm(preset?: Scenario): SimForm {
  return {
    principal: '',
    aprPct: '',
    termMonths: '60',
    minimumPayment: '',
    extraPayment: preset ? String(preset.extraPayment ?? 0) : '0',
    lumpSumPayment: preset ? String(preset.lumpSumPayment ?? 0) : '0',
    strategy: preset && isStrategyType(preset.strategy) ? preset.strategy : 'SNOWBALL',
  };
}

function buildInput(form: SimForm): SimulationInput {
  return {
    principal: toNumber(form.principal),
    interestRate: toNumber(form.aprPct) / 100,
    termMonths: Math.round(toNumber(form.termMonths)),
    minimumPayment: toNumber(form.minimumPayment),
    extraPayment: toNumber(form.extraPayment || '0'),
    lumpSumPayment: toNumber(form.lumpSumPayment || '0'),
    strategy: form.strategy,
  };
}

function validate(input: SimulationInput): string | null {
  if (!Number.isFinite(input.principal) || input.principal <= 0) {
    return 'Starting balance must be greater than zero.';
  }
  if (!Number.isFinite(input.interestRate) || input.interestRate < 0) {
    return 'APR must be zero or more.';
  }
  if (!Number.isFinite(input.termMonths) || input.termMonths < 1) {
    return 'Term must be at least 1 month.';
  }
  if (!Number.isFinite(input.minimumPayment) || input.minimumPayment <= 0) {
    return 'Minimum payment must be greater than zero.';
  }
  if (!Number.isFinite(input.extraPayment) || input.extraPayment < 0) {
    return 'Extra payment must be zero or more.';
  }
  if (!Number.isFinite(input.lumpSumPayment) || input.lumpSumPayment < 0) {
    return 'Lump sum must be zero or more.';
  }

  // Important: the engine loops until the balance reaches zero. If the payment
  // does not cover the first month's interest the balance never falls.
  const interest = monthlyInterest(input.principal, input.interestRate);
  const payment = input.minimumPayment + input.extraPayment;
  if (payment <= interest) {
    return `A monthly payment of ${money(payment)} does not cover ${money(
      interest,
    )} of monthly interest, so the balance would never be repaid.`;
  }

  return null;
}

export function SimulatePage() {
  const location = useLocation();
  const preset = (location.state as { scenario?: Scenario } | null)?.scenario;

  const loadTomes = useCallback(() => tomesApi.list(), []);
  const tomes = useApiResource(loadTomes);

  const [form, setForm] = useState<SimForm>(() => initialForm(preset));
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<{ input: SimulationInput; result: SimulationResult } | null>(null);

  const [scenarioName, setScenarioName] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const accounts = tomes.data ?? [];

  function update<K extends keyof SimForm>(key: K, value: SimForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function fillFromAccounts() {
    if (accounts.length === 0) return;

    const balance = sumBalance(accounts);
    const minimums = sumMinimums(accounts);
    const apr = weightedApr(accounts);

    setForm((current) => ({
      ...current,
      principal: balance.toFixed(2),
      minimumPayment: minimums.toFixed(2),
      aprPct: apr.toFixed(2),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = buildInput(form);
    const problem = validate(input);
    if (problem) {
      setFormError(problem);
      return;
    }

    setBusy(true);
    setFormError(null);
    setSaveNotice(null);
    setSaveError(null);
    try {
      const result = await simulationApi.run(input);
      setRun({ input, result });
      saveLastRun(result);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!run) return;

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
        strategy: run.input.strategy,
        extraPayment: run.input.extraPayment,
        lumpSumPayment: run.input.lumpSumPayment,
      });
      setScenarioName('');
      setSaveNotice(`Saved "${name}". The balance and term are not stored with a scenario.`);
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
        subtitle="Month-by-month payoff projection from a single balance."
      />

      {preset ? (
        <Alert tone="info">
          Prefilled strategy and extra payments from <strong>{preset.name}</strong>. Scenarios do not
          store a balance or term, so fill those in.
        </Alert>
      ) : null}

      <Section
        title="Inputs"
        description="APR is entered as a percentage; it is sent to the API as a decimal."
        actions={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={fillFromAccounts}
            disabled={accounts.length === 0}
          >
            {tomes.loading ? 'Loading accounts…' : 'Fill from my accounts'}
          </button>
        }
      >
        <form className="stack" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-3">
            <Field label="Starting balance">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.principal}
                onChange={(event) => update('principal', event.target.value)}
                placeholder="1000"
                required
              />
            </Field>

            <Field label="APR %" hint="Annual percentage rate">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.aprPct}
                onChange={(event) => update('aprPct', event.target.value)}
                placeholder="20"
                required
              />
            </Field>

            <Field label="Term (months)">
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={form.termMonths}
                onChange={(event) => update('termMonths', event.target.value)}
                required
              />
            </Field>

            <Field label="Minimum payment">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.minimumPayment}
                onChange={(event) => update('minimumPayment', event.target.value)}
                placeholder="50"
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
          </div>

          <div className="grid grid-3">
            <Field label="Strategy" hint="Recorded, but a single balance has nothing to reorder">
              <select
                className="input"
                value={form.strategy}
                onChange={(event) => update('strategy', event.target.value as StrategyType)}
              >
                {STRATEGY_TYPES.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategyLabel(strategy)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {accounts.length > 0 ? (
            <p className="muted small">
              From your accounts: {money(sumBalance(accounts))} balance ·{' '}
              {money(sumMinimums(accounts))} minimums · {percent(weightedApr(accounts))} avg APR.
            </p>
          ) : null}

          {formError ? <Alert>{formError}</Alert> : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Running…' : 'Run simulation'}
            </button>
          </div>
        </form>
      </Section>

      {run ? (
        <Section
          title="Result"
          description="Returned by POST /api/assemble/run"
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRun(null)}>
              Clear
            </button>
          }
        >
          <div className="stack">
            <SimulationResultView result={run.result} />

            <div className="save-row">
              <form className="save-form" onSubmit={handleSaveScenario}>
                <Field label="Save these inputs as a scenario">
                  <input
                    className="input"
                    type="text"
                    value={scenarioName}
                    onChange={(event) => setScenarioName(event.target.value)}
                    placeholder="e.g. Card payoff at $75/mo"
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
    </div>
  );
}
