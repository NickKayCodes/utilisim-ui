import { useState } from 'react';
import type { PlanTimeline } from '../types/api';
import { money, monthsLabel, percent } from '../lib/format';
import { Alert, Badge, EmptyState, StatCard } from './ui';

const UTILIZATION_WARNING = 30;

export function PlanTimelineView({ timeline }: { timeline: PlanTimeline }) {
  const [expanded, setExpanded] = useState<number[]>([]);
  // A run can finish (status COMPLETED) without paying the debt off, so use the
  // engine's termination reason rather than the run status.
  const repaid = timeline.terminationReason === 'PAID_OFF';

  function toggleMonth(monthIndex: number) {
    setExpanded((current) =>
      current.includes(monthIndex)
        ? current.filter((value) => value !== monthIndex)
        : [...current, monthIndex],
    );
  }

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard
          label="Months to payoff"
          value={repaid ? monthsLabel(timeline.monthsToPayoff) : 'Not repaid'}
          hint={`Final balance ${money(timeline.finalBalance)}`}
        />
        <StatCard label="Total interest" value={money(timeline.totalInterest)} />
        <StatCard label="Total paid" value={money(timeline.totalPaid)} />
        <StatCard
          label="Peak utilization"
          value={
            timeline.peakUtilizationPct === null
              ? '—'
              : percent(timeline.peakUtilizationPct)
          }
          tone={
            timeline.peakUtilizationPct !== null &&
            timeline.peakUtilizationPct >= UTILIZATION_WARNING
              ? 'warning'
              : undefined
          }
          hint={timeline.peakUtilizationPct === null ? 'No credit limit' : 'Across all months'}
        />
      </div>

      {repaid ? null : (
        <Alert tone="warning">
          This plan does not pay the debt off: {money(timeline.finalBalance)} remains after{' '}
          {monthsLabel(timeline.months.length)}.
        </Alert>
      )}

      {timeline.months.length === 0 ? (
        <EmptyState title="No months" description="The engine returned an empty timeline." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Starting</th>
                <th className="num">Interest</th>
                <th className="num">Min due</th>
                <th className="num">Actual</th>
                <th className="num">Extra</th>
                <th className="num">Lump sum</th>
                <th className="num">Remaining</th>
                <th className="num">Utilization</th>
                <th className="num">Interest paid</th>
                <th className="num">Interest cover</th>
              </tr>
            </thead>
            <tbody>
              {timeline.months.map((month) => {
                const open = expanded.includes(month.monthIndex);
                return [
                  <tr
                    key={`month-${month.monthIndex}`}
                    className={month.monthIndex === 1 ? 'month-row-first' : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-expanded={open}
                        aria-controls={`month-${month.monthIndex}-debts`}
                        onClick={() => toggleMonth(month.monthIndex)}
                      >
                        {month.monthLabel}
                        <span className="muted small">{open ? ' ▾' : ' ▸'}</span>
                      </button>
                    </td>
                    <td className="num">{money(month.startingBalance)}</td>
                    <td className="num">{money(month.monthlyInterest)}</td>
                    <td className="num">{money(month.minimumDue)}</td>
                    <td className="num">{money(month.actualPayment)}</td>
                    <td className="num">{money(month.extraPayment)}</td>
                    <td className="num">{money(month.lumpSumApplied)}</td>
                    <td className="num">{money(month.remainingBalance)}</td>
                    <td className="num">
                      {month.utilizationPct === null ? (
                        '—'
                      ) : month.utilizationPct >= UTILIZATION_WARNING ? (
                        <Badge tone="warn">{percent(month.utilizationPct)}</Badge>
                      ) : (
                        percent(month.utilizationPct)
                      )}
                    </td>
                    <td className="num">{money(month.interestPaid)}</td>
                    <td className="num">{money(month.amountToCoverInterest)}</td>
                  </tr>,
                  open
                    ? month.debts.map((debt) => (
                        <tr key={`month-${month.monthIndex}-${debt.tomeId}`} className="debt-row">
                          <td colSpan={2} className="muted small">
                            ↳ {debt.accountName} · {money(debt.startingBalance)}
                          </td>
                          <td className="num">{money(debt.monthlyInterest)}</td>
                          <td className="num">{money(debt.minimumDue)}</td>
                          <td className="num">{money(debt.actualPayment)}</td>
                          <td className="num">{money(debt.extraPayment)}</td>
                          <td className="num">{money(debt.lumpSumApplied)}</td>
                          <td className="num">{money(debt.remainingBalance)}</td>
                          <td className="num">
                            {debt.utilizationPct === null ? '—' : percent(debt.utilizationPct)}
                          </td>
                          <td className="num">{money(debt.interestPaid)}</td>
                          <td className="num">{money(debt.amountToCoverInterest)}</td>
                        </tr>
                      ))
                    : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
