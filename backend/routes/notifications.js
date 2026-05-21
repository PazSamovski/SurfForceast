const express = require('express');
const {
  getPublicKey,
  isVapidConfigured,
} = require('../lib/webPush');
const {
  normalizeVapidPublicKey,
  isValidP256ApplicationServerKey,
} = require('../lib/vapidKey');

const router = express.Router();

router.get('/vapid-public-key', (req, res) => {
  if (!isVapidConfigured()) {
    return res.status(503).json({
      error: true,
      message: 'Push notifications are not configured on the server.',
    });
  }

  const publicKey = normalizeVapidPublicKey(getPublicKey());

  if (!publicKey || !isValidP256ApplicationServerKey(publicKey)) {
    console.error(
      'GET /api/notifications/vapid-public-key: VAPID_PUBLIC_KEY is missing or not a valid P-256 base64url key.'
    );
    return res.status(503).json({
      error: true,
      message: 'Push notifications are misconfigured. Check VAPID_PUBLIC_KEY on the server.',
    });
  }

  res.json({ publicKey });
});

module.exports = router;
