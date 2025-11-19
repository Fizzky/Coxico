import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, X, Plus, Check, AlertCircle, FolderUp, Package, FolderPlus } from 'lucide-react';
import { apiUrl } from './utils/api';



const AdminUpload = () => {
  const [uploadMethod, setUploadMethod] = useState('bulk');
  const [uploadMode, setUploadMode] = useState('new'); // 'new' or 'existing' - NEW
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: '' });
  const [existingMangaId, setExistingMangaId] = useState(''); // NEW
  const [allManga, setAllManga] = useState([]); // NEW
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
  const [chapters, setChapters] = useState([{ chapterNumber: 1, chapterNumberLabel: '1', title: '', pages: [] }]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPages, setUploadingPages] = useState({});
  const [message, setMessage] = useState('');

  // NEW: Fetch all manga for the dropdown
  useEffect(() => {
    const fetchManga = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${apiUrl}/api/admin/manga`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAllManga(response.data.manga);
      } catch (error) {
        console.error('Error fetching manga:', error);
        if (error.code === 'ERR_NETWORK' || !error.response) {
          console.error('Network error - backend may not be accessible at:', apiUrl);
        }
      }
    };
    fetchManga();
  }, []);

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
      const response = await axios.post(`${apiUrl}/api/admin/upload-cover`, data, {
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
  setUploadProgress({ current: 0, total: 0, status: 'Starting...' });
  setMessage('🔍 Analyzing folder structure...');

  try {
    const token = localStorage.getItem('token');
    const mangaIdToUse = uploadMode === 'existing' ? existingMangaId : formData.mangaId;
    
    // 1. Upload cover (only for new manga)
    if (uploadMode === 'new') {
      const coverFile = files.find(f => 
        f.webkitRelativePath.match(/cover\.(jpg|jpeg|png|webp)$/i)
      );

      if (coverFile) {
        setMessage('📸 Uploading cover image...');
        const coverData = new FormData();
        coverData.append('cover', coverFile);
        coverData.append('mangaId', formData.mangaId);
        
        const coverResponse = await axios.post(`${apiUrl}/api/admin/upload-cover`, coverData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setCoverUrl(coverResponse.data.url);
        
        const reader = new FileReader();
        reader.onloadend = () => setCoverPreview(reader.result);
        reader.readAsDataURL(coverFile);
        setMessage('✅ Cover uploaded!');
      }
    }

    // 2. Group files by volume and chapter
    const volumeMap = {};
    const flatChapterMap = {};
    let hasVolumes = false;

    setMessage('🗂️ Organizing files...');

    files.forEach(file => {
      const path = file.webkitRelativePath;
      const parts = path.split('/');
      
      if (parts.length < 3) return;
      
      const secondFolder = parts[1];
      const volumeMatch = secondFolder.match(/^(?:volume|vol)\s*([\d.]+)/i);
      
      if (volumeMatch && parts.length >= 4) {
        // Volume structure
        hasVolumes = true;
        const volumeNumber = parseFloat(volumeMatch[1]);
        const chapterFolder = parts[2];
        
        const chapterMatch = chapterFolder.match(/^(?:chapter\s*)?([\d.]+)(?:\s*-\s*(.+))?$/i);
        if (!chapterMatch) return;
        
        const chapterNumberLabel = chapterMatch[1].trim();
        const chapterNumber = parseFloat(chapterNumberLabel);
        const chapterTitle = chapterMatch[2]?.trim() || `Chapter ${chapterNumber}`;
        const chapterKey = chapterNumberLabel || chapterNumber.toString();
        
        if (!volumeMap[volumeNumber]) {
          volumeMap[volumeNumber] = {
            volumeNumber,
            volumeTitle: `Volume ${volumeNumber}`,
            chapters: {}
          };
        }
        
        if (!volumeMap[volumeNumber].chapters[chapterKey]) {
          volumeMap[volumeNumber].chapters[chapterKey] = {
            chapterNumber,
            chapterNumberLabel,
            title: chapterTitle,
            files: []
          };
        }
        
        volumeMap[volumeNumber].chapters[chapterKey].files.push(file);
      } else if (parts.length >= 3) {
        // Flat structure
        const chapterFolder = parts[1];
        const chapterMatch = chapterFolder.match(/^(?:chapter\s*)?([\d.]+)(?:\s*-\s*(.+))?$/i);
        
        if (!chapterMatch) return;
        
        const chapterNumberLabel = chapterMatch[1].trim();
        const chapterNumber = parseFloat(chapterNumberLabel);
        const chapterTitle = chapterMatch[2]?.trim() || `Chapter ${chapterNumber}`;
        const chapterKey = chapterNumberLabel || chapterNumber.toString();
        
        if (!flatChapterMap[chapterKey]) {
          flatChapterMap[chapterKey] = {
            chapterNumber,
            chapterNumberLabel,
            title: chapterTitle,
            files: []
          };
        }
        
        flatChapterMap[chapterKey].files.push(file);
      }
    });

    // 3. Process volumes ONE AT A TIME
    let allChapters = [];
    let volumes = [];

    if (hasVolumes) {
      const sortedVolumes = Object.values(volumeMap).sort((a, b) => a.volumeNumber - b.volumeNumber);
      const totalVolumes = sortedVolumes.length;
      
      setMessage(`📚 Found ${totalVolumes} volumes. Starting upload...`);
      
      for (let i = 0; i < sortedVolumes.length; i++) {
        const volume = sortedVolumes[i];
        const sortedChapters = Object.values(volume.chapters).sort((a, b) => a.chapterNumber - b.chapterNumber);
        const totalChapters = sortedChapters.length;
        
        setUploadProgress({
          current: i + 1,
          total: totalVolumes,
          status: `Volume ${volume.volumeNumber}`
        });
        
        setMessage(`📦 Volume ${volume.volumeNumber} (${i + 1}/${totalVolumes}) - ${totalChapters} chapters...`);
        
        const volumeChapters = [];
        
        // Process chapters in this volume
        for (let j = 0; j < sortedChapters.length; j++) {
          const chapter = sortedChapters[j];
          const chapterLabel = chapter.chapterNumberLabel || chapter.chapterNumber;
          
          setMessage(`📖 Vol ${volume.volumeNumber} - Ch ${chapterLabel}: ${chapter.title} (${j + 1}/${totalChapters})`);
          
          // Sort files
          const sortedFiles = chapter.files.sort((a, b) => {
            const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
            return numA - numB;
          });

          // Upload pages for this chapter
          const pagesData = new FormData();
          sortedFiles.forEach(file => pagesData.append('pages', file));
          pagesData.append('mangaId', mangaIdToUse);
          pagesData.append('chapterNumber', chapter.chapterNumber);
          if (chapter.chapterNumberLabel) {
            pagesData.append('chapterNumberLabel', chapter.chapterNumberLabel);
          }

          try {
            const pagesResponse = await axios.post(`${apiUrl}/api/admin/upload-pages`, pagesData, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const uploadedChapter = {
              chapterNumber: chapter.chapterNumber,
              chapterNumberLabel: chapter.chapterNumberLabel || chapter.chapterNumber?.toString(),
              title: chapter.title,
              pages: pagesResponse.data.pages,
              volumeNumber: volume.volumeNumber,
              volumeTitle: volume.volumeTitle,
              views: 0,
              uploadedAt: new Date()
            };
            
            volumeChapters.push(uploadedChapter);
            allChapters.push(uploadedChapter);
            
          } catch (error) {
            console.error(`Failed to upload chapter ${chapterLabel}:`, error);
            setMessage(`⚠️ Warning: Chapter ${chapterLabel} failed, continuing...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        volumes.push({
          volumeNumber: volume.volumeNumber,
          volumeTitle: volume.volumeTitle,
          chapters: volumeChapters
        });
        
        setMessage(`✅ Volume ${volume.volumeNumber} complete! (${volumeChapters.length} chapters uploaded)`);
        
        // Small delay between volumes to prevent overwhelming server
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setFormData(prev => ({ ...prev, volumes, hasVolumes: true }));
      setMessage(`🎉 Success! Uploaded ${totalVolumes} volumes with ${allChapters.length} total chapters!`);
      
    } else {
      // Flat chapter structure
      const sortedChapters = Object.values(flatChapterMap).sort((a, b) => a.chapterNumber - b.chapterNumber);
      const totalChapters = sortedChapters.length;
      
      setMessage(`📚 Found ${totalChapters} chapters. Starting upload...`);
      
      for (let i = 0; i < sortedChapters.length; i++) {
        const chapter = sortedChapters[i];
        const chapterLabel = chapter.chapterNumberLabel || chapter.chapterNumber;
        
        setUploadProgress({
          current: i + 1,
          total: totalChapters,
          status: `Chapter ${chapterLabel}`
        });
        
        setMessage(`📖 Chapter ${chapterLabel}: ${chapter.title} (${i + 1}/${totalChapters})`);
        
        const sortedFiles = chapter.files.sort((a, b) => {
          const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
          return numA - numB;
        });

        const pagesData = new FormData();
        sortedFiles.forEach(file => pagesData.append('pages', file));
        pagesData.append('mangaId', mangaIdToUse);
        pagesData.append('chapterNumber', chapter.chapterNumber);
        if (chapter.chapterNumberLabel) {
          pagesData.append('chapterNumberLabel', chapter.chapterNumberLabel);
        }

        try {
          const pagesResponse = await axios.post('/api/admin/upload-pages', pagesData, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          allChapters.push({
            chapterNumber: chapter.chapterNumber,
            chapterNumberLabel: chapter.chapterNumberLabel || chapter.chapterNumber?.toString(),
            title: chapter.title,
            pages: pagesResponse.data.pages,
            views: 0,
            uploadedAt: new Date()
          });
        } catch (error) {
          console.error(`Failed to upload chapter ${chapterLabel}:`, error);
          setMessage(`⚠️ Warning: Chapter ${chapterLabel} failed, continuing...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setMessage(`🎉 Success! Uploaded ${allChapters.length} chapters!`);
    }

    setChapters(allChapters);
    setUploadProgress({ current: 0, total: 0, status: 'Complete!' });
    
  } catch (error) {
    console.error('Bulk upload error:', error);
    setMessage(`❌ Upload failed: ${error.response?.data?.error || error.message}`);
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
    if (chapters[chapterIndex].chapterNumberLabel) {
      data.append('chapterNumberLabel', chapters[chapterIndex].chapterNumberLabel);
    }

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
      const chapterLabel = chapters[chapterIndex].chapterNumberLabel || chapters[chapterIndex].chapterNumber;
      setMessage(`Chapter ${chapterLabel} - ${files.length} pages uploaded!`);
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
      chapterNumberLabel: (chapters.length + 1).toString(),
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

    if (uploadMode === 'existing') {
      // ADD TO EXISTING MANGA - NEW
      if (!existingMangaId) {
        setMessage('Please select a manga');
        setUploading(false);
        return;
      }

      const volumesData = formData.hasVolumes && formData.volumes.length > 0
        ? { volumes: formData.volumes }
        : { chapters: chapters.map(ch => ({
            chapterNumber: ch.chapterNumber,
            chapterNumberLabel: ch.chapterNumberLabel || (ch.chapterNumber != null ? ch.chapterNumber.toString() : ''),
            title: ch.title,
            pages: ch.pages,
            views: 0,
            uploadedAt: new Date()
          }))
        };

      const response = await axios.post(
        `${apiUrl}/api/admin/manga/${existingMangaId}/add-volumes`,
        volumesData,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const skipped = response.data?.skippedDuplicates || [];
      if (skipped.length > 0) {
        setMessage(`⚠️ Uploaded with ${skipped.length} duplicate chapter(s) skipped: ${skipped.join(', ')}`);
      } else {
        setMessage('✅ Volumes added successfully!');
      }
    } else {
      // CREATE NEW MANGA - EXISTING CODE
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
          chapterNumberLabel: ch.chapterNumberLabel || (ch.chapterNumber != null ? ch.chapterNumber.toString() : ''),
          title: ch.title,
          pages: ch.pages,
          views: 0,
          uploadedAt: new Date()
        }))
      };

      const response = await axios.post(`${apiUrl}/api/admin/create-manga`, mangaData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMessage('✅ Manga created successfully!');
        
        // Reset form
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
        setChapters([{ chapterNumber: 1, chapterNumberLabel: '1', title: '', pages: [] }]);
        setExistingMangaId('');
      } else {
        setMessage(`❌ Error: ${response.data.error || 'Failed to save manga'}`);
      }
    }
  } catch (error) {
    console.error('Submit error:', error);
    
    // Handle network errors specifically
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || !error.response) {
      setMessage(`❌ Network Error: Unable to connect to the server. Please check:
      • Backend server is running
      • API URL is configured correctly
      • Network connection is stable
      • CORS settings allow requests from this domain`);
      return;
    }
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      setMessage(`❌ Request Timeout: The server took too long to respond. The upload might be too large. Please try again or upload in smaller batches.`);
      return;
    }
    
    const errorMessage = error.response?.data?.error 
      || error.response?.data?.message 
      || error.message 
      || 'Failed to save manga';
    
    // Show more detailed error if available
    if (error.response?.data?.errors) {
      const validationErrors = error.response.data.errors.map(e => e.msg || e.message).join(', ');
      setMessage(`❌ Error: ${validationErrors}`);
    } else {
      setMessage(`❌ Error: ${errorMessage}`);
    }
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
              message.includes('Error') || message.includes('Failed') || message.includes('❌')
                ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                : 'bg-green-500/10 border border-green-500/20 text-green-400'
            }`}>
              {message.includes('Error') || message.includes('Failed') || message.includes('❌') ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              {message}
            </div>
          )}

          {/* NEW: Upload Mode Selector */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Upload Mode</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                type="button"
                onClick={() => setUploadMode('new')}
                className={`p-6 rounded-lg border-2 transition-all ${
                  uploadMode === 'new'
                    ? 'border-[#e50914] bg-[#e50914]/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto mb-2 text-[#e50914]" />
                  <h3 className="font-bold mb-1">Create New Manga</h3>
                  <p className="text-xs text-gray-400">Upload a completely new series</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUploadMode('existing')}
                className={`p-6 rounded-lg border-2 transition-all ${
                  uploadMode === 'existing'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="text-center">
                  <FolderPlus className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <h3 className="font-bold mb-1">Add to Existing</h3>
                  <p className="text-xs text-gray-400">Add volumes to existing manga</p>
                </div>
              </button>
            </div>

            {uploadMode === 'existing' && (
              <div>
                <label className="block text-sm font-medium mb-2">Select Manga to Update</label>
                <select
                  value={existingMangaId}
                  onChange={(e) => setExistingMangaId(e.target.value)}
                  className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={uploadMode === 'existing'}
                >
                  <option value="">-- Select a manga --</option>
                  {allManga.map((manga) => (
                    <option key={manga._id} value={manga._id} style={{ backgroundColor: '#333', color: 'white' }}>
                      {manga.title} ({manga.totalChapters || 0} chapters)
                    </option>
                  ))}
                </select>
                {existingMangaId && (
                  <div className="mt-3 p-3 bg-blue-900/30 border border-blue-700 rounded text-sm text-blue-300">
                    <strong>Note:</strong> New volumes/chapters will be added to this manga. Duplicate chapter numbers will be rejected.
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information - Only show for new manga */}
            {uploadMode === 'new' && (
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
            )}

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
                <h2 className="text-xl font-semibold mb-4">
                  {uploadMode === 'new' ? 'Bulk Folder Upload' : 'Upload New Volumes'}
                </h2>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                  <p className="text-blue-400 text-sm mb-2">
                    <strong>Folder Structure Required:</strong>
                  </p>
                  <pre className="text-xs text-blue-300 font-mono">
{`${uploadMode === 'new' ? 'manga-name/' : 'new-volumes/'}
${uploadMode === 'new' ? '├── cover.jpg (required)\n' : ''}├── Volume 1/
│   ├── Chapter 1/
│   │   ├── 1.jpg
│   │   └── 2.jpg
├── Volume 2/
    └── Chapter 3/`}
                  </pre>
                  <p className="text-blue-400 text-xs mt-2">
                    Supported names: <code>Volume 1</code>, <code>Vol 1</code>, or <code>Chapter 1</code>
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
                  {bulkUploading ? 'Processing...' : uploadMode === 'new' ? 'Select Manga Folder' : 'Select Volumes to Add'}
                </label>

                {bulkUploading && uploadProgress.total > 0 && (
  <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-blue-300 font-medium">
        Progress: {uploadProgress.current}/{uploadProgress.total}
      </span>
      <span className="text-blue-400 text-sm">{uploadProgress.status}</span>
    </div>
    <div className="w-full bg-gray-700 rounded-full h-2.5">
      <div 
        className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
      ></div>
    </div>
    <p className="text-xs text-gray-400 mt-2">
      Please wait... This may take several minutes for large volumes.
    </p>
  </div>
)}

                {chapters.length > 0 && chapters[0].pages.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h3 className="font-semibold text-green-400">Processed Chapters:</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {chapters.map(ch => {
                        const chapterLabel = ch.chapterNumberLabel || ch.chapterNumber;
                        return (
                        <div key={`${chapterLabel}-${ch.title}`} className="bg-black/30 border border-green-500/20 rounded p-3">
                          <div className="text-sm font-medium">Chapter {chapterLabel}</div>
                          <div className="text-xs text-gray-400 truncate">{ch.title}</div>
                          <div className="text-xs text-green-400 mt-1">{ch.pages.length} pages</div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
              </div>
            )}

            {uploadMethod === 'manual' && uploadMode === 'new' && (
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
                          <h3 className="font-semibold">Chapter {chapter.chapterNumberLabel || chapter.chapterNumber}</h3>
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
                              type="text"
                              value={chapter.chapterNumberLabel || chapter.chapterNumber}
                              onChange={(e) => {
                                const updated = [...chapters];
                                const rawValue = e.target.value;
                                updated[index].chapterNumberLabel = rawValue;
                                const parsed = parseFloat(rawValue);
                                updated[index].chapterNumber = Number.isNaN(parsed) ? 0 : parsed;
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
              disabled={
                uploading || 
                (uploadMode === 'new' && (!coverUrl || chapters.some(ch => ch.pages.length === 0))) ||
                (uploadMode === 'existing' && !existingMangaId)
              }
              className="w-full py-4 bg-[#e50914] hover:bg-[#b20710] rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#e50914]"
            >
              {uploading 
                ? (uploadMode === 'new' ? 'Creating Manga...' : 'Adding Volumes...') 
                : (uploadMode === 'new' ? 'Create Manga' : 'Add Volumes to Manga')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminUpload;