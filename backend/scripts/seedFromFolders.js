// @ts-nocheck
// backend/scripts/seedFromFolders.js
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Manga from "../models/Manga.js";
import Chapter from "../models/Chapter.js";

dotenv.config();

/* ===================== CONFIG ===================== */

// Which manga are we importing?
const MANGA_TITLE = "One Piece";
const MANGA_SLUG  = "one-piece";  // folder under uploads/manga/<slug>

// Default metadata if not provided
const DEFAULT_AUTHOR = "Eiichiro Oda";
const DEFAULT_ARTIST = "Eiichiro Oda";
const DEFAULT_STATUS = "ongoing"; // 'ongoing' | 'completed' | 'hiatus'
const DEFAULT_GENRES = ["Action", "Adventure", "Comedy", "Shounen"];
const DEFAULT_RATING = 0;

// If your chapters are FLAT (no volume subfolders), use this mapping.
const VOLUME_MAPPINGS = [
  { range: [1, 7],  number: 1, title: "Romance Dawn" },
  { range: [9, 17], number: 2, title: "Buggy the Clown – Versus!! Bagī Kaizoku-Dan" },
];

// Filenames considered image pages
const IMAGE_REGEX = /\.(jpe?g|png|webp|gif)$/i;

/* ===================== PATHS ===================== */

const ROOT_DIR     = path.join(process.cwd(), "backend", "uploads", "manga", MANGA_SLUG);
const COVER_PATH   = path.join(ROOT_DIR, "cover.jpg");
const VOLUMES_ROOT = path.join(ROOT_DIR, "volumes");
const CHAPTERS_ROOT= path.join(ROOT_DIR, "chapters");

/* ===================== HELPERS ===================== */

const toUrl = (abs) => {
  // Convert absolute path to /uploads URL
  const rel = abs.split(path.join(process.cwd(), "backend"))[1].replace(/\\+/g, "/");
  return `/uploads${rel}`;
};

const naturalSort = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

// Accepts "Vol 1 - Romance Dawn" or "Volume 02: Buggy"
const parseVol = (name, i) => {
  const m = name.match(/vol(?:ume)?\s*(\d+)/i);
  const number = m ? parseInt(m[1], 10) : i + 1;
  const title = name.replace(/^vol(?:ume)?\s*\d+\s*[-.:]?\s*/i, "").trim() || `Volume ${number}`;
  return { number, title };
};

// Accepts "1 - Romance Dawn" or "Chapter 01 Something"
const parseChap = (name, i) => {
  const n = name.match(/(\d+)/);
  const chapterNumber = n ? parseInt(n[1], 10) : i + 1;
  const title = name.replace(/^[^0-9]*\d+\s*[-._:]?\s*/i, "").trim() || `Chapter ${chapterNumber}`;
  return { chapterNumber, title };
};

const volForChapter = (maps, ch) => {
  for (const v of maps) {
    const [a, b] = v.range;
    if (ch >= a && ch <= b) return { volumeNumber: v.number, volumeTitle: v.title };
  }
  return { volumeNumber: null, volumeTitle: null };
};

/* ===================== MAIN ===================== */

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/coxico";
  await mongoose.connect(uri);

  if (!fs.existsSync(ROOT_DIR)) throw new Error(`Folder not found: ${ROOT_DIR}`);

  const coverUrl = fs.existsSync(COVER_PATH)
    ? toUrl(COVER_PATH)
    : "https://via.placeholder.com/300x400/0066cc/ffffff?text=Cover";

  // Upsert the manga document (coverImage is required by your schema)
  const manga = await Manga.findOneAndUpdate(
    { title: MANGA_TITLE },
    {
      title: MANGA_TITLE,
      alternativeTitles: [],
      description: "Imported via seedFromFolders (volumes supported).",
      author: DEFAULT_AUTHOR,
      artist: DEFAULT_ARTIST,
      genres: DEFAULT_GENRES,
      status: DEFAULT_STATUS,
      coverImage: coverUrl,
      rating: DEFAULT_RATING,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  console.log(`Manga ready: ${manga.title} (${manga._id})`);

  let created = 0, updated = 0, skipped = 0;

  // MODE A: Nested /volumes/<Vol X - Title>/<chapter folders>
  if (fs.existsSync(VOLUMES_ROOT)) {
    const vols = fs.readdirSync(VOLUMES_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name).sort(naturalSort);

    for (let vi = 0; vi < vols.length; vi++) {
      const volName = vols[vi];
      const { number: volumeNumber, title: volumeTitle } = parseVol(volName, vi);
      const volPath = path.join(VOLUMES_ROOT, volName);

      const chDirs = fs.readdirSync(volPath, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name).sort(naturalSort);

      for (let ci = 0; ci < chDirs.length; ci++) {
        const chName = chDirs[ci];
        const { chapterNumber, title } = parseChap(chName, ci);
        const chPath = path.join(volPath, chName);

        const pages = fs.readdirSync(chPath, { withFileTypes: true })
          .filter(f => f.isFile()).map(f => f.name).filter(n => IMAGE_REGEX.test(n))
          .sort(naturalSort).map(fname => toUrl(path.join(chPath, fname)));

        if (pages.length === 0) { skipped++; continue; }

        const existing = await Chapter.findOne({ mangaId: manga._id, chapterNumber });
        if (existing) {
          existing.title = title;
          existing.pages = pages;
          existing.volumeNumber = volumeNumber;
          existing.volumeTitle  = volumeTitle;
          await existing.save(); updated++;
        } else {
          await Chapter.create({
            mangaId: manga._id,
            chapterNumber,
            title,
            pages,
            volumeNumber,
            volumeTitle
          });
          created++;
        }
      }
    }
  }

  // MODE B: Flat /chapters/<chapter folders> (use VOLUME_MAPPINGS)
  if (fs.existsSync(CHAPTERS_ROOT)) {
    const chDirs = fs.readdirSync(CHAPTERS_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name).sort(naturalSort);

    for (let ci = 0; ci < chDirs.length; ci++) {
      const folder = chDirs[ci];
      const { chapterNumber, title } = parseChap(folder, ci);
      const chPath = path.join(CHAPTERS_ROOT, folder);

      const pages = fs.readdirSync(chPath, { withFileTypes: true })
        .filter(f => f.isFile()).map(f => f.name).filter(n => IMAGE_REGEX.test(n))
        .sort(naturalSort).map(fname => toUrl(path.join(chPath, fname)));

      if (pages.length === 0) { skipped++; continue; }

      const { volumeNumber, volumeTitle } = volForChapter(VOLUME_MAPPINGS, chapterNumber);

      const existing = await Chapter.findOne({ mangaId: manga._id, chapterNumber });
      if (existing) {
        existing.title = title;
        existing.pages = pages;
        existing.volumeNumber = volumeNumber;
        existing.volumeTitle  = volumeTitle;
        await existing.save(); updated++;
      } else {
        await Chapter.create({
          mangaId: manga._id,
          chapterNumber,
          title,
          pages,
          volumeNumber,
          volumeTitle
        });
        created++;
      }
    }
  }

  const totalChapters = await Chapter.countDocuments({ mangaId: manga._id });
  manga.chapters = totalChapters;
  await manga.save();

  console.log(`\n✅ Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`Total chapters: ${totalChapters}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
