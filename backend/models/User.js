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
  lastLogin: { 
    type: Date, 
    default: null 
  },
  favorites: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Manga' 
  }],
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
  readingHistory: [{
    mangaId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Manga', 
      required: true 
    },
    chapterNumber: { 
      type: Number, 
      required: true 
    },
    readAt: { 
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
  return user;
};

export default mongoose.model('User', UserSchema);