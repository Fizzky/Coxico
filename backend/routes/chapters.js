// backend/routes/chapters.js
import express from 'express';
import Chapter from '../models/Chapter.js';
import Manga from '../models/Manga.js';

const router = express.Router();

// Get chapter by manga ID and chapter number
router.get('/manga/:mangaId/chapter/:chapterNumber', async (req, res) => {
  try {
    const { mangaId, chapterNumber } = req.params;
    
    // Find the specific chapter
    const chapter = await Chapter.findOne({ 
      mangaId, 
      chapterNumber: parseInt(chapterNumber) 
    }).populate('mangaId', 'title');
    
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Get all chapters for navigation
    const allChapters = await Chapter.find({ mangaId })
      .sort({ chapterNumber: 1 })
      .select('chapterNumber title uploadedAt');

    // Increment views
    chapter.views += 1;
    await chapter.save();

    res.json({
      chapter,
      allChapters,
      manga: chapter.mangaId
    });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chapter by ID
router.get('/:id', async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id).populate('mangaId', 'title');
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Increment views
    chapter.views += 1;
    await chapter.save();

    res.json(chapter);
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;