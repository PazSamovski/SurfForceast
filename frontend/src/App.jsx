import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';
import Register from './Register.jsx';
import AdminDashboard from './Admin.jsx';
import ResetPassword from './ResetPassword.jsx';
import ChatWidget from './ChatWidget.jsx';
import { getAuthHeaders } from './auth.js';
import { getWaveGenreDisplay } from './waveGenres.js';
import './App.css';

const API_BASE = '/api/surf';
const AUTH_ME_API = '/api/auth/me';
const FORECAST_API = '/api/forecast';

const SPOTS = [
  { id: 'Netanya', label: 'Netanya' },
  { id: 'Tel Aviv', label: 'Tel Aviv' },
  { id: 'Haifa', label: 'Haifa' },
  { id: 'Ashdod', label: 'Ashdod' },
];

const PLACEHOLDER = '—';
const ISRAEL_TZ = 'Asia/Jerusalem';
const TICK_MS = 1000;

function IconWave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
      <path d="M2 17c2-4 4-4 6 0s4 4 6 0 4-4 6 0" opacity="0.6" />
    </svg>
  );
}

function IconSwellPeriod() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconCompass() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" opacity="0.5" />
      <path d="m14.5 9.5-5 2 2 5 5-2-2-5z" fill="currentColor" stroke="none" opacity="0.9" />
    </svg>
  );
}

function IconWind() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 6.5a2.5 2.5 0 1 1 0 5H4" />
      <path d="M14 4a3 3 0 1 1 0 6H4" />
      <path d="M17.5 13.5a2.5 2.5 0 1 1 0 5H4" />
    </svg>
  );
}

