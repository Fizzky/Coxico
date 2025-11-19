import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import timeout from 'connect-timeout';

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
import webhookRoutes from './routes/webhooks.js';
import feedbackRoutes from './routes/feedback.js';

const app = express();

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check if request is secure (handled by Railway/Vercel reverse proxy)
    if (req.header('x-forwarded-proto') !== 'https' && req.header('host') !== `localhost:${process.env.PORT}`) {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

//Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false // Allow embedding if needed
}));
app.use(mongoSanitize())
app.use(xss())
app.use(hpp())

// Body parsing middleware (must come before CORS)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ 
  extended: true, 
  limit: "50mb",
  parameterLimit: 50000
}));

app.use(timeout('600s')); 
app.use((req, res, next) => {
  res.on('finish', () => {
    req.body = null;
    req.files = null;
  });
  next();
});

// Rate limiting - Protect auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts, please try again later'
});

// General API rate limiting (protect against DDoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/", apiLimiter); // Apply to all API routes except auth (which has stricter limits)

// ---------- CORS Configuration (Production Ready) ----------
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://www.coxico.xyz',
  'https://coxico.xyz',
  'https://coxico-1g917f1z6-hafizs-projects-12fe0b3f.vercel.app',
  'https://coxico.vercel.app',
  process.env.FRONTEND_URL // Dynamic frontend URL from environment
].filter(Boolean); // Remove undefined values

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

// Body parsing already configured above

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
app.use('/api/webhooks', webhookRoutes);
app.use('/api/feedback', feedbackRoutes);

// ---------- Global Error Handler Middleware (MUST be after routes) ----------
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      message: 'Validation error',
      errors: isDevelopment ? err.errors : undefined
    });
  }
  
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  
  // Default error response
  res.status(err.status || 500).json({ 
    message: err.message || 'Server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// ---------- 404 Handler ----------
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

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
        admin: '/api/admin',
        webhooks: '/api/webhooks',
        feedback: '/api/feedback'
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

  // SOLUTION 5: Memory monitoring
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`💾 Memory: ${Math.round(used.heapUsed / 1024 / 1024)} MB / ${Math.round(used.heapTotal / 1024 / 1024)} MB`);
  
  // Force cleanup if memory is high
  if (used.heapUsed / used.heapTotal > 0.9) {
    console.log('⚠️ High memory usage! Forcing garbage collection...');
    if (global.gc) {
      global.gc();
    }
  }
}, 30000); // Check every 30 seconds

// SOLUTION 6: Process error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Give time to log before exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit on unhandled rejection, but log it
  // This prevents crashes from async errors
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB:', err);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB:', err);
    process.exit(1);
  }
});
});