// backend/routes/admin.js
import express from 'express';
import { body, validationResult } from 'express-validator';
import Manga from '../models/Manga.js';
import Chapter from '../models/Chapter.js';
import User from '../models/User.js';
import { adminAuth } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';

const router = express.Router();

// Lazy-load upload middleware
let uploadMiddleware = null;

function getUploadMiddleware() {
  if (!uploadMiddleware) {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    console.log('Initializing S3 upload middleware...');
    console.log('Bucket:', process.env.AWS_BUCKET_NAME);
    console.log('Region:', process.env.AWS_REGION);
    console.log('Access Key:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set');

    uploadMiddleware = multer({
      storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_BUCKET_NAME || 'coxico',
        key: function (req, file, cb) {
          const mangaId = req.body.mangaId || 'temp';
          const chapterNum = req.body.chapterNumber || '1';
          const timestamp = Date.now();
          cb(null, `manga/${mangaId}/chapter-${chapterNum}/${timestamp}-${file.originalname}`);
        }
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
        files: 200 // Increased to 200 files
      }
    });
  }
  return uploadMiddleware;
}

// Admin login (create admin user if doesn't exist)
router.post('/login', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if admin user exists
    let admin = await User.findOne({ email, role: 'admin' });
    
    // If no admin exists, create one (for first-time setup)
    if (!admin) {
      const hashedPassword = await bcrypt.hash(password, 12);
      admin = new User({
        email,
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
      await admin.save();
      
      const token = jwt.sign(
        { userId: admin._id.toString(), role: admin.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Admin account created and logged in',
        token,
        user: admin.toJSON()
      });
    }

    // Check password for existing admin
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: admin._id.toString(), role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      user: admin.toJSON()
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload cover image (using lazy-loaded middleware)
router.post('/upload-cover', adminAuth, (req, res, next) => {
  const upload = getUploadMiddleware().fields([
    { name: 'cover', maxCount: 1 }
  ]);
  upload(req, res, next);
}, async (req, res) => {
  try {
    if (!req.files || !req.files.cover || req.files.cover.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const file = req.files.cover[0];
    res.json({
      success: true,
      url: file.location,
      key: file.key
    });
  } catch (error) {
    console.error('Cover upload error:', error);
    res.status(500).json({ error: 'Failed to upload cover' });
  }
});

// Upload chapter pages (using lazy-loaded middleware)
router.post('/upload-pages', adminAuth, (req, res, next) => {
  const upload = getUploadMiddleware().fields([
    { name: 'pages', maxCount: 200 }
  ]);
  upload(req, res, next);
}, async (req, res) => {
  try {
    if (!req.files || !req.files.pages || req.files.pages.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const pageUrls = req.files.pages.map(file => file.location);
    res.json({
      success: true,
      pages: pageUrls
    });
  } catch (error) {
    console.error('Pages upload error:', error);
    res.status(500).json({ error: 'Failed to upload pages' });
  }
});

// Create new manga with chapters
router.post('/create-manga', adminAuth, async (req, res) => {
  try {
    const {
      mangaId,
      title,
      description,
      author,
      artist,
      genres,
      status,
      coverImage,
      chapters
    } = req.body;

    const newManga = new Manga({
      _id: mangaId,
      title,
      description,
      author,
      artist,
      genres,
      status,
      coverImage,
      rating: 0,
      views: 0,
      favorites: 0,
      totalChapters: chapters.length,
      hasVolumes: false,
      chapters,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newManga.save();

    res.json({
      success: true,
      manga: newManga
    });
  } catch (error) {
    console.error('Create manga error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new manga (original route)
router.post('/manga', [
  adminAuth,
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('author').trim().notEmpty().withMessage('Author is required'),
  body('artist').trim().notEmpty().withMessage('Artist is required'),
  body('genres').isArray().withMessage('Genres must be an array'),
  body('coverImage').trim().notEmpty().withMessage('Cover image URL is required'),
  body('status').optional().isIn(['ongoing', 'completed', 'hiatus'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const manga = new Manga(req.body);
    await manga.save();

    res.status(201).json({ 
      message: 'Manga created successfully', 
      manga 
    });
  } catch (error) {
    console.error('Create manga error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Manga with this title already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Update manga
router.put('/manga/:id', [
  adminAuth,
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim().notEmpty(),
  body('author').optional().trim().notEmpty(),
  body('artist').optional().trim().notEmpty(),
  body('genres').optional().isArray(),
  body('status').optional().isIn(['ongoing', 'completed', 'hiatus'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const manga = await Manga.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    res.json({ 
      message: 'Manga updated successfully', 
      manga 
    });
  } catch (error) {
    console.error('Update manga error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete manga
router.delete('/manga/:id', adminAuth, async (req, res) => {
  try {
    const manga = await Manga.findByIdAndDelete(req.params.id);
    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    // Also delete all chapters
    await Chapter.deleteMany({ mangaId: manga._id });

    res.json({ message: 'Manga and all chapters deleted successfully' });
  } catch (error) {
    console.error('Delete manga error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all manga for admin (with more details)
router.get('/manga', adminAuth, async (req, res) => {
  try {
    console.log('Fetching manga for admin...');
    const manga = await Manga.find().sort({ createdAt: -1 }).lean();
    
    console.log(`Found ${manga.length} manga`);
    
    // Count embedded chapters instead of separate collection
    const mangaWithChapterCounts = manga.map(m => ({
      ...m,
      actualChapterCount: m.chapters?.length || 0  // Count from embedded array
    }));

    res.json({ manga: mangaWithChapterCounts });
  } catch (error) {
    console.error('Get admin manga error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Create new chapter
router.post('/chapters', [
  adminAuth,
  body('mangaId').isMongoId().withMessage('Valid manga ID required'),
  body('chapterNumber').isInt({ min: 1 }).withMessage('Chapter number must be positive'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('pages').isArray().withMessage('Pages must be an array').custom((pages) => {
    if (pages.length === 0) {
      throw new Error('At least one page is required');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if manga exists
    const manga = await Manga.findById(req.body.mangaId);
    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    // Check if chapter already exists
    const existingChapter = await Chapter.findOne({
      mangaId: req.body.mangaId,
      chapterNumber: req.body.chapterNumber
    });

    if (existingChapter) {
      return res.status(400).json({ message: 'Chapter already exists' });
    }

    const chapter = new Chapter(req.body);
    await chapter.save();

    // Update manga chapter count
    const chapterCount = await Chapter.countDocuments({ mangaId: req.body.mangaId });
    await Manga.findByIdAndUpdate(req.body.mangaId, { chapters: chapterCount });

    res.status(201).json({ 
      message: 'Chapter created successfully', 
      chapter 
    });
  } catch (error) {
    console.error('Create chapter error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chapters for a manga (admin)
router.get('/manga/:mangaId/chapters', adminAuth, async (req, res) => {
  try {
    console.log(`Fetching chapters for manga: ${req.params.mangaId}`);
    
    // Find manga and return its embedded chapters array
    const manga = await Manga.findById(req.params.mangaId).lean();
    
    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }
    
    const chapters = manga.chapters || [];
    console.log(`Found ${chapters.length} chapters`);
    res.json({ chapters });
  } catch (error) {
    console.error('Get chapters error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Update chapter
router.put('/chapters/:id', [
  adminAuth,
  body('title').optional().trim().notEmpty(),
  body('pages').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const chapter = await Chapter.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    res.json({ 
      message: 'Chapter updated successfully', 
      chapter 
    });
  } catch (error) {
    console.error('Update chapter error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete chapter
router.delete('/chapters/:id', adminAuth, async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Update manga chapter count
    const chapterCount = await Chapter.countDocuments({ mangaId: chapter.mangaId });
    await Manga.findByIdAndUpdate(chapter.mangaId, { chapters: chapterCount });

    res.json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error('Delete chapter error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Create user
router.post('/users', adminAuth, async (req, res) => {
  try {
    const { username, email, password, role, isActive } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role: role || 'user',
      isActive: isActive !== undefined ? isActive : true
    });
    
    res.json({ message: 'User created successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user: ' + error.message });
  }
});

// Update user
router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { username, email, password, role, isActive } = req.body;
    const updateData = { username, email, role, isActive };
    
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password, 12);
    }
    
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user: ' + error.message });
  }
});

// Delete user
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Toggle user status
router.patch('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select('-password');
    res.json({ message: 'User status updated', user });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Error updating user status' });
  }
});

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    console.log('Fetching admin stats...');
    
    const totalManga = await Manga.countDocuments();
    
    // Count total chapters from all manga documents
    const allManga = await Manga.find().select('chapters').lean();
    const totalChapters = allManga.reduce((sum, m) => sum + (m.chapters?.length || 0), 0);
    
    const totalUsers = await User.countDocuments({ role: 'user' });
    
    const recentManga = await Manga.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title createdAt')
      .lean();

    console.log(`Stats: ${totalManga} manga, ${totalChapters} chapters, ${totalUsers} users`);

    res.json({
      stats: {
        totalManga,
        totalChapters,
        totalUsers
      },
      recentManga
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

export default router;