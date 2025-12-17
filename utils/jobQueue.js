const FFmpegProcessor = require('./ffmpegProcessor');

const processJob = async (data) => {
  const { jobId } = data;
  console.log(`🔄 Processing job synchronously: ${jobId}`);
  try {
    const processor = new FFmpegProcessor(jobId);
    await processor.process();
    console.log(`✅ Job ${jobId} completed synchronously`);
    return { id: jobId, data };
  } catch (err) {
    console.error(`❌ Job ${jobId} failed synchronously:`, err);
    throw err;
  }
};

module.exports = {
  add: processJob
};