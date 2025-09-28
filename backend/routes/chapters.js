// backend/routes/chapters.js - MongoDB version
import express from 'express';
import Manga from '../models/Manga.js';

const router = express.Router();

// Get chapter by manga ID and chapter number (with volume support)
router.get('/manga/:mangaId/chapter/:chapterNumber', async (req, res) => {
  try {
    const { mangaId, chapterNumber } = req.params;
    const chapterNum = parseInt(chapterNumber);
    
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
    
    // Increment chapter views in the database
    if (manga.hasVolumes) {
      // Find and update chapter in volume
      for (let volume of manga.volumes) {
        const chapterIndex = volume.chapters.findIndex(ch => ch.chapterNumber === chapterNum);
        if (chapterIndex !== -1) {
          volume.chapters[chapterIndex].views = (volume.chapters[chapterIndex].views || 0) + 1;
          break;
        }
      }
    } else {
      // Find and update chapter in flat structure
      const chapterIndex = manga.chapters.findIndex(ch => ch.chapterNumber === chapterNum);
      if (chapterIndex !== -1) {
        manga.chapters[chapterIndex].views = (manga.chapters[chapterIndex].views || 0) + 1;
      }
    }
    
    await manga.save();
    
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

export default router;