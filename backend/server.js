const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env'),
  override: true,
});

const crypto = require('crypto');
const dns = require('dns');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const fs = require('fs').promises;
const ChatMessage = require('./models/ChatMessage');
const User = require('./models/User');
const PasswordResetToken = require('./models/PasswordResetToken');
const ManagerForecast = require('./models/ManagerForecast');
const PushSubscription = require('./models/PushSubscription');
const {
  ensureVapidKeys,
  isVapidConfigured,
  sendPushNotification,
} = require('./lib/webPush');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Use public DNS — many routers block Atlas SRV lookups (querySrv ECONNREFUSED)
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only this email may approve users — set ADMIN_EMAIL in .env to your address
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildResetUrl(req, token) {
  const configuredBase = (process.env.APP_BASE_URL || '').trim();
  const base = configuredBase || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}

function formatUserResponse(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    isApproved: Boolean(user.isApproved),
    isAdmin: Boolean(
      ADMIN_EMAIL && user.email?.toLowerCase() === ADMIN_EMAIL
    ),
  };
}

async function requireAdminUser(userId) {
  if (!ADMIN_EMAIL) {
    return { error: { status: 500, message: 'ADMIN_EMAIL is not configured on the server.' } };
  }

  const user = await User.findById(userId).select('-password');

  if (!user) {
    return { error: { status: 404, message: 'User not found.' } };
  }

  if (user.email.toLowerCase() !== ADMIN_EMAIL) {
    return { error: { status: 403, message: 'Only the authorized admin can access this resource.' } };
  }

  return { user };
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required.',
    });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({
      error: true,
      message: 'Invalid or expired session. Please log in again.',
    });
  }
}

const SPOTS = {
  netanya: {
    beach: 'Netanya',
    latitude: 32.324,
    longitude: 34.855,
  },
  'tel-aviv': {
    beach: 'Tel Aviv',
    latitude: 32.08,
    longitude: 34.765,
  },
  haifa: {
    beach: 'Haifa',
    latitude: 32.83,
    longitude: 34.97,
  },
  ashdod: {
    beach: 'Ashdod',
    latitude: 31.8,
    longitude: 34.633,
  },
};

const DEFAULT_SPOT_KEY = 'netanya';
const ISRAEL_TZ = 'Asia/Jerusalem';
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const FRONTEND_DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const CHAT_SPOT_NAMES = ['Netanya', 'Tel Aviv', 'Haifa', 'Ashdod'];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
});

const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

app.use(cors());
app.use(express.json());

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

async function uploadImageToCloudinary(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'surf-forecast-chat',
  });
  return result.secure_url;
}

async function removeLocalFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to remove temp upload:', err.message);
    }
  }
}

function resolveSpot(spotParam) {
  if (!spotParam) {
    return { key: DEFAULT_SPOT_KEY, ...SPOTS[DEFAULT_SPOT_KEY] };
  }

  const normalized = String(spotParam).toLowerCase().trim().replace(/\s+/g, '-');
  const spot = SPOTS[normalized];

  if (spot) {
    return { key: normalized, ...spot };
  }

  return { key: DEFAULT_SPOT_KEY, ...SPOTS[DEFAULT_SPOT_KEY] };
}

function resolveChatSpot(spotParam) {
  return resolveSpot(spotParam).beach;
}

function getIsraelCalendarDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isMessageFromToday(createdAt) {
  try {
    const messageDay = getIsraelCalendarDate(new Date(createdAt));
    const today = getIsraelCalendarDate();
    return messageDay === today;
  } catch {
    return false;
  }
}

function formatMessageForApi(doc) {
  return {
    id: doc._id.toString(),
    spot: doc.spot,
    user: doc.user,
    message: doc.message,
    timestamp: doc.createdAt.toISOString(),
    ...(doc.imageUrl && { imageUrl: doc.imageUrl }),
  };
}

async function pruneOldMessages(spotName) {
  const safeSpot = CHAT_SPOT_NAMES.includes(spotName) ? spotName : 'Netanya';
  const spotMessages = await ChatMessage.find({ spot: safeSpot }).select('_id createdAt');

  const oldIds = spotMessages
    .filter((doc) => !isMessageFromToday(doc.createdAt))
    .map((doc) => doc._id);

  if (oldIds.length > 0) {
    await ChatMessage.deleteMany({ _id: { $in: oldIds } });
  }

  return safeSpot;
}

