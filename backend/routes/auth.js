// backend/routes/auth.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Manga from '../models/Manga.js';
import mongoose from 'mongoose';
import Chapter from '../models/Chapter.js';  // ⭐ ADD THIS LINE
import multer from 'multer';
import { S3Client } from '@aws-sdk/client-s3';
import multerS3 from 'multer-s3';

console.log('🪣 AWS Bucket Name:', process.env.AWS_BUCKET_NAME);
console.log('🔑 AWS Access Key:', process.env.AWS_ACCESS_KEY_ID ? 'Present' : 'Missing');
console.log('🔐 AWS Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? 'Present' : 'Missing');
console.log('🌍 AWS Region:', process.env.AWS_REGION);

// ⭐ ADD S3 CONFIGURATION HERE
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const folder = file.fieldname === 'profilePhoto' ? 'profiles' : 'banners';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `${folder}/${file.fieldname}-${uniqueSuffix}-${file.originalname}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password } = req.body;

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      username,
      password: hashedPassword
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.toJSON());
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Update user profile with S3 image uploads
router.put('/profile', upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'bannerPhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { username, email, bio, currentPassword, newPassword } = req.body;

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      user.email = email;
    }

    if (bio !== undefined) {
      user.bio = bio;
    }

    // Handle profile photo upload to S3
    if (req.files && req.files.profilePhoto) {
      user.profilePhoto = req.files.profilePhoto[0].location; // S3 URL
    }

    // Handle banner photo upload to S3
    if (req.files && req.files.bannerPhoto) {
      user.bannerPhoto = req.files.bannerPhoto[0].location; // S3 URL
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password required' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      user.password = await bcrypt.hash(newPassword, 12);
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    res.json({ 
      valid: true, 
      user: user.toJSON()
    });

  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Get user favorites
router.get('/favorites', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get manga data for each favorite
    const favoriteManga = await Manga.find({ _id: { $in: user.favorites } });

    res.json({ favorites: favoriteManga });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ message: 'Error fetching favorites' });
  }
});

// Toggle favorite status
router.post('/favorites/toggle/:mangaId', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { mangaId } = req.params;
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if manga exists
    const manga = await Manga.findById(mangaId);
    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    const isFavorite = user.favorites.includes(mangaId);
    
    if (isFavorite) {
      // Remove from favorites
      user.favorites = user.favorites.filter(fav => fav !== mangaId);
      manga.favorites = Math.max(0, (manga.favorites || 0) - 1);
    } else {
      // Add to favorites
      user.favorites.push(mangaId);
      manga.favorites = (manga.favorites || 0) + 1;
    }
    
    await user.save();
    await manga.save();

    res.json({ 
      success: true,
      isFavorite: !isFavorite,
      mangaId: mangaId
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ message: 'Error toggling favorite' });
  }
});

router.post('/reading-progress', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { mangaId, chapterId, chapterNumber, currentPage, totalPages, readingTime } = req.body;
    
    console.log('📖 Reading progress update received:', {
      userId: decoded.userId,
      mangaId,
      chapterId,
      chapterNumber,
      currentPage,
      totalPages,
      readingTime
    });

    // ⭐ NEW: Convert mangaId slug to ObjectId
    let actualMangaId = mangaId;
    
    // Check if mangaId is already an ObjectId (24 hex characters)
    if (!/^[0-9a-fA-F]{24}$/.test(mangaId)) {
      console.log('🔄 Converting slug to ObjectId:', mangaId);
      // It's a slug, look up the actual manga
      const manga = await Manga.findById(mangaId);
      if (!manga) {
        console.log('❌ Manga not found:', mangaId);
        return res.status(404).json({ message: 'Manga not found' });
      }
      actualMangaId = manga._id.toString();
      console.log('✅ Found manga ObjectId:', actualMangaId);
    }
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('❌ User not found:', decoded.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize arrays if they don't exist
    if (!user.readingHistory) {
      user.readingHistory = [];
    }
    if (!user.continueReading) {
      user.continueReading = [];
    }

    // ⭐ ADD THIS NEW CLEANUP CODE HERE
console.log('🧹 Cleaning up invalid entries...');
console.log('Before cleanup - history length:', user.readingHistory.length);
console.log('Before cleanup - continue reading length:', user.continueReading.length);

user.readingHistory = user.readingHistory.filter(h => 
  h.manga && h.chapter && h.chapterNumber && h.totalPages
);
user.continueReading = user.continueReading.filter(c => 
  c.manga && c.chapter && c.chapterNumber
);

console.log('After cleanup - history length:', user.readingHistory.length);
console.log('After cleanup - continue reading length:', user.continueReading.length);

    const isCompleted = currentPage >= Math.floor(totalPages * 0.9);

    // Use actualMangaId instead of mangaId
    const existingHistoryIndex = user.readingHistory.findIndex(
      h => h?.manga?.toString() === actualMangaId && h?.chapter?.toString() === chapterId
    );

    console.log('📚 Existing history index:', existingHistoryIndex);

    if (existingHistoryIndex !== -1) {
      console.log('🔄 Updating existing history entry');
      const existing = user.readingHistory[existingHistoryIndex];
      user.readingHistory[existingHistoryIndex] = {
        manga: actualMangaId,  // Use actualMangaId
        chapter: chapterId,
        chapterNumber,
        currentPage,
        totalPages,
        isCompleted,
        lastReadAt: new Date(),
        readingTime: (existing.readingTime || 0) + (readingTime || 0)
      };
    } else {
      console.log('➕ Creating new history entry');
      user.readingHistory.push({
        manga: actualMangaId,  // Use actualMangaId
        chapter: chapterId,
        chapterNumber,
        currentPage,
        totalPages,
        isCompleted,
        lastReadAt: new Date(),
        readingTime: readingTime || 0
      });
    }

    // Use actualMangaId for continue reading
    const existingContinueIndex = user.continueReading.findIndex(
      c => c?.manga?.toString() === actualMangaId
    );

    if (!isCompleted) {
      if (existingContinueIndex !== -1) {
        console.log('🔄 Updating continue reading');
        user.continueReading[existingContinueIndex] = {
          manga: actualMangaId,  // Use actualMangaId
          chapter: chapterId,
          chapterNumber,
          currentPage,
          lastReadAt: new Date()
        };
      } else {
        console.log('➕ Adding to continue reading');
        user.continueReading.push({
          manga: actualMangaId,  // Use actualMangaId
          chapter: chapterId,
          chapterNumber,
          currentPage,
          lastReadAt: new Date()
        });
      }
    } else if (existingContinueIndex !== -1) {
      console.log('✅ Removing from continue reading (completed)');
      user.continueReading.splice(existingContinueIndex, 1);
    }

    user.continueReading.sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));
    user.continueReading = user.continueReading.slice(0, 20);

    user.markModified('readingHistory');
    user.markModified('continueReading');

    await user.save();
    console.log('✅ Reading progress saved successfully!');

    res.json({ 
      message: 'Reading progress updated',
      isCompleted,
      continueReading: user.continueReading.length,
      totalHistory: user.readingHistory.length
    });
  } catch (error) {
    console.error('❌ Update reading progress error:', error);
    res.status(500).json({ message: 'Error updating reading progress' });
  }
});

router.get('/reading-history', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { page = 1, limit = 20, filter = 'all' } = req.query;
    
    // Don't use populate - fetch user first
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let history = user.readingHistory || [];
    
    // Filter out entries with null manga
    history = history.filter(h => h.manga);

    if (filter === 'completed') {
      history = history.filter(h => h.isCompleted);
    } else if (filter === 'reading') {
      history = history.filter(h => !h.isCompleted);
    }

    history.sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedHistory = history.slice(startIndex, endIndex);

    // ⭐ Manually fetch manga and chapter data for each history item
const enrichedHistory = await Promise.all(
  paginatedHistory.map(async (item) => {
    try {
  const manga = await Manga.findById(item.manga);
  
  // ⭐ Find chapter embedded in manga document instead of separate collection
  let chapter = null;
  if (manga) {
    // Check if manga has volumes
    if (manga.hasVolumes && manga.volumes) {
      // Search in volumes
      for (const volume of manga.volumes) {
        chapter = volume.chapters?.find(ch => ch._id?.toString() === item.chapter?.toString());
        if (chapter) break;
      }
    }
    
    // If not found in volumes or no volumes, search in flat chapters array
    if (!chapter && manga.chapters) {
      chapter = manga.chapters.find(ch => ch._id?.toString() === item.chapter?.toString());
    }
  }

  console.log('Enriching item:', {
    mangaId: item.manga,
    chapterId: item.chapter,
    foundManga: !!manga,
    foundChapter: !!chapter,
    mangaTitle: manga?.title,
    chapterTitle: chapter?.title
  });
  
  return {
    _id: item._id,
    chapterNumber: item.chapterNumber,
    currentPage: item.currentPage,
    totalPages: item.totalPages,
    isCompleted: item.isCompleted,
    lastReadAt: item.lastReadAt,
    readingTime: item.readingTime,
    manga: manga ? {
      _id: manga._id,
      title: manga.title,
      coverImage: manga.coverImage,
      status: manga.status,
      genres: manga.genres
    } : { title: 'Unknown Manga' },
    chapter: chapter ? {
      _id: chapter._id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title
    } : null
  };
} catch (err) {
  console.error('Error enriching history item:', err);
  return {
    _id: item._id,
    chapterNumber: item.chapterNumber,
    currentPage: item.currentPage,
    totalPages: item.totalPages,
    isCompleted: item.isCompleted,
    lastReadAt: item.lastReadAt,
    readingTime: item.readingTime,
    manga: { title: 'Error loading manga' },
    chapter: null
  };
}
})
);

    res.json({
      history: enrichedHistory,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(history.length / limit),
        count: history.length,
        hasNext: endIndex < history.length,
        hasPrev: startIndex > 0
      }
    });
  } catch (error) {
    console.error('Get reading history error:', error);
    res.status(500).json({ message: 'Error fetching reading history' });
  }
});

// Get reading statistics
router.get('/reading-stats', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const history = user.readingHistory || [];
    const totalChaptersRead = history.length;
    const completedChapters = history.filter(h => h.isCompleted).length;
    const totalReadingTime = history.reduce((sum, h) => sum + (h.readingTime || 0), 0);
    
    // Filter out undefined manga IDs before converting to string
    const uniqueManga = [...new Set(
      history
        .filter(h => h.manga) // Filter out entries with undefined manga
        .map(h => h.manga.toString())
    )];
    
    const readingDates = [...new Set(
      history
        .filter(h => h.lastReadAt) // Filter out entries with undefined date
        .map(h => new Date(h.lastReadAt).toDateString())
    )];
    readingDates.sort((a, b) => new Date(b) - new Date(a));
    
    let currentStreak = 0;
    let today = new Date();
    
    for (let i = 0; i < readingDates.length; i++) {
      const readDate = new Date(readingDates[i]);
      const daysDiff = Math.floor((today - readDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === i) {
        currentStreak++;
      } else {
        break;
      }
    }

    res.json({
      totalChaptersRead,
      completedChapters,
      totalReadingTime: Math.floor(totalReadingTime / 60), // Convert to minutes
      uniqueMangaRead: uniqueManga.length,
      currentStreak,
      continueReadingCount: user.continueReading?.length || 0
    });
  } catch (error) {
    console.error('Get reading stats error:', error);
    res.status(500).json({ message: 'Error fetching reading stats' });
  }
});

// Get continue reading list
router.get('/continue-reading', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Manually fetch manga and chapter data
    const enrichedContinueReading = await Promise.all(
      (user.continueReading || []).map(async (item) => {
        try {
          const manga = await Manga.findById(item.manga);
          const chapter = item.chapter ? await Chapter.findById(item.chapter) : null;
          
          if (!manga) return null; // Skip if manga not found
          
          return {
            manga: {
              _id: manga._id,
              title: manga.title,
              coverImage: manga.coverImage
            },
            chapter: chapter ? {
              _id: chapter._id,
              chapterNumber: chapter.chapterNumber,
              title: chapter.title
            } : null,
            chapterNumber: item.chapterNumber,
            currentPage: item.currentPage,
            lastReadAt: item.lastReadAt
          };
        } catch (err) {
          console.error('Error enriching continue reading item:', err);
          return null;
        }
      })
    );

    // Filter out null entries and limit to 20
    const continueReading = enrichedContinueReading
      .filter(item => item !== null)
      .slice(0, 20);

    res.json({
      continueReading
    });
  } catch (error) {
    console.error('Get continue reading error:', error);
    res.status(500).json({ message: 'Error fetching continue reading list' });
  }
});

// ==================== PASSWORD RESET ROUTES ====================

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  console.log('🔵 Forgot password route hit!');
  console.log('🔵 Email:', req.body.email);
  
  try {
    const { email } = req.body;
    
    console.log('🔵 Looking for user...');
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('🔵 User not found');
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    console.log('🔵 User found, generating token...');
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();
    console.log('🔵 Token saved to database');

    console.log('🔵 About to import email service...');
    const { sendPasswordResetEmail } = await import('../services/emailService.js');
    console.log('🔵 Email service imported, sending email...');
    
    const emailResult = await sendPasswordResetEmail(user.email, resetToken);
    console.log('🔵 Email result:', emailResult);
    
    if (!emailResult.success) {
      console.error('🔴 Failed to send reset email:', emailResult.error);
      return res.status(500).json({ message: 'Error sending reset email' });
    }

    console.log('✅ Everything successful!');
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('🔴 Forgot password error:', error);
    res.status(500).json({ message: 'Error processing password reset request' });
  }
});

// Reset Password
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Hash the token from URL to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// Replace the old debug route with this:
router.get('/debug-chapters', async (req, res) => {
  try {
    // Get the actual collection name
    const collectionName = Chapter.collection.name;
    
    // Try to find chapters multiple ways
    const byMangaId = await Chapter.find({ mangaId: 'onepiece' }).limit(5);
    const allChapters = await Chapter.find({}).limit(10);
    const directById = await Chapter.findById('68d75049e1e76a5f2054bd30');
    
    // Also check raw MongoDB collection
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    res.json({
      modelCollectionName: collectionName,
      allCollections: collectionNames,
      searchByMangaId: {
        count: byMangaId.length,
        chapters: byMangaId.map(c => ({
          _id: c._id,
          mangaId: c.mangaId,
          chapterNumber: c.chapterNumber,
          title: c.title
        }))
      },
      allChapters: {
        count: allChapters.length,
        chapters: allChapters.map(c => ({
          _id: c._id,
          mangaId: c.mangaId,
          chapterNumber: c.chapterNumber,
          title: c.title
        }))
      },
      searchingForId: '68d75049e1e76a5f2054bd30',
      directSearch: directById ? {
        found: true,
        id: directById._id,
        mangaId: directById.mangaId,
        chapterNumber: directById.chapterNumber
      } : 'NOT FOUND'
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export default router;