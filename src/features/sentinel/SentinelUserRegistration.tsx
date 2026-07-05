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
    <div>
      <h2>Sentinel Registration</h2>
      <form onSubmit={handleSubmission}>
        <input
          id="register-username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="Username"
          required
        />
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="Email"
          required
        />
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Password"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default SentinelUserRegistration;
