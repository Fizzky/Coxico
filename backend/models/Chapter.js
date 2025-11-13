// backend/models/Chapter.js
import mongoose from 'mongoose';

const chapterSchema = new mongoose.Schema({
  mangaId: {
    type: String,  // Changed from ObjectId to String
    ref: 'Manga',
    required: true,
    index: true
  },
  chapterNumber: {
    type: Number,
    required: true,
    index: true
  },
  chapterNumberLabel: {
    type: String,
    default: function () {
      if (this.chapterNumber === undefined || this.chapterNumber === null) {
        return null;
      }
      return this.chapterNumber.toString();
    }
  },
  title: {
    type: String,
    required: true
  },
  pages: [{
    type: String,
    required: true
  }], // Array of image URLs

  // --- NEW: optional volume metadata ---
  volumeNumber: {
    type: Number,
    default: null,
    index: true
  },
  volumeTitle: {
    type: String,
    default: null
  },

  views: {
    type: Number,
    default: 0
  }
}, {
  // keep your original uploadedAt field name
  timestamps: { createdAt: 'uploadedAt', updatedAt: false }
});

// Compound index for efficient querying
chapterSchema.index({ mangaId: 1, chapterNumber: 1 });
chapterSchema.index({ uploadedAt: -1 });

// Helpful secondary indexes (existing + volume filters)
chapterSchema.index({ mangaId: 1, volumeNumber: 1, chapterNumber: 1 });
chapterSchema.index({ mangaId: 1, chapterNumberLabel: 1 }, { unique: true, sparse: true });

export default mongoose.model('Chapter', chapterSchema);
