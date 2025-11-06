// backend/models/Rating.js
import mongoose from 'mongoose';

const RatingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  manga: {
    type: String,
    ref: 'Manga',
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  }
}, {
  timestamps: true
});

// One rating per user per manga
RatingSchema.index({ user: 1, manga: 1 }, { unique: true });

export default mongoose.model('Rating', RatingSchema);