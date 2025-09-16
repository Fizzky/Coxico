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