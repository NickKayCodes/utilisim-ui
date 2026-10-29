import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { errorMessage } from '../lib/api';
import { Alert, Field } from '../components/ui';

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/app') ? from : '/app/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-brand">
          <span className="brand-mark">US</span>
          <span className="brand-name">UtiliSim</span>
        </div>
        <h1 className="auth-headline">Plan the shortest path out of debt.</h1>
        <p className="auth-blurb">
          Model your accounts, choose a payoff strategy, and see the month-by-month cost before you
          commit to it.
        </p>
        <ul className="auth-points">
          <li>Snowball, avalanche and hybrid payoff ordering</li>
          <li>Month-by-month amortization schedules</li>
          <li>Side-by-side strategy comparison</li>
        </ul>
        <p className="auth-footnote">Backend: localhost:8080</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h2 className="auth-title">Sign in</h2>
          <p className="muted">Use the email and password for your UtiliSim account.</p>

          {error ? <Alert>{error}</Alert> : null}

          <form className="stack" onSubmit={handleSubmit} noValidate>
            <Field label="Email">
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>

            <Field label="Password">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
