import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { archiveApi } from '../services/archive';
import { useApiResource } from '../lib/use-api-resource';
import { ApiError } from '../lib/api';
import { dateTime, money, strategyLabel } from '../lib/format';
import type { Scenario } from '../types/api';
import { Alert, Badge, EmptyState, PageHeader, Section, Spinner } from '../components/ui';

/** Read-only view of a saved scenario. Opens the simulator with the same preset as the list. */
export function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const loadScenario = useCallback(async () => {
    if (!id) return null;
    try {
      return await archiveApi.get(id);
    } catch (error) {
      // 404 means missing or owned by someone else; anything else is a real failure
      // and must surface as an error instead of pretending the scenario is gone.
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
      throw error;
    }
  }, [id]);
  const scenario = useApiResource<Scenario | null>(loadScenario);

  function handleRun(preset: Scenario) {
    navigate('/app/simulate', { state: { scenario: preset } });
  }

  if (scenario.loading) {
    return (
      <div className="stack-lg">
        <Spinner label="Loading scenario…" />
      </div>
    );
  }

  if (scenario.error) {
    return (
      <div className="stack-lg">
        <Alert>
          {scenario.error}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={scenario.reload}>
            Retry
          </button>
        </Alert>
        <div>
          <Link className="btn btn-ghost" to="/app/scenarios">
            ← Back to scenarios
          </Link>
        </div>
      </div>
    );
  }

  if (!scenario.data) {
    return (
      <div className="stack-lg">
        <EmptyState
          title="Scenario not found"
          description="This scenario does not exist, or it belongs to another account."
          action={
            <Link className="btn btn-primary" to="/app/scenarios">
              Back to scenarios
            </Link>
          }
        />
      </div>
    );
  }

  const saved = scenario.data;

  return (
    <div className="stack-lg">
      <PageHeader
        title={saved.name}
        subtitle="A saved strategy preset. It holds plan inputs, not results."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => handleRun(saved)}>
            Open in Simulate
          </button>
        }
      />

      <Section title="Saved inputs" description="What the simulator prefills from this scenario">
        <div className="stack">
          <div className="grid grid-2">
            <div className="field">
              <span className="field-label">Strategy</span>
              <span>
                <Badge tone="info">{strategyLabel(saved.strategy)}</Badge>
              </span>
            </div>

            <div className="field">
              <span className="field-label">Extra per month</span>
              <span>{money(saved.extraPayment)}</span>
            </div>

            <div className="field">
              <span className="field-label">One-time lump sum</span>
              <span>{money(saved.lumpSumPayment)}</span>
            </div>

            <div className="field">
              <span className="field-label">Created</span>
              <span className="muted small">{dateTime(saved.createdAt)}</span>
            </div>

            <div className="field">
              <span className="field-label">Updated</span>
              <span className="muted small">{dateTime(saved.updatedAt)}</span>
            </div>
          </div>

          <p className="muted small">
            This scenario stores plan inputs only: strategy, extra payment and lump sum. It does not
            store a debt set, start month or horizon, and it is not linked to any run.
          </p>
        </div>
      </Section>

      <div>
        <Link className="btn btn-ghost" to="/app/scenarios">
          ← Back to scenarios
        </Link>
      </div>
    </div>
  );
}