async function getTodayMessagesForSpot(spotName) {
  const safeSpot = await pruneOldMessages(spotName);
  const messages = await ChatMessage.find({ spot: safeSpot }).sort({ createdAt: 1 });
  return {
    spotName: safeSpot,
    messages: messages.map(formatMessageForApi),
  };
}

function degreesToCompass(degrees) {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function formatValue(value, formatter) {
  if (value == null || Number.isNaN(value)) return null;
  return formatter(value);
}

function getWaveGenre(waveHeightMeters) {
  if (waveHeightMeters == null || Number.isNaN(waveHeightMeters)) {
    return null;
  }
  if (waveHeightMeters < 1) return 'Small';
  if (waveHeightMeters <= 2) return 'Medium';
  return 'Big';
}

function buildSurfPayload(spot, marineCurrent, weatherCurrent) {
  const waveHeightMeters = marineCurrent?.wave_height ?? null;
  const waveGenre = getWaveGenre(waveHeightMeters);
  const swellPeriod = marineCurrent?.swell_wave_period;
  const swellDirection = marineCurrent?.swell_wave_direction;
  const windSpeed = weatherCurrent?.wind_speed_10m;
  const temperature = weatherCurrent?.temperature_2m;
  const updatedAt = marineCurrent?.time ?? weatherCurrent?.time ?? null;

  return {
    beach: spot.beach,
    spot: spot.key,
    latitude: spot.latitude,
    longitude: spot.longitude,
    waveHeightMeters,
    waveGenre,
    waveHeight: formatValue(waveHeightMeters, (v) => `${v.toFixed(1)} m`),
    swellPeriod: formatValue(swellPeriod, (v) => v.toFixed(1)),
    swellDirection: formatValue(swellDirection, (v) => {
      const compass = degreesToCompass(v);
      return `${compass} (${Math.round(v)}°)`;
    }),
    wind: formatValue(windSpeed, (v) => `${Math.round(v)} km/h`),
    temperature: formatValue(temperature, (v) => `${Math.round(v)}`),
    updatedAt,
  };
}

async function fetchMarineData(spot) {
  const { data } = await axios.get(MARINE_API, {
    params: {
      latitude: spot.latitude,
      longitude: spot.longitude,
      current: 'wave_height,swell_wave_period,swell_wave_direction',
      timezone: 'Asia/Jerusalem',
    },
    timeout: 10000,
  });
  return data?.current ?? null;
}

async function fetchWeatherData(spot) {
  const { data } = await axios.get(WEATHER_API, {
    params: {
      latitude: spot.latitude,
      longitude: spot.longitude,
      current: 'temperature_2m,wind_speed_10m',
      timezone: 'Asia/Jerusalem',
    },
    timeout: 10000,
  });
  return data?.current ?? null;
}

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};
    const trimmedUsername = String(username ?? '').trim();
    const trimmedEmail = String(email ?? '').trim().toLowerCase();
    const trimmedPassword = String(password ?? '');

    if (!trimmedUsername || !trimmedEmail || !trimmedPassword) {
      return res.status(400).json({
        error: true,
        message: 'Username, email, and password are required.',
      });
    }

    if (trimmedUsername.length < 3) {
      return res.status(400).json({
        error: true,
        message: 'Username must be at least 3 characters.',
      });
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        error: true,
        message: 'Please provide a valid email address.',
      });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({
        error: true,
        message: 'Password must be at least 6 characters.',
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: trimmedEmail }, { username: trimmedUsername }],
    });

    if (existingUser) {
      const field =
        existingUser.email === trimmedEmail ? 'Email' : 'Username';
      return res.status(409).json({
        error: true,
        message: `${field} is already registered.`,
      });
    }

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    const user = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      password: hashedPassword,
      isApproved: false,
    });

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message:
        'Account created. Waiting for admin approval before you can access the app.',
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern?.email ? 'Email' : 'Username';
      return res.status(409).json({
        error: true,
        message: `${field} is already registered.`,
      });
    }

    console.error('POST /api/register error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to create account. Please try again.',
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const trimmedEmail = String(email ?? '').trim().toLowerCase();
    const trimmedPassword = String(password ?? '');

    if (!trimmedEmail || !trimmedPassword) {
      return res.status(400).json({
        error: true,
        message: 'Email and password are required.',
      });
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        error: true,
        message: 'Please provide a valid email address.',
      });
    }

    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.status(401).json({
        error: true,
        message: 'Invalid email or password.',
      });
    }

    const passwordMatch = await bcrypt.compare(trimmedPassword, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: true,
        message: 'Invalid email or password.',
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: user.isApproved
        ? 'Welcome back!'
        : 'Logged in. Waiting for admin approval before you can access the app.',
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error('POST /api/login error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to log in. Please try again.',
    });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const trimmedEmail = String(req.body?.email ?? '').trim().toLowerCase();

    if (!trimmedEmail) {
      return res.status(400).json({
        error: true,
        message: 'Email is required.',
      });
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        error: true,
        message: 'Please provide a valid email address.',
      });
    }

    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.json({
        message:
          'If this email is registered, a password reset link has been generated.',
      });
    }

    await PasswordResetToken.updateMany(
      { userId: user._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash: hashResetToken(rawToken),
      expiresAt,
    });

    const resetUrl = buildResetUrl(req, rawToken);

    res.json({
      message:
        'Password reset link generated. It expires in 15 minutes and can only be used once.',
      resetUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('POST /api/forgot-password error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to process password reset request.',
    });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const rawToken = String(req.body?.token ?? '').trim();
    const trimmedPassword = String(req.body?.password ?? '');

    if (!rawToken || !trimmedPassword) {
      return res.status(400).json({
        error: true,
        message: 'Reset token and new password are required.',
      });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({
        error: true,
        message: 'Password must be at least 6 characters.',
      });
    }

    const tokenHash = hashResetToken(rawToken);
    const resetRecord = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        error: true,
        message: 'Invalid or expired reset link. Please request a new one.',
      });
    }

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    const user = await User.findByIdAndUpdate(
      resetRecord.userId,
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found.',
      });
    }

    resetRecord.usedAt = new Date();
    await resetRecord.save();

    await PasswordResetToken.updateMany(
      { userId: resetRecord.userId, usedAt: null, _id: { $ne: resetRecord._id } },
      { $set: { usedAt: new Date() } }
    );

    res.json({
      message: 'Password updated successfully. You can log in with your new password.',
    });
  } catch (err) {
    console.error('POST /api/reset-password error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to reset password. Please try again.',
    });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found.',
      });
    }

    res.json({ user: formatUserResponse(user) });
  } catch (err) {
    console.error('GET /api/auth/me error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to verify account status.',
    });
  }
});

function formatForecastResponse(doc) {
  if (!doc?.isActive || !doc.text?.trim()) {
    return null;
  }

  return {
    text: doc.text.trim(),
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

app.get('/api/forecast', async (req, res) => {
  try {
    const doc = await ManagerForecast.findOne().sort({ updatedAt: -1 });

    res.json({
      forecast: formatForecastResponse(doc),
    });
  } catch (err) {
    console.error('GET /api/forecast error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to load manager forecast.',
    });
  }
});

app.post('/api/admin/forecast', authMiddleware, async (req, res) => {
  try {
    const adminCheck = await requireAdminUser(req.userId);

    if (adminCheck.error) {
      return res.status(adminCheck.error.status).json({
        error: true,
        message: adminCheck.error.message,
      });
    }

    const trimmedText = String(req.body?.text ?? '').trim();

    const doc = await ManagerForecast.findOneAndUpdate(
      {},
      {
        text: trimmedText,
        isActive: Boolean(trimmedText),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const forecast = formatForecastResponse(doc);

    res.json({
      message: forecast
        ? 'Daily forecast published.'
        : 'Daily forecast cleared.',
      forecast,
    });
  } catch (err) {
    console.error('POST /api/admin/forecast error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to save manager forecast.',
    });
  }
});

function formatPushSubscriptionDoc(doc) {
  return {
    endpoint: doc.endpoint,
    expirationTime: doc.expirationTime ?? null,
    keys: {
      p256dh: doc.keys.p256dh,
      auth: doc.keys.auth,
    },
  };
}

app.use('/api/notifications', notificationsRoutes);

app.get('/api/notifications/status', authMiddleware, async (req, res) => {
  try {
    const subscription = await PushSubscription.findOne({ userId: req.userId });
    res.json({ subscribed: Boolean(subscription) });
  } catch (err) {
    console.error('GET /api/notifications/status error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to check notification status.',
    });
  }
});

app.post('/api/notifications/subscribe', authMiddleware, async (req, res) => {
  try {
    const raw = req.body?.subscription ?? req.body;
    const endpoint = String(raw?.endpoint ?? '').trim();
    const p256dh = String(raw?.keys?.p256dh ?? '').trim();
    const auth = String(raw?.keys?.auth ?? '').trim();
    const expirationTime = raw?.expirationTime ?? null;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({
        error: true,
        message: 'Valid push subscription (endpoint and keys) is required.',
      });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId: req.userId,
        endpoint,
        expirationTime,
        keys: { p256dh, auth },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      message: 'Push notifications enabled.',
      subscribed: true,
    });
  } catch (err) {
    console.error('POST /api/notifications/subscribe error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to save push subscription.',
    });
  }
});

