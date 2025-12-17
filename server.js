require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

const PORT = parseInt(process.env.PORT, 10) || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/video-editor';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const CORS_ORIGINS = process.env.CORS_ORIGINS || CLIENT_ORIGIN;

const allowedOrigins = [
  ...CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  'https://video-editor-app-frontend.vercel.app'
];

function isOriginAllowed(origin) {
  if (!origin) return true; // allow curl or server-side requests
  if (allowedOrigins.includes(origin)) return true;

  try {
    const u = new URL(origin);
    const host = u.host;

    return allowedOrigins.some((o) => {
      if (o.startsWith('*.')) {
        const suffix = o.slice(1);
        return host.endsWith(suffix.replace(/^\./, '.'));
      }
      try {
        const ohost = new URL(o).host;
        return ohost === host;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      console.log('Blocked by CORS:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(204).end();
  }

  return res.status(403).json({ error: 'Origin not allowed by CORS policy' });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${req.ip}`
  );
  next();
});

const uploadsDir = path.join(__dirname, 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const outputDir = path.join(__dirname, 'outputs');

[uploadsDir, videosDir, outputDir].forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('Failed to create directory', dir, err);
  }
});

app.use('/api', uploadRoutes);

app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    dbConnected: dbState === 1,
    dbState,
  });
});

app.get('/', (req, res) => {
  res.send('Video Editor Backend is running by MANYA SHUKLA');
});

app.use((err, req, res, next) => {
  console.error(
    'Global error handler:',
    err && err.stack ? err.stack : err
  );

  if (
    err &&
    (err.name === 'MulterError' ||
      (err.message &&
        err.message.toLowerCase().includes('invalid file type')))
  ) {
    return res.status(400).json({ error: err.message });
  }

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }

  if (err && err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({ error: err.message });
  }

  res.status(err && err.status ? err.status : 500).json({
    error: err && err.message ? err.message : 'Something went wrong!',
  });
});

let server;

server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

async function connectMongo(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
      return;
    } catch (err) {
      console.error(
        `MongoDB connection attempt ${attempt} failed:`,
        err && err.message ? err.message : err
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  console.warn(
    'Continuing without MongoDB. Some routes will not function until DB is available.'
  );
}

connectMongo().catch((e) =>
  console.error('Unexpected Mongo connect error:', e)
);

function shutdown(signal) {
  console.log(
    `Received ${signal}. Closing HTTP server and MongoDB connection...`
  );

  const closeDb = () =>
    mongoose.connection
      .close(false)
      .then(() => {
        console.log('MongoDB connection closed.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
      });

  if (server) {
    server.close(() => {
      closeDb();
    });
  } else {
    closeDb();
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
