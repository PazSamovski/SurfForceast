import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Login from './Login.jsx';
import './Register.css';

const REGISTER_API = '/api/register';

function Register({ onSuccess, onBack }) {
  const location = useLocation();
  const [mode, setMode] = useState('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const switchToLogin = () => {
    setMode('login');
    setError(null);
    setSuccess(null);
  };

  const switchToRegister = () => {
    setMode('register');
    setError(null);
    setSuccess(null);
  };

  useEffect(() => {
    if (location.state?.login) {
      setMode('login');
    }
  }, [location.state]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUsername || !trimmedEmail || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(REGISTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername,
          email: trimmedEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      setSuccess(data.message || 'Account created successfully!');
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      if (onSuccess) {
        setTimeout(() => onSuccess(data), 800);
      } else {
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        {onBack && (
          <button type="button" className="register-back" onClick={onBack}>
            ← Back to dashboard
          </button>
        )}

        {mode === 'login' ? (
          <Login
            onSuccess={onSuccess}
            onSwitchToRegister={switchToRegister}
            loading={loading}
          />
        ) : (
          <>
            <div className="register-header">
              <h2 className="register-title">Create account</h2>
              <p className="register-subtitle">
                Join SurfForceast to share conditions with the community
              </p>
            </div>

            {error && (
              <p className="register-alert register-alert--error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="register-alert register-alert--success" role="status">
                {success}
              </p>
            )}

            <form
              className="register-form"
              onSubmit={handleRegisterSubmit}
              noValidate
            >
              <label className="register-field">
                <span className="register-label">Username</span>
                <input
                  type="text"
                  className="register-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="surfer123"
                  autoComplete="username"
                  minLength={3}
                  maxLength={30}
                  disabled={loading}
                  required
                />
              </label>

              <label className="register-field">
                <span className="register-label">Email</span>
                <input
                  type="email"
                  className="register-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
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
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                  disabled={loading}
                  required
                />
              </label>

              <label className="register-field">
                <span className="register-label">Confirm password</span>
                <input
                  type="password"
                  className="register-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />
              </label>

              <button
                type="submit"
                className="register-submit"
                disabled={loading}
              >
                {loading ? 'Creating account…' : 'Register'}
              </button>
            </form>

            <p className="register-switch">
              Already have an account?{' '}
              <button
                type="button"
                className="register-switch-btn"
                onClick={switchToLogin}
                disabled={loading}
              >
                Login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Register;