app.post('/api/notifications/send', authMiddleware, async (req, res) => {
  try {
    const adminCheck = await requireAdminUser(req.userId);

    if (adminCheck.error) {
      return res.status(adminCheck.error.status).json({
        error: true,
        message: adminCheck.error.message,
      });
    }

    const title = String(req.body?.title ?? 'SurfForceast').trim() || 'SurfForceast';
    const body = String(req.body?.body ?? req.body?.message ?? '').trim();

    if (!body) {
      return res.status(400).json({
        error: true,
        message: 'Notification message is required.',
      });
    }

    if (!isVapidConfigured()) {
      return res.status(503).json({
        error: true,
        message: 'Push notifications are not configured. Set VAPID keys on the server.',
      });
    }

    const subscriptions = await PushSubscription.find();
    const payload = {
      title,
      body,
      url: '/',
      icon: '/icons/icon-192.png',
    };

    let sent = 0;
    let failed = 0;
    const staleEndpoints = [];

    await Promise.all(
      subscriptions.map(async (doc) => {
        const subscription = formatPushSubscriptionDoc(doc);
        try {
          await sendPushNotification(subscription, payload);
          sent += 1;
        } catch (err) {
          failed += 1;
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(doc.endpoint);
          }
        }
      })
    );

    if (staleEndpoints.length > 0) {
      await PushSubscription.deleteMany({ endpoint: { $in: staleEndpoints } });
    }

    res.json({
      message: `Notification sent to ${sent} subscriber${sent !== 1 ? 's' : ''}.`,
      sent,
      failed,
      total: subscriptions.length,
    });
  } catch (err) {
    console.error('POST /api/notifications/send error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to send notifications.',
    });
  }
});

app.get('/api/admin/users', authMiddleware, async (req, res) => {
  try {
    const adminCheck = await requireAdminUser(req.userId);

    if (adminCheck.error) {
      return res.status(adminCheck.error.status).json({
        error: true,
        message: adminCheck.error.message,
      });
    }

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      users: users.map(formatUserResponse),
    });
  } catch (err) {
    console.error('GET /api/admin/users error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to load users.',
    });
  }
});

app.post('/api/approve-user', authMiddleware, async (req, res) => {
  try {
    const adminCheck = await requireAdminUser(req.userId);

    if (adminCheck.error) {
      return res.status(adminCheck.error.status).json({
        error: true,
        message: adminCheck.error.message,
      });
    }

    const { userId, isApproved = true } = req.body ?? {};

    if (!userId) {
      return res.status(400).json({
        error: true,
        message: 'userId is required.',
      });
    }

    const targetUser = await User.findByIdAndUpdate(
      userId,
      { isApproved: Boolean(isApproved) },
      { new: true }
    ).select('-password');

    if (!targetUser) {
      return res.status(404).json({
        error: true,
        message: 'User to approve was not found.',
      });
    }

    res.json({
      message: `User ${targetUser.username} approval set to ${Boolean(isApproved)}.`,
      user: formatUserResponse(targetUser),
    });
  } catch (err) {
    console.error('POST /api/approve-user error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to update user approval status.',
    });
  }
});

