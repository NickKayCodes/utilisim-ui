import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { archiveApi } from '../services/archive';
import { useApiResource } from '../lib/use-api-resource';
import { errorMessage } from '../lib/api';
import { dateTime, money, strategyLabel, toNumber } from '../lib/format';
import type { Scenario, ScenarioInput } from '../types/api';
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  PageHeader,
  Section,
  Spinner,
} from '../components/ui';

const SCENARIO_STRATEGIES = ['SNOWBALL', 'AVALANCHE', 'HYBRID', 'MINIMUM_ONLY'];

interface ScenarioForm {
  name: string;
  strategy: string;
  extraPayment: string;
  lumpSumPayment: string;
}

const EMPTY_FORM: ScenarioForm = {
  name: '',
  strategy: 'SNOWBALL',
  extraPayment: '0',
  lumpSumPayment: '0',
};

function validateForm(form: ScenarioForm): string | null {
  if (!form.name.trim()) return 'Give the scenario a name.';

  const extra = toNumber(form.extraPayment || '0');
  if (!Number.isFinite(extra) || extra < 0) return 'Extra payment must be zero or more.';

  const lump = toNumber(form.lumpSumPayment || '0');
  if (!Number.isFinite(lump) || lump < 0) return 'Lump sum must be zero or more.';

  return null;
}

function buildPayload(form: ScenarioForm): ScenarioInput {
  return {
    name: form.name.trim(),
    strategy: form.strategy,
    extraPayment: toNumber(form.extraPayment || '0'),
    lumpSumPayment: toNumber(form.lumpSumPayment || '0'),
  };
}

export function ScenariosPage() {
  const loadScenarios = useCallback(() => archiveApi.list(), []);
  const scenarios = useApiResource(loadScenarios);
  const navigate = useNavigate();

  const [form, setForm] = useState<ScenarioForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rows = scenarios.data ?? [];

  function update<K extends keyof ScenarioForm>(key: K, value: ScenarioForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateForm(form);
    if (problem) {
      setFormError(problem);
      return;
    }

    setSaving(true);
    setFormError(null);
    setActionError(null);
    try {
      await archiveApi.create(buildPayload(form));
      setForm(EMPTY_FORM);
      scenarios.reload();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete scenario "${name}"?`)) return;

    setDeletingId(id);
    setActionError(null);
    try {
      await archiveApi.remove(id);
      scenarios.reload();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  function handleRun(scenario: Scenario) {
    navigate('/app/simulate', { state: { scenario } });
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Scenarios"
        subtitle="Reusable strategy presets. They store the strategy and extra payments, not a balance."
      />

      <Alert tone="info">
        Scenarios are private to your account — only you can see, change or delete them.
      </Alert>

      {actionError ? <Alert>{actionError}</Alert> : null}
      {scenarios.error ? (
        <Alert>
          {scenarios.error}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={scenarios.reload}>
            Retry
          </button>
        </Alert>
      ) : null}

      <div className="grid grid-2 grid-align-start">
        <Section title="New scenario" description="POST /api/archive/scenarios">
          <form className="stack" onSubmit={handleSubmit} noValidate>
            <Field label="Name">
              <input
                className="input"
                type="text"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="Aggressive payoff, 2026"
                required
              />
            </Field>

            <Field label="Strategy">
              <select
                className="input"
                value={form.strategy}
                onChange={(event) => update('strategy', event.target.value)}
              >
                {SCENARIO_STRATEGIES.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategyLabel(strategy)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-2">
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

            {formError ? <Alert>{formError}</Alert> : null}

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save scenario'}
            </button>
          </form>
        </Section>

        <Section title="How scenarios are used" description="What carries over into a run">
          <ul className="bullet-list">
            <li>Strategy name — pre-selects the strategy dropdown.</li>
            <li>Extra payment and lump sum — prefill the simulator.</li>
            <li>
              Balance, APR and term are <strong>not</strong> stored, so you still enter those.
            </li>
          </ul>
          <p className="muted small">
            Simulation results are never written back to a scenario, and there is no
            <code> GET /api/assemble/results/{'{id}'}</code> to reopen a past run.
          </p>
        </Section>
      </div>

      <Section title="Saved scenarios" description="Shared across all users (see note above).">
        {scenarios.loading ? (
          <Spinner label="Loading scenarios…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No scenarios yet"
            description="Save a strategy and extra payment here to reuse them in the simulator."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Strategy</th>
                  <th className="num">Extra / month</th>
                  <th className="num">Lump sum</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((scenario) => (
                  <tr key={scenario.id}>
                    <td className="cell-strong">{scenario.name}</td>
                    <td>
                      <Badge tone="info">{strategyLabel(scenario.strategy)}</Badge>
                    </td>
                    <td className="num">{money(scenario.extraPayment)}</td>
                    <td className="num">{money(scenario.lumpSumPayment)}</td>
                    <td className="muted small">{dateTime(scenario.createdAt)}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRun(scenario)}
                      >
                        Simulate
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={deletingId === scenario.id}
                        onClick={() => handleDelete(scenario.id, scenario.name)}
                      >
                        {deletingId === scenario.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
