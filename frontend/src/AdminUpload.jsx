import React, { useState } from 'react';
import axios from 'axios';
import { Upload, X, Plus, Check, AlertCircle, FolderUp, Package } from 'lucide-react';

const AdminUpload = () => {
  const [uploadMethod, setUploadMethod] = useState('bulk');
  const [formData, setFormData] = useState({
  mangaId: '',
  title: '',
  description: '',
  author: '',
  artist: '',
  genres: '',
  status: 'ongoing',
  hasVolumes: false,
  volumes: []
});
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [chapters, setChapters] = useState([{ chapterNumber: 1, title: '', pages: [] }]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPages, setUploadingPages] = useState({});
  const [message, setMessage] = useState('');

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result);
    };
    reader.readAsDataURL(file);

    setUploadingCover(true);
    const data = new FormData();
    data.append('cover', file);
    data.append('mangaId', formData.mangaId);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/upload-cover', data, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setCoverUrl(response.data.url);
      setMessage('Cover uploaded successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to upload cover: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploadingCover(false);
    }
  };

  const handleBulkFolderUpload = async (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  setBulkUploading(true);
  setMessage('Processing folder structure...');

  try {
    const token = localStorage.getItem('token');
    
    // 1. Find cover image
    const coverFile = files.find(f => 
      f.webkitRelativePath.match(/cover\.(jpg|jpeg|png|webp)$/i)
    );

    if (coverFile) {
      const coverData = new FormData();
      coverData.append('cover', coverFile);
      coverData.append('mangaId', formData.mangaId);
      
      const coverResponse = await axios.post('/api/admin/upload-cover', coverData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCoverUrl(coverResponse.data.url);
      
      const reader = new FileReader();
      reader.onloadend = () => setCoverPreview(reader.result);
      reader.readAsDataURL(coverFile);
    }

    // 2. Detect if structure has volumes
    const volumeMap = {};
    const flatChapterMap = {};
    let hasVolumes = false;

    files.forEach(file => {
      const path = file.webkitRelativePath;
      const parts = path.split('/');
      
      if (parts.length < 3) return; // Skip root files
      
      // Check if second folder is a volume folder
      const secondFolder = parts[1];
      const volumeMatch = secondFolder.match(/^(?:volume|vol)\s*(\d+)/i);
      
      if (volumeMatch && parts.length >= 4) {
        // Structure: root/Volume X/Chapter Y/image.jpg
        hasVolumes = true;
        const volumeNumber = parseInt(volumeMatch[1]);
        const chapterFolder = parts[2];
        
        // Extract chapter info
        const chapterMatch = chapterFolder.match(/^(?:chapter\s*)?(\d+)(?:\s*-\s*(.+))?$/i);
        if (!chapterMatch) return;
        
        const chapterNumber = parseInt(chapterMatch[1]);
        const chapterTitle = chapterMatch[2]?.trim() || `Chapter ${chapterNumber}`;
        
        // Initialize volume
        if (!volumeMap[volumeNumber]) {
          volumeMap[volumeNumber] = {
            volumeNumber,
            volumeTitle: `Volume ${volumeNumber}`,
            chapters: {}
          };
        }
        
        // Initialize chapter within volume
        if (!volumeMap[volumeNumber].chapters[chapterNumber]) {
          volumeMap[volumeNumber].chapters[chapterNumber] = {
            chapterNumber,
            title: chapterTitle,
            files: []
          };
        }
        
        volumeMap[volumeNumber].chapters[chapterNumber].files.push(file);
      } else if (parts.length >= 3) {
        // Structure: root/Chapter Y/image.jpg (no volumes)
        const chapterFolder = parts[1];
        const chapterMatch = chapterFolder.match(/^(?:chapter\s*)?(\d+)(?:\s*-\s*(.+))?$/i);
        
        if (!chapterMatch) return;
        
        const chapterNumber = parseInt(chapterMatch[1]);
        const chapterTitle = chapterMatch[2]?.trim() || `Chapter ${chapterNumber}`;
        
        if (!flatChapterMap[chapterNumber]) {
          flatChapterMap[chapterNumber] = {
            chapterNumber,
            title: chapterTitle,
            files: []
          };
        }
        
        flatChapterMap[chapterNumber].files.push(file);
      }
    });

    // 3. Process based on structure
    let uploadedChapters = [];
    let volumes = [];

    if (hasVolumes) {
      // Process volumes
      setMessage('Detected volume structure...');
      
      const sortedVolumes = Object.values(volumeMap).sort((a, b) => a.volumeNumber - b.volumeNumber);
      
      for (const volume of sortedVolumes) {
        const sortedChapters = Object.values(volume.chapters).sort((a, b) => a.chapterNumber - b.chapterNumber);
        const volumeChapters = [];
        
        for (const chapter of sortedChapters) {
          setMessage(`Uploading Volume ${volume.volumeNumber}, Chapter ${chapter.chapterNumber}: ${chapter.title}...`);
          
          // Sort files naturally
          const sortedFiles = chapter.files.sort((a, b) => {
            const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
            return numA - numB;
          });

          // Upload pages
          const pagesData = new FormData();
          sortedFiles.forEach(file => pagesData.append('pages', file));
          pagesData.append('mangaId', formData.mangaId);
          pagesData.append('chapterNumber', chapter.chapterNumber);

          const pagesResponse = await axios.post('/api/admin/upload-pages', pagesData, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const uploadedChapter = {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            pages: pagesResponse.data.pages,
            views: 0,
            uploadedAt: new Date()
          };
          
          volumeChapters.push(uploadedChapter);
          uploadedChapters.push(uploadedChapter);
        }
        
        volumes.push({
          volumeNumber: volume.volumeNumber,
          volumeTitle: volume.volumeTitle,
          chapters: volumeChapters
        });
      }
    } else {
      // Process flat structure (no volumes)
      setMessage('Detected flat chapter structure...');
      
      const sortedChapters = Object.values(flatChapterMap).sort((a, b) => a.chapterNumber - b.chapterNumber);
      
      for (const chapter of sortedChapters) {
        setMessage(`Uploading Chapter ${chapter.chapterNumber}: ${chapter.title}...`);
        
        const sortedFiles = chapter.files.sort((a, b) => {
          const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
          return numA - numB;
        });

        const pagesData = new FormData();
        sortedFiles.forEach(file => pagesData.append('pages', file));
        pagesData.append('mangaId', formData.mangaId);
        pagesData.append('chapterNumber', chapter.chapterNumber);

        const pagesResponse = await axios.post('/api/admin/upload-pages', pagesData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        uploadedChapters.push({
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          pages: pagesResponse.data.pages,
          views: 0,
          uploadedAt: new Date()
        });
      }
    }

    setChapters(uploadedChapters);
    
    // Store volumes info for submission
    if (hasVolumes) {
      setFormData(prev => ({ ...prev, volumes, hasVolumes: true }));
      setMessage(`Successfully processed ${volumes.length} volumes with ${uploadedChapters.length} chapters!`);
    } else {
      setMessage(`Successfully processed ${uploadedChapters.length} chapters!`);
    }
  } catch (error) {
    setMessage('Bulk upload failed: ' + (error.response?.data?.error || error.message));
  } finally {
    setBulkUploading(false);
  }
};

  const handleChapterPagesUpload = async (chapterIndex, files) => {
    setUploadingPages({...uploadingPages, [chapterIndex]: true});
    const data = new FormData();
    Array.from(files).forEach(file => data.append('pages', file));
    data.append('mangaId', formData.mangaId);
    data.append('chapterNumber', chapters[chapterIndex].chapterNumber);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/upload-pages', data, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const updatedChapters = [...chapters];
      updatedChapters[chapterIndex].pages = response.data.pages;
      setChapters(updatedChapters);
      setMessage(`Chapter ${chapters[chapterIndex].chapterNumber} - ${files.length} pages uploaded!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to upload pages: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploadingPages({...uploadingPages, [chapterIndex]: false});
    }
  };

  const handleFolderUpload = async (chapterIndex, event) => {
    const files = Array.from(event.target.files);
    const sortedFiles = files.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
    await handleChapterPagesUpload(chapterIndex, sortedFiles);
  };

  const addChapter = () => {
    setChapters([...chapters, { 
      chapterNumber: chapters.length + 1, 
      title: '', 
      pages: [] 
    }]);
  };

  const removeChapter = (index) => {
    const updated = chapters.filter((_, i) => i !== index);
    setChapters(updated);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setUploading(true);
  setMessage('');

  try {
    const token = localStorage.getItem('token');
    const mangaData = {
      mangaId: formData.mangaId.toLowerCase().replace(/\s+/g, ''),
      title: formData.title,
      description: formData.description,
      author: formData.author,
      artist: formData.artist,
      genres: formData.genres.split(',').map(g => g.trim()),
      status: formData.status,
      coverImage: coverUrl,
      hasVolumes: formData.hasVolumes || false,
      volumes: formData.volumes || [],
      chapters: chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        pages: ch.pages,
        views: 0,
        uploadedAt: new Date()
      }))
    };

    await axios.post('/api/admin/create-manga', mangaData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setMessage('Manga created successfully!');
    
    setFormData({
  mangaId: '',
  title: '',
  description: '',
  author: '',
  artist: '',
  genres: '',
  status: 'ongoing',
  hasVolumes: false,
  volumes: []
});
    setCoverUrl('');
    setCoverPreview('');
    setChapters([{ chapterNumber: 1, title: '', pages: [] }]);
  } catch (error) {
    setMessage(`Error: ${error.response?.data?.error || 'Failed to create manga'}`);
  } finally {
    setUploading(false);
  }
};

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <div className="container mx-auto px-6 py-8 pt-24">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#e50914] to-[#f40612] bg-clip-text text-transparent">
            Upload New Manga
          </h1>
          <p className="text-gray-400 mb-8">Add a new manga series to your collection</p>

          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.includes('Error') || message.includes('Failed') 
                ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                : 'bg-green-500/10 border border-green-500/20 text-green-400'
            }`}>
              {message.includes('Error') || message.includes('Failed') ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6">Basic Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Manga ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="mangaId"
                    value={formData.mangaId}
                    onChange={handleInputChange}
                    placeholder="e.g., naruto (lowercase, no spaces)"
                    required
                    className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g., Naruto"
                    required
                    className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Enter manga description..."
                  required
                  className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Author <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="author"
                    value={formData.author}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Artist <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="artist"
                    value={formData.artist}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
                    style={{ color: 'white', backgroundColor: '#333' }}
                  >
                    <option value="ongoing" style={{ backgroundColor: '#333', color: 'white' }}>Ongoing</option>
                    <option value="completed" style={{ backgroundColor: '#333', color: 'white' }}>Completed</option>
                    <option value="hiatus" style={{ backgroundColor: '#333', color: 'white' }}>Hiatus</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Genres <span className="text-red-400">*</span> <span className="text-gray-500 text-xs">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  name="genres"
                  value={formData.genres}
                  onChange={handleInputChange}
                  placeholder="e.g., Action, Adventure, Shounen"
                  required
                  className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Upload Method</h2>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setUploadMethod('bulk')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    uploadMethod === 'bulk' 
                      ? 'bg-[#e50914] text-white' 
                      : 'bg-[#333] text-gray-400 hover:bg-[#444]'
                  }`}
                >
                  <Package className="h-5 w-5" />
                  Bulk Upload (Entire Folder)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMethod('manual')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    uploadMethod === 'manual' 
                      ? 'bg-[#e50914] text-white' 
                      : 'bg-[#333] text-gray-400 hover:bg-[#444]'
                  }`}
                >
                  <Upload className="h-5 w-5" />
                  Manual Upload (Chapter by Chapter)
                </button>
              </div>
            </div>

            {uploadMethod === 'bulk' && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Bulk Folder Upload</h2>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                  <p className="text-blue-400 text-sm mb-2">
                    <strong>Folder Structure Required:</strong>
                  </p>
                  <pre className="text-xs text-blue-300 font-mono">
{`manga-name/
├── cover.jpg
├── Volume 1/
│   ├── 1.jpg
│   ├── 2.jpg
│   └── 3.jpg
├── Volume 2/
│   ├── 1.jpg
│   └── 2.jpg`}
                  </pre>
                  <p className="text-blue-400 text-xs mt-2">
                    Supported names: <code>Volume 1</code>, <code>Vol 1</code>, <code>1-title</code>, or <code>chapter-1-title</code>
                  </p>
                </div>

                <input
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  onChange={handleBulkFolderUpload}
                  className="hidden"
                  id="bulk-folder-upload"
                />
                <label
                  htmlFor="bulk-folder-upload"
                  className="flex items-center justify-center w-full px-4 py-4 bg-[#e50914] hover:bg-[#b20710] rounded-lg text-white cursor-pointer transition-colors font-medium"
                >
                  <FolderUp className="h-6 w-6 mr-2" />
                  {bulkUploading ? 'Processing...' : 'Select Manga Folder'}
                </label>

                {chapters.length > 0 && chapters[0].pages.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h3 className="font-semibold text-green-400">Processed Chapters:</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {chapters.map(ch => (
                        <div key={ch.chapterNumber} className="bg-black/30 border border-green-500/20 rounded p-3">
                          <div className="text-sm font-medium">Chapter {ch.chapterNumber}</div>
                          <div className="text-xs text-gray-400 truncate">{ch.title}</div>
                          <div className="text-xs text-green-400 mt-1">{ch.pages.length} pages</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {uploadMethod === 'manual' && (
              <>
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-6">Cover Image</h2>
                  <div className="flex items-start gap-6">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2 text-gray-300">
                        Upload Cover <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverUpload}
                          className="hidden"
                          id="cover-upload"
                        />
                        <label
                          htmlFor="cover-upload"
                          className="flex items-center justify-center w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white cursor-pointer hover:bg-[#444] transition-colors"
                        >
                          <Upload className="h-5 w-5 mr-2" />
                          {uploadingCover ? 'Uploading...' : coverUrl ? 'Change Cover' : 'Choose Cover Image'}
                        </label>
                      </div>
                    </div>
                    {coverPreview && (
                      <div className="w-32 h-48 rounded-lg overflow-hidden border border-white/20">
                        <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Chapters</h2>
                    <button
                      type="button"
                      onClick={addChapter}
                      className="flex items-center gap-2 px-4 py-2 bg-[#e50914] hover:bg-[#b20710] rounded-lg font-medium transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Chapter
                    </button>
                  </div>

                  <div className="space-y-4">
                    {chapters.map((chapter, index) => (
                      <div key={index} className="bg-black/30 border border-white/10 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold">Chapter {chapter.chapterNumber}</h3>
                          {chapters.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeChapter(index)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-300">Chapter Number</label>
                            <input
                              type="number"
                              value={chapter.chapterNumber}
                              onChange={(e) => {
                                const updated = [...chapters];
                                updated[index].chapterNumber = parseInt(e.target.value);
                                setChapters(updated);
                              }}
                              className="w-full px-4 py-2 bg-[#333] border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-300">Chapter Title</label>
                            <input
                              type="text"
                              value={chapter.title}
                              onChange={(e) => {
                                const updated = [...chapters];
                                updated[index].title = e.target.value;
                                setChapters(updated);
                              }}
                              placeholder="e.g., The Beginning"
                              className="w-full px-4 py-2 bg-[#333] border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#e50914]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Chapter Pages</label>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <input
                                type="file"
                                webkitdirectory="true"
                                directory="true"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleFolderUpload(index, e)}
                                className="hidden"
                                id={`folder-${index}`}
                              />
                              <label
                                htmlFor={`folder-${index}`}
                                className="flex items-center justify-center w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white cursor-pointer hover:bg-[#444] transition-colors"
                              >
                                <FolderUp className="h-5 w-5 mr-2" />
                                {uploadingPages[index] ? 'Uploading...' : 'Upload Folder'}
                              </label>
                            </div>

                            <div>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleChapterPagesUpload(index, e.target.files)}
                                className="hidden"
                                id={`pages-${index}`}
                              />
                              <label
                                htmlFor={`pages-${index}`}
                                className="flex items-center justify-center w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white cursor-pointer hover:bg-[#444] transition-colors"
                              >
                                <Upload className="h-5 w-5 mr-2" />
                                {uploadingPages[index] ? 'Uploading...' : 'Upload Files'}
                              </label>
                            </div>
                          </div>

                          {chapter.pages.length > 0 && (
                            <p className="mt-2 text-sm text-green-400 flex items-center gap-2">
                              <Check className="h-4 w-4" />
                              {chapter.pages.length} pages uploaded
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={uploading || !coverUrl || chapters.some(ch => ch.pages.length === 0)}
              className="w-full py-4 bg-[#e50914] hover:bg-[#b20710] rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#e50914]"
            >
              {uploading ? 'Creating Manga...' : 'Create Manga'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminUpload;