import { useState } from 'react';
import './Register.css';

const LOGIN_API = '/api/login';
const FORGOT_PASSWORD_API = '/api/forgot-password';

function ForgotPasswordModal({ email, onEmailChange, onClose, isBusy }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [resetUrl, setResetUrl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setResetUrl(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(FORGOT_PASSWORD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Unable to request password reset.');
      }

      setMessage(
        data.message ||
          'If this email is registered, a reset link has been generated.'
      );
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const modalBusy = isBusy || loading;

  return (
    <div
      className="register-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="register-modal"
        role="dialog"
        aria-labelledby="forgot-password-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="register-modal__close"
          onClick={onClose}
          aria-label="Close"
          disabled={modalBusy}
        >
          ×
        </button>

        <h3 id="forgot-password-title" className="register-modal__title">
          Forgot password
        </h3>
        <p className="register-modal__text">
          Enter your account email. We&apos;ll generate a one-time reset link
          (valid for 15 minutes).
        </p>

        {error && (
          <p className="register-alert register-alert--error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="register-alert register-alert--success" role="status">
            {message}
          </p>
        )}

        {resetUrl && (
          <div className="register-modal__link-box">
            <p className="register-modal__link-label">Reset link</p>
            <a href={resetUrl} className="register-modal__link">
              {resetUrl}
            </a>
          </div>
        )}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <label className="register-field">
            <span className="register-label">Email</span>
            <input
              type="email"
              className="register-input"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={modalBusy}
              required
            />
          </label>

          <button
            type="submit"
            className="register-submit"
            disabled={modalBusy}
          >
            {loading ? 'Generating…' : 'Send reset link'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Login({ onSuccess, onSwitchToRegister, loading: parentLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const isBusy = loading || parentLoading;

  const openForgotModal = () => {
    setForgotEmail(email);
    setShowForgotModal(true);
  };

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

        <p className="register-forgot">
          <button
            type="button"
            className="register-forgot-btn"
            onClick={openForgotModal}
            disabled={isBusy}
          >
            Forgot password?
          </button>
        </p>

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

      {showForgotModal && (
        <ForgotPasswordModal
          email={forgotEmail}
          onEmailChange={setForgotEmail}
          onClose={() => setShowForgotModal(false)}
          isBusy={isBusy}
        />
      )}
    </>
  );
}

export default Login;
