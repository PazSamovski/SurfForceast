import { useEffect, useState } from 'react';
import {
  fetchNotificationStatus,
  subscribeToPushNotifications,
} from './pushNotifications';

export default function PushSubscribeBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return;
      }

      try {
        const { subscribed } = await fetchNotificationStatus();
        if (!cancelled && !subscribed) {
          setVisible(true);
        }
      } catch {
        /* ignore */
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe() {
    setError('');
    setLoading(true);
    try {
      await subscribeToPushNotifications();
      setVisible(false);
    } catch (err) {
      setError(err.message || 'Unable to enable notifications.');
    } finally {
      setLoading(false);
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <section className="push-subscribe-banner card" aria-labelledby="push-banner-title">
      <div className="push-subscribe-banner__content">
        <p id="push-banner-title" className="push-subscribe-banner__text">
          תרצה לקבל התראות על שינויים בים בזמן אמת?
        </p>
        <button
          type="button"
          className="push-subscribe-banner__btn"
          onClick={handleSubscribe}
          disabled={loading}
        >
          {loading ? 'מאשר...' : 'כן, תעדכן אותי!'}
        </button>
      </div>
      {error ? (
        <p className="push-subscribe-banner__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
