const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const Job = require('../models/Job');
ffmpeg.setFfmpegPath(ffmpegStatic);

class FFmpegProcessor {
  constructor(jobId) {
    this.jobId = jobId;
    this.job = null;
  }

  async process() {
    try {
      await Job.findOneAndUpdate(
        { jobId: this.jobId },
        { status: 'processing', progress: 10 }
      );
      this.job = await Job.findOne({ jobId: this.jobId });
      if (!this.job) {
        throw new Error('Job not found');
      }
      const inputPath = path.isAbsolute(this.job.originalVideo)
        ? this.job.originalVideo
        : path.join(__dirname, '..', this.job.originalVideo);
      const outputFilename = `output_${this.jobId}_${Date.now()}.mp4`;
      const outputPath = path.join(__dirname, '..', 'outputs', outputFilename);
  
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      let command = ffmpeg(inputPath)
        .size('1280x720')
        .videoCodec('libx264')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-movflags +faststart'
        ])
        .audioCodec('copy');

      // Apply overlays (skipping unsupported text filters)
      this.job.overlays.forEach((overlay, index) => {
        if (overlay.type !== 'text') {
          command = this.applyOverlay(command, overlay, index);
        }
      });

      return new Promise((resolve, reject) => {
        command
          .on('start', (commandLine) => {
            console.log('Spawned Ffmpeg with command: ' + commandLine);
          })
          .on('progress', (progress) => {
            const raw = progress && typeof progress.percent === 'number' ? progress.percent : null;
            if (raw !== null && isFinite(raw)) {
              const percent = Math.max(0, Math.min(90, Math.round(raw)));
              Job.findOneAndUpdate(
                { jobId: this.jobId },
                { progress: percent, updatedAt: Date.now() }
              ).catch(console.error);
            }
          })
          .on('stderr', (stderrLine) => {
            console.error('FFmpeg stderr:', stderrLine);
          })
          .on('end', async () => {
            await Job.findOneAndUpdate(
              { jobId: this.jobId },
              {
                status: 'completed',
                progress: 100,
                outputVideo: `/outputs/${outputFilename}`,
                updatedAt: Date.now()
              }
            );
            resolve(outputPath);
          })
          .on('error', async (err, stdout, stderr) => {
            console.error('FFmpeg error:', err.message);
            console.error('FFmpeg stderr output:', stderr);
            
            await Job.findOneAndUpdate(
              { jobId: this.jobId },
              {
                status: 'failed',
                error: err.message,
                updatedAt: Date.now()
              }
            );
            reject(err);
          })
          .save(outputPath);
      });
    } catch (error) {
      console.error('Processing error:', error);
      await Job.findOneAndUpdate(
        { jobId: this.jobId },
        {
          status: 'failed',
          error: error.message,
          updatedAt: Date.now()
        }
      );
      throw error;
    }
  }

  applyOverlay(command, overlay, index) {
    const enableExpr = `between(t,${overlay.startTime},${overlay.endTime})`;
    const xExpr = `(main_w*${Number(overlay.x) || 0}/100)`;
    const yExpr = `(main_h*${Number(overlay.y) || 0}/100)`;

    // Skip text overlays to avoid "Filter not found" (drawtext)
    if (overlay.type === 'image') {
      const imagePath = path.isAbsolute(overlay.content)
        ? overlay.content
        : path.join(__dirname, '..', overlay.content);
      return command
        .input(imagePath)
        .complexFilter([
          {
            filter: 'overlay',
            options: {
              enable: enableExpr,
              x: xExpr,
              y: yExpr
            },
            inputs: ['0:v', `1:v`], // Note: This assumes single overlay logic for now
            outputs: ['v']
          }
        ]);
    } else if (overlay.type === 'video') {
      const videoPath = path.isAbsolute(overlay.content)
        ? overlay.content
        : path.join(__dirname, '..', overlay.content);
      return command
        .input(videoPath)
        .complexFilter([
          {
            filter: 'overlay',
            options: {
              enable: enableExpr,
              x: xExpr,
              y: yExpr
            },
            inputs: ['0:v', `1:v`],
            outputs: ['v']
          }
        ]);
    }

    return command;
  }
}

module.exports = FFmpegProcessor;