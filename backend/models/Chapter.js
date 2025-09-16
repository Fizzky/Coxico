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
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  pages: [{ 
    type: String, 
    required: true 
  }], // Array of image URLs
  views: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: { createdAt: 'uploadedAt', updatedAt: false }
});

// Compound index for efficient querying
ChapterSchema.index({ mangaId: 1, chapterNumber: 1 }, { unique: true });
ChapterSchema.index({ uploadedAt: -1 });

export default mongoose.model('Chapter', ChapterSchema);