const mongoose = require('mongoose');

const overlaySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  x: {
    type: Number,
    required: true,
    default: 0
  },
  y: {
    type: Number,
    required: true,
    default: 0
  },
  width: Number,
  height: Number,
  startTime: {
    type: Number,
    required: true,
    default: 0
  },
  endTime: {
    type: Number,
    required: true
  },
  fontSize: Number,
  fontColor: {
    type: String,
    default: '#FFFFFF'
  },
  backgroundColor: String
});

const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true
  },
  originalVideo: {
    type: String,
    required: true
  },
  overlays: [overlaySchema],
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    set: (val) => {
      const num = typeof val === 'number' && isFinite(val) ? val : 0;
      return Math.max(0, Math.min(100, num));
    }
  },
  outputVideo: String,
  error: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

jobSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;