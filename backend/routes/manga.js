// backend/routes/manga.js - Replace your current file with this volume-aware version
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your manga folder
const MANGA_DIR = path.join(__dirname, '..', 'manga');

// Helper function to scan manga directory with volume support
const scanMangaDirectory = () => {
  const mangaList = [];
  
  try {
    const mangaFolders = fs.readdirSync(MANGA_DIR);
    
    mangaFolders.forEach((folder, index) => {
      const mangaPath = path.join(MANGA_DIR, folder);
      if (fs.statSync(mangaPath).isDirectory()) {
        
        let allChapters = [];
        let volumes = [];
        
        // Check for volume-based structure first
        const mangaContents = fs.readdirSync(mangaPath);
        const volumeFolders = mangaContents.filter(item => {
          const itemPath = path.join(mangaPath, item);
          return fs.statSync(itemPath).isDirectory() && 
                 (item.toLowerCase().includes('volume') || item.toLowerCase().includes('vol'));
        });
        
        if (volumeFolders.length > 0) {
          // Volume-based structure
          volumeFolders.forEach(volumeFolder => {
            const volumePath = path.join(mangaPath, volumeFolder);
            
            // Extract volume number from folder name
            const volumeMatch = volumeFolder.match(/(?:volume|vol)\s*(\d+)/i);
            const volumeNumber = volumeMatch ? parseInt(volumeMatch[1]) : 1;
            
            // Look for chapters folder in volume
            const chaptersPath = path.join(volumePath, 'chapters');
            if (fs.existsSync(chaptersPath)) {
              const chapterFolders = fs.readdirSync(chaptersPath);
              const volumeChapters = chapterFolders
                .filter(chapterFolder => fs.statSync(path.join(chaptersPath, chapterFolder)).isDirectory())
                .map((chapterFolder, chapterIndex) => {
                  // Extract chapter number from folder name
                  const chapterMatch = chapterFolder.match(/^(\d+)/);
                  const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : chapterIndex + 1;
                  
                  // Get chapter title
                  const titleMatch = chapterFolder.match(/^\d+\s*-\s*(.+)$/);
                  const title = titleMatch ? titleMatch[1] : chapterFolder;
                  
                  // Get pages in chapter
                  const chapterPath = path.join(chaptersPath, chapterFolder);
                  const pageFiles = fs.readdirSync(chapterPath)
                    .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
                    .sort();
                  
                  const pages = pageFiles.map(page => 
                    `/manga/${encodeURIComponent(folder)}/${encodeURIComponent(volumeFolder)}/chapters/${encodeURIComponent(chapterFolder)}/${encodeURIComponent(page)}`
                  );
                  
                  return {
                    _id: `${folder}-vol${volumeNumber}-chapter-${chapterNumber}`,
                    chapterNumber,
                    title,
                    pages,
                    volumeNumber,
                    volumeTitle: volumeFolder,
                    views: Math.floor(Math.random() * 1000),
                    uploadedAt: new Date().toISOString()
                  };
                })
                .sort((a, b) => a.chapterNumber - b.chapterNumber);
              
              volumes.push({
                volumeNumber,
                volumeTitle: volumeFolder,
                chapters: volumeChapters
              });
              
              allChapters.push(...volumeChapters);
            }
          });
          
          // Sort volumes by number
          volumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
          
        } else {
          // Flat structure (original)
          const chaptersPath = path.join(mangaPath, 'chapters');
          if (fs.existsSync(chaptersPath)) {
            const chapterFolders = fs.readdirSync(chaptersPath);
            allChapters = chapterFolders
              .filter(chapterFolder => fs.statSync(path.join(chaptersPath, chapterFolder)).isDirectory())
              .map((chapterFolder, chapterIndex) => {
                const chapterMatch = chapterFolder.match(/^(\d+)/);
                const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : chapterIndex + 1;
                
                const titleMatch = chapterFolder.match(/^\d+\s*-\s*(.+)$/);
                const title = titleMatch ? titleMatch[1] : chapterFolder;
                
                const chapterPath = path.join(chaptersPath, chapterFolder);
                const pageFiles = fs.readdirSync(chapterPath)
                  .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
                  .sort();
                
                const pages = pageFiles.map(page => 
                  `/manga/${encodeURIComponent(folder)}/chapters/${encodeURIComponent(chapterFolder)}/${encodeURIComponent(page)}`
                );
                
                return {
                  _id: `${folder}-chapter-${chapterNumber}`,
                  chapterNumber,
                  title,
                  pages,
                  views: Math.floor(Math.random() * 1000),
                  uploadedAt: new Date().toISOString()
                };
              })
              .sort((a, b) => a.chapterNumber - b.chapterNumber);
          }
        }
        
        // Create manga object
        const manga = {
          _id: folder.toLowerCase().replace(/[^a-z0-9]/g, ''),
          title: folder.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          description: `Read ${folder.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')} manga online. Follow the exciting adventures and storylines.`,
          author: "Unknown Author",
          artist: "Unknown Artist",
          genres: ["Action", "Adventure", "Drama"],
          status: allChapters.length > 50 ? "completed" : "ongoing",
          coverImage: allChapters.length > 0 && allChapters[0].pages.length > 0 
            ? allChapters[0].pages[0] 
            : `/manga/${encodeURIComponent(folder)}/cover.jpg`,
          rating: 7.5 + Math.random() * 2,
          views: Math.floor(Math.random() * 10000),
          favorites: 0,
          chapters: allChapters.length,
          createdAt: new Date().toISOString(),
          chaptersData: allChapters,
          volumes: volumes, // Include volume information
          hasVolumes: volumes.length > 0
        };
        
        mangaList.push(manga);
      }
    });
    
  } catch (error) {
    console.error('Error scanning manga directory:', error);
  }
  
  return mangaList;
};

// Get all manga
router.get('/', async (req, res) => {
  try {
    const manga = scanMangaDirectory();
    res.json({ manga, total: manga.length });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search manga
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ manga: [], total: 0 });

    const allManga = scanMangaDirectory();
    const results = allManga.filter(manga => 
      manga.title.toLowerCase().includes(q) ||
      manga.description.toLowerCase().includes(q) ||
      manga.author.toLowerCase().includes(q) ||
      manga.genres.some(genre => genre.toLowerCase().includes(q))
    );

    res.json({ manga: results, total: results.length });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get manga by ID with volume-aware chapters
router.get('/:id', async (req, res) => {
  try {
    const allManga = scanMangaDirectory();
    const manga = allManga.find(m => m._id === req.params.id);
    
    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    // Return manga with chapters and volumes
    res.json({ 
      manga: {
        ...manga,
        views: manga.views + 1
      }, 
      chapters: manga.chaptersData,
      volumes: manga.volumes,
      hasVolumes: manga.hasVolumes
    });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;