function IconThermometer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z" />
      <path d="M10 9h4" opacity="0.5" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function getIsraelCalendarDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatIsraelClock(date) {
  return date.toLocaleTimeString('en-GB', {
    timeZone: ISRAEL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatChatDate(isoTime) {
  try {
    return new Date(isoTime).toLocaleDateString('en-GB', {
      timeZone: ISRAEL_TZ,
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatChatTime(isoTime) {
  try {
    return new Date(isoTime).toLocaleTimeString('en-GB', {
      timeZone: ISRAEL_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

function formatRelativeTime(isoTime, now) {
  try {
    const then = new Date(isoTime);
    const diffSec = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return null;
  } catch {
    return null;
  }
}

function formatMessageTimestamp(isoTime, now) {
  try {
    const then = new Date(isoTime);
    const isToday = getIsraelCalendarDate(then) === getIsraelCalendarDate(now);
    const relative = isToday ? formatRelativeTime(isoTime, now) : null;

    if (relative && !relative.includes('h ago')) {
      return { relative, date: null, time: null };
    }

    return {
      relative: null,
      date: isToday ? null : formatChatDate(isoTime),
      time: formatChatTime(isoTime),
    };
  } catch {
    return { relative: null, date: null, time: null };
  }
}

function hasLiveValue(value) {
  return value != null && value !== '' && value !== PLACEHOLDER;
}

function buildMetrics(surf) {
  const waveGenre = surf?.waveGenre ?? null;

  return [
    {
      id: 'waveHeight',
      label: 'Wave Height',
      value: surf?.waveHeight ?? PLACEHOLDER,
      icon: IconWave,
      live: hasLiveValue(surf?.waveHeight),
      waveGenre,
      waveDisplay: getWaveGenreDisplay(waveGenre),
    },
    {
      id: 'swellPeriod',
      label: 'Swell Period',
      value: surf?.swellPeriod ?? PLACEHOLDER,
      unit: 'sec',
      icon: IconSwellPeriod,
      live: hasLiveValue(surf?.swellPeriod),
    },
    {
      id: 'swellDirection',
      label: 'Swell Direction',
      value: surf?.swellDirection ?? PLACEHOLDER,
      icon: IconCompass,
      live: hasLiveValue(surf?.swellDirection),
    },
    {
      id: 'wind',
      label: 'Wind',
      value: surf?.wind ?? PLACEHOLDER,
      icon: IconWind,
      live: hasLiveValue(surf?.wind),
    },
    {
      id: 'temperature',
      label: 'Temperature',
      value: surf?.temperature ?? PLACEHOLDER,
      unit: '°C',
      icon: IconThermometer,
      live: hasLiveValue(surf?.temperature),
    },
  ];
}

function formatUpdatedLabel(isoTime, now) {
  if (!isoTime) return 'Live data';
  try {
    const relative = formatRelativeTime(isoTime, now);
    if (relative) return `Updated ${relative}`;

    const date = new Date(isoTime);
    const label = date.toLocaleString('en-GB', {
      timeZone: ISRAEL_TZ,
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
      hour12: false,
    });
    return `Updated ${label}`;
  } catch {
    return 'Live data';
  }
}

function MetricTile({ metric }) {
  const Icon = metric.icon;
  const isPlaceholder = metric.value === PLACEHOLDER;
  const isWaveHeight = metric.id === 'waveHeight';
  const waveDisplay = isWaveHeight ? metric.waveDisplay : null;
  const showWaveVisual = Boolean(waveDisplay);

  return (
    <article
      className={`metric ${metric.live ? 'metric--live' : 'metric--pending'} ${
        isWaveHeight ? 'metric--wave' : ''
      }`}
    >
      {showWaveVisual ? (
        <div className="metric__wave-visual" aria-hidden="true">
          {waveDisplay.type === 'image' ? (
            <img
              src={waveDisplay.imageUrl}
              alt={`${waveDisplay.genre} wave conditions`}
              className="metric__wave-image"
              loading="lazy"
            />
          ) : (
            <span
              className="metric__wave-emoji"
              style={{ fontSize: waveDisplay.emojiSize }}
            >
              {waveDisplay.emoji}
            </span>
          )}
        </div>
      ) : (
        <div className="metric__icon-wrap">
          <Icon />
        </div>
      )}
      <div className="metric__body">
        <span className="metric__label">{metric.label}</span>
        {showWaveVisual && (
          <span className="metric__wave-genre">{waveDisplay.genre}</span>
        )}
        <p className={`metric__value ${isPlaceholder ? 'metric__value--placeholder' : ''}`}>
          {metric.value}
          {metric.unit && !isPlaceholder && (
            <span className="metric__unit">{metric.unit}</span>
          )}
          {metric.unit && isPlaceholder && (
            <span className="metric__unit metric__unit--muted">{metric.unit}</span>
          )}
        </p>
        {showWaveVisual && waveDisplay.description && (
          <p className="metric__wave-desc">{waveDisplay.description}</p>
        )}
      </div>
    </article>
  );
}

function clearAuthStorage() {
  localStorage.removeItem('username');
  localStorage.removeItem('surfToken');
  localStorage.removeItem('surfUsername');
}

function getInitialAuthView() {
  const token = localStorage.getItem('surfToken');
  if (!token) {
    clearAuthStorage();
    return 'guest';
  }
  return 'checking';
}

function AuthCheckingScreen() {
  return (
    <div className="app">
      <div className="app__bg" aria-hidden="true">
        <div className="app__glow app__glow--1" />
        <div className="app__glow app__glow--2" />
        <div className="app__shimmer" />
      </div>
      <div className="shell">
        <main className="main">
          <section className="glass glass--centered" aria-busy="true">
            <div className="loader">
              <div className="loader__ring" />
              <p className="loader__text">Checking account…</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function AuthGate() {
  const [authView, setAuthView] = useState(getInitialAuthView);
  const [displayUsername, setDisplayUsername] = useState(
    () => localStorage.getItem('username') || ''
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [authRefreshing, setAuthRefreshing] = useState(false);

  const applySession = useCallback((user) => {
    if (user?.username) {
      localStorage.setItem('username', user.username);
      setDisplayUsername(user.username);
    }
    setIsAdmin(Boolean(user?.isAdmin));
    setAuthView(user?.isApproved ? 'approved' : 'pending');
  }, []);

  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem('surfToken');
    if (!token) {
      clearAuthStorage();
      setDisplayUsername('');
      setIsAdmin(false);
      setAuthView('guest');
      return;
    }

    setAuthRefreshing(true);
    try {
      const res = await fetch(AUTH_ME_API, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Session expired');
      }
      applySession(data.user);
    } catch {
      clearAuthStorage();
      setDisplayUsername('');
      setIsAdmin(false);
      setAuthView('guest');
    } finally {
      setAuthRefreshing(false);
    }
  }, [applySession]);

  useEffect(() => {
    if (authView === 'checking') {
      checkAuthStatus();
    }
  }, [authView, checkAuthStatus]);

  const handleAuthSuccess = useCallback((data) => {
    if (data.token) {
      localStorage.setItem('surfToken', data.token);
    }
    if (data.user?.username) {
      localStorage.setItem('username', data.user.username);
      setDisplayUsername(data.user.username);
    }
    setIsAdmin(Boolean(data.user?.isAdmin));
    setAuthView(data.user?.isApproved ? 'approved' : 'pending');
  }, []);

  const handleLogout = useCallback(() => {
    clearAuthStorage();
    setDisplayUsername('');
    setIsAdmin(false);
    setAuthView('guest');
  }, []);

  if (authView === 'guest') {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Register onSuccess={handleAuthSuccess} />} />
      </Routes>
    );
  }

  if (authView === 'checking') {
    return <AuthCheckingScreen />;
  }

  if (authView === 'pending') {
    return (
      <PendingApproval
        username={displayUsername}
        onLogout={handleLogout}
        onRefresh={checkAuthStatus}
        checking={authRefreshing}
      />
    );
  }

  if (authView === 'approved') {
    return (
      <Routes>
          <Route
            path="/"
            element={
              <DashboardApp
                username={displayUsername}
                onLogout={handleLogout}
                isAdmin={isAdmin}
              />
            }
          />
          <Route
            path="/admin"
            element={
              isAdmin ? (
                <AdminDashboard
                  username={displayUsername}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Register onSuccess={handleAuthSuccess} />} />
    </Routes>
  );
}

function PendingApproval({ username, onLogout, onRefresh, checking }) {
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
              <h1 className="topbar__title">Surf & Weather</h1>
              <p className="topbar__greeting">Hello, {username}</p>
            </div>
          </div>
          <div className="topbar__actions">
            <button type="button" className="topbar__logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>
        <main className="main">
          <section className="glass glass--centered auth-pending" aria-live="polite">
            <h2 className="auth-pending__title">Waiting for Admin Approval</h2>
            <p className="auth-pending__text">
              Your account is registered. An admin must approve your access before you
              can use the dashboard and chat.
            </p>
            <button
              type="button"
              className="auth-pending__refresh"
              onClick={onRefresh}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check status again'}
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}

function formatForecastUpdated(isoTime) {
  if (!isoTime) return null;
  try {
    return new Date(isoTime).toLocaleString('en-GB', {
      timeZone: ISRAEL_TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return null;
  }
}

function DashboardApp({ username, onLogout, isAdmin }) {
  const [currentSpot, setCurrentSpot] = useState('Netanya');
  const [surf, setSurf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [managerForecast, setManagerForecast] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const isFirstLoad = useRef(true);

  const fetchSurf = useCallback(async (spot, { isInitial = false } = {}) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}?spot=${encodeURIComponent(spot)}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      if (data.error) {
        throw new Error(data.message || 'Failed to load surf data');
      }

      setSurf(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSurf(currentSpot, { isInitial: isFirstLoad.current });
    isFirstLoad.current = false;
  }, [currentSpot, fetchSurf]);

  useEffect(() => {
    let cancelled = false;

    async function fetchForecast() {
      try {
        const res = await fetch(FORECAST_API);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Unable to load forecast');
        }
        if (!cancelled) {
          setManagerForecast(data.forecast ?? null);
        }
      } catch {
        if (!cancelled) {
          setManagerForecast(null);
        }
      }
    }

    fetchForecast();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(tick);
  }, []);

  const handleSpotChange = (e) => {
    setCurrentSpot(e.target.value);
  };

  const metrics = buildMetrics(surf);
  const israelClock = formatIsraelClock(now);
  const updatedLabel = refreshing
    ? 'Updating…'
    : formatUpdatedLabel(surf?.updatedAt, now);
  const coordsLabel =
    surf?.latitude != null && surf?.longitude != null
      ? `${surf.latitude}°, ${surf.longitude}°`
      : null;

  const showInitialLoader = loading && !surf;
  const showDashboard = Boolean(surf);
  const showErrorOnly = error && !surf;
  const forecastUpdatedLabel = formatForecastUpdated(managerForecast?.updatedAt);

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
              <h1 className="topbar__title">Surf & Weather</h1>
              <p className="topbar__greeting">Hello, {username}</p>
            </div>
          </div>
          <div className="topbar__actions">
            {isAdmin && (
              <Link to="/admin" className="topbar__admin-link">
                Admin
              </Link>
            )}
            <button
              type="button"
              className="topbar__logout-btn"
              onClick={onLogout}
            >
              Logout
            </button>
            <div className="topbar__status">
              <time className="topbar__clock" dateTime={now.toISOString()}>
                {israelClock}
              </time>
              <span className="topbar__tz">Israel</span>
              <span className="topbar__status-divider" aria-hidden="true" />
              <span className="topbar__live">
                <span className="topbar__dot" />
                Live
              </span>
            </div>
          </div>
        </header>

        <main className="main">
          {showInitialLoader && (
            <section className="glass glass--centered" aria-busy="true" aria-label="Loading">
              <div className="loader">
                <div className="loader__ring" />
                <p className="loader__text">Fetching conditions…</p>
              </div>
            </section>
          )}

          {showErrorOnly && (
            <section className="glass glass--centered glass--error" role="alert">
              <p className="glass__error-title">Unable to load surf data</p>
              <p className="glass__error-detail">{error}</p>
              <p className="glass__error-hint">Start the backend with <code>npm start</code> in the backend folder.</p>
            </section>
          )}

          {managerForecast?.text && (
            <section className="manager-forecast" aria-labelledby="manager-forecast-heading">
              <div className="manager-forecast__header">
                <span className="manager-forecast__badge">Manager Update</span>
                <h2 id="manager-forecast-heading" className="manager-forecast__title">
                  Manager&apos;s Forecast
                </h2>
                {forecastUpdatedLabel && (
                  <time
                    className="manager-forecast__time"
                    dateTime={managerForecast.updatedAt}
                  >
                    Updated {forecastUpdatedLabel}
                  </time>
                )}
              </div>
              <p className="manager-forecast__text">{managerForecast.text}</p>
            </section>
          )}

          {showDashboard && (
            <section
              className={`glass ${refreshing ? 'glass--refreshing' : ''}`}
              aria-label="Beach conditions"
              aria-busy={refreshing}
            >
              <div className="glass__header">
                <div className="glass__location">
                  <span className="glass__pin" aria-hidden="true">
                    <IconPin />
                  </span>
                  <div className="glass__location-text">
                    <label className="glass__eyebrow" htmlFor="spot-select">
                      Select spot
                    </label>
                    <div className="spot-select-wrap">
                      <select
                        id="spot-select"
                        className="spot-select"
                        value={currentSpot}
                        onChange={handleSpotChange}
                        disabled={refreshing}
                        aria-label="Choose surf spot"
                      >
                        {SPOTS.map((spot) => (
                          <option key={spot.id} value={spot.id}>
                            {spot.label}
                          </option>
                        ))}
                      </select>
                      <span className="spot-select__chevron" aria-hidden="true">
                        <IconChevron />
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`glass__chip ${refreshing ? 'glass__chip--pulse' : ''}`}>
                  {refreshing && <span className="glass__chip-spinner" aria-hidden="true" />}
                  {updatedLabel}
                </div>
              </div>

              {surf?.partial && !refreshing && (
                <p className="glass__partial" role="status">
                  Some data sources are temporarily unavailable. Showing available readings.
                </p>
              )}

              <div className="glass__divider" />

              <div className={`metrics-panel ${refreshing ? 'metrics-panel--loading' : ''}`}>
                {refreshing && (
                  <div className="metrics-panel__overlay" aria-hidden="true">
                    <div className="metrics-panel__spinner" />
                  </div>
                )}
                <div className="metrics-grid">
                  {metrics.map((metric) => (
                    <MetricTile key={metric.id} metric={metric} />
                  ))}
                </div>
              </div>

              <p className="glass__footnote">
                Live conditions via{' '}
                <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                  Open-Meteo
                </a>{' '}
                Marine &amp; Weather APIs
                {coordsLabel && (
                  <>
                    {' '}
                    · {surf.beach} ({coordsLabel})
                  </>
                )}
              </p>
            </section>
          )}

          {error && surf && (
            <p className="glass__inline-error" role="alert">
              Could not refresh {currentSpot}: {error}
            </p>
          )}
        </main>

        <footer className="footer">
          <span>© SurfForceast</span>
          <span className="footer__sep">·</span>
          <span>Ocean conditions dashboard</span>
        </footer>
      </div>

      {showDashboard && (
        <ChatWidget
          currentSpot={currentSpot}
          username={username}
          now={now}
          formatMessageTimestamp={formatMessageTimestamp}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}
