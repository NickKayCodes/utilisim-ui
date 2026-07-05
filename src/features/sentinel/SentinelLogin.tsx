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
    <div>
      <h2>Sentinel Login</h2>
      <form onSubmit={handleSubmission}>
        <input
          id="username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="Username"
          required
        />
        <input
          id="password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Password"
          required
        />
        <button type="submit" disabled={loading}>
          Login
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default SentinelLogin;
