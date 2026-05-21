import { getAuthHeaders } from './auth';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
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
  if (!keyRes.ok) {
    throw new Error('Unable to load push configuration.');
  }
  const { publicKey } = await keyRes.json();
  if (!publicKey) {
    throw new Error('Push is not configured on the server.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

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
