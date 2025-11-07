// backend/routes/manga.js - MongoDB version
import express from 'express';
import Manga from '../models/Manga.js';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/with-chapters', async (req, res) => {
  try {
    const manga = await Manga.find(); // Include chapters and volumes
    res.json({ manga, total: manga.length });
  } catch (error) {
    console.error('Error fetching manga with chapters:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all manga
router.get('/', async (req, res) => {
  try {
    const manga = await Manga.find().select('-chapters -volumes');
    res.json({ manga, total: manga.length });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search manga
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ manga: [], total: 0 });

    const results = await Manga.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } },
        { genres: { $regex: q, $options: 'i' } }
      ]
    }).select('-chapters -volumes');

    res.json({ manga: results, total: results.length });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dynamic slug-to-ObjectId lookup route for favorites system
router.get('/search-by-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Try exact ID match first
    let manga = await Manga.findById(slug).select('_id title');
    
    if (!manga) {
      // Try flexible matching
      const searchPatterns = [
        slug,
        slug.replace(/([a-z])([A-Z])/g, '$1 $2'),
        slug.replace(/\s+/g, ''),
        slug.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, l => l.toUpperCase())
      ];
      
      for (const pattern of searchPatterns) {
        manga = await Manga.findOne({
          $or: [
            { title: { $regex: `^${pattern}$`, $options: 'i' } },
            { title: { $regex: pattern.replace(/\s+/g, ''), $options: 'i' } },
            { _id: pattern.toLowerCase() }
          ]
        }).select('_id title');
        
        if (manga) break;
      }
    }
    
    // Fallback: partial match
    if (!manga) {
      manga = await Manga.findOne({
        $or: [
          { title: { $regex: slug, $options: 'i' } },
          { _id: { $regex: slug, $options: 'i' } }
        ]
      }).select('_id title');
    }
    
    // Special case for "piece" queries
    if (!manga && slug.toLowerCase().includes('piece')) {
      manga = await Manga.findOne({
        title: { $regex: 'piece', $options: 'i' }
      }).select('_id title');
    }
    
    if (manga) {
      res.json({ manga });
    } else {
      res.status(404).json({ message: 'Manga not found' });
    }
  } catch (error) {
    console.error('Search by slug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get manga by ID with volume-aware chapters
router.get('/:id', async (req, res) => {
  try {
    const manga = await Manga.findById(req.params.id);
    
    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    // ✅ DON'T increment views here - just return data
    res.json({ 
      manga,
      chapters: manga.chapters,
      volumes: manga.volumes,
      hasVolumes: manga.hasVolumes
    });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Rate manga (requires authentication)
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { rating } = req.body;
    const mangaId = req.params.id;
    const userId = req.user._id;

    // Validate rating
    if (!rating || rating < 1 || rating > 10) {
      return res.status(400).json({ message: 'Rating must be between 1 and 10' });
    }

    // Find user and check if already rated
    const user = await User.findById(userId);
    const existingRating = user.mangaRatings.find(r => r.mangaId === mangaId);

    if (existingRating) {
      // Update existing rating
      existingRating.rating = rating;
      existingRating.ratedAt = new Date();
    } else {
      // Add new rating
      user.mangaRatings.push({
        mangaId,
        rating,
        ratedAt: new Date()
      });
    }

    await user.save();

    // Recalculate manga average rating
    await updateMangaRating(mangaId);

    res.json({ message: 'Rating saved successfully', rating });
  } catch (error) {
    console.error('Error rating manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's rating for a manga
router.get('/:id/user-rating', auth, async (req, res) => {
  try {
    const mangaId = req.params.id;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const userRating = user.mangaRatings.find(r => r.mangaId === mangaId);

    res.json({ 
      userRating: userRating ? userRating.rating : null 
    });
  } catch (error) {
    console.error('Error getting user rating:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track manga view (call this when user opens manga)
router.post('/:id/view', async (req, res) => {
  try {
    console.log('📊 View tracked for manga:', req.params.id);
    const manga = await Manga.findById(req.params.id);
    if (manga) {
      console.log('📈 Before - Views:', manga.views);
      manga.views += 1;
      await manga.save();
      console.log('📈 After - Views:', manga.views);
    }
    res.json({ message: 'View tracked' });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to recalculate manga rating
async function updateMangaRating(mangaId) {
  try {
    // Get all users who rated this manga
    const users = await User.find({ 
      'mangaRatings.mangaId': mangaId 
    }, { 
      mangaRatings: 1 
    });

    // Extract ratings for this manga
    const ratings = [];
    users.forEach(user => {
      const rating = user.mangaRatings.find(r => r.mangaId === mangaId);
      if (rating) ratings.push(rating.rating);
    });

    // Calculate average
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
      : 0;

    // Update manga
    await Manga.findByIdAndUpdate(mangaId, {
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalRatings: ratings.length
    });

  } catch (error) {
    console.error('Error updating manga rating:', error);
  }
}

export default router;