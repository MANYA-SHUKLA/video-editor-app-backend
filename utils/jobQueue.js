const Queue = require('bull');
const FFmpegProcessor = require('./ffmpegProcessor');
const path = require('path');
const fs = require('fs');

let videoQueue;
let redisConnected = false;

// Redis configuration
const redisUrl = process.env.REDIS_URL;
const redisConfig = redisUrl ? { url: redisUrl } : {
  host: '127.0.0.1',
  port: 6379
};

console.log(`🔄 Initializing video processing queue...`);

try {
  videoQueue = new Queue('video processing', {
    redis: redisConfig
  });


  videoQueue.on('ready', () => {
    redisConnected = true;
    console.log('✅ Redis connected successfully - Queue features enabled');
  });

  videoQueue.on('error', (err) => {
    redisConnected = false;
    console.error('❌ Queue error (Redis connection failed):', err.message);
    console.log('⚠️  Falling back to synchronous processing mode');
  });

  videoQueue.on('waiting', (jobId) => {
    console.log(`📋 Job ${jobId} added to queue`);
  });

  // Process jobs from the queue
  videoQueue.process(async (job) => {
    const { jobId } = job.data;
    console.log(`🎬 Processing job: ${jobId}`);

    const processor = new FFmpegProcessor(jobId);
    await processor.process();

    return { jobId, status: 'completed' };
  });

  videoQueue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  videoQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
  });

  videoQueue.on('progress', (job, progress) => {
    console.log(`📊 Job ${job.id} progress: ${progress}%`);
  });

  // Check connection after a short delay
  setTimeout(() => {
    if (!redisConnected) {
      console.log('⚠️  Redis not available - Operating in synchronous mode');
    }
  }, 2000);

} catch (error) {
  console.warn('❌ Failed to initialize Redis queue:', error.message);
  console.log('⚠️  Falling back to synchronous processing mode');

  // Fallback synchronous queue
  videoQueue = {
    add: async (data) => {
      console.log('🔄 Processing job synchronously:', data.jobId);
      try {
        const processor = new FFmpegProcessor(data.jobId);
        await processor.process();
        console.log(`✅ Job ${data.jobId} completed synchronously`);
        return { id: data.jobId, data };
      } catch (err) {
        console.error(`❌ Job ${data.jobId} failed synchronously:`, err);
        throw err;
      }
    },
    on: () => {} // No-op for event listeners
  };
}

// Export queue and connection status
module.exports = videoQueue;
module.exports.redisConnected = () => redisConnected;