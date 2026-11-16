import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { tomesApi } from '../services/tomes';
import { useApiResource } from '../lib/use-api-resource';
import { errorMessage } from '../lib/api';
import { effectiveApr, sumBalance, sumLimits, utilization } from '../lib/accounts';
import { money, percent, titleCase, toNumber } from '../lib/format';
import type { TomeRequest } from '../types/api';
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  PageHeader,
  Section,
  Spinner,
  StatCard,
} from '../components/ui';

const ACCOUNT_TYPES = [
  'CREDIT_CARD',
  'STUDENT_LOAN',
  'AUTO_LOAN',
  'MORTGAGE',
  'PERSONAL_LOAN',
  'LINE_OF_CREDIT',
  'OTHER',
];

/**
 * A credit limit only means something for revolving credit (BUG-004). Installment
 * loans hide the field; `OTHER` keeps it as an optional extra.
 */
const CREDIT_LIMIT_TYPES = ['CREDIT_CARD', 'LINE_OF_CREDIT', 'OTHER'];

function showsCreditLimit(type: string): boolean {
  return CREDIT_LIMIT_TYPES.includes(type);
}

/** `OTHER` may omit the limit; the revolving types still require it. */
function requiresCreditLimit(type: string): boolean {
  return type === 'CREDIT_CARD' || type === 'LINE_OF_CREDIT';
}

interface AccountForm {
  name: string;
  type: string;
  currentBalance: string;
  apr: string;
  minimumDebtPayment: string;
  currentPayment: string;
  creditLimit: string;
}

const EMPTY_FORM: AccountForm = {
  name: '',
  type: 'CREDIT_CARD',
  currentBalance: '',
  apr: '',
  minimumDebtPayment: '',
  currentPayment: '',
  creditLimit: '',
};

function validateForm(form: AccountForm): string | null {
  if (!form.name.trim()) return 'Give the account a name.';

  const balance = toNumber(form.currentBalance);
  if (!Number.isFinite(balance) || balance < 0) return 'Balance must be zero or more.';

  if (form.apr.trim()) {
    const apr = toNumber(form.apr);
    if (!Number.isFinite(apr) || apr < 0 || apr > 100) return 'APR must be between 0 and 100.';
  }

  const minimum = toNumber(form.minimumDebtPayment);
  if (!Number.isFinite(minimum) || minimum < 0) return 'Minimum payment must be zero or more.';

  if (form.currentPayment.trim()) {
    const current = toNumber(form.currentPayment);
    if (!Number.isFinite(current) || current < 0) {
      return 'Current payment must be zero or more.';
    }
    if (current < minimum) return 'Current payment cannot be below the minimum.';
  }

  if (showsCreditLimit(form.type)) {
    const blank = !form.creditLimit.trim();
    if (!blank || requiresCreditLimit(form.type)) {
      const limit = toNumber(form.creditLimit);
      if (!Number.isFinite(limit) || limit < 0) return 'Credit limit must be zero or more.';
    }
  }

  return null;
}

function buildPayload(form: AccountForm): TomeRequest {
  const aprText = form.apr.trim();
  const currentText = form.currentPayment.trim();
  const limitText = showsCreditLimit(form.type) ? form.creditLimit.trim() : '';
  return {
    name: form.name.trim(),
    type: form.type,
    currentBalance: toNumber(form.currentBalance),
    apr: aprText ? toNumber(aprText) : null,
    minimumDebtPayment: toNumber(form.minimumDebtPayment),
    currentPayment: currentText ? toNumber(currentText) : null,
    // Hidden types send 0, and a blank optional limit also stores 0.
    creditLimit: limitText ? toNumber(limitText) : 0,
  };
}

