import React, { useState } from 'react';
import { updateUser } from './sentinel.service';

const SentinelUserUpdate: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
  }

  async function handleSubmission(e: React.SubmitEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const payload: Record<string, string> = {};

    if (email.trim()) {
      payload.email = email.trim();
    }

    if (password.trim()) {
      payload.password = password;
    }

    if (Object.keys(payload).length === 0) {
      setError('Please enter an email or password to update.');
      setLoading(false);
      return;
    }

    const response = await updateUser(payload);

    if (response.success) {
      setMessage(response.message || 'User updated successfully');
      setEmail('');
      setPassword('');
    } else {
      setError(response.error || 'User update failed');
    }

    setLoading(false);
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Update Sentinel User</h2>
      <form onSubmit={handleSubmission} style={styles.form}>
        <input
          id="update-email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="New Email"
          style={styles.input}
        />
        <input
          id="update-password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="New Password"
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Updating...' : 'Update'}
        </button>
      </form>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '420px',
    margin: '0 auto',
    padding: '1.5rem',
    borderRadius: '1rem',
    background: '#ffffff',
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
  },
  title: {
    margin: '0 0 1.25rem',
    fontSize: '1.75rem',
    color: '#111827',
    textAlign: 'center',
  },
  form: {
    display: 'grid',
    gap: '1rem',
  },
  input: {
    width: '100%',
    padding: '0.95rem 1rem',
    borderRadius: '0.85rem',
    border: '1px solid #d1d5db',
    background: '#f8fafc',
    fontSize: '1rem',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '0.95rem 1rem',
    borderRadius: '0.85rem',
    border: 'none',
    background: '#2563eb',
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  success: {
    marginTop: '1rem',
    color: '#16a34a',
    textAlign: 'center',
  },
  error: {
    marginTop: '1rem',
    color: '#dc2626',
    textAlign: 'center',
  },
};

export default SentinelUserUpdate;
