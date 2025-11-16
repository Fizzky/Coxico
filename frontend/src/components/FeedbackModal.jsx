// Feedback Modal Component for Beta Testing
import React, { useState } from 'react';
import { X, Star, Send, Loader } from 'lucide-react';
import axios from 'axios';

const FeedbackModal = ({ isOpen, onClose }) => {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('general');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const categories = [
    { value: 'general', label: 'General Feedback' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature_request', label: 'Feature Request' },
    { value: 'ui_ux', label: 'UI/UX Issue' },
    { value: 'performance', label: 'Performance Issue' },
    { value: 'other', label: 'Other' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!feedback.trim() || feedback.trim().length < 10) {
      alert('Please provide at least 10 characters of feedback');
      return;
    }

    if (rating === 0) {
      alert('Please provide a rating');
      return;
    }

    setIsSubmitting(true);

    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      };

      const response = await axios.post('/api/feedback', {
        rating,
        category,
        message: feedback,
        deviceInfo: JSON.stringify(deviceInfo),
        timestamp: new Date().toISOString(),
      });

      if (response.status === 200 || response.status === 201) {
        setIsSubmitted(true);
        setTimeout(() => {
          onClose();
          // Reset form
          setRating(0);
          setCategory('general');
          setFeedback('');
          setIsSubmitted(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        {isSubmitted ? (
          <div className="feedback-success">
            <div className="success-icon">✓</div>
            <h2>Thank you!</h2>
            <p>Your feedback helps us improve Coxico.</p>
          </div>
        ) : (
          <>
            <div className="feedback-header">
              <h2>Send Feedback</h2>
              <button className="close-btn" onClick={onClose}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="feedback-form">
              <div className="feedback-section">
                <label>Overall Rating</label>
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${star <= rating ? 'active' : ''}`}
                      onClick={() => setRating(star)}
                      disabled={isSubmitting}
                    >
                      <Star size={32} fill={star <= rating ? '#E50914' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="feedback-section">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="feedback-section">
                <label htmlFor="feedback">Your Feedback</label>
                <textarea
                  id="feedback"
                  rows="6"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us what you think, report bugs, or suggest features..."
                  disabled={isSubmitting}
                  required
                  minLength={10}
                />
                <small>{feedback.length} characters</small>
              </div>

              <div className="feedback-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || !feedback.trim() || rating === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader size={18} className="spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <style jsx>{`
        .feedback-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }

        .feedback-modal {
          background: #1a1a1a;
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        .feedback-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 1px solid #333;
        }

        .feedback-header h2 {
          margin: 0;
          color: white;
          font-size: 24px;
        }

        .close-btn {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .close-btn:hover {
          color: white;
        }

        .feedback-form {
          padding: 24px;
        }

        .feedback-section {
          margin-bottom: 24px;
        }

        .feedback-section label {
          display: block;
          color: white;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .rating-stars {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-top: 12px;
        }

        .star-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #666;
          transition: transform 0.2s;
        }

        .star-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .star-btn.active {
          color: #E50914;
        }

        .star-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .feedback-section select,
        .feedback-section textarea {
          width: 100%;
          padding: 12px;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-family: inherit;
        }

        .feedback-section select:focus,
        .feedback-section textarea:focus {
          outline: none;
          border-color: #E50914;
        }

        .feedback-section textarea {
          resize: vertical;
          min-height: 120px;
        }

        .feedback-section small {
          display: block;
          margin-top: 4px;
          color: #999;
          font-size: 12px;
        }

        .feedback-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 32px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: #E50914;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #f40612;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #2a2a2a;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #333;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .feedback-success {
          padding: 60px 24px;
          text-align: center;
        }

        .success-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
          background: #E50914;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          color: white;
        }

        .feedback-success h2 {
          color: white;
          margin: 0 0 12px;
          font-size: 24px;
        }

        .feedback-success p {
          color: #999;
          margin: 0;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .feedback-modal {
            max-width: 100%;
            margin: 0;
            border-radius: 0;
            max-height: 100vh;
          }

          .feedback-header,
          .feedback-form {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default FeedbackModal;

