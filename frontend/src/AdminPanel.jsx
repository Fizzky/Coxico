// frontend/src/AdminPanel.jsx
import React, { useState, useEffect, useContext, createContext } from 'react';
import { ImageUploader } from './components/ImageUploader.jsx';
import { 
  Plus, 
  Edit, 
  Trash2, 
  BarChart3, 
  BookOpen, 
  Users, 
  FileText,
  LogOut,
  Settings,
  Upload,
  X,
  Save,
  Search,
  User
} from 'lucide-react';
import axios from 'axios';

// Auth context for admin
const AdminAuthContext = createContext();

const AdminAuth = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  if (token) {
    // SET THIS DEFAULT HEADER - this is the critical fix
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setAdmin({ token });
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
  setLoading(false);
}, [token]);


  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/admin/login', { email, password });
      const { token: newToken, user } = response.data;
      
      localStorage.setItem('adminToken', newToken);
      setToken(newToken);
      setAdmin(user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setAdmin(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AdminAuthContext.Provider value={{ admin, login, logout, loading }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

// Admin Login Component
const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AdminAuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 min-h-screen bg-[#141414] flex items-center justify-center px-4 z-[9999]">
      <div className="max-w-md w-full bg-black/60 backdrop-blur-md rounded-lg shadow-2xl p-8 border border-white/10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Coxico" className="admin-logo" />
          <p className="text-gray-400">Admin Panel</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e50914] hover:bg-[#b8070f] text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-400">
            <strong>First time?</strong> Use any email and password to create your admin account.
          </p>
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard Component
const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
  try {
    const token = localStorage.getItem('adminToken');
    const response = await axios.get('/api/admin/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    setStats(response.data);
  } catch (error) {
    console.error('Error fetching stats:', error);
  } finally {
    setLoading(false);
  }
};

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#e50914] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
      
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Manga</p>
                  <p className="text-3xl font-bold text-white">{stats.stats.totalManga}</p>
                </div>
                <BookOpen className="h-8 w-8 text-[#e50914]" />
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Chapters</p>
                  <p className="text-3xl font-bold text-white">{stats.stats.totalChapters}</p>
                </div>
                <FileText className="h-8 w-8 text-green-400" />
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Users</p>
                  <p className="text-3xl font-bold text-white">{stats.stats.totalUsers}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-yellow-400">⭐ Premium: {stats.stats.premiumUsers || 0}</span>
                    <span className="text-gray-400">Free: {stats.stats.freeUsers || 0}</span>
                  </div>
                </div>
                <Users className="h-8 w-8 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Recent Manga</h2>
            <div className="space-y-3">
              {stats.recentManga.map((manga) => (
                <div key={manga._id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{manga.title}</p>
                    <p className="text-sm text-gray-400">
                      Created {new Date(manga.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Manga Management Component
const MangaManagement = () => {
  const [manga, setManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingManga, setEditingManga] = useState(null);

  useEffect(() => {
    fetchManga();
  }, []);

  const fetchManga = async () => {
  try {
    const token = localStorage.getItem('adminToken');
    const response = await axios.get('/api/admin/manga', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    setManga(response.data.manga);
  } catch (error) {
    console.error('Error fetching manga:', error);
  } finally {
    setLoading(false);
  }
};

  const deleteManga = async (mangaId) => {
    if (!window.confirm('Are you sure you want to delete this manga? This will also delete all its chapters.')) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`/api/admin/manga/${mangaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Manga deleted successfully!');
      setManga(manga.filter(m => m._id !== mangaId));
    } catch (error) {
      alert('Failed to delete manga: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Manga Management</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#e50914] hover:bg-[#b8070f] text-white px-4 py-2 rounded-lg transition-colors flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Manga
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#e50914] border-t-transparent"></div>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-gray-300 font-medium">Manga</th>
                <th className="px-6 py-4 text-left text-gray-300 font-medium">Author</th>
                <th className="px-6 py-4 text-left text-gray-300 font-medium">Status</th>
                <th className="px-6 py-4 text-left text-gray-300 font-medium">Chapters</th>
                <th className="px-6 py-4 text-left text-gray-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {manga.map((m) => (
                <tr key={m._id} className="hover:bg-white/5">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={m.coverImage} 
                        alt={m.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                      <div>
                        <div className="text-white font-medium">{m.title}</div>
                        <div className="text-gray-400 text-sm">Rating: {m.rating}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{m.author}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      m.status === 'ongoing' 
                        ? 'bg-green-500/20 text-green-400' 
                        : m.status === 'completed' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{m.actualChapterCount || 0}</td>
                  <td className="px-6 py-4 space-x-2">
                    <button
                      onClick={() => {
                        setEditingManga(m);
                        setShowForm(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors inline-flex items-center"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteManga(m._id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors inline-flex items-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <MangaForm
          manga={editingManga}
          onClose={() => {
            setShowForm(false);
            setEditingManga(null);
          }}
          onSave={() => {
            fetchManga();
            setShowForm(false);
            setEditingManga(null);
          }}
        />
      )}
    </div>
  );
};

// Manga Form Component
const MangaForm = ({ manga, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: manga?.title || '',
    description: manga?.description || '',
    author: manga?.author || '',
    artist: manga?.artist || '',
    genres: manga?.genres || [],
    coverImage: manga?.coverImage || '',
    status: manga?.status || 'ongoing',
    rating: manga?.rating || 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (manga) {
        await axios.put(`/api/admin/manga/${manga._id}`, formData);
      } else {
        await axios.post('/api/admin/manga', formData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving manga:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreChange = (e) => {
    const genres = e.target.value.split(',').map(g => g.trim()).filter(g => g);
    setFormData({ ...formData, genres });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {manga ? 'Edit Manga' : 'Add New Manga'}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Author</label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Artist</label>
              <input
                type="text"
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Genres (comma-separated)
            </label>
            <input
              type="text"
              value={formData.genres.join(', ')}
              onChange={handleGenreChange}
              placeholder="Action, Adventure, Comedy"
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Cover Image URL</label>
            <input
              type="url"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="hiatus">Hiatus</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Rating (0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#e50914] hover:bg-[#b8070f] text-white px-6 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Chapter Management Component
const ChapterManagement = () => {
  const [manga, setManga] = useState([]);
  const [selectedManga, setSelectedManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editingChapter, setEditingChapter] = useState(null);

  useEffect(() => {
    fetchManga();
  }, []);

  const fetchManga = async () => {
    try {
      const response = await axios.get('/api/admin/manga');
      setManga(response.data.manga);
    } catch (error) {
      console.error('Error fetching manga:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapters = async (mangaId) => {
  try {
    const response = await axios.get(`/api/admin/manga/${mangaId}/chapters`);
    setChapters(response.data.chapters || []); // Add fallback
  } catch (error) {
    console.error('Error fetching chapters:', error);
    setChapters([]); // Set empty array on error
  }
};

  const deleteChapter = async (chapterId) => {
    if (window.confirm('Are you sure you want to delete this chapter?')) {
      try {
        await axios.delete(`/api/admin/chapters/${chapterId}`);
        setChapters(chapters.filter(c => c._id !== chapterId));
      } catch (error) {
        console.error('Error deleting chapter:', error);
      }
    }
  };

  const deleteAllChapters = async () => {
  if (!window.confirm(`Are you sure you want to delete ALL ${chapters?.length || 0} chapters for "${selectedManga.title}"? This action cannot be undone!`)) {
    return;
  }

  try {
    await axios.put(`/api/admin/manga/${selectedManga._id}`, {
      chapters: []
    });
    
    setChapters([]);
    fetchManga();
    alert('All chapters deleted successfully!');
  } catch (error) {
    console.error('Error deleting all chapters:', error);
    alert('Failed to delete chapters');
  }
};

const deleteMangaWithChapters = async () => {
  if (!window.confirm(`Are you sure you want to DELETE "${selectedManga.title}" and ALL ${chapters?.length || 0} chapters? This will permanently remove the manga from your database!`)) {
    return;
  }

  try {
    await axios.delete(`/api/admin/manga/${selectedManga._id}`);
    
    setSelectedManga(null);
    setChapters([]);
    fetchManga();
    alert('Manga and all chapters deleted successfully!');
  } catch (error) {
    console.error('Error deleting manga:', error);
    alert('Failed to delete manga');
  }
};

  const handleMangaSelect = (mangaItem) => {
    setSelectedManga(mangaItem);
    fetchChapters(mangaItem._id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Chapter Management</h1>
        {selectedManga && (
  <div className="flex space-x-2">
    <button
      onClick={() => setShowChapterForm(true)}
      className="bg-[#e50914] hover:bg-[#b8070f] text-white px-4 py-2 rounded-lg transition-colors flex items-center"
    >
      <Plus className="h-5 w-5 mr-2" />
      Add Chapter
    </button>
    {chapters && chapters.length > 0 && (
      <>
        <button
          onClick={deleteAllChapters}
          className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
        >
          <Trash2 className="h-5 w-5 mr-2" />
          Delete All Chapters
        </button>
        <button
          onClick={deleteMangaWithChapters}
          className="bg-red-900 hover:bg-red-950 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
        >
          <Trash2 className="h-5 w-5 mr-2" />
          Delete Manga + Chapters
        </button>
      </>
    )}
  </div>
)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Select Manga</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-4 border-[#e50914] border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {manga.map((m) => (
                <button
                  key={m._id}
                  onClick={() => handleMangaSelect(m)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedManga?._id === m._id
                      ? 'border-[#e50914] bg-[#e50914]/20'
                      : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center">
                    <img 
                      src={m.coverImage} 
                      alt={m.title}
                      className="h-12 w-8 object-cover rounded mr-3"
                    />
                    <div>
                      <p className="font-medium text-sm text-white">{m.title}</p>
                      <p className="text-xs text-gray-400">{m.actualChapterCount || 0} chapters</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-4">
          {selectedManga ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-4">
                Chapters for "{selectedManga.title}"
              </h2>
              
              {chapters.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No chapters found</p>
                  <button
                    onClick={() => setShowChapterForm(true)}
                    className="mt-4 bg-[#e50914] hover:bg-[#b8070f] text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Add First Chapter
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {chapters.map((chapter) => (
                    <div key={chapter._id} className="border border-white/10 rounded-lg p-4 bg-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-white">
                            Chapter {chapter.chapterNumberLabel || chapter.chapterNumber}: {chapter.title}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {chapter.pages?.length || 0} pages • {chapter.views} views
                          </p>
                          <p className="text-xs text-gray-500">
                            Uploaded {new Date(chapter.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingChapter(chapter);
                              setShowChapterForm(true);
                            }}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => deleteChapter(chapter._id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {chapter.pages && chapter.pages.length > 0 && (
                        <div className="mt-3 flex space-x-2 overflow-x-auto">
                          {chapter.pages.slice(0, 5).map((page, index) => (
                            <img
                              key={index}
                              src={page}
                              alt={`Page ${index + 1}`}
                              className="h-16 w-12 object-cover rounded border flex-shrink-0"
                            />
                          ))}
                          {chapter.pages.length > 5 && (
                            <div className="h-16 w-12 bg-gray-800 rounded border flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                              +{chapter.pages.length - 5}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Select a manga to manage its chapters</p>
            </div>
          )}
        </div>
      </div>

      {showChapterForm && (
        <ChapterForm
          manga={selectedManga}
          chapter={editingChapter}
          onClose={() => {
            setShowChapterForm(false);
            setEditingChapter(null);
          }}
          onSave={() => {
            fetchChapters(selectedManga._id);
            setShowChapterForm(false);
            setEditingChapter(null);
          }}
        />
      )}
    </div>
  );
};

// Chapter Form Component
const ChapterForm = ({ manga, chapter, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    chapterNumber: typeof chapter?.chapterNumber === 'number' ? chapter.chapterNumber : '',
    chapterNumberLabel: chapter?.chapterNumberLabel || (chapter?.chapterNumber != null ? chapter.chapterNumber.toString() : ''),
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
      const parsedNumber = parseFloat(formData.chapterNumberLabel ?? '');
      if (Number.isNaN(parsedNumber)) {
        alert('Please enter a valid chapter number.');
        setLoading(false);
        return;
      }

      const submitData = {
        ...formData,
        chapterNumber: parsedNumber,
        chapterNumberLabel: formData.chapterNumberLabel || parsedNumber.toString(),
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
      <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {chapter ? 'Edit Chapter' : 'Add New Chapter'} - {manga.title}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Chapter Number</label>
              <input
                type="text"
                value={formData.chapterNumberLabel || ''}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  const parsed = parseFloat(rawValue);
                  setFormData(prev => ({
                    ...prev,
                    chapterNumberLabel: rawValue,
                    chapterNumber: Number.isNaN(parsed) ? prev.chapterNumber : parsed
                  }));
                }}
                className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Chapter Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Upload Pages</label>
            <ImageUploader
              onImageUploaded={handlePagesUploaded}
              multiple={true}
              accept="image/*"
            />
            <p className="text-xs text-gray-400 mt-2">
              Tip: You can select multiple files at once or drag and drop them here
            </p>
          </div>

          {formData.pages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Pages ({formData.pages.length})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-60 overflow-y-auto border border-white/10 rounded-lg p-4 bg-white/5">
                {formData.pages.map((page, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={page}
                      alt={`Page ${index + 1}`}
                      className="w-full h-24 object-cover rounded border hover:shadow-md transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingPage(index)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Remove page"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="text-xs text-center mt-1 text-gray-400">
                      Page {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="font-medium text-blue-400 mb-2">How to add pages:</h4>
            <ul className="text-sm text-blue-300 space-y-1">
              <li>• Upload image files directly using the upload area above</li>
              <li>• Supports JPG, PNG, and GIF formats</li>
              <li>• Images will be automatically optimized for web viewing</li>
              <li>• You can upload multiple pages at once</li>
              <li>• Pages will be displayed in the order you upload them</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || formData.pages.length === 0}
              className="bg-[#e50914] hover:bg-[#b8070f] text-white px-6 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Chapter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// User Management Component
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterSubscription, setFilterSubscription] = useState('all');
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
  try {
    const token = localStorage.getItem('adminToken');
    const response = await axios.get('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    setUsers(response.data.users || []);
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    setLoading(false);
  }
};

  const deleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/admin/users/${userId}`);
        setUsers(users.filter(u => u._id !== userId));
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user');
      }
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await axios.patch(`/api/admin/users/${userId}/status`, { 
        isActive: !currentStatus 
      });
      setUsers(users.map(u => 
        u._id === userId ? { ...u, isActive: !currentStatus } : u
      ));
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error updating user status');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesSubscription = filterSubscription === 'all' || 
                               (filterSubscription === 'premium' && user.subscriptionType === 'premium' && user.subscriptionStatus === 'active') ||
                               (filterSubscription === 'free' && (user.subscriptionType === 'free' || user.subscriptionStatus !== 'active'));
    return matchesSearch && matchesRole && matchesSubscription;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <button
          onClick={() => setShowUserForm(true)}
          className="bg-[#e50914] hover:bg-[#b8070f] text-white px-4 py-2 rounded-lg transition-colors flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add User
        </button>
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search users by username or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              />
            </div>
          </div>
          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
            >
              <option value="all">All Roles</option>
              <option value="user">Users</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <div>
            <select
              value={filterSubscription}
              onChange={(e) => setFilterSubscription(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
            >
              <option value="all">All Subscriptions</option>
              <option value="premium">Premium</option>
              <option value="free">Free</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#e50914] border-t-transparent"></div>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Subscription</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p>No users found</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isPremium = user.subscriptionType === 'premium' && user.subscriptionStatus === 'active';
                    const subscriptionEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
                    const isExpired = subscriptionEndDate && subscriptionEndDate < new Date();
                    
                    return (
                    <tr key={user._id} className="hover:bg-white/5">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {user.avatar ? (
                              <img 
                                src={user.avatar} 
                                alt={user.username}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center">
                                <User className="h-6 w-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">{user.username}</div>
                            <div className="text-sm text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-500/20 text-purple-400' 
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            isPremium
                              ? 'bg-yellow-500/20 text-yellow-400' 
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {isPremium ? '⭐ Premium' : 'Free'}
                          </span>
                          {isPremium && subscriptionEndDate && (
                            <div className="text-xs text-gray-400">
                              {isExpired ? 'Expired' : `Expires: ${subscriptionEndDate.toLocaleDateString()}`}
                            </div>
                          )}
                          {!isPremium && user.downloadCount !== undefined && (
                            <div className="text-xs text-gray-400">
                              Downloads: {user.downloadCount || 0}/5
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.isActive 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        <div>
                          <div>{user.favorites?.length || 0} favorites</div>
                          <div>{user.readingHistory?.length || 0} read</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setShowUserForm(true);
                            }}
                            className="text-blue-400 hover:text-blue-300"
                            title="Edit user"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={async () => {
                              const newType = isPremium ? 'free' : 'premium';
                              const newStatus = isPremium ? 'expired' : 'active';
                              try {
                                const token = localStorage.getItem('adminToken');
                                await axios.patch(`/api/admin/users/${user._id}/subscription`, {
                                  subscriptionType: newType,
                                  subscriptionStatus: newStatus,
                                  subscriptionStartDate: newType === 'premium' ? new Date() : user.subscriptionStartDate,
                                  subscriptionEndDate: newType === 'premium' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null
                                }, {
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                fetchUsers();
                              } catch (error) {
                                alert('Error updating subscription: ' + (error.response?.data?.message || error.message));
                              }
                            }}
                            className={`${
                              isPremium 
                                ? 'text-orange-400 hover:text-orange-300' 
                                : 'text-yellow-400 hover:text-yellow-300'
                            }`}
                            title={isPremium ? 'Downgrade to Free' : 'Upgrade to Premium'}
                          >
                            {isPremium ? (
                              <span className="text-xs">⬇️</span>
                            ) : (
                              <span className="text-xs">⬆️</span>
                            )}
                          </button>
                          <button
                            onClick={() => toggleUserStatus(user._id, user.isActive)}
                            className={`${
                              user.isActive 
                                ? 'text-red-400 hover:text-red-300' 
                                : 'text-green-400 hover:text-green-300'
                            }`}
                            title={user.isActive ? 'Deactivate user' : 'Activate user'}
                          >
                            {user.isActive ? (
                              <X className="h-5 w-5" />
                            ) : (
                              <User className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteUser(user._id)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete user"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-white/10 px-6 py-4 border-t border-white/10">
            <div className="flex items-center justify-between text-sm text-gray-300">
              <span>Showing {filteredUsers.length} of {users.length} users</span>
              <div className="flex space-x-4">
                <span>Active: {users.filter(u => u.isActive).length}</span>
                <span>Admins: {users.filter(u => u.role === 'admin').length}</span>
                <span>Premium: {users.filter(u => u.subscriptionType === 'premium' && u.subscriptionStatus === 'active').length}</span>
                <span>Free: {users.filter(u => u.subscriptionType === 'free' || u.subscriptionStatus !== 'active').length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserForm && (
        <UserForm
          user={editingUser}
          onClose={() => {
            setShowUserForm(false);
            setEditingUser(null);
          }}
          onSave={() => {
            fetchUsers();
            setShowUserForm(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
};

// User Form Component
const UserForm = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'user',
    isActive: user?.isActive !== undefined ? user.isActive : true
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = { ...formData };
      
      if (user && !submitData.password) {
        delete submitData.password;
      }

      if (user) {
        await axios.put(`/api/admin/users/${user._id}`, submitData);
      } else {
        await axios.post('/api/admin/users', submitData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user: ' + (error.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password {user && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
              required={!user}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-[#e50914] focus:ring-[#e50914] border-gray-500 rounded bg-white/5"
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-gray-300">
                Active user
              </label>
            </div>
            
            {user && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Subscription Type</label>
                  <select
                    value={formData.subscriptionType}
                    onChange={(e) => setFormData({ ...formData, subscriptionType: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Subscription Status</label>
                  <select
                    value={formData.subscriptionStatus}
                    onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]"
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#e50914] hover:bg-[#b8070f] text-white px-6 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Admin Panel Component
const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { admin, logout } = useContext(AdminAuthContext);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'manga', label: 'Manga', icon: BookOpen },
    { id: 'chapters', label: 'Chapters', icon: FileText },
    { id: 'users', label: 'Users', icon: Users },
  ];

  return (
    <div className="fixed inset-0 min-h-screen bg-[#141414] z-[9999] overflow-y-auto">
      <header className="bg-black/40 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="Coxico" className="admin-header-logo" />
              <span className="text-gray-400">Admin Panel</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Welcome, Admin</span>
              <button
                onClick={logout}
                className="bg-[#e50914] hover:bg-[#b8070f] text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-black/20 border-r border-white/10 min-h-screen">
          <nav className="p-4">
            <div className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeTab === tab.id
                        ? 'bg-[#e50914] text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-6">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'manga' && <MangaManagement />}
          {activeTab === 'chapters' && <ChapterManagement />}
          {activeTab === 'users' && <UserManagement />}
        </main>
      </div>
    </div>
  );
};

const AdminApp = () => {
  const { admin, loading } = useContext(AdminAuthContext);

  if (loading) {
    return (
      <div className="fixed inset-0 min-h-screen bg-[#141414] flex items-center justify-center z-[9999]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#e50914] border-t-transparent"></div>
      </div>
    );
  }

  return admin ? <AdminPanel /> : <AdminLogin />;
};

export default function AdminWithAuth() {
  return (
    <AdminAuth>
      <AdminApp />
    </AdminAuth>
  );
}