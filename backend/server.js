const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env'),
  override: true,
});

const dns = require('dns');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const fs = require('fs').promises;
const ChatMessage = require('./models/ChatMessage');

const app = express();
const PORT = process.env.PORT || 3000;

// Use public DNS — many routers block Atlas SRV lookups (querySrv ECONNREFUSED)
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

const MONGODB_URI = process.env.MONGODB_URI;

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
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
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

function buildSurfPayload(spot, marineCurrent, weatherCurrent) {
  const waveHeight = marineCurrent?.wave_height;
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
    waveHeight: formatValue(waveHeight, (v) => `${v.toFixed(1)} m`),
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

  try {
    await fs.access(path.join(FRONTEND_DIST, 'index.html'));
  } catch {
    console.error('Frontend build not found. Run: cd frontend && npm run build');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI.trim(), { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected successfully');
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
