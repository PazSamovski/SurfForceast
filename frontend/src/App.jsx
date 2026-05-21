import { useCallback, useEffect, useRef, useState } from 'react';
import Register from './Register.jsx';
import './App.css';

const API_BASE = '/api/surf';
const CHAT_API = '/api/chat';
const DEFAULT_CHAT_USER = 'Local Surfer';

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

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
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
  return [
    {
      id: 'waveHeight',
      label: 'Wave Height',
      value: surf?.waveHeight ?? PLACEHOLDER,
      icon: IconWave,
      live: hasLiveValue(surf?.waveHeight),
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

  return (
    <article className={`metric ${metric.live ? 'metric--live' : 'metric--pending'}`}>
      <div className="metric__icon-wrap">
        <Icon />
      </div>
      <div className="metric__body">
        <span className="metric__label">{metric.label}</span>
        <p className={`metric__value ${isPlaceholder ? 'metric__value--placeholder' : ''}`}>
          {metric.value}
          {metric.unit && !isPlaceholder && (
            <span className="metric__unit">{metric.unit}</span>
          )}
          {metric.unit && isPlaceholder && (
            <span className="metric__unit metric__unit--muted">{metric.unit}</span>
          )}
        </p>
      </div>
    </article>
  );
}

function App() {
  const [view, setView] = useState('dashboard');
  const [currentSpot, setCurrentSpot] = useState('Netanya');
  const [surf, setSurf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(
    () => localStorage.getItem('surfUsername') || DEFAULT_CHAT_USER
  );
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const isFirstLoad = useRef(true);
  const chatEndRef = useRef(null);
  const imageInputRef = useRef(null);

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
    const tick = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchChat() {
      setChatLoading(true);
      setChatError(null);

      try {
        const res = await fetch(
          `${CHAT_API}?spot=${encodeURIComponent(currentSpot)}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }

        if (!cancelled) {
          setMessages(data.messages ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setChatError(err.message);
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setChatLoading(false);
        }
      }
    }

    fetchChat();
    return () => {
      cancelled = true;
    };
  }, [currentSpot]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentSpot]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const clearImageSelection = useCallback(() => {
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImageFile(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, []);

  const handleSpotChange = (e) => {
    setCurrentSpot(e.target.value);
    clearImageSelection();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setImageFile(file);
  };

  const canSend = Boolean(chatInput.trim() || imageFile);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const trimmedMessage = chatInput.trim();
    const trimmedUser = chatUser.trim() || DEFAULT_CHAT_USER;

    if (!canSend || sending) return;

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      spot: currentSpot,
      user: trimmedUser,
      message: trimmedMessage,
      timestamp: new Date().toISOString(),
      ...(imagePreviewUrl && { imageUrl: imagePreviewUrl }),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setChatInput('');
    setSending(true);
    setChatError(null);

    const formData = new FormData();
    formData.append('spot', currentSpot);
    formData.append('user', trimmedUser);
    formData.append('message', trimmedMessage);
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticId ? data : msg))
      );
      clearImageSelection();
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      setChatError(err.message);
      setChatInput(trimmedMessage);
    } finally {
      setSending(false);
    }
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
            </div>
          </div>
          <div className="topbar__actions">
            {view === 'dashboard' && (
              <button
                type="button"
                className="topbar__auth-btn"
                onClick={() => setView('register')}
              >
                Register
              </button>
            )}
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
          {view === 'register' && (
            <Register
              onBack={() => setView('dashboard')}
              onSuccess={(data) => {
                if (data?.user?.username) {
                  setChatUser(data.user.username);
                }
                setView('dashboard');
              }}
            />
          )}

          {view === 'dashboard' && showInitialLoader && (
            <section className="glass glass--centered" aria-busy="true" aria-label="Loading">
              <div className="loader">
                <div className="loader__ring" />
                <p className="loader__text">Fetching conditions…</p>
              </div>
            </section>
          )}

          {view === 'dashboard' && showErrorOnly && (
            <section className="glass glass--centered glass--error" role="alert">
              <p className="glass__error-title">Unable to load surf data</p>
              <p className="glass__error-detail">{error}</p>
              <p className="glass__error-hint">Start the backend with <code>npm start</code> in the backend folder.</p>
            </section>
          )}

          {view === 'dashboard' && showDashboard && (
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

              <div className="glass__divider glass__divider--chat" />

              <section className="chat" aria-label="Live community chat">
                <div className="chat__header">
                  <span className="chat__icon" aria-hidden="true">
                    <IconChat />
                  </span>
                  <div>
                    <h3 className="chat__title">Live Community Chat</h3>
                    <p className="chat__subtitle">{currentSpot} · share conditions with locals</p>
                  </div>
                </div>

                <div
                  className="chat__messages"
                  aria-live="polite"
                  aria-busy={chatLoading}
                >
                  {chatLoading && (
                    <p className="chat__placeholder">Loading conversation…</p>
                  )}

                  {!chatLoading && messages.length === 0 && (
                    <p className="chat__placeholder">
                      Be the first to report conditions here!
                    </p>
                  )}

                  {!chatLoading &&
                    messages.map((msg) => {
                      const ts = formatMessageTimestamp(msg.timestamp, now);
                      return (
                      <article key={msg.id} className="chat__bubble">
                        <div className="chat__bubble-meta">
                          <span className="chat__bubble-user">{msg.user}</span>
                          <time className="chat__bubble-datetime" dateTime={msg.timestamp}>
                            {ts.relative ? (
                              <span className="chat__bubble-relative">{ts.relative}</span>
                            ) : (
                              <>
                                {ts.date && (
                                  <span className="chat__bubble-date">{ts.date}</span>
                                )}
                                {ts.time && (
                                  <span className="chat__bubble-time">{ts.time}</span>
                                )}
                              </>
                            )}
                          </time>
                        </div>
                        {msg.imageUrl && (
                          <a
                            href={msg.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="chat__bubble-image-link"
                          >
                            <img
                              src={msg.imageUrl}
                              alt="Surf conditions shared in chat"
                              className="chat__bubble-image"
                              loading="lazy"
                            />
                          </a>
                        )}
                        {msg.message ? (
                          <p className="chat__bubble-text">{msg.message}</p>
                        ) : null}
                      </article>
                    );
                    })}

                  <div ref={chatEndRef} />
                </div>

                {chatError && (
                  <p className="chat__error" role="alert">
                    {chatError}
                  </p>
                )}

                <form className="chat__form" onSubmit={handleSendMessage}>
                  <label className="chat__field chat__field--name">
                    <span className="chat__label">Your name</span>
                    <input
                      type="text"
                      className="chat__input"
                      value={chatUser}
                      onChange={(e) => setChatUser(e.target.value)}
                      placeholder={DEFAULT_CHAT_USER}
                      maxLength={40}
                      disabled={sending}
                    />
                  </label>

                  {imagePreviewUrl && imageFile && (
                    <div className="chat__preview">
                      <img
                        src={imagePreviewUrl}
                        alt=""
                        className="chat__preview-thumb"
                      />
                      <div className="chat__preview-meta">
                        <span className="chat__preview-name">{imageFile.name}</span>
                        <button
                          type="button"
                          className="chat__preview-remove"
                          onClick={clearImageSelection}
                          disabled={sending}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="chat__compose">
                    <div className="chat__attach-wrap">
                      <input
                        ref={imageInputRef}
                        id="chat-image-input"
                        type="file"
                        accept="image/*"
                        className="chat__file-input"
                        onChange={handleImageSelect}
                        disabled={sending}
                        aria-label="Attach surf photo"
                      />
                      <label
                        htmlFor="chat-image-input"
                        className={`chat__attach ${imageFile ? 'chat__attach--active' : ''}`}
                        title="Attach photo"
                      >
                        <IconCamera />
                      </label>
                    </div>

                    <label className="chat__field chat__field--grow">
                      <span className="chat__label">Message</span>
                      <input
                        type="text"
                        className="chat__input"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Glassy morning, light offshore…"
                        maxLength={500}
                        disabled={sending}
                      />
                    </label>
                    <button
                      type="submit"
                      className="chat__send"
                      disabled={sending || !canSend}
                    >
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </form>
              </section>

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

          {view === 'dashboard' && error && surf && (
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
    </div>
  );
}

export default App;
