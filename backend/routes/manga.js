// backend/routes/manga.js - MongoDB version
import express from 'express';
import Manga from '../models/Manga.js';

const router = express.Router();

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

    // Increment views
    manga.views += 1;
    await manga.save();

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

export default router;