import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { archiveApi } from '../services/archive';
import { tomesApi } from '../services/tomes';
import { useApiResource } from '../lib/use-api-resource';
import { readLastRun } from '../lib/last-run';
import {
  effectiveApr,
  sumBalance,
  sumMinimums,
  utilization,
  weightedApr,
} from '../lib/accounts';
import { money, moneyShort, monthsLabel, percent, shortDate, strategyLabel } from '../lib/format';
import { Alert, Badge, EmptyState, PageHeader, Section, Spinner, StatCard } from '../components/ui';

export function DashboardPage() {
  const { user } = useAuth();
  const loadTomes = useCallback(() => tomesApi.list(), []);
  const loadScenarios = useCallback(() => archiveApi.list(), []);
  const tomes = useApiResource(loadTomes);
  const scenarios = useApiResource(loadScenarios);
  const [lastRun] = useState(readLastRun);

  const accounts = tomes.data ?? [];
  const balance = sumBalance(accounts);
  const minimums = sumMinimums(accounts);
  const apr = weightedApr(accounts);
  const used = utilization(accounts);

  return (
    <div className="stack-lg">
      <PageHeader
        title="Dashboard"
        subtitle={user ? `Signed in as ${user.email}` : undefined}
        actions={
          <Link className="btn btn-primary" to="/app/simulate">
            New simulation
          </Link>
        }
      />

      {tomes.error ? (
        <Alert>
          {tomes.error} <button type="button" className="btn btn-ghost btn-sm" onClick={tomes.reload}>Retry</button>
        </Alert>
      ) : null}

      <div className="grid grid-4">
        <StatCard
          label="Accounts tracked"
          value={tomes.loading ? '—' : String(accounts.length)}
          hint={tomes.loading ? 'Loading…' : `${accounts.length ? 'Across all types' : 'Add your first account'}`}
        />
        <StatCard label="Total balance" value={tomes.loading ? '—' : money(balance)} hint="Sum of current balances" />
        <StatCard label="Monthly minimums" value={tomes.loading ? '—' : money(minimums)} hint="Before any extra payment" />
        <StatCard
          label="Average APR"
          value={tomes.loading ? '—' : percent(apr)}
          hint={used > 0 ? `${percent(used, 0)} of total credit limit` : 'Balance-weighted'}
          tone={apr >= 20 ? 'warning' : undefined}
        />
      </div>

      <div className="grid grid-2">
        <Section
          title="Last simulation"
          description="Kept in this browser only — the API does not store runs."
          actions={
            <Link className="btn btn-ghost btn-sm" to="/app/simulate">
              Open simulator
            </Link>
          }
        >
          {lastRun ? (
            <div className="stack">
              <div className="grid grid-3">
                <StatCard label="Months to payoff" value={monthsLabel(lastRun.monthsToPayoff)} />
                <StatCard label="Interest" value={moneyShort(lastRun.totalInterestPaid)} />
                <StatCard label="Payoff date" value={shortDate(lastRun.payoffDate)} />
              </div>
              <p className="muted small">
                Ran against a {moneyShort(lastRun.totalPrincipalPaid)} principal at status{' '}
                {lastRun.status}.
              </p>
            </div>
          ) : (
            <EmptyState
              title="No simulation yet"
              description="Run one to see the payoff date and interest cost."
              action={
                <Link className="btn btn-primary btn-sm" to="/app/simulate">
                  Run a simulation
                </Link>
              }
            />
          )}
        </Section>

        <Section
          title="Scenarios"
          description="Saved strategy + extra payment presets."
          actions={
            <Link className="btn btn-ghost btn-sm" to="/app/scenarios">
              Manage
            </Link>
          }
        >
          {scenarios.loading ? (
            <Spinner label="Loading scenarios…" />
          ) : scenarios.data && scenarios.data.length > 0 ? (
            <ul className="mini-list">
              {scenarios.data.slice(0, 4).map((scenario) => (
                <li key={scenario.id} className="mini-row">
                  <div>
                    <p className="mini-title">{scenario.name}</p>
                    <p className="muted small">{shortDate(scenario.createdAt)}</p>
                  </div>
                  <div className="mini-meta">
                    <Badge tone="info">{strategyLabel(scenario.strategy)}</Badge>
                    <span className="muted small">+{money(scenario.extraPayment)}/mo</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No scenarios saved"
              description="A scenario stores a strategy and extra payment you want to reuse."
              action={
                <Link className="btn btn-ghost btn-sm" to="/app/scenarios">
                  Create one
                </Link>
              }
            />
          )}
        </Section>
      </div>

      <Section
        title="Your accounts"
        description="Balances come from /api/tomes and are scoped to your login."
        actions={
          <Link className="btn btn-ghost btn-sm" to="/app/accounts">
            Manage accounts
          </Link>
        }
      >
        {tomes.loading ? (
          <Spinner label="Loading accounts…" />
        ) : accounts.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            description="Add a card, loan or line of credit to simulate against."
            action={
              <Link className="btn btn-primary btn-sm" to="/app/accounts">
                Add an account
              </Link>
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
                </tr>
              </thead>
              <tbody>
                {accounts.slice(0, 5).map((account) => (
                  <tr key={account.id}>
                    <td>
                      <span className="cell-strong">{account.name}</span>
                      <span className="cell-sub">{account.type.replaceAll('_', ' ').toLowerCase()}</span>
                    </td>
                    <td className="num">{money(account.currentBalance)}</td>
                    <td className="num">{percent(effectiveApr(account))}</td>
                    <td className="num">{money(account.minimumDebtPayment)}</td>
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
