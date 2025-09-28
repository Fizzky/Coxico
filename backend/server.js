import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Resolve __dirname in ESM first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env with explicit path
dotenv.config({ path: path.join(__dirname, '.env') });

// NOW import other modules
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import mangaRoutes from "./routes/manga.js";
import chaptersRoutes from "./routes/chapters.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from './routes/admin.js';

const app = express();

// ---------- Middleware (MUST come first!) ----------
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Add your frontend URL
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- Static files ----------
// If you chose uploads/ as your static root:
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// If you kept your files in backend/manga/, keep this too:
app.use("/manga", express.static(path.join(__dirname, "manga")));

// ---------- API routes (AFTER middleware!) ----------
app.use("/api/manga", mangaRoutes);
app.use("/api/chapters", chaptersRoutes);
app.use("/api/auth", authRoutes);
app.use('/api/admin', adminRoutes);

// ---------- Basic health check route ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// ---------- DB ----------
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/coxico";

mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ---------- Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 API running at http://127.0.0.1:${PORT}`);
  console.log(`📊 Health check: http://127.0.0.1:${PORT}/api/health`);
  console.log(`📚 Manga API: http://127.0.0.1:${PORT}/api/manga`);
});