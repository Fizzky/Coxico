// backend/models/Manga.js
import mongoose from 'mongoose';

const chapterSchema = new mongoose.Schema({
  chapterNumber: { type: Number, required: true },
  title: { type: String, required: true },
  pages: [{ type: String }], // Array of S3 URLs
  volumeNumber: Number,
  volumeTitle: String,
  views: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now }
});

const volumeSchema = new mongoose.Schema({
  volumeNumber: { type: Number, required: true },
  volumeTitle: { type: String, required: true },
  chapters: [chapterSchema] // Embedded chapters
});

const MangaSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom ID like 'onepiece'
  title: { 
    type: String, 
    required: true, 
    index: true 
  },
  alternativeTitles: [String],
  description: { 
    type: String, 
    required: true 
  },
  author: { 
    type: String, 
    required: true 
  },
  artist: { 
    type: String, 
    required: true 
  },
  genres: [{ 
    type: String, 
    index: true 
  }],
  status: { 
    type: String, 
    enum: ['ongoing', 'completed', 'hiatus'], 
    default: 'ongoing',
    index: true 
  },
  coverImage: { 
    type: String, 
    required: true 
  },
  rating: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 10 
  },
  views: { 
    type: Number, 
    default: 0 
  },
  favorites: { 
    type: Number, 
    default: 0 
  },
  totalChapters: { 
    type: Number, 
    default: 0 
  },
  hasVolumes: {
    type: Boolean,
    default: false
  },
  volumes: [volumeSchema], // Volume structure with embedded chapters
  chapters: [chapterSchema] // Flat chapter list for non-volume manga
}, {
  timestamps: true
});

// Text search index
MangaSchema.index({ 
  title: 'text', 
  alternativeTitles: 'text', 
  description: 'text' 
});

// Performance indexes
MangaSchema.index({ createdAt: -1 });
MangaSchema.index({ rating: -1 });
MangaSchema.index({ views: -1 });

export default mongoose.model('Manga', MangaSchema);