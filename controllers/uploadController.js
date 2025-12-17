const path = require('path');
const fs = require('fs');
const Job = require('../models/Job');
const Video = require('../models/Video');
const { v4: uuidv4 } = require('uuid');
const FFmpegProcessor = require('../utils/ffmpegProcessor');

const uploadController = {
  uploadVideo: async (req, res) => {
    try {
      console.log(`Upload request from origin: ${req.get('origin') || req.headers.origin || 'unknown'}, path: ${req.originalUrl}`)
      console.log('Upload headers:', { origin: req.get('origin'), 'content-type': req.headers['content-type'] })

      if (!req.file) {
        console.warn('No file received in upload request')
        return res.status(400).json({ error: 'No video file uploaded' });
      }

      const { overlays } = req.body;
      let parsedOverlays = [];
      
      if (overlays) {
        try {
          parsedOverlays = JSON.parse(overlays);
        } catch (error) {
          return res.status(400).json({ error: 'Invalid overlays format' });
        }
      }
      const jobId = uuidv4();
      const video = new Video({
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
      await video.save();
      const job = new Job({
        jobId,
        originalVideo: req.file.path,
        overlays: parsedOverlays,
        status: 'pending',
        progress: 0
      });
      await job.save();
      
      // Process the job synchronously
      (async () => {
        try {
          const processor = new FFmpegProcessor(jobId);
          await processor.process();
          console.log(`Job ${jobId} processing completed`);
        } catch (queueError) {
          console.error('Failed to process job:', queueError);
          job.status = 'failed';
          job.error = `Failed to process job: ${queueError.message}`;
          await job.save();
        }
      })();

      return res.status(200).json({
        success: true,
        jobId,
        message: 'Video uploaded and processing started'
      });
    } catch (error) {
      console.error('Upload error:', error);
      const message = error && error.message ? error.message : 'Failed to upload video';
      res.status(500).json({ error: message });
    }
  },
  getJobStatus: async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await Job.findOne({ jobId });
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.status(200).json({
        jobId,
        status: job.status,
        progress: job.progress,
        outputVideo: job.outputVideo,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      });
    } catch (error) {
      console.error('Status error:', error);
      res.status(500).json({ error: 'Failed to get job status' });
    }
  },
  getResult: async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await Job.findOne({ jobId });
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({ 
          error: 'Video not ready yet', 
          status: job.status,
          progress: job.progress 
        });
      }

      if (!job.outputVideo) {
        return res.status(404).json({ error: 'Output video not found' });
      }

      const outputPath = path.join(__dirname, '..', job.outputVideo);
      
      if (!fs.existsSync(outputPath)) {
        return res.status(404).json({ error: 'Output video file not found' });
      }

      res.download(outputPath, `edited_video_${jobId}.mp4`);
    } catch (error) {
      console.error('Result error:', error);
      res.status(500).json({ error: 'Failed to get result' });
    }
  },
  uploadOverlayImage: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
      }

      res.status(200).json({
        success: true,
        imageUrl: `/uploads/images/${req.file.filename}`,
        filename: req.file.filename
      });
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
};

module.exports = uploadController;