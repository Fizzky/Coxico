import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import s3Service from '../services/s3Service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

s3Service.configure();

async function migrateLocalMangaToS3() {
  const mangaDir = path.join(__dirname, '../manga');
  console.log('Starting migration to S3...');
  console.log('Looking for manga directory at:', mangaDir);
  
  if (!fs.existsSync(mangaDir)) {
    console.error('Manga directory not found:', mangaDir);
    return;
  }

  try {
    const mangaFolders = fs.readdirSync(mangaDir);
    console.log(`Found ${mangaFolders.length} manga folders\n`);
    
    for (const mangaFolder of mangaFolders) {
      const mangaPath = path.join(mangaDir, mangaFolder);
      
      if (!fs.statSync(mangaPath).isDirectory()) continue;
      
      console.log(`Processing manga: ${mangaFolder}`);
      
      // Upload cover image if exists
      const possibleCovers = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'];
      for (const coverName of possibleCovers) {
        const coverPath = path.join(mangaPath, coverName);
        if (fs.existsSync(coverPath)) {
          const coverKey = `manga/${mangaFolder}/cover.jpg`;
          await s3Service.uploadFile(coverPath, coverKey);
          break;
        }
      }
      
      // Process volumes/chapters
      const items = fs.readdirSync(mangaPath);
      const volumeFolders = items.filter(item => {
        const itemPath = path.join(mangaPath, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      console.log(`  Found ${volumeFolders.length} volumes`);
      
      for (const volumeFolder of volumeFolders) {
        const volumePath = path.join(mangaPath, volumeFolder);
        console.log(`  Processing: ${volumeFolder}`);
        
        // Check if there's a 'chapters' subdirectory
        const chaptersPath = path.join(volumePath, 'chapters');
        const searchPath = fs.existsSync(chaptersPath) ? chaptersPath : volumePath;
        
        // Get all items in the search path
        const chapterItems = fs.readdirSync(searchPath);
        
        // Look for chapter folders
        const chapterFolders = chapterItems.filter(item => {
          const itemPath = path.join(searchPath, item);
          return fs.statSync(itemPath).isDirectory();
        });
        
        if (chapterFolders.length === 0) {
          // No subfolders, images might be directly in this folder
          const imageFiles = chapterItems
            .filter(file => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file))
            .sort((a, b) => {
              const numA = parseInt(a.match(/\d+/)?.[0] || '0');
              const numB = parseInt(b.match(/\d+/)?.[0] || '0');
              return numA - numB;
            });
          
          if (imageFiles.length > 0) {
            console.log(`    Found ${imageFiles.length} images directly in folder`);
            
            for (let i = 0; i < imageFiles.length; i++) {
              const imageFile = imageFiles[i];
              const imagePath = path.join(searchPath, imageFile);
              const imageKey = `manga/${mangaFolder}/${volumeFolder}/${String(i + 1).padStart(3, '0')}.jpg`;
              
              try {
                await s3Service.uploadFile(imagePath, imageKey);
                console.log(`    Uploaded page ${i + 1}/${imageFiles.length}`);
              } catch (error) {
                console.error(`    Failed to upload ${imageFile}:`, error.message);
              }
            }
          }
        } else {
          // Process each chapter subfolder
          console.log(`    Found ${chapterFolders.length} chapter folders`);
          
          for (const chapterFolder of chapterFolders) {
            const chapterPath = path.join(searchPath, chapterFolder);
            console.log(`    Processing: ${chapterFolder}`);
            
            const imageFiles = fs.readdirSync(chapterPath)
              .filter(file => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file))
              .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                return numA - numB;
              });
            
            console.log(`      Found ${imageFiles.length} images`);
            
            for (let i = 0; i < imageFiles.length; i++) {
              const imageFile = imageFiles[i];
              const imagePath = path.join(chapterPath, imageFile);
              const imageKey = `manga/${mangaFolder}/${volumeFolder}/${chapterFolder}/${String(i + 1).padStart(3, '0')}.jpg`;
              
              try {
                await s3Service.uploadFile(imagePath, imageKey);
                console.log(`      Uploaded page ${i + 1}/${imageFiles.length}`);
              } catch (error) {
                console.error(`      Failed to upload ${imageFile}:`, error.message);
              }
            }
          }
        }
      }
      
      console.log('');
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('Your manga files are now stored in S3.');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateLocalMangaToS3();