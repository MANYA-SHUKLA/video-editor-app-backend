# Video Editor Backend

Made by Manya Shukla

A small Node.js/Express backend for receiving video uploads, applying overlays (text/image/video) using FFmpeg, and returning processed outputs. Uses MongoDB (for tracking jobs) and Bull (Redis-backed) for background processing.


## Quick Start

Prerequisites
- Node.js (>= 16)
- MongoDB (local or remote)
- Redis (Bull queue requires Redis)

Install & run
```bash
cd backend
npm install
# create a .env file (see .env.example below)
# start redis and mongodb services
npm run dev    # starts with nodemon
# or
npm start      # node server.js
```

Default server: http://localhost:5001
Health check: GET /api/health


## Environment variables
Create a `.env` file in `backend/` (or use export) with these keys as needed:
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/video-editor
CLIENT_ORIGIN=http://localhost:3000
```


## Folder structure

- /controllers
  - uploadController.js      # API handlers for upload, status & result
- /models
  - Job.js                   # Job schema (overlays, status, progress)
  - Video.js                 # Uploaded video metadata
- /routes
  - uploadRoutes.js          # API routes mounted at /api
- /utils
  - fileUpload.js            # Multer storage & file restrictions
  - ffmpegProcessor.js       # FFmpeg overlay processing (fluent-ffmpeg)
  - jobQueue.js              # Bull queue worker (requires Redis)
- /uploads                   # Incoming uploads (videos/ images)
- /outputs                   # Processed output videos
- server.js                  # Express app entry point


## API

1) POST /api/upload
- Content-Type: multipart/form-data
- Fields:
  - `video` (file) — required (max ~500MB)
  - `overlays` (string) — optional JSON string describing overlays

`overlays` format (example):

```json
[
  {
    "type": "text",
    "content": "Hello World",
    "x": 10,
    "y": 5,
    "startTime": 0,
    "endTime": 4,
    "fontSize": 24,
    "fontColor": "#FFFFFF"
  },
  {
    "type": "image",
    "content": "uploads/images/image-165...png",
    "x": 50,
    "y": 50,
    "startTime": 2,
    "endTime": 6
  }
]
```

Note: `content` for `image` or `video` overlays should be either an absolute filesystem path or a path relative to the backend root (for example `uploads/images/<filename>` or `uploads/videos/<filename>`). Avoid using a leading slash when referencing uploaded images if you want them to be resolved relative to the project directory.

Example curl upload:
```bash
curl -X POST http://localhost:5001/api/upload \
  -F "video=@/full/path/to/video.mp4" \
  -F 'overlays=[{"type":"text","content":"Hi","x":10,"y":10,"startTime":0,"endTime":5}]'
```

2) POST /api/upload/image
- Upload overlay images (max ~10MB)
- Returns: `{ success: true, imageUrl: "/uploads/images/<filename>", filename: "<filename>" }`

3) GET /api/status/:jobId
- Returns job status, progress and metadata

4) GET /api/result/:jobId
- When job status is `completed`, download the processed `.mp4` file


## Notes & Troubleshooting
- Ensure Redis is running (default configured at 127.0.0.1:6379). On macOS: `brew install redis` and `brew services start redis`.
- Ensure MongoDB is running and reachable by the `MONGODB_URI` in your environment.
- Check logs printed by `server.js`, `jobQueue.js`, and `ffmpegProcessor.js` for progress and errors.
- FFmpeg is provided via the `ffmpeg-static` package.
- If uploads fail, verify multer file filters and file size limits in `utils/fileUpload.js`.


## Acknowledgements
Built for the video-editor demo. If you need changes to overlays, limits, or queue behavior, open an issue or edit the code in `utils/` and `controllers/`.


---

Made by Manya Shukla
