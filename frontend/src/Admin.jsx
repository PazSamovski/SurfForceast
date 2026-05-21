import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthHeaders } from './auth.js';
import SendGlobalNotification from './admin/SendGlobalNotification.jsx';
import './Admin.css';

const ADMIN_USERS_API = '/api/admin/users';
const APPROVE_USER_API = '/api/approve-user';
const ADMIN_FORECAST_API = '/api/admin/forecast';
const FORECAST_API = '/api/forecast';
function IconWave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
      <path d="M2 17c2-4 4-4 6 0s4 4 6 0 4-4 6 0" opacity="0.6" />
    </svg>
  );
}

function AdminDashboard({ username, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [forecastText, setForecastText] = useState('');
  const [forecastSaving, setForecastSaving] = useState(false);
  const [forecastMessage, setForecastMessage] = useState(null);
  const [forecastError, setForecastError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(ADMIN_USERS_API, { headers: getAuthHeaders() });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      setUsers(data.users ?? []);
    } catch (err) {
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await fetch(FORECAST_API);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to load forecast.');
      }
      setForecastText(data.forecast?.text ?? '');
    } catch {
      setForecastText('');
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchForecast();
  }, [fetchUsers, fetchForecast]);

  const handleSaveForecast = async (e) => {
    e.preventDefault();
    setForecastSaving(true);
    setForecastError(null);
    setForecastMessage(null);

    try {
      const res = await fetch(ADMIN_FORECAST_API, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: forecastText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Unable to save forecast.');
      }

      setForecastMessage(data.message || 'Forecast saved.');
      setForecastText(data.forecast?.text ?? '');
    } catch (err) {
      setForecastError(err.message);
    } finally {
      setForecastSaving(false);
    }
  };

  const handleClearForecast = async () => {
    setForecastSaving(true);
    setForecastError(null);
    setForecastMessage(null);

    try {
      const res = await fetch(ADMIN_FORECAST_API, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: '' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Unable to clear forecast.');
      }

      setForecastText('');
      setForecastMessage(data.message || 'Forecast cleared.');
    } catch (err) {
      setForecastError(err.message);
    } finally {
      setForecastSaving(false);
    }
  };

  const handleApprove = async (userId) => {
    setApprovingId(userId);
    setActionError(null);

    try {
      const res = await fetch(APPROVE_USER_API, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, isApproved: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Approval failed.');
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, isApproved: true } : user
        )
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const pendingCount = users.filter((user) => !user.isApproved).length;

  return (
    <div className="app">
      <div className="app__bg" aria-hidden="true">
        <div className="app__glow app__glow--1" />
        <div className="app__glow app__glow--2" />
        <div className="app__shimmer" />
      </div>

      <div className="shell">
        <header className="topbar">
          <div className="topbar__brand">
            <span className="topbar__mark" aria-hidden="true">
              <IconWave />
            </span>
            <div>
              <p className="topbar__eyebrow">SurfForceast</p>
              <h1 className="topbar__title">Admin</h1>
              <p className="topbar__greeting">Hello, {username}</p>
            </div>
          </div>
          <div className="topbar__actions">
            <Link to="/" className="topbar__admin-link">
              Dashboard
            </Link>
            <button
              type="button"
              className="topbar__logout-btn"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="main">
          <section className="glass admin-forecast" aria-labelledby="admin-forecast-heading">
            <div className="admin-forecast__header">
              <div>
                <h2 id="admin-forecast-heading" className="admin-forecast__title">
                  Manager&apos;s daily forecast
                </h2>
                <p className="admin-forecast__subtitle">
                  Publish a short update for all surfers. Leave empty and save to hide it from the dashboard.
                </p>
              </div>
            </div>

            {forecastError && (
              <p className="admin-panel__error" role="alert">
                {forecastError}
              </p>
            )}

            {forecastMessage && (
              <p className="admin-forecast__success" role="status">
                {forecastMessage}
              </p>
            )}

            <form className="admin-forecast__form" onSubmit={handleSaveForecast}>
              <label className="admin-forecast__field" htmlFor="manager-forecast-text">
                <span className="admin-forecast__label">Today&apos;s message</span>
                <textarea
                  id="manager-forecast-text"
                  className="admin-forecast__textarea"
                  value={forecastText}
                  onChange={(e) => setForecastText(e.target.value)}
                  placeholder="e.g. Conditions are looking clean at Poleg, go early!"
                  rows={4}
                  maxLength={2000}
                  disabled={forecastSaving}
                />
              </label>
              <div className="admin-forecast__actions">
                <button
                  type="submit"
                  className="admin-forecast__save"
                  disabled={forecastSaving}
                >
                  {forecastSaving ? 'Saving…' : 'Publish forecast'}
                </button>
                <button
                  type="button"
                  className="admin-forecast__clear"
                  onClick={handleClearForecast}
                  disabled={forecastSaving || !forecastText.trim()}
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          <SendGlobalNotification />

          <section className="glass admin-panel" aria-labelledby="admin-heading">
            <div className="admin-panel__header">
              <div>
                <h2 id="admin-heading" className="admin-panel__title">
                  User approvals
                </h2>
                <p className="admin-panel__subtitle">
                  Approve registered users so they can access the dashboard and chat.
                </p>
              </div>
              <button
                type="button"
                className="admin-panel__refresh"
                onClick={fetchUsers}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {error && (
              <p className="admin-panel__error" role="alert">
                {error}
              </p>
            )}

            {actionError && (
              <p className="admin-panel__error" role="alert">
                {actionError}
              </p>
            )}

            {loading && !users.length && !error && (
              <div className="admin-panel__loader">
                <div className="loader__ring" />
                <p className="loader__text">Loading users…</p>
              </div>
            )}

            {!loading && !error && users.length === 0 && (
              <p className="admin-panel__empty">No registered users yet.</p>
            )}

            {users.length > 0 && (
              <>
                <p className="admin-panel__stats">
                  {users.length} user{users.length !== 1 ? 's' : ''}
                  {pendingCount > 0 && (
                    <>
                      {' '}
                      · <span className="admin-panel__pending">{pendingCount} pending</span>
                    </>
                  )}
                </p>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Email</th>
                        <th scope="col">Status</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td data-label="Name">{user.username}</td>
                          <td data-label="Email">{user.email}</td>
                          <td data-label="Status">
                            <span
                              className={`admin-status ${
                                user.isApproved
                                  ? 'admin-status--approved'
                                  : 'admin-status--pending'
                              }`}
                            >
                              {user.isApproved ? 'Approved' : 'Pending'}
                            </span>
                          </td>
                          <td data-label="Action">
                            {user.isApproved ? (
                              <span className="admin-table__done">—</span>
                            ) : (
                              <button
                                type="button"
                                className="admin-approve-btn"
                                onClick={() => handleApprove(user.id)}
                                disabled={approvingId === user.id}
                              >
                                {approvingId === user.id ? 'Approving…' : 'Approve'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </main>

        <footer className="footer">
          <span>© SurfForceast</span>
          <span className="footer__sep">·</span>
          <span>Admin dashboard</span>
        </footer>
      </div>
    </div>
  );
}

export default AdminDashboard;
