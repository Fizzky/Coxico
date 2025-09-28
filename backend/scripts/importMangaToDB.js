import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Manga from '../models/Manga.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const S3_BUCKET = process.env.AWS_BUCKET_NAME || 'coxico';
const S3_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const S3_BASE_URL = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

const getS3Url = (key) => `${S3_BASE_URL}/${key}`;

async function importMangaToDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // IMPORTANT: Delete all existing manga first to avoid ObjectID conflicts
    const deletedCount = await Manga.deleteMany({});
    console.log(`Deleted ${deletedCount.deletedCount} existing manga documents\n`);

    const MANGA_DIR = path.join(__dirname, '../manga');
    
    if (!fs.existsSync(MANGA_DIR)) {
      console.error('Manga directory not found');
      process.exit(1);
    }

    const mangaFolders = fs.readdirSync(MANGA_DIR);
    console.log(`Found ${mangaFolders.length} manga folders to import\n`);

    for (const folder of mangaFolders) {
      const mangaPath = path.join(MANGA_DIR, folder);
      
      if (!fs.statSync(mangaPath).isDirectory()) continue;

      console.log(`Processing: ${folder}`);

      let allChapters = [];
      let volumes = [];

      const mangaContents = fs.readdirSync(mangaPath);
      const volumeFolders = mangaContents.filter(item => {
        const itemPath = path.join(mangaPath, item);
        return fs.statSync(itemPath).isDirectory() && 
               (item.toLowerCase().includes('volume') || item.toLowerCase().includes('vol'));
      });

      if (volumeFolders.length > 0) {
        volumeFolders.forEach(volumeFolder => {
          const volumePath = path.join(mangaPath, volumeFolder);
          const volumeMatch = volumeFolder.match(/(?:volume|vol)\s*(\d+)/i);
          const volumeNumber = volumeMatch ? parseInt(volumeMatch[1]) : 1;

          const chaptersPath = path.join(volumePath, 'chapters');
          if (fs.existsSync(chaptersPath)) {
            const chapterFolders = fs.readdirSync(chaptersPath);
            const volumeChapters = chapterFolders
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
                
                const pages = pageFiles.map((_, pageIndex) => {
                  const pageKey = `manga/${folder}/${volumeFolder}/${chapterFolder}/${String(pageIndex + 1).padStart(3, '0')}.jpg`;
                  return getS3Url(pageKey);
                });

                return {
                  chapterNumber,
                  title,
                  pages,
                  volumeNumber,
                  volumeTitle: volumeFolder,
                  views: 0,
                  uploadedAt: new Date()
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

        volumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
      } else {
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
              
              const pages = pageFiles.map((_, pageIndex) => {
                const pageKey = `manga/${folder}/chapters/${chapterFolder}/${String(pageIndex + 1).padStart(3, '0')}.jpg`;
                return getS3Url(pageKey);
              });

              return {
                chapterNumber,
                title,
                pages,
                views: 0,
                uploadedAt: new Date()
              };
            })
            .sort((a, b) => a.chapterNumber - b.chapterNumber);
        }
      }

      // Create string-based ID (not ObjectID)
      const mangaId = folder.toLowerCase().replace(/[^a-z0-9]/g, '');
      const coverKey = `manga/${folder}/cover.jpg`;
      
      console.log(`  Creating manga with ID: ${mangaId} (type: ${typeof mangaId})`);
      
      const mangaDoc = new Manga({
        _id: mangaId, // String ID like 'onepiece'
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
        coverImage: getS3Url(coverKey),
        rating: 7.5 + Math.random() * 2,
        views: Math.floor(Math.random() * 10000),
        favorites: 0,
        totalChapters: allChapters.length,
        hasVolumes: volumes.length > 0,
        volumes: volumes,
        chapters: allChapters,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await mangaDoc.save();
      console.log(`  Imported ${allChapters.length} chapters`);
    }

    console.log('\nAll manga imported to MongoDB successfully!');
    console.log('IDs are now string-based (e.g., "onepiece")');
    console.log('You can now safely delete the local manga folder.');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importMangaToDB();