import { useState } from 'react';
import type { SimulationResult } from '../types/api';
import { dateTime, money, monthsLabel, shortDate } from '../lib/format';
import { StatCard } from './ui';

const PREVIEW_ROWS = 12;

export function SimulationResultView({ result }: { result: SimulationResult }) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? result.schedule : result.schedule.slice(0, PREVIEW_ROWS);

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard label="Months to payoff" value={monthsLabel(result.monthsToPayoff)} />
        <StatCard label="Interest paid" value={money(result.totalInterestPaid)} />
        <StatCard label="Principal paid" value={money(result.totalPrincipalPaid)} />
        <StatCard
          label="Payoff date"
          value={shortDate(result.payoffDate)}
          hint={`Completed ${dateTime(result.completedAt)}`}
        />
      </div>

      <div className="section-head">
        <h2 className="section-title">Amortization schedule</h2>
        <span className="muted small">
          {result.schedule.length} rows · status {result.status}
        </span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="num">Month</th>
              <th>Date</th>
              <th className="num">Payment</th>
              <th className="num">Principal</th>
              <th className="num">Interest</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.monthIndex}>
                <td className="num">{entry.monthIndex}</td>
                <td>{shortDate(entry.date)}</td>
                <td className="num">{money(entry.payment)}</td>
                <td className="num">{money(entry.principalPaid)}</td>
                <td className="num">{money(entry.interestPaid)}</td>
                <td className="num">{money(entry.remainingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.schedule.length > PREVIEW_ROWS ? (
        <button type="button" className="btn btn-ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? `Show first ${PREVIEW_ROWS} months` : `Show all ${result.schedule.length} months`}
        </button>
      ) : null}

      <p className="muted small">
        This run was not stored by the API. The response has a generated id, but there is no
        endpoint to fetch it again, and reloading the page clears it. Save the inputs as a
        scenario if you want to reproduce it.
      </p>
    </div>
  );
}
