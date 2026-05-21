import { getAuthHeaders } from './auth';

function normalizeVapidPublicKey(key) {
  if (key == null) return '';
  let s = String(key).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s+/g, '');
}

/**
 * Decode a VAPID / applicationServerKey from base64url to Uint8Array (65-byte P-256 point).
 */
function urlBase64ToUint8Array(base64String) {
  const normalized = normalizeVapidPublicKey(base64String);
  if (!normalized) {
    throw new Error('VAPID public key is missing.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error(
      'Invalid VAPID public key format. Expected base64url (no +, /, spaces, or quotes).'
    );
  }

  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const standard = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(standard);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  if (output.length !== 65 || output[0] !== 0x04) {
    throw new Error(
      'VAPID public key is not a valid P-256 key. Use the public key from `npx web-push generate-vapid-keys` (not the private key).'
    );
  }

  return output;
}

export async function fetchNotificationStatus() {
  const res = await fetch('/api/notifications/status', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    return { subscribed: false };
  }
  return res.json();
}

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied.');
  }

  const keyRes = await fetch('/api/notifications/vapid-public-key');
  const keyPayload = await keyRes.json().catch(() => ({}));

  if (!keyRes.ok) {
    throw new Error(
      keyPayload.message || 'Unable to load push configuration.'
    );
  }

  const publicKey = normalizeVapidPublicKey(keyPayload.publicKey);
  console.log('[push] VAPID publicKey from API:', publicKey || '(undefined)');

  if (!publicKey) {
    throw new Error('Push is not configured on the server (publicKey missing).');
  }

  let applicationServerKey;
  try {
    applicationServerKey = urlBase64ToUint8Array(publicKey);
  } catch (err) {
    console.error('[push] Failed to decode VAPID publicKey:', err.message);
    throw err;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await subscription.unsubscribe();
    subscription = null;
  }

  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const res = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Unable to enable notifications.');
  }

  return data;
}