app.get('/api/surf', async (req, res) => {
  const spot = resolveSpot(req.query.spot);

  try {
    const [marineResult, weatherResult] = await Promise.allSettled([
      fetchMarineData(spot),
      fetchWeatherData(spot),
    ]);

    const marineFailed = marineResult.status === 'rejected';
    const weatherFailed = weatherResult.status === 'rejected';

    if (marineFailed && weatherFailed) {
      console.error(`Marine API error (${spot.beach}):`, marineResult.reason?.message);
      console.error(`Weather API error (${spot.beach}):`, weatherResult.reason?.message);
      return res.status(503).json({
        error: true,
        message: 'Unable to reach weather services. Please try again shortly.',
      });
    }

    if (marineFailed) {
      console.error(`Marine API error (${spot.beach}):`, marineResult.reason?.message);
    }
    if (weatherFailed) {
      console.error(`Weather API error (${spot.beach}):`, weatherResult.reason?.message);
    }

    const marineCurrent = marineResult.status === 'fulfilled' ? marineResult.value : null;
    const weatherCurrent = weatherResult.status === 'fulfilled' ? weatherResult.value : null;

    const payload = buildSurfPayload(spot, marineCurrent, weatherCurrent);

    const hasAnyData = [
      payload.waveHeight,
      payload.swellPeriod,
      payload.swellDirection,
      payload.wind,
      payload.temperature,
    ].some(Boolean);

    if (!hasAnyData) {
      return res.status(503).json({
        error: true,
        message: 'Weather services responded but returned no usable data.',
      });
    }

    if (marineFailed || weatherFailed) {
      payload.partial = true;
    }

    res.json(payload);
  } catch (err) {
    console.error(`Unexpected /api/surf error (${spot.beach}):`, err.message);
    res.status(500).json({
      error: true,
      message: 'An unexpected error occurred while fetching surf data.',
    });
  }
});

app.get('/api/chat', async (req, res) => {
  try {
    const spotName = resolveChatSpot(req.query.spot);
    const { spotName: safeSpot, messages } = await getTodayMessagesForSpot(spotName);
    res.json({ spot: safeSpot, messages });
  } catch (err) {
    console.error('GET /api/chat error:', err.message);
    res.status(500).json({
      error: true,
      message: 'Unable to load chat messages.',
    });
  }
});

app.post('/api/chat', (req, res) => {
  upload.single('image')(req, res, async (multerErr) => {
    if (multerErr) {
      const message =
        multerErr.code === 'LIMIT_FILE_SIZE'
          ? 'Image must be 5 MB or smaller.'
          : multerErr.message || 'Invalid image upload.';
      return res.status(400).json({ error: true, message });
    }

    let tempFilePath = null;

    try {
      const { spot, user, message } = req.body ?? {};
      const spotName = resolveChatSpot(spot);
      const trimmedMessage = String(message ?? '').trim();
      const trimmedUser = String(user ?? '').trim() || 'Local Surfer';

      if (!trimmedMessage && !req.file) {
        return res.status(400).json({
          error: true,
          message: 'Message or image is required.',
        });
      }

      if (trimmedMessage.length > 500) {
        return res.status(400).json({
          error: true,
          message: 'Message must be 500 characters or fewer.',
        });
      }

      const safeSpot = await pruneOldMessages(spotName);

      let imageUrl = null;

      if (req.file) {
        tempFilePath = req.file.path;
        imageUrl = await uploadImageToCloudinary(tempFilePath);
        await removeLocalFile(tempFilePath);
        tempFilePath = null;
      }

      const savedMessage = await ChatMessage.create({
        spot: safeSpot,
        user: trimmedUser,
        message: trimmedMessage,
        imageUrl: imageUrl || undefined,
        createdAt: new Date(),
      });

      res.status(201).json(formatMessageForApi(savedMessage));
    } catch (err) {
      if (tempFilePath) {
        await removeLocalFile(tempFilePath);
      }

      console.error('POST /api/chat error:', err.message);
      res.status(500).json({
        error: true,
        message: 'Unable to save chat message.',
      });
    }
  });
});

app.use(express.static(FRONTEND_DIST));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

async function startServer() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is required. Set it in backend/.env (see .env.example).');
    process.exit(1);
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is required. Set it in backend/.env (see .env.example).');
    process.exit(1);
  }

  if (!ADMIN_EMAIL) {
    console.warn('Warning: ADMIN_EMAIL is not set. POST /api/approve-user will not work.');
  }

  const indexPath = path.join(FRONTEND_DIST, 'index.html');
  try {
    await fs.access(indexPath);
  } catch {
    console.error('Frontend build not found at:', indexPath);
    console.error('From repo root run: npm run build');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI.trim(), { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected successfully');
  ensureVapidKeys();
  await ensureUploadsDir();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err.message);
  if (err.message.includes('ECONNREFUSED') || err.message.includes('querySrv')) {
    console.error(
      'DNS cannot reach MongoDB Atlas. Try Google DNS (8.8.8.8) on your PC or router.'
    );
  }
  if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
    console.error('MongoDB login failed. Check username and password in Atlas → Database Access.');
  }
  process.exit(1);
});
