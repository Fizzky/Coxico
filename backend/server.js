import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';

// Resolve __dirname in ESM first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env with explicit path
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug: Check if .env loaded
console.log('=== Environment Variables Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✓ Loaded' : '✗ Missing');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✓ Loaded' : '✗ Missing');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✓ Loaded' : '✗ Missing');
console.log('SES_FROM_EMAIL:', process.env.SES_FROM_EMAIL);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('.env file path:', path.join(__dirname, '.env'));
console.log('===================================\n');

// NOW import other modules
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import mangaRoutes from "./routes/manga.js";
import chaptersRoutes from "./routes/chapters.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from './routes/admin.js';

const app = express();

//Security middleware
app.use(helmet())
app.use(mongoSanitize())
app.use(xss())
app.use(hpp())

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// ---------- CORS Configuration (Production Ready) ----------
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://www.coxico.xyz',
  'https://coxico.xyz'
];

// Add FRONTEND_URL from environment if specified
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ---------- Middleware ----------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ---------- Root route ----------
app.get('/', (req, res) => {
  res.json({ 
    message: 'Coxico API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      manga: '/api/manga',
      chapters: '/api/chapters',
      auth: '/api/auth',
      admin: '/api/admin'
    }
  });
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
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`🚀 API running at http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
  console.log(`📚 Manga API: http://${HOST}:${PORT}/api/manga`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});