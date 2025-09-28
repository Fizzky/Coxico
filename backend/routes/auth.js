// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Manga from '../models/Manga.js';

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

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { username, email, currentPassword, newPassword } = req.body;

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

// Reading progress routes
router.post('/reading-progress', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { mangaId, chapterId, chapterNumber, currentPage, totalPages, readingTime } = req.body;
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isCompleted = currentPage >= Math.floor(totalPages * 0.9);

    const existingHistoryIndex = user.readingHistory.findIndex(
      h => h.manga.toString() === mangaId && h.chapter.toString() === chapterId
    );

    if (existingHistoryIndex !== -1) {
      user.readingHistory[existingHistoryIndex] = {
        ...user.readingHistory[existingHistoryIndex],
        currentPage,
        totalPages,
        isCompleted,
        lastReadAt: new Date(),
        readingTime: (user.readingHistory[existingHistoryIndex].readingTime || 0) + (readingTime || 0)
      };
    } else {
      user.readingHistory.push({
        manga: mangaId,
        chapter: chapterId,
        chapterNumber,
        currentPage,
        totalPages,
        isCompleted,
        lastReadAt: new Date(),
        readingTime: readingTime || 0
      });
    }

    const existingContinueIndex = user.continueReading.findIndex(
      c => c.manga.toString() === mangaId
    );

    if (!isCompleted) {
      if (existingContinueIndex !== -1) {
        user.continueReading[existingContinueIndex] = {
          manga: mangaId,
          chapter: chapterId,
          chapterNumber,
          currentPage,
          lastReadAt: new Date()
        };
      } else {
        user.continueReading.push({
          manga: mangaId,
          chapter: chapterId,
          chapterNumber,
          currentPage,
          lastReadAt: new Date()
        });
      }
    } else if (existingContinueIndex !== -1) {
      user.continueReading.splice(existingContinueIndex, 1);
    }

    user.continueReading.sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));
    user.continueReading = user.continueReading.slice(0, 20);

    await user.save();

    res.json({ 
      message: 'Reading progress updated',
      isCompleted,
      continueReading: user.continueReading.length
    });
  } catch (error) {
    console.error('Update reading progress error:', error);
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
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let history = user.readingHistory;

    if (filter === 'completed') {
      history = history.filter(h => h.isCompleted);
    } else if (filter === 'reading') {
      history = history.filter(h => !h.isCompleted);
    }

    history.sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedHistory = history.slice(startIndex, endIndex);

    res.json({
      history: paginatedHistory,
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

    const continueReading = user.continueReading
      .sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt))
      .slice(0, 10);

    res.json({ continueReading });
  } catch (error) {
    console.error('Get continue reading error:', error);
    res.status(500).json({ message: 'Error fetching continue reading' });
  }
});

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

    const history = user.readingHistory;
    const totalChaptersRead = history.length;
    const completedChapters = history.filter(h => h.isCompleted).length;
    const totalReadingTime = history.reduce((sum, h) => sum + (h.readingTime || 0), 0);
    
    const uniqueManga = [...new Set(history.map(h => h.manga.toString()))];
    
    const readingDates = [...new Set(history.map(h => new Date(h.lastReadAt).toDateString()))];
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
      totalReadingTime: Math.floor(totalReadingTime / 60),
      uniqueMangaRead: uniqueManga.length,
      currentStreak,
      continueReadingCount: user.continueReading.length
    });
  } catch (error) {
    console.error('Get reading stats error:', error);
    res.status(500).json({ message: 'Error fetching reading stats' });
  }
});

export default router;