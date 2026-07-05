//create login form component for sentinel authentication
import React, { useState } from 'react';
import { login } from './sentinel.service';

//set form state using usestate for login payload
const SentinelLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  //feedback state for loading and error messages
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //update form state on input change
  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUsername(e.target.value);
  }
  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
  }

  //handle form submission for login
  async function handleSubmission(e: React.SubmitEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const sentinelLoginPayload = {
      username,
      password,
    };

    console.log('Submitting login with', sentinelLoginPayload);
    //pass login payload to api for authentication, handle response and errors
    const response = await login(sentinelLoginPayload);
    if (response.success) {
      console.log('Login successful', response.data);
    } else {
      setError(response.error || 'Login failed');
    }
    setLoading(false);
  }

  //render login form with username and password fields, submit button, and feedback messages
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Sentinel Login</h2>
      <form onSubmit={handleSubmission} style={styles.form}>
        <input
          id="username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="Username"
          required
          style={styles.input}
        />
        <input
          id="password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Password"
          required
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

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
    transition: 'border-color 0.2s ease',
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
  error: {
    margin: 0,
    color: '#dc2626',
    textAlign: 'center',
  },
};

export default SentinelLogin;
