// backend/routes/chapters.js - MongoDB version
import express from 'express';
import Manga from '../models/Manga.js';
import Chapter from '../models/Chapter.js';

const router = express.Router();

const VIEW_INCREMENT_WINDOW_MS = 3000;
const recentViewIncrements = new Map();

const purgeOldViewEntries = (now) => {
  for (const [key, timestamp] of recentViewIncrements.entries()) {
    if (now - timestamp > VIEW_INCREMENT_WINDOW_MS) {
      recentViewIncrements.delete(key);
    }
  }
};

// Get chapter by manga ID and chapter number (with volume support)
router.get('/manga/:mangaId/chapter/:chapterNumber', async (req, res) => {
  try {
    const { mangaId, chapterNumber } = req.params;
    const chapterNum = Number(chapterNumber);

    if (Number.isNaN(chapterNum)) {
      return res.status(400).json({ message: 'Invalid chapter number' });
    }
    
    // Find manga in MongoDB
    const manga = await Manga.findById(mangaId);
    
    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }
    
    // Get all chapters (flatten volumes if volume-based structure)
    let allChapters = [];
    
    if (manga.hasVolumes && manga.volumes.length > 0) {
      // Volume-based structure - flatten chapters from all volumes
      manga.volumes.forEach(volume => {
        volume.chapters.forEach(chapter => {
          allChapters.push({
            _id: chapter._id,
            chapterNumber: chapter.chapterNumber,
            chapterNumberLabel: chapter.chapterNumberLabel || (chapter.chapterNumber != null ? chapter.chapterNumber.toString() : null),
            title: chapter.title,
            pages: chapter.pages,
            volumeNumber: chapter.volumeNumber,
            volumeTitle: chapter.volumeTitle,
            views: chapter.views || 0,
            uploadedAt: chapter.uploadedAt
          });
        });
      });
    } else {
      // Flat structure
      allChapters = manga.chapters.map(chapter => ({
        _id: chapter._id,
        chapterNumber: chapter.chapterNumber,
        chapterNumberLabel: chapter.chapterNumberLabel || (chapter.chapterNumber != null ? chapter.chapterNumber.toString() : null),
        title: chapter.title,
        pages: chapter.pages,
        views: chapter.views || 0,
        uploadedAt: chapter.uploadedAt
      }));
    }
    
    // Sort chapters properly
    allChapters.sort((a, b) => {
      if (a.volumeNumber && b.volumeNumber && a.volumeNumber !== b.volumeNumber) {
        return a.volumeNumber - b.volumeNumber;
      }
      return a.chapterNumber - b.chapterNumber;
    });
    
    // Find the specific chapter
    const targetChapter = allChapters.find(ch => ch.chapterNumber === chapterNum);
    
    if (!targetChapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }
    
    if (!targetChapter.pages || targetChapter.pages.length === 0) {
      return res.status(404).json({ message: 'No pages found for this chapter' });
    }
    
    const clientIdentifier = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const cacheKey = `${clientIdentifier}-${mangaId}-${chapterNum}`;
    const now = Date.now();
    purgeOldViewEntries(now);

    const lastIncrement = recentViewIncrements.get(cacheKey);
    const shouldIncrementView = !lastIncrement || (now - lastIncrement) > VIEW_INCREMENT_WINDOW_MS;

    if (shouldIncrementView) {
      if (manga.hasVolumes) {
        // Find and update chapter in volume
        for (let volume of manga.volumes) {
          const chapterIndex = volume.chapters.findIndex(ch => ch.chapterNumber === chapterNum);
          if (chapterIndex !== -1) {
            const currentViews = volume.chapters[chapterIndex].views || 0;
            volume.chapters[chapterIndex].views = currentViews + 1;
            targetChapter.views = currentViews + 1;
            break;
          }
        }
      } else {
        // Find and update chapter in flat structure
        const chapterIndex = manga.chapters.findIndex(ch => ch.chapterNumber === chapterNum);
        if (chapterIndex !== -1) {
          const currentViews = manga.chapters[chapterIndex].views || 0;
          manga.chapters[chapterIndex].views = currentViews + 1;
          targetChapter.views = currentViews + 1;
        }
      }

      recentViewIncrements.set(cacheKey, now);
      await manga.save();
    }
    
    // Create response
    const chapter = {
      ...targetChapter,
      mangaId: {
        _id: manga._id,
        title: manga.title
      }
    };

    res.json({
      chapter,
      allChapters: allChapters.map(ch => ({
        _id: ch._id,
        chapterNumber: ch.chapterNumber,
        chapterNumberLabel: ch.chapterNumberLabel || (ch.chapterNumber != null ? ch.chapterNumber.toString() : null),
        title: ch.title,
        volumeNumber: ch.volumeNumber,
        volumeTitle: ch.volumeTitle
      })),
      manga: {
        _id: manga._id,
        title: manga.title,
        coverImage: manga.coverImage
      }
    });
    
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this route to backend/routes/chapters.js
router.get('/latest', async (req, res) => {
  try {
    const latestChapter = await Chapter.findOne().sort({ uploadedAt: -1 }).limit(1);
    res.json({ chapter: latestChapter });
  } catch (error) {
    console.error('Error fetching latest chapter:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;