// frontend/src/App.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Search, Menu, X, User, Eye, Star, ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight, LogIn, UserPlus, Heart, History, LogOut, SlidersHorizontal,
  TrendingUp, Crown  // Add these two missing imports
} from 'lucide-react';
import axios from 'axios';
import './App.css';
import AdminApp from './AdminPanel.jsx'; // kept import as before
import { AuthProvider, useAuth } from './components/AuthContext';
import './styles/netflix-theme.css';
import AdminUpload from './AdminUpload.jsx';
import AdminWithAuth from './AdminPanel.jsx';

axios.defaults.baseURL = 'http://localhost:5000';

// ---------------------- Protected Route Component ----------------------
const AdminRoute = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};


// ---------------------- Header (sliding search + live results + "Did you mean") ----------------------
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);

  // Live results + suggestion state
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResults, setLiveResults] = useState([]);
  const [didYouMean, setDidYouMean] = useState(null);

  // Caches/refs
  const allIndexRef = useRef(null);   // cache of all manga for fuzzy
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load search history once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('search_history');
      if (raw) setSearchHistory(JSON.parse(raw));
    } catch {}
  }, []);

  // Lock body scroll when overlay open + focus field
  useEffect(() => {
    if (searchOpen) {
      document.body.classList.add('search-open');
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      document.body.classList.remove('search-open');
      setSearchTerm('');
      setLiveResults([]);
      setDidYouMean(null);
    }
    return () => document.body.classList.remove('search-open');
  }, [searchOpen]);

  // Keyboard shortcuts: "/" to open, Esc to close
  useEffect(() => {
    const handler = (e) => {
      const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
      if (!inInput && e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const pushHistory = (q) => {
    try {
      const current = Array.isArray(searchHistory) ? [...searchHistory] : [];
      const next = [q, ...current.filter((t) => t.toLowerCase() !== q.toLowerCase())].slice(0, 8);
      setSearchHistory(next);
      localStorage.setItem('search_history', JSON.stringify(next));
    } catch {}
  };

  const submitSearch = (e) => {
    e?.preventDefault?.();
    const q = (searchTerm || '').trim();
    if (!q) return;
    pushHistory(q);
    setIsMenuOpen(false);
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const trending = ['One Piece', 'Jujutsu Kaisen', 'Solo Leveling', 'Chainsaw Man', 'Blue Lock', 'Berserk'];

  // ---------- Fuzzy helpers ----------
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const levenshtein = (a, b) => {
    a = normalize(a); b = normalize(b);
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };

  // ---------- Debounced live search + did-you-mean ----------
  useEffect(() => {
    if (!searchOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const q = searchTerm.trim();
      if (!q) {
        setLiveResults([]);
        setDidYouMean(null);
        return;
      }

      setLiveLoading(true);
      try {
        // 1) Ask the server for results
        //    IMPORTANT: in Express, register /api/manga/search BEFORE /api/manga/:id
        const res = await axios.get(`/api/manga/search?q=${encodeURIComponent(q)}`);
        const items = res?.data?.manga || [];
        setLiveResults(items);

        // 2) If nothing, try fuzzy suggestion from cached full index
        if (items.length === 0) {
          if (!allIndexRef.current) {
            try {
              const all = await axios.get('/api/manga');
              allIndexRef.current = all?.data?.manga || [];
            } catch {
              allIndexRef.current = [];
            }
          }
          const idx = allIndexRef.current;
          let best = null;
          let bestDist = Infinity;
          const nq = normalize(q);

          idx.forEach((m) => {
            const d = levenshtein(nq, m?.title || '');
            if (d < bestDist) {
              bestDist = d;
              best = m;
            }
          });

          // Threshold: ~30% of query length, min 2
          const threshold = Math.max(2, Math.floor(nq.length * 0.3));
          if (best && nq.length >= 3 && bestDist <= threshold) {
            setDidYouMean({ title: best.title, id: best._id });
          } else {
            setDidYouMean(null);
          }
        } else {
          setDidYouMean(null);
        }
      } catch {
        setLiveResults([]);
        setDidYouMean(null);
      } finally {
        setLiveLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, searchOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-content">
        {/* Left / Center: Primary nav */}
        <nav className="nav-primary">
          <Link to="/" className="logo">MANGAREAD</Link>

          <Link to="/" className="nav-link">Home</Link>
          <Link to="/browse" className="nav-link">Browse</Link>
          <Link to="/popular" className="nav-link">Popular</Link>
          <Link to="/latest" className="nav-link">New Releases</Link>
          {isAuthenticated() && <Link to="/favorites" className="nav-link">My List</Link>}
          
          {/* Admin Upload Link - Only visible to admins */}
          {isAdmin && (
            <Link to="/admin/upload" className="nav-link text-[#e50914] font-semibold">
              Admin Upload
            </Link>
          )}
        </nav>

        {/* Right: Search + Auth */}
        <div className="nav-secondary">
          <button
            aria-label="Search"
            className="text-white hover:opacity-80"
            onClick={() => setSearchOpen(true)}
            title="Press / to search"
          >
            <Search className="search-icon" />
          </button>

          {/* Authenticated user menu */}
          {isAuthenticated() ? (
            <div className="relative">
              <button onClick={() => setIsMenuOpen((v) => !v)} className="profile-menu text-white">
                <div className="profile-avatar">{user?.username?.charAt(0)?.toUpperCase() || 'U'}</div>
                <div className="dropdown-arrow" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-3 w-56 rounded-md shadow-lg z-50 bg-[#141414] border border-white/10 overflow-hidden">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-300">
                      Signed in as <span className="font-semibold text-white">{user?.username}</span>
                    </div>
                    <Link to="/profile" className="block px-4 py-2 text-sm text-gray-200 hover:bg-white/10" onClick={() => setIsMenuOpen(false)}>
                      <User className="h-4 w-4 inline mr-2" /> Profile
                    </Link>
                    <Link to="/favorites" className="block px-4 py-2 text-sm text-gray-200 hover:bg-white/10" onClick={() => setIsMenuOpen(false)}>
                      <Heart className="h-4 w-4 inline mr-2" /> Favorites
                    </Link>
                    <Link to="/reading-history" className="block px-4 py-2 text-sm text-gray-200 hover:bg-white/10" onClick={() => setIsMenuOpen(false)}>
                      <History className="h-4 w-4 inline mr-2" /> Reading History
                    </Link>
                    <div className="my-1 border-t border-white/10" />
                    <button
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10"
                    >
                      <LogOut className="h-4 w-4 inline mr-2" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Not authenticated: show Login / Sign Up
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="text-white/90 hover:text-white px-3 py-1.5 text-sm font-medium border border-white/20 rounded">
                <LogIn className="h-4 w-4 inline mr-2" /> Login
              </Link>
              <Link to="/signup" className="bg-[#e50914] text-white px-4 py-2 rounded text-sm font-semibold hover:opacity-90">
                <UserPlus className="h-4 w-4 inline mr-2" /> Sign Up
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button className="md:hidden text-white" onClick={() => setIsMenuOpen((v) => !v)} aria-label="Toggle menu">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile flyout menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#141414]">
          <div className="px-4 py-3 space-y-1">
            <Link to="/" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>Home</Link>
            <Link to="/browse" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>Browse</Link>
            <Link to="/popular" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>Popular</Link>
            <Link to="/latest" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>New Releases</Link>
            {isAdmin && (
              <Link to="/admin/upload" className="block text-[#e50914] font-semibold py-2" onClick={() => setIsMenuOpen(false)}>
                Admin Upload
              </Link>
            )}
            <AuthMenuMobile setIsMenuOpen={setIsMenuOpen} />
          </div>
        </div>
      )}

      {/* Sliding Search Overlay */}
      {searchOpen && (
        <div className="search-overlay open" onClick={() => setSearchOpen(false)}>
          <div className="search-panel" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitSearch} className="search-form">
              <Search className="search-form-icon" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search manga, authors, genres…"
                className="search-input"
              />
              {searchTerm && (
                <button type="button" className="search-clear" onClick={() => setSearchTerm('')} aria-label="Clear">
                  <X size={16} />
                </button>
              )}
              <button type="submit" className="search-submit">Search</button>
            </form>

            {/* Live results while typing */}
            {!!searchTerm && (
              <div className="search-live">
                {liveLoading ? (
                  <div className="search-empty">Searching…</div>
                ) : liveResults.length > 0 ? (
                  <div className="search-list">
                    {liveResults.map((m) => (
                      <Link
                        key={m._id}
                        to={`/manga/${m._id}`}
                        className="search-item"
                        onClick={() => setSearchOpen(false)}
                      >
                        <img className="search-item-cover" src={m.coverImage} alt={m.title} />
                        <div className="search-item-body">
                          <div className="search-item-title">{m.title}</div>
                          <div className="search-item-meta">
                            {(m.rating || 0).toFixed(1)}/10 · {m.status || '—'} · {(m.views || 0)} views
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="search-empty">
                    No matches for "{searchTerm}".
                    {didYouMean ? (
                      <>
                        {' '}Did you mean{' '}
                        <button
                          className="didyou-link"
                          onClick={() => {
                            const t = didYouMean.title;
                            setSearchTerm(t);
                            pushHistory(t);
                            setSearchOpen(false);
                            navigate(`/search?q=${encodeURIComponent(t)}`);
                          }}
                        >
                          <strong>{didYouMean.title}</strong>
                        </button>
                        ?
                      </>
                    ) : (
                      <> Press Enter to search all results.</>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick chips */}
            <div className="search-quick">
              {searchHistory.length > 0 && (
                <div className="quick-block">
                  <div className="quick-title">Recent</div>
                  <div className="quick-chips">
                    {searchHistory.map((q) => (
                      <button
                        key={q}
                        className="chip"
                        onClick={() => {
                          setSearchTerm(q);
                          navigate(`/search?q=${encodeURIComponent(q)}`);
                          setSearchOpen(false);
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="quick-block">
                <div className="quick-title">Trending</div>
                <div className="quick-chips">
                  {trending.map((q) => (
                    <button
                      key={q}
                      className="chip"
                      onClick={() => {
                        setSearchTerm(q);
                        navigate(`/search?q=${encodeURIComponent(q)}`);
                        setSearchOpen(false);
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

const AuthMenuMobile = ({ setIsMenuOpen }) => {
  const { isAuthenticated, logout } = useAuth();
  if (isAuthenticated()) {
    return (
      <>
        <Link to="/favorites" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>My List</Link>
        <Link to="/profile" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>Profile</Link>
        <Link to="/reading-history" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>Reading History</Link>
        <button
          onClick={() => { logout(); setIsMenuOpen(false); }}
          className="block w-full text-left text-red-400 py-2"
        >
          Sign out
        </button>
      </>
    );
  }
  return (
    <>
      <Link to="/login" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>
        <LogIn className="h-4 w-4 inline mr-2" />
        Login
      </Link>
      <Link to="/signup" className="block text-gray-200 py-2" onClick={() => setIsMenuOpen(false)}>
        <UserPlus className="h-4 w-4 inline mr-2" />
        Sign Up
      </Link>
    </>
  );
};

// ---------------------- Manga Card ----------------------
const MangaCard = ({ manga }) => {
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const handleFavoriteClick = async (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      setShowLoginPrompt(true);
      setTimeout(() => setShowLoginPrompt(false), 3000);
      return;
    }
    setFavoriteLoading(true);
    const result = await toggleFavorite(manga._id);
    setFavoriteLoading(false);
    if (!result.success) {
      console.error('Favorite toggle error:', result.message);
    }
  };

  return (
    <div className="group relative">
      <Link to={`/manga/${manga._id}`} className="block">
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
          <div className="relative">
            <img
              src={manga.coverImage}
              alt={manga.title}
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {/* Status Badge */}
            <div className="absolute top-2 right-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full text-white ${
                manga.status === 'ongoing' ? 'bg-green-500' :
                manga.status === 'completed' ? 'bg-blue-500' :
                'bg-yellow-500'
              }`}>
                {manga.status}
              </span>
            </div>
            {/* Favorite Button */}
            <div className="absolute top-2 left-2">
              <button
                onClick={handleFavoriteClick}
                disabled={favoriteLoading}
                className={`p-2 rounded-full transition-all duration-200 ${
                  favoriteLoading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : isAuthenticated() && isFavorite(manga._id)
                    ? 'bg-red-500 text-white shadow-lg hover:bg-red-600'
                    : 'bg-white/80 text-gray-600 hover:bg-white hover:text-red-500 shadow-md'
                } backdrop-blur-sm`}
                title={!isAuthenticated() ? 'Login to add favorites' : isFavorite(manga._id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                {favoriteLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Heart className={`h-4 w-4 ${isAuthenticated() && isFavorite(manga._id) ? 'fill-current' : ''}`} />
                )}
              </button>
            </div>
            {/* Login Prompt */}
            {showLoginPrompt && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-white px-4 py-2 rounded-lg text-sm font-medium animate-fade-in">
                  <Link to="/login" className="text-blue-600 hover:text-blue-700">
                    Login to add favorites
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="p-4">
            <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
              {manga.title}
            </h3>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{manga.description}</p>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center">
                <Star className="h-4 w-4 text-yellow-400 mr-1" />
                <span>{manga.rating}/10</span>
              </div>
              <div className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                <span>{manga.views.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {manga.genres.slice(0, 2).map((genre, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  {genre}
                </span>
              ))}
              {manga.genres.length > 2 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  +{manga.genres.length - 2}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

// ---------------------- Home (billboard + rows) ----------------------
const HomePage = () => {
  const [manga, setManga] = useState([]);
  const [featuredManga, setFeaturedManga] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManga();
  }, []);

  const fetchManga = async () => {
    try {
      const response = await axios.get('/api/manga');
      const mangaList = response.data.manga || [];
      setManga(mangaList);

      if (mangaList.length > 0) {
        const featured = mangaList.reduce((a, b) => (a.rating > b.rating ? a : b));
        setFeaturedManga(featured);
      }
    } catch (error) {
      console.error('Error fetching manga:', error);
    } finally {
      setLoading(false);
    }
  };

  const Row = ({ title, items }) => {
    const sliderRef = useRef(null);
    const [offset, setOffset] = useState(0);
    const STEP = 100;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const pages = Math.max(0, Math.ceil(items.length / 6) - 1);
    const maxOffset = -STEP * pages;

    const next = () => setOffset((o) => clamp(o - STEP, maxOffset, 0));
    const prev = () => setOffset((o) => clamp(o + STEP, maxOffset, 0));

    useEffect(() => {
      if (sliderRef.current) sliderRef.current.style.transform = `translateX(${offset}%)`;
    }, [offset]);

    if (!items || items.length === 0) return null;

    return (
      <div className="content-row">
        <div className="row-header">
          <h2 className="row-title">{title}</h2>
          <Link to="/browse" className="see-all">See All →</Link>
        </div>

        <div className="slider-container">
          <button className="slider-button prev" onClick={prev}>‹</button>
          <div className="slider-mask">
            <div className="slider" ref={sliderRef}>
              {items.map((m) => (
  <Link key={m._id} to={`/manga/${m._id}`} className="manga-tile">
    <div className="tile-inner">
      <img
        src={m.coverImage || 'https://via.placeholder.com/300x450/2a2a2a/ffffff?text=Manga'}
        alt={m.title}
        className="tile-image"
      />
      <div className="tile-hover">
        <h3 className="tile-title">{m.title}</h3>
        <div className="tile-meta">
          <span className="tile-match">{Math.round(((m.rating || 0) * 10))}% Match</span>
          <span>{m.status || '—'}</span>
        </div>
        <div className="tile-actions">
          <button className="action-btn" title="Read">▶</button>
          <button className="action-btn" title="More">ℹ</button>
        </div>
      </div>
    </div>
  </Link>
))}
            </div>
          </div>
          <button className="slider-button next" onClick={next}>›</button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  const billboardStyle = featuredManga
    ? {
        backgroundImage: `
          linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%),
          linear-gradient(to top, #141414 0%, transparent 20%),
          url('${featuredManga.coverImage}')
        `,
      }
    : {};

  const latest = [...manga].slice(0, 18);
  const trending = [...manga].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 18);
  const becauseYouLiked = featuredManga
    ? [...manga].filter((m) =>
        (m.genres || []).some((g) => (featuredManga.genres || []).includes(g))
      ).slice(0, 18)
    : [];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <section className="billboard" style={billboardStyle}>
        <div className="billboard-content">
          <h1 className="billboard-title">{featuredManga?.title || 'Featured'}</h1>
          <p className="billboard-description">
            {featuredManga?.description
              ? (featuredManga.description.length > 220
                  ? featuredManga.description.slice(0, 220) + '…'
                  : featuredManga.description)
              : 'Discover and read amazing manga stories.'}
          </p>
          <div className="billboard-metadata">
            <span className="match-score">{Math.round(((featuredManga?.rating || 0) * 10))}% Match</span>
            <span>{(featuredManga?.views || 0).toLocaleString()} views</span>
            <span>{featuredManga?.status || '—'}</span>
          </div>
          <div className="billboard-buttons">
            {featuredManga && (
              <>
                <Link to={`/manga/${featuredManga._id}`} className="btn btn-play">▶ Read</Link>
                <Link to={`/manga/${featuredManga._id}`} className="btn btn-info">ℹ More Info</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <Row title="Latest Manga" items={latest} />
      <Row title="Trending Now" items={trending} />
      {becauseYouLiked.length > 0 && (
        <Row title={`Because You Liked ${featuredManga?.title}`} items={becauseYouLiked} />
      )}
    </div>
  );
};

// ---------------------- Manga Detail (dark hero) ----------------------
const MangaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();

  const [manga, setManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    const fetchMangaDetail = async () => {
      try {
        const response = await axios.get(`/api/manga/${id}`);
        setManga(response.data.manga);
        setChapters(response.data.chapters || []);

        console.log('Manga object:', response.data.manga);
        
      } catch (error) {
        console.error('Error fetching manga detail:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMangaDetail();
  }, [id]);

  const handleFavorite = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!manga?._id) return;
    setFavLoading(true);
    await toggleFavorite(manga._id);
    setFavLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Manga not found</h2>
          <Link to="/" className="text-[#54b9c5] hover:underline">Go back home</Link>
        </div>
      </div>
    );
  }

  const heroStyle = {
    backgroundImage: `
      linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%),
      linear-gradient(to top, #141414 0%, transparent 20%),
      url('${manga.coverImage}')
    `,
  };

  const firstChapter = chapters?.[0];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <section className="billboard" style={heroStyle}>
        <div className="billboard-content">
          <h1 className="billboard-title">{manga.title}</h1>
          <p className="billboard-description">
            {manga.description?.length > 260 ? manga.description.slice(0, 260) + '…' : manga.description}
          </p>

          <div className="billboard-metadata">
            <span className="match-score">{Math.round((manga.rating || 0) * 10)}% Match</span>
            <span>{(manga.views || 0).toLocaleString()} views</span>
            <span className="capitalize">{manga.status || '—'}</span>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {(manga.genres || []).slice(0, 6).map((g) => (
              <span key={g} className="px-2 py-1 text-xs rounded bg-white/10">{g}</span>
            ))}
          </div>

          <div className="billboard-buttons">
  {firstChapter && (
    <Link to={`/read/${manga._id}/chapter/${firstChapter.chapterNumber}`} className="btn btn-play">
      ▶ Read Chapter {firstChapter.chapterNumber}
    </Link>
  )}
  <button onClick={handleFavorite} className="btn btn-info" disabled={favLoading}>
  {favLoading ? (
    'Saving…'
  ) : isAuthenticated() ? (
    isFavorite(manga._id) ? '♥ Remove from Favourites' : '+ Add to Favourites'
  ) : (
    '+ Add to Favourites'
  )}
</button>
</div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-4">About</h2>
            <div className="bg-white/5 border border-white/10 rounded-lg p-5 leading-relaxed text-white/80">
              {manga.description}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-white/80">
              <div><span className="text-white/60">Author:</span> {manga.author || '—'}</div>
              <div><span className="text-white/60">Artist:</span> {manga.artist || '—'}</div>
              <div className="flex items-center">
                <Star className="h-4 w-4 text-yellow-400 mr-1" />
                <span>{manga.rating}/10</span>
              </div>
              <div className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                <span>{(manga.views || 0).toLocaleString()} views</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <img
              src={manga.coverImage}
              alt={manga.title}
              className="w-full rounded-lg shadow-lg border border-white/10"
            />
          </div>
        </div>

        {/* Chapters */}
<div className="mt-12">
  <h2 className="text-2xl font-semibold mb-6">Chapters</h2>

  {chapters.length === 0 ? (
    <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center text-white/70">
      No chapters available yet.
    </div>
  ) : (
    <div className="space-y-6">
      {/* Check if manga has volumes */}
      {manga.hasVolumes && manga.volumes ? (
        // Display by volumes
        manga.volumes.map((volume, volIndex) => (
          <div key={volume.volumeNumber} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            <div className="bg-white/10 px-6 py-3 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {volume.volumeTitle} ({volume.chapters.length} chapters)
              </h3>
            </div>
            {volume.chapters.map((chapter, idx) => (
              <Link
                key={chapter._id}
                to={`/read/${manga._id}/chapter/${chapter.chapterNumber}`}
                className={`block px-6 py-4 text-white/90 hover:bg-white/10 transition-colors ${
                  idx !== volume.chapters.length - 1 ? 'border-b border-white/10' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      Chapter {chapter.chapterNumber}: {chapter.title}
                    </div>
                    <div className="text-xs text-white/60">
                      {new Date(chapter.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-white/70">
                    <Eye className="h-4 w-4 mr-1" />
                    <span>{chapter.views || 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))
      ) : (
        // Display flat structure (no volumes)
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          {chapters.map((chapter, idx) => (
            <Link
              key={chapter._id}
              to={`/read/${manga._id}/chapter/${chapter.chapterNumber}`}
              className={`block px-6 py-4 text-white/90 hover:bg-white/10 transition-colors ${
                idx !== chapters.length - 1 ? 'border-b border-white/10' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    Chapter {chapter.chapterNumber}: {chapter.title}
                  </div>
                  <div className="text-xs text-white/60">
                    {new Date(chapter.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center text-sm text-white/70">
                  <Eye className="h-4 w-4 mr-1" />
                  <span>{chapter.views || 0}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )}
</div>
      </div>
    </div>
  );
};

// ---------------------- Chapter Reader ----------------------
const ChapterReaderPage = () => {
  const { mangaId, chapterNumber } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, updateReadingProgress } = useAuth();
  const [data, setData] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());
  const [lastProgressUpdate, setLastProgressUpdate] = useState(0);

  useEffect(() => {
    const fetchChapter = async () => {
      try {
        const response = await axios.get(`/api/chapters/manga/${mangaId}/chapter/${chapterNumber}`);
        setData(response.data);
        
        // Check if we should go to last page
        const shouldGoToLastPage = sessionStorage.getItem('goToLastPage') === 'true';
        if (shouldGoToLastPage) {
          sessionStorage.removeItem('goToLastPage');
          setCurrentPage(response.data.chapter.pages.length - 1);
        } else {
          setCurrentPage(0);
        }
      } catch (error) {
        console.error('Error fetching chapter:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChapter();
    setStartTime(Date.now()); // Reset reading timer
  }, [mangaId, chapterNumber]);

  // Auto-save reading progress every 30 seconds or when page changes significantly
  useEffect(() => {
    if (!data || !isAuthenticated()) return;

    const saveProgress = async () => {
      const now = Date.now();
      const readingTime = Math.floor((now - startTime) / 1000); // Convert to seconds
      
      // Only save if user has been reading for at least 5 seconds
      if (readingTime >= 5 && currentPage !== lastProgressUpdate) {
        await updateReadingProgress(
          mangaId,
          data.chapter._id,
          data.chapter.chapterNumber,
          currentPage,
          data.chapter.pages.length,
          Math.floor((now - startTime) / 1000)
        );
        setLastProgressUpdate(currentPage);
        setStartTime(now); // Reset timer
      }
    };

    // Save immediately when page changes significantly (every 5 pages or at boundaries)
    if (currentPage % 5 === 0 || currentPage === 0 || currentPage === data.chapter.pages.length - 1) {
      const timer = setTimeout(saveProgress, 1000);
      return () => clearTimeout(timer);
    }

    // Auto-save every 30 seconds
    const interval = setInterval(saveProgress, 30000);
    return () => clearInterval(interval);
  }, [data, currentPage, isAuthenticated, mangaId, updateReadingProgress, startTime, lastProgressUpdate]);

  // Save progress on component unmount
  useEffect(() => {
    return () => {
      if (data && isAuthenticated() && currentPage !== lastProgressUpdate) {
        const readingTime = Math.floor((Date.now() - startTime) / 1000);
        if (readingTime >= 5) {
          updateReadingProgress(
            mangaId,
            data.chapter._id,
            data.chapter.chapterNumber,
            currentPage,
            data.chapter.pages.length,
            readingTime
          );
        }
      }
    };
  }, [data, currentPage, isAuthenticated, mangaId, updateReadingProgress, startTime, lastProgressUpdate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextPage();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, data]);

  const nextPage = () => {
    if (data && currentPage < data.chapter.pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else if (data && currentPage === data.chapter.pages.length - 1) {
      // Save progress before moving to next chapter
      if (isAuthenticated()) {
        updateReadingProgress(
          mangaId,
          data.chapter._id,
          data.chapter.chapterNumber,
          currentPage,
          data.chapter.pages.length,
          Math.floor((Date.now() - startTime) / 1000)
        );
      }
      nextChapter();
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (currentPage === 0) {
      prevChapterToLastPage();
    }
  };

  const nextChapter = () => {
    if (data) {
      const currentIndex = data.allChapters.findIndex(
        ch => ch.chapterNumber === parseInt(chapterNumber)
      );
      if (currentIndex < data.allChapters.length - 1) {
        const nextCh = data.allChapters[currentIndex + 1];
        setCurrentPage(0);
        navigate(`/read/${mangaId}/chapter/${nextCh.chapterNumber}`);
      }
    }
  };

  const prevChapterToLastPage = () => {
    if (data) {
      const currentIndex = data.allChapters.findIndex(
        ch => ch.chapterNumber === parseInt(chapterNumber)
      );
      if (currentIndex > 0) {
        const prevCh = data.allChapters[currentIndex - 1];
        sessionStorage.setItem('goToLastPage', 'true');
        navigate(`/read/${mangaId}/chapter/${prevCh.chapterNumber}`);
      }
    }
  };

  const prevChapter = () => {
    if (data) {
      const currentIndex = data.allChapters.findIndex(
        ch => ch.chapterNumber === parseInt(chapterNumber)
      );
      if (currentIndex > 0) {
        const prevCh = data.allChapters[currentIndex - 1];
        setCurrentPage(0);
        navigate(`/read/${mangaId}/chapter/${prevCh.chapterNumber}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2">Loading chapter...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Chapter not found</h2>
          <button
            onClick={() => navigate(`/manga/${mangaId}`)}
            className="text-blue-400 hover:text-blue-300"
          >
            Go back to manga
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Chapter Navigation Header */}
      <div 
        className="bg-gray-900 p-4" 
        style={{
          position: 'fixed',
          top: '64px',
          left: '0',
          right: '0',
          zIndex: '100'
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/manga/${mangaId}`)}
            className="flex items-center text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to {data.manga.title}
          </button>
          <h1 className="text-lg font-semibold">
            Chapter {data.chapter.chapterNumber}: {data.chapter.title}
          </h1>
          <div className="text-sm text-gray-400">
            Page {currentPage + 1} of {data.chapter.pages.length}
          </div>
        </div>
      </div>

      {/* Reader Content */}
      <div 
        style={{
          position: 'fixed',
          top: '120px',
          left: '0',
          right: '0',
          bottom: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px'
        }}
      >
        <img
          src={data.chapter.pages[currentPage]}
          alt={`Page ${currentPage + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Navigation Controls */}
      <div 
        className="bg-gray-900 rounded-lg p-2 flex items-center space-x-4"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: '100'
        }}
      >
        <button
          onClick={prevPage}
          disabled={currentPage === 0 && (!data.allChapters || data.allChapters.findIndex(ch => ch.chapterNumber === parseInt(chapterNumber)) === 0)}
          className="p-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 rounded"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="text-sm px-4">
          {currentPage + 1} / {data.chapter.pages.length}
        </span>

        <button
          onClick={nextPage}
          disabled={currentPage >= data.chapter.pages.length - 1 && (!data.allChapters || data.allChapters.findIndex(ch => ch.chapterNumber === parseInt(chapterNumber)) === data.allChapters.length - 1)}
          className="p-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 rounded"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Chapter Navigation - Left */}
      <div 
        style={{
          position: 'fixed',
          top: '50%',
          left: '20px',
          transform: 'translateY(-50%)',
          zIndex: '100'
        }}
      >
        <button
          onClick={prevChapter}
          className="bg-gray-900 p-3 rounded-full hover:bg-gray-700 disabled:opacity-50"
          disabled={!data.allChapters || data.allChapters.findIndex(ch => ch.chapterNumber === parseInt(chapterNumber)) === 0}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      {/* Chapter Navigation - Right */}
      <div 
        style={{
          position: 'fixed',
          top: '50%',
          right: '20px',
          transform: 'translateY(-50%)',
          zIndex: '100'
        }}
      >
        <button
          onClick={nextChapter}
          className="bg-gray-900 p-3 rounded-full hover:bg-gray-700 disabled:opacity-50"
          disabled={!data.allChapters || data.allChapters.findIndex(ch => ch.chapterNumber === parseInt(chapterNumber)) === data.allChapters.length - 1}
        >
          <ArrowRight className="h-6 w-6" />
        </button>
      </div>

      {/* Click areas for page navigation */}
      <div
        className="cursor-pointer"
        style={{
          position: 'fixed',
          top: '120px',
          left: '0',
          width: '33%',
          bottom: '80px',
          zIndex: '50'
        }}
        onClick={prevPage}
      />
      <div
        style={{
          position: 'fixed',
          top: '120px',
          right: '0',
          width: '33%',
          bottom: '80px',
          zIndex: '50',
          cursor: 'pointer'
        }}
        onClick={nextPage}
      />
    </div>
  );
};

// ---------------------- Browse/Popular/Latest placeholders ----------------------
const BrowsePage = () => {
  const [manga, setManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('title_asc');
  const [genreFilter, setGenreFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch all manga
useEffect(() => {
  const fetchManga = async () => {
    try {
      const response = await axios.get('/api/manga');
      const mangaList = response.data.manga || [];
      
      // DEBUG: Check what IDs we're getting
      console.log('=== MANGA DEBUG START ===');
      console.log('Total manga received:', mangaList.length);
      console.log('');
      
      if (mangaList.length > 0) {
        console.log('Manga ID Details:');
        mangaList.forEach(m => {
          console.log(`  Title: "${m.title}"`);
          console.log(`  ID: "${m._id}"`);
          console.log(`  ID Type: ${typeof m._id}`);
          console.log(`  ID Length: ${m._id ? m._id.length : 0}`);
          console.log('  ---');
        });
      } else {
        console.log('No manga found in response!');
      }
      
      console.log('=== MANGA DEBUG END ===');
      console.log('');
      
      setManga(mangaList);
    } catch (error) {
      console.error('Error fetching manga:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    } finally {
      setLoading(false);
    }
  };
  fetchManga();
}, []);

  // Filter and sort manga
  const filteredAndSortedManga = useMemo(() => {
    let filtered = manga.filter(m => {
      const matchesSearch = !searchQuery || 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesGenre = !genreFilter || 
        m.genres.some(g => g.toLowerCase().includes(genreFilter.toLowerCase()));
      
      const matchesStatus = !statusFilter || m.status === statusFilter;
      
      return matchesSearch && matchesGenre && matchesStatus;
    });

    // Sort manga
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title_asc': return a.title.localeCompare(b.title);
        case 'title_desc': return b.title.localeCompare(a.title);
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        case 'rating_asc': return (a.rating || 0) - (b.rating || 0);
        case 'views_desc': return (b.views || 0) - (a.views || 0);
        case 'views_asc': return (a.views || 0) - (b.views || 0);
        case 'chapters_desc': return (b.chapters || 0) - (a.chapters || 0);
        case 'chapters_asc': return (a.chapters || 0) - (b.chapters || 0);
        default: return 0;
      }
    });

    return filtered;
  }, [manga, searchQuery, sortBy, genreFilter, statusFilter]);

  // Get all unique genres
  const allGenres = useMemo(() => {
    const genres = new Set();
    manga.forEach(m => m.genres.forEach(g => genres.add(g)));
    return Array.from(genres).sort();
  }, [manga]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white">
        <div className="container mx-auto px-6 py-8 pt-20">
          <div className="flex items-center justify-center h-64">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <div className="container mx-auto px-6 py-8 pt-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Browse Manga</h1>
          <p className="text-white/70">Discover your next favorite manga from our collection</p>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/60" />
            <input
              type="text"
              placeholder="Search manga titles, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
            />
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Sort By */}
            <select
  value={sortBy}
  onChange={(e) => setSortBy(e.target.value)}
  className="bg-[#333] border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]"
  style={{
    color: 'white',
    backgroundColor: '#333'
  }}
>
  <option value="title_asc" style={{ backgroundColor: '#333', color: 'white' }}>Title A-Z</option>
  <option value="title_desc" style={{ backgroundColor: '#333', color: 'white' }}>Title Z-A</option>
  <option value="rating_desc" style={{ backgroundColor: '#333', color: 'white' }}>Highest Rated</option>
  <option value="rating_asc" style={{ backgroundColor: '#333', color: 'white' }}>Lowest Rated</option>
  <option value="views_desc" style={{ backgroundColor: '#333', color: 'white' }}>Most Popular</option>
  <option value="views_asc" style={{ backgroundColor: '#333', color: 'white' }}>Least Popular</option>
  <option value="chapters_desc" style={{ backgroundColor: '#333', color: 'white' }}>Most Chapters</option>
  <option value="chapters_asc" style={{ backgroundColor: '#333', color: 'white' }}>Fewest Chapters</option>
</select>

            {/* Genre Filter */}
            <select
  value={genreFilter}
  onChange={(e) => setGenreFilter(e.target.value)}
  className="bg-[#333] border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]"
  style={{
    color: 'white',
    backgroundColor: '#333'
  }}
>
  <option value="" style={{ backgroundColor: '#333', color: 'white' }}>All Genres</option>
  {allGenres.map(genre => (
    <option key={genre} value={genre} style={{ backgroundColor: '#333', color: 'white' }}>{genre}</option>
  ))}
</select>

            {/* Status Filter */}
            <select
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
  className="bg-[#333] border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]"
  style={{
    color: 'white',
    backgroundColor: '#333'
  }}
>
  <option value="" style={{ backgroundColor: '#333', color: 'white' }}>All Status</option>
  <option value="ongoing" style={{ backgroundColor: '#333', color: 'white' }}>Ongoing</option>
  <option value="completed" style={{ backgroundColor: '#333', color: 'white' }}>Completed</option>
  <option value="hiatus" style={{ backgroundColor: '#333', color: 'white' }}>Hiatus</option>
</select>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchQuery('');
                setSortBy('title_asc');
                setGenreFilter('');
                setStatusFilter('');
              }}
              className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-3 text-white transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-white/70">
            Showing {filteredAndSortedManga.length} of {manga.length} manga
          </p>
        </div>

        {/* Manga Grid */}
        {filteredAndSortedManga.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-16 w-16 text-white/40 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No manga found</h3>
            <p className="text-white/60">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {filteredAndSortedManga.map((mangaItem) => (
              <Link
                key={mangaItem._id}
                to={`/manga/${mangaItem._id}`}
                className="group cursor-pointer"
              >
                <div className="relative overflow-hidden rounded-lg bg-white/5 transition-transform duration-300 group-hover:scale-105">
                  {/* Cover Image */}
                  <div className="aspect-[3/4] relative">
                    <img
                      src={mangaItem.coverImage}
                      alt={mangaItem.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="text-center p-4">
                        <h3 className="font-semibold text-sm mb-2 line-clamp-2">{mangaItem.title}</h3>
                        <div className="flex items-center justify-center gap-4 text-xs text-white/80">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400" />
                            {mangaItem.rating?.toFixed(1) || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {(mangaItem.views || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        mangaItem.status === 'completed' ? 'bg-green-600' :
                        mangaItem.status === 'ongoing' ? 'bg-blue-600' :
                        'bg-yellow-600'
                      }`}>
                        {mangaItem.status?.charAt(0).toUpperCase() + mangaItem.status?.slice(1) || 'Unknown'}
                      </span>
                    </div>

                    {/* Chapter Count */}
                    <div className="absolute bottom-2 right-2">
                      <span className="bg-black/70 px-2 py-1 rounded text-xs">
                        {mangaItem.chapters || 0} Ch
                      </span>
                    </div>
                  </div>

                  {/* Title (Always Visible) */}
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 group-hover:text-[#e50914] transition-colors">
                      {mangaItem.title}
                    </h3>
                    
                    {/* Genres */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mangaItem.genres?.slice(0, 2).map((genre) => (
                        <span key={genre} className="px-1.5 py-0.5 text-xs bg-white/10 rounded text-white/70">
                          {genre}
                        </span>
                      ))}
                      {mangaItem.genres?.length > 2 && (
                        <span className="px-1.5 py-0.5 text-xs bg-white/10 rounded text-white/70">
                          +{mangaItem.genres.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------- Favorites (stable) ----------------------
const FavoritesPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dateAdded'); // dateAdded, title, rating, status
  const [filterByStatus, setFilterByStatus] = useState('all'); // all, ongoing, completed
  const [filterByGenre, setFilterByGenre] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const navigate = useNavigate();

  // Helper function to convert ObjectId back to slug for navigation
  const getSlugFromObjectId = (objectId) => {
    // Map known ObjectIds back to their slugs
    const objectIdToSlugMap = {
      '68bef993a319f39dd3d3cc2b': 'onepiece',
      '68bef9a4a319f39dd3d3cc43': 'onepiece', // duplicate One Piece ID
      '68bef99aa319f39dd3d3cc3b': 'attackontitan',
      '68bf0b81bf172fe4678f7d1b': 'attackontitan',
      '68bf0b84bf172fe4678f7d21': 'attackontitan'
      // Add more mappings as you discover them from console logs
    };
    
    return objectIdToSlugMap[objectId] || objectId;
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    if (hasFetched) return;

    const loadFavorites = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch('http://localhost:5000/api/auth/favorites', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Favorites data:', data.favorites); // Debug line to see the data structure
          // Add dateAdded for sorting (simulate dates for now)
          const favoritesWithDates = (data.favorites || []).map((manga, index) => ({
            ...manga,
            dateAdded: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)) // Simulate different dates
          }));
          setFavorites(favoritesWithDates);
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    };

    loadFavorites();
  }, [isAuthenticated, navigate, hasFetched]);

  // Filter and sort favorites
  const filteredAndSortedFavorites = useMemo(() => {
    let filtered = favorites.filter(manga => {
      const matchesSearch = !searchQuery || 
        manga.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        manga.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = filterByStatus === 'all' || manga.status === filterByStatus;
      
      const matchesGenre = filterByGenre === 'all' || 
        manga.genres?.some(g => g.toLowerCase() === filterByGenre.toLowerCase());
      
      return matchesSearch && matchesStatus && matchesGenre;
    });

    // Sort favorites
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'dateAdded':
        default:
          return new Date(b.dateAdded) - new Date(a.dateAdded);
      }
    });

    return filtered;
  }, [favorites, searchQuery, sortBy, filterByStatus, filterByGenre]);

  // Get unique genres from favorites
  const availableGenres = useMemo(() => {
    const genres = new Set();
    favorites.forEach(manga => 
      manga.genres?.forEach(genre => genres.add(genre))
    );
    return Array.from(genres).sort();
  }, [favorites]);

  // Calculate stats
  const stats = useMemo(() => {
    const genreCounts = {};
    favorites.forEach(m => m.genres?.forEach(g => { 
      genreCounts[g] = (genreCounts[g] || 0) + 1; 
    }));
    const topGenres = Object.entries(genreCounts)
      .sort(([,a],[,b]) => b-a)
      .slice(0,3)
      .map(([g])=>g);

    return {
      total: favorites.length,
      ongoing: favorites.filter(m => m.status === 'ongoing').length,
      completed: favorites.filter(m => m.status === 'completed').length,
      avgRating: favorites.length > 0 
        ? (favorites.reduce((a,m)=>a+(m.rating||0),0)/favorites.length).toFixed(1)
        : '0.0',
      topGenres,
      totalChapters: favorites.reduce((sum, manga) => sum + (manga.chapters || 0), 0)
    };
  }, [favorites]);

  if (!isAuthenticated()) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e50914] mx-auto"></div>
          <p className="mt-4 text-white/70">Loading your favorites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <div className="container mx-auto px-6 py-8 pt-20">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Favorites</h1>
          <p className="text-white/70">{stats.total} manga in your collection</p>
        </div>

        {favorites.length === 0 ? (
          // Empty State
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="h-12 w-12 text-white/40" />
            </div>
            <h2 className="text-2xl font-bold mb-4">No favorites yet</h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">
              Start building your manga collection by adding manga to your favorites!
            </p>
            <Link
              to="/browse"
              className="bg-[#e50914] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#b20710] transition-colors"
            >
              Browse Manga
            </Link>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[#e50914]">{stats.total}</div>
                <div className="text-sm text-white/70">Total Manga</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.ongoing}</div>
                <div className="text-sm text-white/70">Ongoing</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
                <div className="text-sm text-white/70">Completed</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{stats.avgRating}</div>
                <div className="text-sm text-white/70">Avg. Rating</div>
              </div>
            </div>

            {/* Controls Section */}
            <div className="mb-8 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/60" />
                <input
                  type="text"
                  placeholder="Search your favorites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent"
                />
              </div>

              {/* Filters and View Controls */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[#333] border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]"
                  style={{ color: 'white', backgroundColor: '#333' }}
                >
                  <option value="dateAdded" style={{ backgroundColor: '#333', color: 'white' }}>Recently Added</option>
                  <option value="title" style={{ backgroundColor: '#333', color: 'white' }}>Title A-Z</option>
                  <option value="rating" style={{ backgroundColor: '#333', color: 'white' }}>Highest Rated</option>
                  <option value="status" style={{ backgroundColor: '#333', color: 'white' }}>Status</option>
                </select>

                {/* Filter by Status */}
                <select
                  value={filterByStatus}
                  onChange={(e) => setFilterByStatus(e.target.value)}
                  className="bg-[#333] border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]"
                  style={{ color: 'white', backgroundColor: '#333' }}
                >
                  <option value="all" style={{ backgroundColor: '#333', color: 'white' }}>All Status</option>
                  <option value="ongoing" style={{ backgroundColor: '#333', color: 'white' }}>Ongoing</option>
                  <option value="completed" style={{ backgroundColor: '#333', color: 'white' }}>Completed</option>
                </select>

                {/* Filter by Genre */}
                <select
                  value={filterByGenre}
                  onChange={(e) => setFilterByGenre(e.target.value)}
                  className="bg-[#333] border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]"
                  style={{ color: 'white', backgroundColor: '#333' }}
                >
                  <option value="all" style={{ backgroundColor: '#333', color: 'white' }}>All Genres</option>
                  {availableGenres.map(genre => (
                    <option key={genre} value={genre} style={{ backgroundColor: '#333', color: 'white' }}>
                      {genre}
                    </option>
                  ))}
                </select>

                {/* View Mode Toggle */}
                <div className="flex bg-white/10 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      viewMode === 'grid' ? 'bg-[#e50914] text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      viewMode === 'list' ? 'bg-[#e50914] text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    List
                  </button>
                </div>

                {/* Clear Filters */}
                {(searchQuery || sortBy !== 'dateAdded' || filterByStatus !== 'all' || filterByGenre !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSortBy('dateAdded');
                      setFilterByStatus('all');
                      setFilterByGenre('all');
                    }}
                    className="text-white/70 hover:text-white text-sm underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Results count */}
              <div className="text-white/70 text-sm">
                Showing {filteredAndSortedFavorites.length} of {favorites.length} manga
              </div>
            </div>

            {/* Manga Display */}
            {filteredAndSortedFavorites.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="h-16 w-16 text-white/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No manga found</h3>
                <p className="text-white/60">Try adjusting your search or filters</p>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid View
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {filteredAndSortedFavorites.map((manga) => (
                  <Link
                    key={manga._id}
                    to={`/manga/${getSlugFromObjectId(manga._id)}`}
                    className="group cursor-pointer"
                  >
                    <div className="relative overflow-hidden rounded-lg bg-white/5 transition-transform duration-300 group-hover:scale-105">
                      {/* Cover Image */}
                      <div className="aspect-[3/4] relative">
                        <img
                          src={manga.coverImage}
                          alt={manga.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        
                        {/* Overlay on Hover */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="text-center p-4">
                            <h3 className="font-semibold text-sm mb-2 line-clamp-2">{manga.title}</h3>
                            <div className="flex items-center justify-center gap-4 text-xs text-white/80">
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-400" />
                                {manga.rating?.toFixed(1) || 'N/A'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {(manga.views || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            manga.status === 'completed' ? 'bg-green-600' :
                            manga.status === 'ongoing' ? 'bg-blue-600' :
                            'bg-yellow-600'
                          }`}>
                            {manga.status?.charAt(0).toUpperCase() + manga.status?.slice(1) || 'Unknown'}
                          </span>
                        </div>

                        {/* Chapter Count */}
                        <div className="absolute bottom-2 right-2">
                          <span className="bg-black/70 px-2 py-1 rounded text-xs">
                            {manga.chapters || 0} Ch
                          </span>
                        </div>
                      </div>

                      {/* Title (Always Visible) */}
                      <div className="p-3">
                        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-[#e50914] transition-colors">
                          {manga.title}
                        </h3>
                        
                        {/* Date Added */}
                        <div className="text-xs text-white/50 mt-1">
                          Added {manga.dateAdded.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              // List View
              <div className="space-y-4">
                {filteredAndSortedFavorites.map((manga) => (
                  <Link
                    key={manga._id}
                    to={`/manga/${getSlugFromObjectId(manga._id)}`}
                    className="block bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={manga.coverImage}
                        alt={manga.title}
                        className="w-16 h-20 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{manga.title}</h3>
                        <p className="text-white/70 text-sm line-clamp-2 mt-1">{manga.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-white/60">
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400" />
                            {manga.rating?.toFixed(1) || 'N/A'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            manga.status === 'completed' ? 'bg-green-600' :
                            manga.status === 'ongoing' ? 'bg-blue-600' :
                            'bg-yellow-600'
                          }`}>
                            {manga.status}
                          </span>
                          <span>{manga.chapters || 0} chapters</span>
                          <span>Added {manga.dateAdded.toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Reading Preferences Section */}
            {stats.topGenres.length > 0 && (
              <div className="mt-12 bg-white/5 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Your Reading Preferences</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-white/60 mb-2">Total Chapters Available:</div>
                    <div className="text-2xl font-bold text-[#e50914]">{stats.totalChapters.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/60 mb-2">Top Genres:</div>
                    <div className="flex flex-wrap gap-2">
                      {stats.topGenres.map(genre => (
                        <span key={genre} className="px-3 py-1 bg-white/10 text-white/80 rounded-full text-sm">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Stat = ({label, value, className}) => (
  <div className="text-center">
    <div className={`text-3xl font-bold ${className}`}>{value}</div>
    <div className="text-sm text-gray-600 mt-1">{label}</div>
  </div>
);

// ---------------------- Reading History placeholder ----------------------
const ReadingHistoryPage = () => (
  <div className="min-h-screen bg-gray-50 py-12">
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Reading History</h1>
      <p>Reading history feature coming soon...</p>
    </div>
  </div>
);

// ---------------------- Login/Signup (Netflix Style) ----------------------
const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(formData.email, formData.password);
    if (result.success) navigate('/');
    else setError(result.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#141414] via-[#1a1a1a] to-[#0a0a0a]"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#e50914] mb-2">MANGAREAD</h1>
          <h2 className="text-3xl font-bold text-white mb-2">Sign In</h2>
          <p className="text-white/70">
            New to MangaReader?{' '}
            <Link to="/signup" className="text-white hover:underline font-semibold">
              Sign up now
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-black/60 backdrop-blur-md py-8 px-8 shadow-2xl rounded-lg border border-white/10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-[#e50914]/10 border border-[#e50914]/20 text-[#e50914] px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent transition-all"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent transition-all"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#e50914] bg-[#333] border-white/20 rounded focus:ring-[#e50914] focus:ring-2"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-white/70">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-white/70 hover:text-white transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#e50914] hover:bg-[#b20710] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e50914] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Signup = () => {
  const [formData, setFormData] = useState({ username:'', email:'', password:'', confirmPassword:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    
    const result = await register(formData.username, formData.email, formData.password);
    if (result.success) navigate('/');
    else setError(result.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#141414] via-[#1a1a1a] to-[#0a0a0a]"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#e50914] mb-2">MANGAREAD</h1>
          <h2 className="text-3xl font-bold text-white mb-2">Create your account</h2>
          <p className="text-white/70">
            Already have an account?{' '}
            <Link to="/login" className="text-white hover:underline font-semibold">
              Sign in here
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-black/60 backdrop-blur-md py-8 px-8 shadow-2xl rounded-lg border border-white/10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-[#e50914]/10 border border-[#e50914]/20 text-[#e50914] px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-white mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent transition-all"
                placeholder="Choose a username"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent transition-all"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength="6"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent transition-all"
                placeholder="Create a password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 bg-[#333] border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:border-transparent transition-all"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#e50914] hover:bg-[#b20710] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e50914] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="text-xs text-white/50 text-center">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ---------------------- Profile ----------------------
const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setMessage('New passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const updateData = {
        username: formData.username,
        email: formData.email
      };

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await axios.put('/api/auth/profile', updateData);
      updateUser(response.data.user);
      setMessage('Profile updated successfully');
      setEditing(false);
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Profile</h1>

        <div className="bg-white rounded-lg shadow p-6">
          {message && (
            <div className={`mb-4 p-3 rounded ${
              message.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          {!editing ? (
            <div>
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white text-xl font-bold">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{user?.username}</h2>
                    <p className="text-gray-600">{user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <p className="text-gray-900 capitalize">{user?.role}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
                  <p className="text-gray-900">
                    {new Date(user?.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditing(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Edit Profile
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="border-t pt-4 mb-4">
                <h3 className="text-lg font-medium mb-4">Change Password (Optional)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        minLength={6}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        minLength={6}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      username: user?.username || '',
                      email: user?.email || '',
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------- Search Page (results + filters) ----------------------
const SearchPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // URL params
  const params = new URLSearchParams(location.search);
  const initialQ = params.get('q') || '';
  const initialStatus = params.get('status') || 'any'; // 'any' | 'ongoing' | 'completed'
  const initialRating = Number(params.get('minRating') || 0);
  const initialSort = params.get('sort') || 'relevance'; // relevance | rating_desc | views_desc | title_asc | title_desc
  const initialGenres = (params.get('genres') || '').split(',').filter(Boolean);

  // State
  const [query, setQuery] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [minRating, setMinRating] = useState(initialRating);
  const [sort, setSort] = useState(initialSort);
  const [selectedGenres, setSelectedGenres] = useState(initialGenres);

  const [allManga, setAllManga] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch results: try server search then fallback to all + filter
  const performFetch = async (q) => {
    setLoading(true);
    try {
      if (q) {
        try {
          const res = await axios.get(`/api/manga/search?q=${encodeURIComponent(q)}`);
          if (res?.data?.manga) {
            setAllManga(res.data.manga);
            setLoading(false);
            return;
          }
        } catch {}
      }
      const resAll = await axios.get('/api/manga');
      const list = resAll.data.manga || [];
      setAllManga(list);
    } catch (e) {
      console.error('Search fetch error:', e);
      setAllManga([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performFetch(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (status !== 'any') p.set('status', status);
    if (minRating > 0) p.set('minRating', String(minRating));
    if (sort !== 'relevance') p.set('sort', sort);
    if (selectedGenres.length) p.set('genres', selectedGenres.join(','));
    navigate({ pathname: '/search', search: p.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, minRating, sort, selectedGenres]);

  useEffect(() => {
    performFetch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Derived data: genre list
  const genreCounts = {};
  allManga.forEach(m => (m.genres || []).forEach(g => {
    genreCounts[g] = (genreCounts[g] || 0) + 1;
  }));
  const allGenres = Object.entries(genreCounts).sort((a,b) => b[1]-a[1]).map(([g]) => g);

  // Client-side filter & sort
  const filtered = allManga
    .filter(m => {
      const q = (query || '').toLowerCase();
      if (q) {
        const hay = [
          m.title,
          m.description,
          m.author,
          m.artist,
          ...(m.genres || [])
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (status !== 'any' && (m.status || '').toLowerCase() !== status) return false;
      if (minRating > 0 && (m.rating || 0) < minRating) return false;
      if (selectedGenres.length && !selectedGenres.every(g => (m.genres || []).includes(g))) return false;
      return true;
    })
    .map(m => {
      const q = (query || '').toLowerCase();
      let score = 0;
      if (q) {
        if ((m.title || '').toLowerCase().includes(q)) score += 3;
        if ((m.description || '').toLowerCase().includes(q)) score += 1;
        (m.genres || []).forEach(g => { if (g.toLowerCase().includes(q)) score += 1; });
      }
      return { ...m, _score: score };
    })
    .sort((a, b) => {
      switch (sort) {
        case 'views_desc': return (b.views || 0) - (a.views || 0);
        case 'title_asc': return (a.title || '').localeCompare(b.title || '');
        case 'title_desc': return (b.title || '').localeCompare(a.title || '');
        default: return (b._score || 0) - (a._score || 0);
      }
    });

  const toggleGenre = (g) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const clearFilters = () => {
    setStatus('any');
    setMinRating(0);
    setSort('relevance');
    setSelectedGenres([]);
  };

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Top search bar */}
      <div className="px-6 pt-28 pb-6 max-w-7xl mx-auto">
        <form
          onSubmit={(e) => { e.preventDefault(); }}
          className="flex items-center gap-3"
        >
          <div className="flex-1 relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search manga, authors, genres…"
              className="w-full px-4 py-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                aria-label="Clear"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-white/70 text-sm">Filters</div>
            <SlidersHorizontal />
          </div>
        </form>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Status */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-2 py-1">
            <span className="text-xs text-white/60">Status</span>
            {['any', 'ongoing', 'completed'].map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`text-xs px-2 py-1 rounded ${status === s ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Min rating */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-3 py-2">
            <span className="text-xs text-white/60">Min rating</span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
            />
            <span className="text-xs">{minRating}</span>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-3 py-2">
            <span className="text-xs text-white/60">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-transparent text-sm focus:outline-none"
            >
              <option value="relevance">Relevance</option>
              <option value="rating_desc">Rating (High→Low)</option>
              <option value="views_desc">Views (High→Low)</option>
              <option value="title_asc">Title (A→Z)</option>
              <option value="title_desc">Title (Z→A)</option>
            </select>
          </div>

          {/* Clear */}
          {(status !== 'any' || minRating > 0 || sort !== 'relevance' || selectedGenres.length > 0) && (
            <button onClick={clearFilters} className="text-xs text-white/70 hover:text-white underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Genre selector */}
      {!!allGenres.length && (
        <div className="max-w-7xl mx-auto px-6 mb-4">
          <div className="bg-white/5 border border-white/10 rounded p-3">
            <div className="text-xs text-white/60 mb-2">Genres</div>
            <div className="flex flex-wrap gap-2">
              {allGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-3 py-1 rounded-full text-sm border ${selectedGenres.includes(g) ? 'bg-white text-black border-white' : 'bg-transparent border-white/20 hover:bg-white/10'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg text-white/80">
            {loading ? 'Searching…' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
            {query && <span className="text-white/50"> for "{query}"</span>}
          </h2>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded p-10 text-center text-white/70">
            <p className="mb-2">No results found.</p>
            <p className="text-sm">Try another keyword, lower the minimum rating, or remove some genres.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
            {filtered.map((m) => (
              <MangaCard key={m._id} manga={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PopularPage = () => {
  const [popularManga, setPopularManga] = useState([]);
  const [trendingManga, setTrendingManga] = useState([]);
  const [topRatedManga, setTopRatedManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trending');
  const { isFavorite, toggleFavorite, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchPopularData();
  }, []);

  const fetchPopularData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/manga');
      const allManga = response.data;

      // Sort manga by different criteria
      const sortedByViews = [...allManga]
        .filter(manga => manga.views > 0)
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 20);

      const sortedByRating = [...allManga]
        .filter(manga => manga.rating > 0)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 20);

      // Simulate trending based on recent activity (you can modify this logic)
      const trending = [...allManga]
        .map(manga => ({
          ...manga,
          trendScore: (manga.views || 0) * 0.7 + (manga.rating || 0) * 30 + Math.random() * 100
        }))
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 20);

      setPopularManga(sortedByViews);
      setTopRatedManga(sortedByRating);
      setTrendingManga(trending);
    } catch (error) {
      console.error('Error fetching popular data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = async (e, mangaId) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAuthenticated) {
      await toggleFavorite(mangaId);
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'trending':
        return trendingManga;
      case 'popular':
        return popularManga;
      case 'toprated':
        return topRatedManga;
      default:
        return trendingManga;
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'trending':
        return 'Trending Now';
      case 'popular':
        return 'Most Popular';
      case 'toprated':
        return 'Top Rated';
      default:
        return 'Trending Now';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white">
        <div className="container mx-auto px-6 py-8 pt-24">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#e50914]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <div className="container mx-auto px-6 py-8 pt-24">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[#e50914] to-[#f40612] bg-clip-text text-transparent">
            Popular Manga
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            Discover the hottest manga that everyone's reading. From trending series to all-time favorites.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-black/30 rounded-lg p-1 max-w-fit">
            {[
              { id: 'trending', label: 'Trending', icon: '🔥' },
              { id: 'popular', label: 'Most Popular', icon: '👑' },
              { id: 'toprated', label: 'Top Rated', icon: '⭐' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'bg-[#e50914] text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Current Tab Title and Count */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{getTabTitle()}</h2>
          <p className="text-gray-400 mt-1">
            {getCurrentData().length} manga available
          </p>
        </div>

        {/* Manga Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
          {getCurrentData().map((manga, index) => (
            <Link
              key={manga._id}
              to={`/manga/${manga._id}`}
              className="group relative cursor-pointer"
            >
              <div className="relative bg-[#1a1a1a] rounded-lg overflow-hidden border border-white/10 hover:border-[#e50914]/50 transition-all duration-300 transform hover:scale-105 hover:z-10">
                {/* Rank Badge */}
                <div className="absolute top-2 left-2 bg-[#e50914] text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                  #{index + 1}
                </div>

                {/* Favorite Button */}
                {isAuthenticated && (
                  <button
                    onClick={(e) => handleFavoriteToggle(e, manga._id)}
                    className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors duration-200"
                  >
                    <svg
                      className={`w-5 h-5 ${
                        isFavorite(manga._id) ? 'text-[#e50914] fill-current' : 'text-white'
                      }`}
                      fill={isFavorite(manga._id) ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </button>
                )}

                {/* Cover Image */}
                <div className="aspect-[3/4] bg-gradient-to-b from-gray-700 to-gray-900">
                  {manga.coverImage ? (
                    <img
                      src={manga.coverImage}
                      alt={manga.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <div className="text-sm text-gray-400 font-medium px-2">
                          {manga.title}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <h3 className="font-bold text-white mb-2 line-clamp-2">{manga.title}</h3>
                  
                  {/* Stats Row */}
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span>{manga.rating || 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{(manga.views || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-between items-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      manga.status === 'completed' 
                        ? 'bg-green-500/20 text-green-400' 
                        : manga.status === 'ongoing'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {manga.status || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {manga.totalChapters || 0} ch
                    </span>
                  </div>

                  {/* Genres */}
                  {manga.genres && manga.genres.length > 0 && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-1">
                        {manga.genres.slice(0, 2).map((genre, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 bg-white/10 rounded text-gray-300">
                            {genre}
                          </span>
                        ))}
                        {manga.genres.length > 2 && (
                          <span className="text-xs text-gray-400">+{manga.genres.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Trending Badge */}
                {activeTab === 'trending' && index < 3 && (
                  <div className="absolute bottom-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    🔥 HOT
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {getCurrentData().length === 0 && !loading && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400 mb-2">No manga found</h3>
            <p className="text-gray-500">Try switching to a different tab or check back later.</p>
          </div>
        )}

        {/* Footer Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-[#e50914]/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-[#e50914]" />
              </div>
              <div>
                <h4 className="font-bold text-white">Trending</h4>
                <p className="text-sm text-gray-400">{trendingManga.length} hot series</p>
              </div>
            </div>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Crown className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h4 className="font-bold text-white">Most Popular</h4>
                <p className="text-sm text-gray-400">{popularManga.length} fan favorites</p>
              </div>
            </div>
          </div>
          
          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Star className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h4 className="font-bold text-white">Top Rated</h4>
                <p className="text-sm text-gray-400">{topRatedManga.length} highest rated</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add this component before your App function
const LatestPage = () => {
  const [latestManga, setLatestManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isFavorite, toggleFavorite, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchLatestManga();
  }, []);

  const fetchLatestManga = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/manga');
      const allManga = response.data;

      // Sort by most recently added/updated (you can modify this logic)
      const latest = [...allManga]
        .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
        .slice(0, 24); // Show latest 24 manga

      setLatestManga(latest);
    } catch (error) {
      console.error('Error fetching latest manga:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = async (e, mangaId) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAuthenticated) {
      await toggleFavorite(mangaId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white">
        <div className="container mx-auto px-6 py-8 pt-24">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#e50914]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <div className="container mx-auto px-6 py-8 pt-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[#e50914] to-[#f40612] bg-clip-text text-transparent">
            New Releases
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            Stay up to date with the newest manga additions and latest chapter releases.
          </p>
        </div>

        {/* Latest Count */}
        <div className="mb-6">
          <p className="text-gray-400">
            {latestManga.length} latest releases
          </p>
        </div>

        {/* Manga Grid */}
        {latestManga.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400 mb-2">No new releases yet</h3>
            <p className="text-gray-500">Check back later for the latest manga updates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {latestManga.map((manga) => (
              <Link
                key={manga._id}
                to={`/manga/${manga._id}`}
                className="group relative cursor-pointer"
              >
                <div className="relative bg-[#1a1a1a] rounded-lg overflow-hidden border border-white/10 hover:border-[#e50914]/50 transition-all duration-300 transform hover:scale-105">
                  {/* New Badge */}
                  <div className="absolute top-2 left-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                    NEW
                  </div>

                  {/* Favorite Button */}
                  {isAuthenticated && (
                    <button
                      onClick={(e) => handleFavoriteToggle(e, manga._id)}
                      className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors duration-200"
                    >
                      <svg
                        className={`w-5 h-5 ${
                          isFavorite(manga._id) ? 'text-[#e50914] fill-current' : 'text-white'
                        }`}
                        fill={isFavorite(manga._id) ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                    </button>
                  )}

                  {/* Cover Image */}
                  <div className="aspect-[3/4] bg-gradient-to-b from-gray-700 to-gray-900">
                    {manga.coverImage ? (
                      <img
                        src={manga.coverImage}
                        alt={manga.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <div className="text-sm text-gray-400 font-medium px-2">
                            {manga.title}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <h3 className="font-bold text-white mb-2 line-clamp-2">{manga.title}</h3>
                    
                    {/* Stats Row */}
                    <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span>{manga.rating || 'N/A'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{(manga.views || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Status and Chapters */}
                    <div className="flex justify-between items-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        manga.status === 'completed' 
                          ? 'bg-green-500/20 text-green-400' 
                          : manga.status === 'ongoing'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {manga.status || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {manga.totalChapters || 0} ch
                      </span>
                    </div>

                    {/* Genres */}
                    {manga.genres && manga.genres.length > 0 && (
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-1">
                          {manga.genres.slice(0, 2).map((genre, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-white/10 rounded text-gray-300">
                              {genre}
                            </span>
                          ))}
                          {manga.genres.length > 2 && (
                            <span className="text-xs text-gray-400">+{manga.genres.length - 2}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------- App ----------------------
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Header />
          <main>
            <Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/browse" element={<BrowsePage />} />
  <Route path="/popular" element={<PopularPage />} />
  <Route path="/latest" element={<LatestPage />} />
  <Route path="/manga/:id" element={<MangaDetailPage />} />
  <Route path="/read/:mangaId/chapter/:chapterNumber" element={<ChapterReaderPage />} />
  <Route path="/search" element={<SearchPage />} />
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<Signup />} />
  <Route path="/profile" element={<ProfilePage />} />
  <Route path="/favorites" element={<FavoritesPage />} />
  <Route path="/reading-history" element={<ReadingHistoryPage />} />
  
  {/* Add these two admin routes */}
  <Route path="/admin" element={<AdminWithAuth />} />
  <Route 
    path="/admin/upload" 
    element={
      <AdminRoute>
        <AdminUpload />
      </AdminRoute>
    } 
  />
</Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;