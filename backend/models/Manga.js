// backend/models/Manga.js
import mongoose from 'mongoose';

const MangaSchema = new mongoose.Schema({
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
  chapters: { 
    type: Number, 
    default: 0 
  }
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