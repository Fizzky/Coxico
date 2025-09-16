// backend/routes/upload.js - Enhanced with proper file upload
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { adminAuth } from '../middleware/auth.js';
import sharp from 'sharp'; // For image optimization

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Upload single image (for manga covers)
router.post('/image', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Optimize image with sharp
    const optimizedPath = `uploads/optimized-${req.file.filename}`;
    await sharp(req.file.path)
      .resize(800, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(optimizedPath);

    // Delete original file
    fs.unlinkSync(req.file.path);

    const imageUrl = `/uploads/${path.basename(optimizedPath)}`;
    
    res.json({
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      filename: path.basename(optimizedPath)
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Error uploading image' });
  }
});

// Upload multiple images (for manga pages)
router.post('/pages', adminAuth, upload.array('pages', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const imageUrls = [];

    for (const file of req.files) {
      // Optimize each page
      const optimizedPath = `uploads/page-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
      await sharp(file.path)
        .resize(1200, 1800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toFile(optimizedPath);

      // Delete original file
      fs.unlinkSync(file.path);

      imageUrls.push(`/uploads/${path.basename(optimizedPath)}`);
    }

    res.json({
      message: 'Pages uploaded successfully',
      imageUrls: imageUrls
    });
  } catch (error) {
    console.error('Error uploading pages:', error);
    res.status(500).json({ message: 'Error uploading pages' });
  }
});

// Delete image
router.delete('/image/:filename', adminAuth, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join('uploads', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ message: 'Image not found' });
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: 'Error deleting image' });
  }
});

export default router;

// ===== FRONTEND COMPONENT =====

// frontend/src/components/ImageUploader.jsx
import React, { useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

export const ImageUploader = ({ onImageUploaded, multiple = false, accept = "image/*" }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (files) => {
    setUploading(true);
    try {
      const formData = new FormData();
      
      if (multiple) {
        Array.from(files).forEach(file => {
          formData.append('pages', file);
        });
        const response = await axios.post('/api/upload/pages', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        onImageUploaded(response.data.imageUrls);
      } else {
        formData.append('image', files[0]);
        const response = await axios.post('/api/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        onImageUploaded(response.data.imageUrl);
      }
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Error uploading image(s)');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
      } ${uploading ? 'opacity-50' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
        id={`file-upload-${multiple ? 'multiple' : 'single'}`}
        disabled={uploading}
      />
      
      <label
        htmlFor={`file-upload-${multiple ? 'multiple' : 'single'}`}
        className="cursor-pointer block"
      >
        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          {uploading ? 'Uploading...' : `Upload ${multiple ? 'Images' : 'Image'}`}
        </p>
        <p className="text-sm text-gray-600">
          {multiple ? 'Drag and drop multiple images or click to browse' : 'Drag and drop an image or click to browse'}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Supports: JPG, PNG, GIF (Max 10MB {multiple ? 'each' : ''})
        </p>
      </label>
    </div>
  );
};

// ===== UPDATED CHAPTER FORM WITH FILE UPLOAD =====

// Update your ChapterForm component to include file upload
const ChapterFormWithUpload = ({ manga, chapter, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    chapterNumber: chapter?.chapterNumber || '',
    title: chapter?.title || '',
    pages: chapter?.pages || []
  });
  const [loading, setLoading] = useState(false);

  const handlePagesUploaded = (uploadedUrls) => {
    setFormData(prev => ({
      ...prev,
      pages: [...prev.pages, ...uploadedUrls]
    }));
  };

  const removeExistingPage = (index) => {
    const updated = [...formData.pages];
    updated.splice(index, 1);
    setFormData({ ...formData, pages: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        mangaId: manga._id
      };

      if (chapter) {
        await axios.put(`/api/admin/chapters/${chapter._id}`, submitData);
      } else {
        await axios.post('/api/admin/chapters', submitData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving chapter:', error);
      alert('Error saving chapter: ' + (error.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {chapter ? 'Edit Chapter' : 'Add New Chapter'} - {manga.title}
          </h2>
          <button onClick={onClose}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chapter Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chapter Number
              </label>
              <input
                type="number"
                min="1"
                value={formData.chapterNumber}
                onChange={(e) => setFormData({ ...formData, chapterNumber: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chapter Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Pages
            </label>
            <ImageUploader
              onImageUploaded={handlePagesUploaded}
              multiple={true}
              accept="image/*"
            />
          </div>

          {/* Existing Pages */}
          {formData.pages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Pages ({formData.pages.length})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-60 overflow-y-auto border rounded-lg p-4">
                {formData.pages.map((page, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={page}
                      alt={`Page ${index + 1}`}
                      className="w-full h-32 object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingPage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="text-xs text-center mt-1">Page {index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || formData.pages.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Chapter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};