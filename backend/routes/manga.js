// backend/routes/manga.js
import express from 'express';
import Manga from '../models/Manga.js';
import Chapter from '../models/Chapter.js';

const router = express.Router();

// Get all manga
router.get('/', async (req, res) => {
  try {
    const manga = await Manga.find().limit(20).sort({ createdAt: -1 });
    res.json({ manga, total: manga.length });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get manga by ID with chapters
router.get('/:id', async (req, res) => {
  try {
    const manga = await Manga.findById(req.params.id);
    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    // Get chapters for this manga
    const chapters = await Chapter.find({ mangaId: manga._id })
      .sort({ chapterNumber: 1 })
      .select('chapterNumber title uploadedAt views');

    // Increment views
    manga.views += 1;
    await manga.save();

    res.json({
      manga,
      chapters
    });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create sample manga with chapters (for testing)
router.post('/sample', async (req, res) => {
  try {
    // Create manga
    const sampleManga = new Manga({
      title: "One Piece",
      description: "Follow Monkey D. Luffy and his crew as they search for the legendary treasure known as One Piece in order to become the next Pirate King.",
      author: "Eiichiro Oda",
      artist: "Eiichiro Oda",
      genres: ["Action", "Adventure", "Comedy", "Drama", "Shounen"],
      coverImage: "https://via.placeholder.com/300x400/0066cc/ffffff?text=One+Piece",
      rating: 9.5,
      status: "ongoing"
    });

    await sampleManga.save();

    // Create sample chapters
    const sampleChapters = [
      {
        mangaId: sampleManga._id,
        chapterNumber: 1,
        title: "Romance Dawn",
        pages: [
          "https://via.placeholder.com/800x1200/ff6b6b/ffffff?text=Page+1",
          "https://via.placeholder.com/800x1200/4ecdc4/ffffff?text=Page+2",
          "https://via.placeholder.com/800x1200/45b7d1/ffffff?text=Page+3",
          "https://via.placeholder.com/800x1200/96ceb4/ffffff?text=Page+4",
          "https://via.placeholder.com/800x1200/ffeaa7/ffffff?text=Page+5"
        ]
      },
      {
        mangaId: sampleManga._id,
        chapterNumber: 2,
        title: "They Call Him Straw Hat Luffy",
        pages: [
          "https://via.placeholder.com/800x1200/dda0dd/ffffff?text=Ch2+Page+1",
          "https://via.placeholder.com/800x1200/98d8c8/ffffff?text=Ch2+Page+2",
          "https://via.placeholder.com/800x1200/f7dc6f/ffffff?text=Ch2+Page+3",
          "https://via.placeholder.com/800x1200/bb8fce/ffffff?text=Ch2+Page+4"
        ]
      },
      {
        mangaId: sampleManga._id,
        chapterNumber: 3,
        title: "Introduce Yourself",
        pages: [
          "https://via.placeholder.com/800x1200/f1948a/ffffff?text=Ch3+Page+1",
          "https://via.placeholder.com/800x1200/00b894/ffffff?text=Ch3+Page+2",
          "https://via.placeholder.com/800x1200/0984e3/ffffff?text=Ch3+Page+3"
        ]
      }
    ];

    await Chapter.insertMany(sampleChapters);

    // Update manga chapter count
    sampleManga.chapters = sampleChapters.length;
    await sampleManga.save();

    res.status(201).json({ 
      message: 'Sample manga with chapters created!', 
      manga: sampleManga,
      chaptersCount: sampleChapters.length
    });
  } catch (error) {
    console.error('Error creating sample manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create another sample manga
router.post('/sample2', async (req, res) => {
  try {
    const sampleManga = new Manga({
      title: "Attack on Titan",
      description: "Humanity fights for survival against giant humanoid Titans that have brought civilization to the brink of extinction.",
      author: "Hajime Isayama",
      artist: "Hajime Isayama",
      genres: ["Action", "Drama", "Fantasy", "Military", "Shounen"],
      coverImage: "https://via.placeholder.com/300x400/8b0000/ffffff?text=Attack+on+Titan",
      rating: 9.0,
      status: "completed"
    });

    await sampleManga.save();

    const sampleChapters = [
      {
        mangaId: sampleManga._id,
        chapterNumber: 1,
        title: "To You, in 2000 Years",
        pages: [
          "https://via.placeholder.com/800x1200/2c3e50/ffffff?text=AOT+Ch1+P1",
          "https://via.placeholder.com/800x1200/34495e/ffffff?text=AOT+Ch1+P2",
          "https://via.placeholder.com/800x1200/e74c3c/ffffff?text=AOT+Ch1+P3"
        ]
      }
    ];

    await Chapter.insertMany(sampleChapters);
    sampleManga.chapters = sampleChapters.length;
    await sampleManga.save();

    res.status(201).json({ 
      message: 'Second sample manga created!', 
      manga: sampleManga 
    });
  } catch (error) {
    console.error('Error creating sample manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;