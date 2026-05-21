import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import './Register.css';

const RESET_PASSWORD_API = '/api/reset-password';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token')?.trim() || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Missing reset token. Please use the link from your password reset request.');
      return;
    }

    if (!password) {
      setError('Please enter a new password.');
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
      const res = await fetch(RESET_PASSWORD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Unable to reset password.');
      }

      setSuccess(data.message || 'Password updated successfully.');
      setPassword('');
      setConfirmPassword('');

      setTimeout(
        () => navigate('/', { replace: true, state: { login: true } }),
        2000
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-header">
          <h2 className="register-title">Reset password</h2>
          <p className="register-subtitle">
            Choose a new password for your SurfForceast account
          </p>
        </div>

        {!token && (
          <p className="register-alert register-alert--error" role="alert">
            This reset link is invalid. Request a new one from the login screen.
          </p>
        )}

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

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <label className="register-field">
            <span className="register-label">New password</span>
            <input
              type="password"
              className="register-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              minLength={6}
              disabled={loading || !token}
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
              disabled={loading || !token}
              required
            />
          </label>

          <button
            type="submit"
            className="register-submit"
            disabled={loading || !token}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p className="register-switch">
          <Link to="/" className="register-switch-btn register-switch-btn--link">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;
