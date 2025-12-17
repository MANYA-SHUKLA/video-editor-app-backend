const Queue = require('bull');
const FFmpegProcessor = require('./ffmpegProcessor');
const path = require('path');
const fs = require('fs');
const videoQueue = new Queue('video processing', {
  redis: {
    host: '127.0.0.1',
    port: 6379
  }
});
videoQueue.on('error', (err) => {
  console.error('Queue error (Redis or Bull):', err);
});

videoQueue.process(async (job) => {
  const { jobId } = job.data;
  console.log(`Processing job: ${jobId}`);
  
  const processor = new FFmpegProcessor(jobId);
  await processor.process();
  
  return { jobId, status: 'completed' };
});
videoQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

videoQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err);
});

videoQueue.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});

module.exports = videoQueue;