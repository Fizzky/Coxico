// backend/models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    index: true 
  },
  username: { 
    type: String, 
    required: true, 
    unique: true,
    minlength: 3,
    maxlength: 20 
  },
  password: { 
  type: String, 
  required: true, 
  minlength: 6 
},
avatar: String,
bio: {
  type: String,
  default: '',
  maxlength: 500
},
profilePhoto: {
  type: String,
  default: ''
},
bannerPhoto: {
  type: String,
  default: ''
},
lastLogin: { 
  type: Date, 
  default: null 
},
  favorites: [{ 
  type: String, 
  ref: 'Manga' 
}],

  
  
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Enhanced reading history with detailed progress tracking
readingHistory: [{
  manga: {
    type: String,  // ✅ Keep as String (manga uses string IDs)
    ref: 'Manga',
    required: true
  },
  chapter: {
    type: mongoose.Schema.Types.ObjectId,  // ⭐ CHANGE to ObjectId (chapters use ObjectIds)
    ref: 'Chapter',
    required: true
  },
  chapterNumber: {
    type: Number,
    required: true
  },
  currentPage: {
    type: Number,
    default: 0
  },
  totalPages: {
    type: Number,
    required: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  lastReadAt: {
    type: Date,
    default: Date.now
  },
  readingTime: {
    type: Number,
    default: 0
  }
}],

// Quick access to continue reading
continueReading: [{
  manga: {
    type: String,  // ✅ Keep as String
    ref: 'Manga',
    required: true
  },
  chapter: {
    type: mongoose.Schema.Types.ObjectId,  // ⭐ CHANGE to ObjectId
    ref: 'Chapter',
    required: true
  },
  chapterNumber: {
    type: Number,
    required: true
  },
  currentPage: {
    type: Number,
    default: 0
  },
  lastReadAt: {
    type: Date,
    default: Date.now
  }
}],

  // Keep legacy bookmarks for backward compatibility (optional)
  bookmarks: [{
    mangaId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Manga', 
      required: true 
    },
    chapterNumber: { 
      type: Number, 
      required: true 
    },
    pageNumber: { 
      type: Number, 
      required: true, 
      default: 1 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    }
  }],

  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true
});



// Remove password from JSON output
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  return user;
};

export default mongoose.model('User', UserSchema);