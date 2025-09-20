// backend/models/Chapter.js
import mongoose from 'mongoose';

const ChapterSchema = new mongoose.Schema({
  mangaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manga',
    required: true,
    index: true
  },
  chapterNumber: {
    type: Number,
    required: true,
    index: true
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
ChapterSchema.index({ mangaId: 1, chapterNumber: 1 }, { unique: true });
ChapterSchema.index({ uploadedAt: -1 });

// Helpful secondary indexes (existing + volume filters)
ChapterSchema.index({ mangaId: 1, volumeNumber: 1, chapterNumber: 1 });

export default mongoose.model('Chapter', ChapterSchema);
