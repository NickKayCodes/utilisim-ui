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
    <div>
      <h2>Update Sentinel User</h2>
      <form onSubmit={handleSubmission}>
        <input
          id="update-email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="New Email"
        />
        <input
          id="update-password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="New Password"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update'}
        </button>
      </form>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default SentinelUserUpdate;
