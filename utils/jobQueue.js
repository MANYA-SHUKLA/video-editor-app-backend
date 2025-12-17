const Queue = require('bull');
const FFmpegProcessor = require('./ffmpegProcessor');
const path = require('path');
const fs = require('fs');

let videoQueue;

try {
  videoQueue = new Queue('video processing', {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
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

} catch (error) {
  console.warn('Redis not available, falling back to synchronous processing:', error.message);
  
  // Fallback synchronous queue
  videoQueue = {
    add: async (data) => {
      console.log('Processing job synchronously:', data.jobId);
      try {
        const processor = new FFmpegProcessor(data.jobId);
        await processor.process();
        console.log(`Job ${data.jobId} completed synchronously`);
        return { id: data.jobId, data };
      } catch (err) {
        console.error(`Job ${data.jobId} failed synchronously:`, err);
        throw err;
      }
    },
    on: () => {} 
  };
}

module.exports = videoQueue;