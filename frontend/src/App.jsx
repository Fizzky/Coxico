// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Search, Menu, X, User, Eye, Star, ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight, LogIn, UserPlus, Heart, History, LogOut, SlidersHorizontal
} from 'lucide-react';
import axios from 'axios';
import './App.css';
import AdminApp from './AdminPanel.jsx'; // kept import as before
import { AuthProvider, useAuth } from './components/AuthContext';
import './styles/netflix-theme.css';

// ---------------------- Header (sliding search + live suggestions) ----------------------
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // search overlay
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);

  // NEW: live suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef(null);
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

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
      setSuggestions([]);
      setActiveIndex(-1);
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

  // ---------- NEW: Debounced live suggestions while typing ----------
  useEffect(() => {
    const q = searchTerm.trim();
    setActiveIndex(-1);

    if (!q) {
      setSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        // try server search first
        let list = [];
        try {
          const res = await axios.get(`/api/manga/search?q=${encodeURIComponent(q)}`);
          list = res?.data?.manga || [];
        } catch {
          // fallback: fetch all then filter client-side
          const resAll = await axios.get('/api/manga');
          const all = resAll?.data?.manga || [];
          const ql = q.toLowerCase();
          list = all
            .map((m) => {
              const hay = [
                m.title,
                m.description,
                m.author,
                m.artist,
                ...(m.genres || []),
              ]
                .join(' ')
                .toLowerCase();
              // simple score: title hits > others
              let score = 0;
              if ((m.title || '').toLowerCase().includes(ql)) score += 3;
              if (hay.includes(ql)) score += 1;
              return { ...m, _score: score };
            })
            .filter((m) => m._score > 0)
            .sort((a, b) => (b._score || 0) - (a._score || 0));
        }

        // limit & normalize
        setSuggestions((list || []).slice(0, 8));
      } catch (err) {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 250); // debounce

    return () => clearTimeout(handle);
  }, [searchTerm]);

  // handle keyboard in the input when suggestions visible
  const onKeyDown = (e) => {
    if (!suggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        const m = suggestions[activeIndex];
        navigate(`/manga/${m._id}`);
        setSearchOpen(false);
        e.preventDefault();
      } else {
        submitSearch(e);
      }
    }
  };

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
                onKeyDown={onKeyDown}
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

            {/* When typing: show LIVE SUGGESTIONS */}
            {searchTerm.trim() ? (
              <div className="search-suggest">
                {suggestLoading ? (
                  <div className="search-suggest-empty">Searching…</div>
                ) : suggestions.length ? (
                  <ul>
                    {suggestions.map((m, i) => (
                      <li key={m._id}>
                        <button
                          className={`suggest-item ${i === activeIndex ? 'active' : ''}`}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => {
                            navigate(`/manga/${m._id}`);
                            setSearchOpen(false);
                          }}
                        >
                          <img
                            className="suggest-thumb"
                            src={m.coverImage || 'https://via.placeholder.com/80x112/2a2a2a/ffffff?text=Manga'}
                            alt={m.title}
                          />
                          <div className="suggest-body">
                            <div className="suggest-title">{m.title}</div>
                            <div className="suggest-meta">
                              {typeof m.rating === 'number' ? `${m.rating}/10 · ` : ''}
                              {(m.status || '').toString().toLowerCase()}
                              {typeof m.views === 'number' ? ` · ${m.views.toLocaleString()} views` : ''}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="search-suggest-empty">No matches for “{searchTerm}”. Press Enter to search all results.</div>
                )}
              </div>
            ) : (
              // Otherwise: show RECENT + TRENDING blocks
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
            )}
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
          onClick={() => {
            logout();
            setIsMenuOpen(false);
          }}
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
                <div key={m._id} className="manga-tile">
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
                        <Link to={`/manga/${m._id}`} className="action-btn" title="Read">▶</Link>
                        <Link to={`/manga/${m._id}`} className="action-btn" title="More">ℹ</Link>
                      </div>
                    </div>
                  </div>
                </div>
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
              <Link to={`/manga/${manga._id}/chapter/${firstChapter.chapterNumber}`} className="btn btn-play">
                ▶ Read Chapter {firstChapter.chapterNumber}
              </Link>
            )}
            <button onClick={handleFavorite} className="btn btn-info" disabled={favLoading}>
              {favLoading ? 'Saving…' : (isAuthenticated() && isFavorite(manga._id) ? '♥ In My List' : '+ My List')}
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
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              {chapters.map((chapter, idx) => (
                <Link
                  key={chapter._id}
                  to={`/manga/${manga._id}/chapter/${chapter.chapterNumber}`}
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
      </div>
    </div>
  );
};

// ---------------------- Chapter Reader ----------------------
const ChapterReaderPage = () => {
  const { mangaId, chapterNumber } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChapter = async () => {
      try {
        const response = await axios.get(`/api/chapters/manga/${mangaId}/chapter/${chapterNumber}`);
        setData(response.data);
      } catch (error) {
        console.error('Error fetching chapter:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChapter();
  }, [mangaId, chapterNumber]);

  const nextPage = () => {
    if (data && currentPage < data.chapter.pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const nextChapter = () => {
    if (data) {
      const currentIndex = data.allChapters.findIndex(ch => ch.chapterNumber === parseInt(chapterNumber));
      if (currentIndex < data.allChapters.length - 1) {
        const nextCh = data.allChapters[currentIndex + 1];
        navigate(`/manga/${mangaId}/chapter/${nextCh.chapterNumber}`);
      }
    }
  };

  const prevChapter = () => {
    if (data) {
      const currentIndex = data.allChapters.findIndex(ch => ch.chapterNumber === parseInt(chapterNumber));
      if (currentIndex > 0) {
        const prevCh = data.allChapters[currentIndex - 1];
        navigate(`/manga/${mangaId}/chapter/${prevCh.chapterNumber}`);
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
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900 p-4">
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

      {/* Reader */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-4xl w-full">
          <img
            src={data.chapter.pages[currentPage]}
            alt={`Page ${currentPage + 1}`}
            className="w-full h-auto max-h-screen object-contain mx-auto"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 rounded-lg p-2 flex items-center space-x-4">
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="p-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 rounded"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="text-sm px-4">
          {currentPage + 1} / {data.chapter.pages.length}
        </span>

        <button
          onClick={nextPage}
          disabled={currentPage >= data.chapter.pages.length - 1}
          className="p-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 rounded"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Chapter Navigation */}
      <div className="fixed top-1/2 transform -translate-y-1/2 left-4">
        <button
          onClick={prevChapter}
          className="bg-gray-900 p-3 rounded-full hover:bg-gray-700 disabled:opacity-50"
          disabled={!data.allChapters || data.allChapters.findIndex(ch => ch.chapterNumber === parseInt(chapterNumber)) === 0}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      <div className="fixed top-1/2 transform -translate-y-1/2 right-4">
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
        className="fixed top-0 left-0 w-1/3 h-full cursor-pointer z-10"
        onClick={prevPage}
      />
      <div
        className="fixed top-0 right-0 w-1/3 h-full cursor-pointer z-10"
        onClick={nextPage}
      />
    </div>
  );
};

// ---------------------- Browse/Popular/Latest placeholders ----------------------
const BrowsePage = () => (
  <div className="min-h-screen bg-gray-50 py-12">
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Browse Manga</h1>
      <p>Browse page coming soon...</p>
    </div>
  </div>
);

const PopularPage = () => (
  <div className="min-h-screen bg-gray-50 py-12">
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Popular Manga</h1>
      <p>Popular page coming soon...</p>
    </div>
  </div>
);

const LatestPage = () => (
  <div className="min-h-screen bg-gray-50 py-12">
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Latest Manga</h1>
      <p>Latest page coming soon...</p>
    </div>
  </div>
);

// ---------------------- Profile ----------------------
const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [_keepImports] = useState(0); // replaces the old `theconst = 0`

  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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

  const [editing, setEditing] = useState(false);

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

// ---------------------- Favorites (stable) ----------------------
const FavoritesPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const navigate = useNavigate();

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
          setFavorites(data.favorites || []);
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    };

    loadFavorites();
  }, []); // run once

  if (!isAuthenticated()) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your favorites...</p>
        </div>
      </div>
    );
  }

  const genreCounts = {};
  favorites.forEach(m => m.genres?.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; }));
  const topGenres = Object.entries(genreCounts).sort(([,a],[,b]) => b-a).slice(0,3).map(([g])=>g);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Favorites</h1>
          <p className="text-gray-600">{favorites.length} manga in your favorites</p>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="h-12 w-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No favorites yet</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start building your manga collection by clicking the heart icon on any manga you love!
            </p>
            <Link
              to="/"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Browse Manga
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {favorites.map((manga) => (
                <MangaCard key={manga._id} manga={manga} />
              ))}
            </div>

            <div className="mt-12 bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Your Reading Preferences</h2>
              <div className="grid grid-cols-3 gap-6">
                <Stat label="Ongoing Series" value={favorites.filter(m => m.status === 'ongoing').length} className="text-blue-600" />
                <Stat label="Completed Series" value={favorites.filter(m => m.status === 'completed').length} className="text-green-600" />
                <Stat label="Avg. Rating" value={(favorites.reduce((a,m)=>a+(m.rating||0),0)/favorites.length||0).toFixed(1)} className="text-yellow-600" />
              </div>
              {topGenres.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <div className="text-sm text-gray-600">Top Genres:</div>
                  <div className="flex gap-2 mt-2">
                    {topGenres.map(g => (
                      <span key={g} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
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

// ---------------------- Login/Signup ----------------------
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

            <Input label="Email address" type="email" value={formData.email} onChange={(v)=>setFormData(f=>({...f,email:v}))} />
            <Input label="Password" type="password" value={formData.password} onChange={(v)=>setFormData(f=>({...f,password:v}))} />

            <div className="flex items-center justify-between">
              <label className="flex items-center text-sm text-gray-900">
                <input type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"/>
                Remember me
              </label>
              <div className="text-sm">
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500">Forgot your password?</a>
              </div>
            </div>

            <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign in'}
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create your account</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            sign in to your existing account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

            <Input label="Username" value={formData.username} onChange={(v)=>setFormData(f=>({...f,username:v}))} />
            <Input label="Email address" type="email" value={formData.email} onChange={(v)=>setFormData(f=>({...f,email:v}))} />
            <Input label="Password" type="password" minLength={6} value={formData.password} onChange={(v)=>setFormData(f=>({...f,password:v}))} />
            <Input label="Confirm Password" type="password" minLength={6} value={formData.confirmPassword} onChange={(v)=>setFormData(f=>({...f,confirmPassword:v}))} />

            <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Input = ({label, type="text", value, onChange, minLength}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <div className="mt-1">
      <input
        type={type}
        value={value}
        minLength={minLength}
        onChange={(e)=>onChange(e.target.value)}
        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        required
      />
    </div>
  </div>
);

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
      // Prefer server search if available
      if (q) {
        try {
          const res = await axios.get(`/api/manga/search?q=${encodeURIComponent(q)}`);
          if (res?.data?.manga) {
            setAllManga(res.data.manga);
            setLoading(false);
            return;
          }
        } catch (err) {
          // fall through to all
        }
      }
      // Fallback to all and filter client-side
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

  // On mount: fetch for initial query
  useEffect(() => {
    performFetch(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when filters change
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

  // Re-run fetch when the *query* string changes (not filters)
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
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
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
            {query && <span className="text-white/50"> for “{query}”</span>}
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
              <Route path="/manga/:mangaId/chapter/:chapterNumber" element={<ChapterReaderPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/reading-history" element={<ReadingHistoryPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
