import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { archiveApi } from '../services/archive';
import { simulationApi } from '../services/simulation';
import { tomesApi } from '../services/tomes';
import { useApiResource } from '../lib/use-api-resource';
import {
  effectiveApr,
  sumBalance,
  sumMinimums,
  utilization,
  weightedApr,
} from '../lib/accounts';
import { money, percent, shortDate, strategyLabel } from '../lib/format';
import { Alert, Badge, EmptyState, PageHeader, Section, Spinner, StatCard } from '../components/ui';

export function DashboardPage() {
  const { user } = useAuth();
  const loadTomes = useCallback(() => tomesApi.list(), []);
  const loadScenarios = useCallback(() => archiveApi.list(), []);
  const loadHistory = useCallback(() => simulationApi.history(20), []);
  const tomes = useApiResource(loadTomes);
  const scenarios = useApiResource(loadScenarios);
  const history = useApiResource(loadHistory);

  const accounts = tomes.data ?? [];
  const balance = sumBalance(accounts);
  const minimums = sumMinimums(accounts);
  const apr = weightedApr(accounts);
  const used = utilization(accounts);

  const currentPlan = (history.data ?? []).find((plan) => plan.plan === 'CURRENT');
  const nextMonth = currentPlan?.months[0];

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
          {tomes.error}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={tomes.reload}>
            Retry
          </button>
        </Alert>
      ) : null}

      <div className="grid grid-4">
        <StatCard
          label="Accounts tracked"
          value={tomes.loading ? '—' : String(accounts.length)}
          hint={tomes.loading ? 'Loading…' : accounts.length ? 'Across all types' : 'Add your first account'}
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
          title="Next month of your current plan"
          description="The first month of the latest CURRENT run."
          actions={
            <Link className="btn btn-ghost btn-sm" to="/app/simulate">
              Open simulator
            </Link>
          }
        >
          {history.error ? (
            <Alert>
              {history.error}{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={history.reload}>
                Retry
              </button>
            </Alert>
          ) : history.loading ? (
            <Spinner label="Loading runs…" />
          ) : currentPlan && nextMonth ? (
            <div className="stack">
              <div className="grid grid-3">
                <StatCard label="Next month" value={nextMonth.monthLabel} hint={`Run #${currentPlan.runId}`} />
                <StatCard label="Starting balance" value={money(nextMonth.startingBalance)} />
                <StatCard label="Monthly interest" value={money(nextMonth.monthlyInterest)} />
                <StatCard label="Minimum due" value={money(nextMonth.minimumDue)} />
                <StatCard label="Actual payment" value={money(nextMonth.actualPayment)} />
                <StatCard
                  label="Remaining"
                  value={money(nextMonth.remainingBalance)}
                  hint={
                    nextMonth.utilizationPct === null
                      ? 'No credit limit'
                      : `Utilization ${percent(nextMonth.utilizationPct)}`
                  }
                />
              </div>
              <p className="muted small">
                Plan {strategyLabel(currentPlan.plan)} · {currentPlan.status} · started{' '}
                {shortDate(currentPlan.months[0]?.periodStart)}
              </p>
            </div>
          ) : (
            <EmptyState
              title="No current plan yet"
              description="Run a CURRENT plan to see next month's starting balance, payment and utilization."
              action={
                <Link className="btn btn-primary btn-sm" to="/app/simulate">
                  Run a plan
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
                  <th className="num">Current</th>
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
                    <td className="num">
                      {money(account.currentPayment ?? account.minimumDebtPayment)}
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
