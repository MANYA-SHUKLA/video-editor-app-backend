const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
dotenv.config();
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CLIENT_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


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
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/video-editor')
  .then(() => {
    console.log('Connected to MongoDB');
  const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.header('Access-Control-Allow-Origin', CLIENT_ORIGIN);
  res.status(500).json({ error: 'Something went wrong!' });
});
app.get("/", (req, res) => {
  res.send("Video Editor Backend is running 🚀");
});


module.exports = app;