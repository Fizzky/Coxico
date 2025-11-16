import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    category: {
      type: String,
      required: true,
      enum: ['general', 'bug', 'feature_request', 'ui_ux', 'performance', 'other'],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    deviceInfo: {
      type: String,
      default: 'Unknown',
    },
    appVersion: {
      type: String,
      default: 'Unknown',
    },
    platform: {
      type: String,
      default: 'Unknown',
    },
    userAgent: {
      type: String,
      default: 'Unknown',
    },
    ipAddress: {
      type: String,
      default: 'Unknown',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'in_progress', 'resolved', 'ignored'],
      default: 'new',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
feedbackSchema.index({ timestamp: -1 });
feedbackSchema.index({ category: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ userId: 1 });

// Virtual for priority (critical bugs and low ratings are high priority)
feedbackSchema.virtual('priority').get(function () {
  if (this.category === 'bug' && this.rating <= 2) return 'critical';
  if (this.rating <= 2) return 'high';
  if (this.category === 'bug') return 'high';
  return 'normal';
});

export default mongoose.model('Feedback', feedbackSchema);

