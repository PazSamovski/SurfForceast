import { useState } from 'react';
import { getAuthHeaders } from '../auth.js';

const SEND_NOTIFICATION_API = '/api/notifications/send';

export default function SendGlobalNotification() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(SEND_NOTIFICATION_API, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ body: message }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Unable to send notification.');
      }

      setResult(data.message || 'Notification sent.');
      setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="glass admin-push" aria-labelledby="admin-push-heading">
      <div className="admin-push__header">
        <div>
          <h2 id="admin-push-heading" className="admin-push__title">
            Send Global Notification
          </h2>
          <p className="admin-push__subtitle">
            Deliver a push alert to every user who enabled notifications.
          </p>
        </div>
      </div>

      {error && (
        <p className="admin-panel__error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <p className="admin-forecast__success" role="status">
          {result}
        </p>
      )}

      <form className="admin-push__form" onSubmit={handleSubmit}>
        <label className="admin-push__field" htmlFor="global-push-message">
          <span className="admin-push__label">Message</span>
          <textarea
            id="global-push-message"
            className="admin-push__textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Waves picking up at Netanya — good afternoon session!"
            rows={4}
            maxLength={500}
            disabled={sending}
            required
          />
        </label>
        <div className="admin-push__actions">
          <button
            type="submit"
            className="admin-push__send"
            disabled={sending || !message.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}
