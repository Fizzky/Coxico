import express from 'express';
import rateLimit from 'express-rate-limit';
import Feedback from '../models/Feedback.js';
const router = express.Router();

// Rate limiting: 5 feedback submissions per hour per IP
const feedbackRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many feedback submissions, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/feedback
 * Submit user feedback
 */
router.post('/', feedbackRateLimit, async (req, res) => {
  try {
    const { rating, category, message, deviceInfo, appVersion, platform, timestamp } = req.body;

    // Validate required fields
    if (!rating || !category || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rating, category, and message are required.',
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5.',
      });
    }

    // Validate category
    const validCategories = ['general', 'bug', 'feature_request', 'ui_ux', 'performance', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category.',
      });
    }

    // Validate message length
    if (message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Feedback message must be at least 10 characters.',
      });
    }

    // Create feedback document
    const feedback = new Feedback({
      rating: parseInt(rating),
      category,
      message: message.trim(),
      deviceInfo: deviceInfo || 'Unknown',
      appVersion: appVersion || 'Unknown',
      platform: platform || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      // Optional: Link to user if authenticated
      userId: req.user?._id || null,
    });

    await feedback.save();

    // Log critical bugs or low ratings for immediate attention
    if (category === 'bug' || rating <= 2) {
      console.error('⚠️ CRITICAL FEEDBACK:', {
        rating,
        category,
        message: message.substring(0, 100),
        userId: feedback.userId,
        timestamp: feedback.timestamp,
      });
      
      // Optional: Send email notification for critical issues
      // await sendCriticalFeedbackEmail(feedback);
    }

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully. Thank you!',
      feedbackId: feedback._id,
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback. Please try again later.',
    });
  }
});

/**
 * GET /api/feedback (Admin only)
 * Get all feedback submissions
 */
router.get('/', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Admin access required.',
      });
    }

    const { category, minRating, limit = 50, skip = 0, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;

    // Build query
    const query = {};
    if (category) query.category = category;
    if (minRating) query.rating = { $gte: parseInt(minRating) };

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const feedback = await Feedback.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('userId', 'username email')
      .lean();

    const total = await Feedback.countDocuments(query);

    res.json({
      success: true,
      feedback,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + feedback.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback.',
    });
  }
});

/**
 * GET /api/feedback/stats (Admin only)
 * Get feedback statistics
 */
router.get('/stats', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Admin access required.',
      });
    }

    const stats = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalFeedback: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
          categoryDistribution: {
            $push: '$category',
          },
        },
      },
    ]);

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats[0]?.ratingDistribution) {
      stats[0].ratingDistribution.forEach((rating) => {
        ratingDistribution[rating]++;
      });
    }

    // Calculate category distribution
    const categoryDistribution = {};
    if (stats[0]?.categoryDistribution) {
      stats[0].categoryDistribution.forEach((category) => {
        categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      });
    }

    res.json({
      success: true,
      stats: {
        averageRating: stats[0]?.averageRating?.toFixed(2) || 0,
        totalFeedback: stats[0]?.totalFeedback || 0,
        ratingDistribution,
        categoryDistribution,
      },
    });
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback statistics.',
    });
  }
});

export default router;

