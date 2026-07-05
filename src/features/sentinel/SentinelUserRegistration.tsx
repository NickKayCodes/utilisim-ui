import React, { useState } from 'react';
import { register } from './sentinel.service';

const SentinelUserRegistration: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUsername(e.target.value);
  }

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

    const payload = {
      username,
      email,
      password,
    };

    const response = await register(payload);

    if (response.success) {
      setMessage(response.message || 'Registration successful');
    } else {
      setError(response.error || 'Registration failed');
    }

    setLoading(false);
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Sentinel Registration</h2>
      <form onSubmit={handleSubmission} style={styles.form}>
        <input
          id="register-username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="Username"
          required
          style={styles.input}
        />
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="Email"
          required
          style={styles.input}
        />
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Password"
          required
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Registering...' : 'Register'}
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

export default SentinelUserRegistration;
