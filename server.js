const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

const FRONTEND_URI = 'https://video-editor-app-frontend.vercel.app'
const BACKEND_URI = 'https://video-editor-app-backend.onrender.com'
const DEFAULT_CLIENT_ORIGIN = FRONTEND_URI
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGIN
const allowedOrigins = [CLIENT_ORIGIN, FRONTEND_URI, BACKEND_URI]
app.use(cors({
  origin: (origin, callback) => {

    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('CORS policy: Origin not allowed'))
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
const uploadsDir = path.join(__dirname, 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const outputDir = path.join(__dirname, 'outputs');

[uploadsDir, videosDir, outputDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use('/api', uploadRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.send('Video Editor Backend is running 🚀 Made by MANYA SHUKLA');
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/video-editor')
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  if (err && (err.name === 'MulterError' || (err.message && err.message.toLowerCase().includes('invalid file type')))) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  if (err && err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(err && err.status ? err.status : 500).json({ error: err && err.message ? err.message : 'Something went wrong!' });
});

module.exports = app;
