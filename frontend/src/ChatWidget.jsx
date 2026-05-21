import { useCallback, useEffect, useRef, useState } from 'react';
import './ChatWidget.css';

const CHAT_API = '/api/chat';

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

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChatWidget({
  currentSpot,
  username,
  now,
  formatMessageTimestamp,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const chatEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const drawerRef = useRef(null);

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

  const fetchChat = useCallback(async () => {
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

      setMessages(data.messages ?? []);
      setHasLoadedOnce(true);
    } catch (err) {
      setChatError(err.message);
      setMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, [currentSpot]);

  useEffect(() => {
    if (open) {
      fetchChat();
    }
  }, [open, currentSpot, fetchChat]);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentSpot, open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

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

    if (!canSend || sending) return;

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      spot: currentSpot,
      user: username,
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
    formData.append('user', username);
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

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen(true)}
        aria-label="Open community chat"
        aria-expanded={open}
        aria-controls="community-chat-drawer"
      >
        <IconChat />
        <span className="chat-fab__label">Chat</span>
      </button>

      {open && (
        <div className="chat-drawer-root">
          <button
            type="button"
            className="chat-drawer__backdrop"
            onClick={close}
            aria-label="Close chat"
          />

          <aside
            id="community-chat-drawer"
            ref={drawerRef}
            className="chat-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-drawer-title"
          >
            <header className="chat-drawer__header">
              <div className="chat-drawer__title-wrap">
                <span className="chat-drawer__icon" aria-hidden="true">
                  <IconChat />
                </span>
                <div>
                  <h2 id="chat-drawer-title" className="chat-drawer__title">
                    Community Chat
                  </h2>
                  <p className="chat-drawer__subtitle">
                    {currentSpot} · share conditions with locals
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="chat-drawer__close"
                onClick={close}
                aria-label="Close chat"
              >
                <IconClose />
              </button>
            </header>

            <div
              className="chat-drawer__messages"
              aria-live="polite"
              aria-busy={chatLoading}
            >
              {chatLoading && !hasLoadedOnce && (
                <p className="chat-drawer__placeholder">Loading conversation…</p>
              )}

              {!chatLoading && messages.length === 0 && (
                <p className="chat-drawer__placeholder">
                  Be the first to report conditions here!
                </p>
              )}

              {messages.map((msg) => {
                const ts = formatMessageTimestamp(msg.timestamp, now);
                return (
                  <article key={msg.id} className="chat-drawer__bubble">
                    <div className="chat-drawer__bubble-meta">
                      <span className="chat-drawer__bubble-user">{msg.user}</span>
                      <time className="chat-drawer__bubble-datetime" dateTime={msg.timestamp}>
                        {ts.relative ? (
                          <span className="chat-drawer__bubble-relative">{ts.relative}</span>
                        ) : (
                          <>
                            {ts.date && (
                              <span className="chat-drawer__bubble-date">{ts.date}</span>
                            )}
                            {ts.time && (
                              <span className="chat-drawer__bubble-time">{ts.time}</span>
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
                        className="chat-drawer__bubble-image-link"
                      >
                        <img
                          src={msg.imageUrl}
                          alt="Surf conditions shared in chat"
                          className="chat-drawer__bubble-image"
                          loading="lazy"
                        />
                      </a>
                    )}
                    {msg.message ? (
                      <p className="chat-drawer__bubble-text">{msg.message}</p>
                    ) : null}
                  </article>
                );
              })}

              <div ref={chatEndRef} />
            </div>

            {chatError && (
              <p className="chat-drawer__error" role="alert">
                {chatError}
              </p>
            )}

            <form className="chat-drawer__form" onSubmit={handleSendMessage}>
              <p className="chat-drawer__posting-as">
                Posting as <strong>{username}</strong>
              </p>

              {imagePreviewUrl && imageFile && (
                <div className="chat-drawer__preview">
                  <img
                    src={imagePreviewUrl}
                    alt=""
                    className="chat-drawer__preview-thumb"
                  />
                  <div className="chat-drawer__preview-meta">
                    <span className="chat-drawer__preview-name">{imageFile.name}</span>
                    <button
                      type="button"
                      className="chat-drawer__preview-remove"
                      onClick={clearImageSelection}
                      disabled={sending}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <div className="chat-drawer__compose">
                <div className="chat-drawer__attach-wrap">
                  <input
                    ref={imageInputRef}
                    id="chat-widget-image-input"
                    type="file"
                    accept="image/*"
                    className="chat-drawer__file-input"
                    onChange={handleImageSelect}
                    disabled={sending}
                    aria-label="Attach surf photo"
                  />
                  <label
                    htmlFor="chat-widget-image-input"
                    className={`chat-drawer__attach ${imageFile ? 'chat-drawer__attach--active' : ''}`}
                    title="Attach photo"
                  >
                    <IconCamera />
                  </label>
                </div>

                <label className="chat-drawer__field chat-drawer__field--grow">
                  <span className="chat-drawer__label">Message</span>
                  <input
                    type="text"
                    className="chat-drawer__input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Glassy morning, light offshore…"
                    maxLength={500}
                    disabled={sending}
                  />
                </label>
                <button
                  type="submit"
                  className="chat-drawer__send"
                  disabled={sending || !canSend}
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

export default ChatWidget;