export function AccountsPage() {
  const loadTomes = useCallback(() => tomesApi.list(), []);
  const tomes = useApiResource(loadTomes);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const accounts = tomes.data ?? [];
  const balance = sumBalance(accounts);
  const limits = sumLimits(accounts);

  function update<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
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
      await tomesApi.create(buildPayload(form));
      setForm(EMPTY_FORM);
      setShowForm(false);
      tomes.reload();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;

    setDeletingId(id);
    setActionError(null);
    try {
      await tomesApi.remove(id);
      tomes.reload();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Accounts"
        subtitle="Balances, APRs and minimum payments used by the simulator."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowForm((open) => !open);
              setFormError(null);
            }}
          >
            {showForm ? 'Close form' : 'Add account'}
          </button>
        }
      />

      {actionError ? <Alert>{actionError}</Alert> : null}
      {tomes.error ? (
        <Alert>
          {tomes.error}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={tomes.reload}>
            Retry
          </button>
        </Alert>
      ) : null}

      <div className="grid grid-3">
        <StatCard label="Total balance" value={money(balance)} hint={`${accounts.length} account(s)`} />
        <StatCard label="Total minimums" value={money(accounts.reduce((t, a) => t + a.minimumDebtPayment, 0))} hint="Per month" />
        <StatCard
          label="Credit utilisation"
          value={limits > 0 ? percent(utilization(accounts), 1) : '—'}
          hint={limits > 0 ? `of ${money(limits)} limit` : 'No credit limits set'}
          tone={utilization(accounts) > 70 ? 'warning' : undefined}
        />
      </div>

      {showForm ? (
        <Section title="New account" description="APR is a percentage (19.99 = 19.99%). Enter a value; a blank APR is not supported yet.">
          <form className="stack" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-3">
              <Field label="Account name">
                <input
                  className="input"
                  type="text"
                  value={form.name}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="Chase Sapphire"
                  required
                />
              </Field>

              <Field label="Type">
                <select
                  className="input"
                  value={form.type}
                  onChange={(event) => {
                    const type = event.target.value;
                    // Switching to a type without a limit clears any stale value.
                    setForm((current) => ({
                      ...current,
                      type,
                      creditLimit: showsCreditLimit(type) ? current.creditLimit : '',
                    }));
                  }}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {titleCase(type)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Current balance">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentBalance}
                  onChange={(event) => update('currentBalance', event.target.value)}
                  placeholder="1200.50"
                  required
                />
              </Field>

              <Field label="APR %" hint="Optional; uses a 16% estimate when blank">
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.apr}
                  onChange={(event) => update('apr', event.target.value)}
                  placeholder="19.99"
                />
              </Field>

              <Field label="Minimum payment">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumDebtPayment}
                  onChange={(event) => update('minimumDebtPayment', event.target.value)}
                  placeholder="35"
                  required
                />
              </Field>

              <Field label="Current payment" hint="What you pay now; defaults to the minimum">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentPayment}
                  onChange={(event) => update('currentPayment', event.target.value)}
                  placeholder="35"
                />
              </Field>

              {showsCreditLimit(form.type) ? (
                <Field
                  label="Credit limit"
                  hint={requiresCreditLimit(form.type) ? 'Used for utilisation only' : 'Optional; used for utilisation only'}
                >
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.creditLimit}
                    onChange={(event) => update('creditLimit', event.target.value)}
                    placeholder="5000"
                  />
                </Field>
              ) : null}
            </div>

            {formError ? <Alert>{formError}</Alert> : null}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save account'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setFormError(null);
                  setShowForm(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Section>
      ) : null}

      <Section
        title="Tracked accounts"
        description="Deleting an account removes it from future simulations."
      >
        {tomes.loading ? (
          <Spinner label="Loading accounts…" />
        ) : accounts.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            description="Add a card or loan to simulate against your real balances."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                Add an account
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="num">Balance</th>
                  <th className="num">APR</th>
                  <th className="num">Minimum</th>
                  <th className="num">Current</th>
                  <th className="num">Utilisation</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const pct =
                    account.creditLimit > 0
                      ? (account.currentBalance / account.creditLimit) * 100
                      : null;

                  return (
                    <tr key={account.id}>
                      <td>
                        <span className="cell-strong">{account.name}</span>
                        <span className="cell-sub">{titleCase(account.type)}</span>
                      </td>
                      <td className="num">{money(account.currentBalance)}</td>
                      <td className="num">
                        {percent(effectiveApr(account))}
                        {account.apr === null ? (
                          <span className="cell-sub">estimated</span>
                        ) : null}
                      </td>
                      <td className="num">{money(account.minimumDebtPayment)}</td>
                      <td className="num">
                        {money(account.currentPayment ?? account.minimumDebtPayment)}
                      </td>
                      <td className="num">
                        {pct === null ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            <div className="bar">
                              <span
                                className={`bar-fill${pct > 70 ? ' bar-fill-high' : ''}`}
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              />
                            </div>
                            <span className="cell-sub">{percent(pct, 0)}</span>
                          </>
                        )}
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={deletingId === account.id}
                          onClick={() => handleDelete(account.id, account.name)}
                        >
                          {deletingId === account.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!tomes.loading && accounts.length > 0 ? (
          <p className="muted small">
            Editing an existing account is not supported by the API yet — delete and re-create it.{' '}
            <Badge tone="warn">PUT /api/tomes/{'{id}'} missing</Badge>
          </p>
        ) : null}
      </Section>
    </div>
  );
}
