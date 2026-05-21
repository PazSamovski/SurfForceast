/**
 * Normalize and validate VAPID P-256 public keys (base64url, 65-byte uncompressed point).
 */

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

function urlBase64ToBuffer(base64url) {
  const normalized = normalizeVapidPublicKey(base64url);
  if (!normalized) {
    throw new Error('VAPID public key is empty.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error(
      'VAPID public key must be base64url (A–Z, a–z, 0–9, -, _). Remove quotes, spaces, or PEM headers.'
    );
  }
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const standard = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(standard, 'base64');
}

function isValidP256ApplicationServerKey(key) {
  try {
    const buf = urlBase64ToBuffer(key);
    return buf.length === 65 && buf[0] === 0x04;
  } catch {
    return false;
  }
}

module.exports = {
  normalizeVapidPublicKey,
  urlBase64ToBuffer,
  isValidP256ApplicationServerKey,
};
