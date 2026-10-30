import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { errorMessage } from '../lib/api';
import { Alert, Field } from '../components/ui';

export function RegisterPage() {
  const { register, status } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/app/dashboard" replace />;
  }

  function validate(): string | null {
    if (!username.trim()) return 'Choose a username.';
    if (!email.includes('@')) return 'Enter a valid email address.';
    // The API accepts any password length, so enforce a sane minimum here.
    if (password.length < 8) return 'Use at least 8 characters for your password.';
    if (password !== confirm) return 'The passwords do not match.';
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await register(username.trim(), email.trim(), password);
      navigate('/app/dashboard', { replace: true });
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
        <h1 className="auth-headline">Start with the balances you actually have.</h1>
        <p className="auth-blurb">
          Add each account once, then compare payoff strategies against the real numbers instead of
          a guess.
        </p>
        <ul className="auth-points">
          <li>Track balances, APRs and minimum payments</li>
          <li>Run a simulation in one click</li>
          <li>Keep the scenarios worth revisiting</li>
        </ul>
        <p className="auth-footnote">
          Your account data and scenarios are private to you.
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h2 className="auth-title">Create an account</h2>
          <p className="muted">Registration signs you in immediately.</p>

          {error ? <Alert>{error}</Alert> : null}

          <form className="stack" onSubmit={handleSubmit} noValidate>
            <Field label="Username">
              <input
                className="input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </Field>

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

            <Field label="Password" hint="At least 8 characters.">
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>

            <Field label="Confirm password">
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </Field>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
