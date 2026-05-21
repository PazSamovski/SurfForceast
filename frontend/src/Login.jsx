import { useState } from 'react';
import './Register.css';

const LOGIN_API = '/api/login';

function Login({ onSuccess, onSwitchToRegister, loading: parentLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isBusy = loading || parentLoading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="register-header">
        <h2 className="register-title">Log in</h2>
        <p className="register-subtitle">
          Sign in with your SurfForceast account
        </p>
      </div>

      {error && (
        <p className="register-alert register-alert--error" role="alert">
          {error}
        </p>
      )}

      <form className="register-form" onSubmit={handleSubmit} noValidate>
        <label className="register-field">
          <span className="register-label">Email</span>
          <input
            type="email"
            className="register-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isBusy}
            required
          />
        </label>

        <label className="register-field">
          <span className="register-label">Password</span>
          <input
            type="password"
            className="register-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            disabled={isBusy}
            required
          />
        </label>

        <button type="submit" className="register-submit" disabled={isBusy}>
          {isBusy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="register-switch">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          className="register-switch-btn"
          onClick={onSwitchToRegister}
          disabled={isBusy}
        >
          Register
        </button>
      </p>
    </>
  );
}

export default Login;
