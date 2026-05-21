const webpush = require('web-push');
const {
  normalizeVapidPublicKey,
  isValidP256ApplicationServerKey,
} = require('./vapidKey');

let publicKey = '';
let privateKey = '';
let vapidSubject = '';
let configuredFromEnv = false;

function readVapidFromEnv() {
  const envPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
  const envSubject = (process.env.VAPID_SUBJECT || '').trim();

  const subject =
    envSubject ||
    (adminEmail ? `mailto:${adminEmail}` : 'mailto:surfforecast@example.com');

  return { envPublic, envPrivate, subject };
}

function ensureVapidKeys() {
  const { envPublic, envPrivate, subject } = readVapidFromEnv();

  if (envPublic && envPrivate) {
    publicKey = normalizeVapidPublicKey(envPublic);
    privateKey = normalizeVapidPublicKey(envPrivate);
    vapidSubject = subject;
    configuredFromEnv = true;

    if (!isValidP256ApplicationServerKey(publicKey)) {
      console.error(
        'Web Push: VAPID_PUBLIC_KEY is not a valid P-256 application server key (65-byte uncompressed point as base64url).'
      );
      configuredFromEnv = false;
    } else {
      webpush.setVapidDetails(vapidSubject, publicKey, privateKey);
      console.log('Web Push: VAPID keys loaded from environment (VAPID_SUBJECT).');
      return { publicKey, privateKey, subject: vapidSubject, configuredFromEnv: true };
    }
  }

  const generated = webpush.generateVAPIDKeys();
  publicKey = generated.publicKey;
  privateKey = generated.privateKey;
  vapidSubject = subject;
  configuredFromEnv = false;
  webpush.setVapidDetails(vapidSubject, publicKey, privateKey);

  console.warn(
    'Web Push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — using ephemeral keys. ' +
      'Subscriptions will stop working after each deploy/restart until stable keys are configured.'
  );
  console.warn('VAPID_PUBLIC_KEY=' + publicKey);
  console.warn('VAPID_PRIVATE_KEY=' + privateKey);

  return { publicKey, privateKey, subject: vapidSubject, configuredFromEnv: false };
}

function getPublicKey() {
  return publicKey;
}

function isVapidConfigured() {
  return configuredFromEnv;
}

async function sendPushNotification(subscription, payload) {
  if (!configuredFromEnv) {
    throw new Error('VAPID keys are not configured on the server.');
  }
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}

module.exports = {
  ensureVapidKeys,
  getPublicKey,
  isVapidConfigured,
  sendPushNotification,
};
