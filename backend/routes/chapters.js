// backend/routes/chapters.js - Replace your current file with this volume-aware version
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your manga folder
const MANGA_DIR = path.join(__dirname, '..', 'manga');

// Helper function to find manga folder by ID
const findMangaFolder = (mangaId) => {
  try {
    const mangaFolders = fs.readdirSync(MANGA_DIR);
    return mangaFolders.find(folder => 
      folder.toLowerCase().replace(/[^a-z0-9]/g, '') === mangaId
    );
  } catch (error) {
    return null;
  }
};

// Helper function to get all chapters for a manga with volume support
const getMangaChapters = (mangaFolder) => {
  const mangaPath = path.join(MANGA_DIR, mangaFolder);
  const mangaContents = fs.readdirSync(mangaPath);
  
  // Check for volume-based structure
  const volumeFolders = mangaContents.filter(item => {
    const itemPath = path.join(mangaPath, item);
    return fs.statSync(itemPath).isDirectory() && 
           (item.toLowerCase().includes('volume') || item.toLowerCase().includes('vol'));
  });
  
  let allChapters = [];
  
  if (volumeFolders.length > 0) {
    // Volume-based structure
    volumeFolders.forEach(volumeFolder => {
      const volumePath = path.join(mangaPath, volumeFolder);
      const chaptersPath = path.join(volumePath, 'chapters');
      
      if (fs.existsSync(chaptersPath)) {
        const chapterFolders = fs.readdirSync(chaptersPath);
        const volumeMatch = volumeFolder.match(/(?:volume|vol)\s*(\d+)/i);
        const volumeNumber = volumeMatch ? parseInt(volumeMatch[1]) : 1;
        
        const volumeChapters = chapterFolders
          .filter(chapterFolder => fs.statSync(path.join(chaptersPath, chapterFolder)).isDirectory())
          .map((chapterFolder, index) => {
            const chapterMatch = chapterFolder.match(/^(\d+)/);
            const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : index + 1;
            
            const titleMatch = chapterFolder.match(/^\d+\s*-\s*(.+)$/);
            const title = titleMatch ? titleMatch[1] : chapterFolder;
            
            return {
              _id: `${mangaFolder}-vol${volumeNumber}-chapter-${chapterNumber}`,
              chapterNumber,
              title,
              volumeNumber,
              volumeTitle: volumeFolder,
              uploadedAt: new Date().toISOString(),
              views: Math.floor(Math.random() * 500)
            };
          })
          .sort((a, b) => a.chapterNumber - b.chapterNumber);
        
        allChapters.push(...volumeChapters);
      }
    });
  } else {
    // Flat structure
    const chaptersPath = path.join(mangaPath, 'chapters');
    if (fs.existsSync(chaptersPath)) {
      const chapterFolders = fs.readdirSync(chaptersPath);
      allChapters = chapterFolders
        .filter(chapterFolder => fs.statSync(path.join(chaptersPath, chapterFolder)).isDirectory())
        .map((chapterFolder, index) => {
          const chapterMatch = chapterFolder.match(/^(\d+)/);
          const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : index + 1;
          
          const titleMatch = chapterFolder.match(/^\d+\s*-\s*(.+)$/);
          const title = titleMatch ? titleMatch[1] : chapterFolder;
          
          return {
            _id: `${mangaFolder}-chapter-${chapterNumber}`,
            chapterNumber,
            title,
            uploadedAt: new Date().toISOString(),
            views: Math.floor(Math.random() * 500)
          };
        })
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
    }
  }
  
  return allChapters.sort((a, b) => {
    // Sort by volume first, then chapter
    if (a.volumeNumber && b.volumeNumber && a.volumeNumber !== b.volumeNumber) {
      return a.volumeNumber - b.volumeNumber;
    }
    return a.chapterNumber - b.chapterNumber;
  });
};

// Get chapter by manga ID and chapter number (with volume support)
router.get('/manga/:mangaId/chapter/:chapterNumber', async (req, res) => {
  try {
    const { mangaId, chapterNumber } = req.params;
    const chapterNum = parseInt(chapterNumber);
    
    // Find the manga folder
    const mangaFolder = findMangaFolder(mangaId);
    if (!mangaFolder) {
      return res.status(404).json({ message: 'Manga not found' });
    }
    
    // Get all chapters for navigation
    const allChapters = getMangaChapters(mangaFolder);
    
    // Find the specific chapter
    const targetChapter = allChapters.find(ch => ch.chapterNumber === chapterNum);
    if (!targetChapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }
    
    // Build the path to the chapter folder
    const mangaPath = path.join(MANGA_DIR, mangaFolder);
    let chapterPath;
    
    if (targetChapter.volumeNumber && targetChapter.volumeTitle) {
      // Volume-based structure
      const volumePath = path.join(mangaPath, targetChapter.volumeTitle);
      const chaptersPath = path.join(volumePath, 'chapters');
      
      // Find the actual chapter folder
      const chapterFolders = fs.readdirSync(chaptersPath);
      const targetChapterFolder = chapterFolders.find(folder => {
        const match = folder.match(/^(\d+)/);
        return match && parseInt(match[1]) === chapterNum;
      });
      
      if (!targetChapterFolder) {
        return res.status(404).json({ message: 'Chapter folder not found' });
      }
      
      chapterPath = path.join(chaptersPath, targetChapterFolder);
      
      // Get pages with volume-aware URLs
      const pageFiles = fs.readdirSync(chapterPath)
        .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
        .sort();
      
      const pages = pageFiles.map(page => 
        `/manga/${encodeURIComponent(mangaFolder)}/${encodeURIComponent(targetChapter.volumeTitle)}/chapters/${encodeURIComponent(targetChapterFolder)}/${encodeURIComponent(page)}`
      );
      
      targetChapter.pages = pages;
      
    } else {
      // Flat structure
      const chaptersPath = path.join(mangaPath, 'chapters');
      const chapterFolders = fs.readdirSync(chaptersPath);
      
      const targetChapterFolder = chapterFolders.find(folder => {
        const match = folder.match(/^(\d+)/);
        return match && parseInt(match[1]) === chapterNum;
      });
      
      if (!targetChapterFolder) {
        return res.status(404).json({ message: 'Chapter folder not found' });
      }
      
      chapterPath = path.join(chaptersPath, targetChapterFolder);
      
      const pageFiles = fs.readdirSync(chapterPath)
        .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
        .sort();
      
      const pages = pageFiles.map(page => 
        `/manga/${encodeURIComponent(mangaFolder)}/chapters/${encodeURIComponent(targetChapterFolder)}/${encodeURIComponent(page)}`
      );
      
      targetChapter.pages = pages;
    }
    
    if (!targetChapter.pages || targetChapter.pages.length === 0) {
      return res.status(404).json({ message: 'No pages found for this chapter' });
    }
    
    // Create complete chapter object
    const chapter = {
      ...targetChapter,
      mangaId: {
        _id: mangaId,
        title: mangaFolder.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
      }
    };

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

export default router;