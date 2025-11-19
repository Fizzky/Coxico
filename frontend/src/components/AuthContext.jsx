// frontend/src/components/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { apiUrl } from '../utils/api';

const AuthContext = createContext();

// Session timeout configuration (24 hours in milliseconds)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout

// Fixed export pattern for Vite Fast Refresh compatibility
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [favorites, setFavorites] = useState([]);
  
  // NEW: Reading progress state
  const [continueReading, setContinueReading] = useState([]);
  const [readingStats, setReadingStats] = useState(null);
  
  // Auto-mapping cache for slug to ObjectId
  const [slugToIdCache, setSlugToIdCache] = useState({});

  // Session timeout state
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const sessionTimeoutRef = useRef(null);
  const sessionWarningRef = useRef(null);
  const activityTimeoutRef = useRef(null);

  // Set axios default header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Fetch user favorites - simplified and stable
  const fetchFavorites = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await axios.get('/api/auth/favorites');
      setFavorites(response.data.favorites || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      setFavorites([]);
    }
  }, [token]);

  // Toggle favorite status - AUTO-LEARNING SOLUTION
  const toggleFavorite = async (mangaId) => {
    try {
      console.log('Toggle started for:', mangaId);
      const token = localStorage.getItem('token');
      if (!token) return { success: false, message: 'Not authenticated' };
      
      const response = await axios.post(`/api/auth/favorites/toggle/${mangaId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Toggle response:', response.data);
      
      if (response.data && response.data.success) {
        // AUTO-LEARN: Save the slug-to-ObjectId mapping
        const returnedObjectId = response.data.mangaId;
        if (returnedObjectId && returnedObjectId !== mangaId) {
          console.log('Learning mapping:', mangaId, '->', returnedObjectId);
          setSlugToIdCache(prev => ({
            ...prev,
            [mangaId]: returnedObjectId
          }));
        }
        
        console.log('Fetching favorites...');
        await fetchFavorites();
        return { success: true };
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
      return { success: false, message: 'Error toggling favorite' };
    }
  };

  // Check if manga is in favorites - AUTO-LEARNING SOLUTION
  const isFavorite = useCallback((mangaId) => {
    // Static mappings for known manga (fallback)
    const staticMappings = {
      'onepiece': '68bef993a319f39dd3d3cc2b',
      'attackontitan': '68bef99aa319f39dd3d3cc3b'
    };
    
    const result = favorites.some(fav => {
      const favId = fav._id || fav;
      
      // Direct match
      if (favId === mangaId) return true;
      
      // Check auto-learned mapping first
      const learnedObjectId = slugToIdCache[mangaId];
      if (learnedObjectId && favId === learnedObjectId) return true;
      
      // Fallback to static mapping
      const staticObjectId = staticMappings[mangaId];
      if (staticObjectId && favId === staticObjectId) return true;
      
      return false;
    });
    
    console.log('isFavorite check:', { 
      mangaId, 
      learnedMapping: slugToIdCache[mangaId],
      staticMapping: staticMappings[mangaId],
      favorites: favorites.map(f => f._id || f), 
      result 
    });
    return result;
  }, [favorites, slugToIdCache]);

  // NEW: Update reading progress
  const updateReadingProgress = useCallback(async (
    mangaId,
    chapterId,
    chapterNumber,
    currentPage,
    totalPages,
    readingTime = 0,
    chapterNumberLabel = null
  ) => {
    try {
      if (!token) return { success: false, message: 'Not authenticated' };

      const response = await axios.post('/api/auth/reading-progress', {
        mangaId,
        chapterId, 
        chapterNumber,
        currentPage,
        totalPages,
        readingTime,
        chapterNumberLabel
      });

      // Refresh continue reading list
      await fetchContinueReading();

      return {
        success: true,
        isCompleted: response.data.isCompleted
      };
    } catch (error) {
      console.error('Error updating reading progress:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error updating progress'
      };
    }
  }, [token]);

  // NEW: Fetch continue reading list
  const fetchContinueReading = useCallback(async () => {
    try {
      if (!token) return;
      
      const response = await axios.get('/api/auth/continue-reading');
      setContinueReading(response.data.continueReading || []);
    } catch (error) {
      console.error('Error fetching continue reading:', error);
      setContinueReading([]);
    }
  }, [token]);

  // NEW: Fetch reading history
  const fetchReadingHistory = useCallback(async (page = 1, filter = 'all') => {
    try {
      if (!token) return { history: [], pagination: {} };
      
      const response = await axios.get(`/api/auth/reading-history?page=${page}&filter=${filter}`);
      return {
        history: response.data.history || [],
        pagination: response.data.pagination || {}
      };
    } catch (error) {
      console.error('Error fetching reading history:', error);
      return { history: [], pagination: {} };
    }
  }, [token]);

  // NEW: Fetch reading stats
  const fetchReadingStats = useCallback(async () => {
    try {
      if (!token) return;
      
      const response = await axios.get('/api/auth/reading-stats');
      setReadingStats(response.data);
    } catch (error) {
      console.error('Error fetching reading stats:', error);
      setReadingStats(null);
    }
  }, [token]);

  // Update session timestamp on user activity
  const updateSessionTimestamp = useCallback(() => {
    if (token && user) {
      localStorage.setItem('sessionTimestamp', Date.now().toString());
      setShowSessionWarning(false);
      // Clear existing timeouts
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
      if (sessionWarningRef.current) {
        clearTimeout(sessionWarningRef.current);
      }
      // Set new timeouts
      setupSessionTimeouts();
    }
  }, [token, user]);

  // Setup session timeout and warning
  const setupSessionTimeouts = useCallback(() => {
    if (!token || !user) return;

    const sessionTimestamp = localStorage.getItem('sessionTimestamp');
    if (!sessionTimestamp) {
      localStorage.setItem('sessionTimestamp', Date.now().toString());
      return;
    }

    const elapsed = Date.now() - parseInt(sessionTimestamp, 10);
    const remaining = SESSION_TIMEOUT - elapsed;
    const warningTime = remaining - SESSION_WARNING_TIME;

    // Clear existing timeouts
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    if (sessionWarningRef.current) {
      clearTimeout(sessionWarningRef.current);
    }

    // Set warning timeout
    if (warningTime > 0) {
      sessionWarningRef.current = setTimeout(() => {
        setShowSessionWarning(true);
      }, warningTime);
    } else if (remaining > 0) {
      // If we're already past warning time but not expired, show warning immediately
      setShowSessionWarning(true);
    }

    // Set logout timeout
    if (remaining > 0) {
      sessionTimeoutRef.current = setTimeout(() => {
        logout();
        setShowSessionWarning(false);
        alert('Your session has expired. Please login again.');
      }, remaining);
    } else {
      // Session already expired
      logout();
      alert('Your session has expired. Please login again.');
    }
  }, [token, user]);

  // Check session on mount and when token/user changes
  useEffect(() => {
    if (token && user) {
      setupSessionTimeouts();
    } else {
      // Clear timeouts if not authenticated
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
      if (sessionWarningRef.current) {
        clearTimeout(sessionWarningRef.current);
      }
      setShowSessionWarning(false);
    }
  }, [token, user, setupSessionTimeouts]);

  // Track user activity to reset session timeout
  useEffect(() => {
    if (!token || !user) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    let activityTimeout;

    const handleActivity = () => {
      // Debounce activity updates (update max once per minute)
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        updateSessionTimestamp();
      }, 60000); // Update at most once per minute
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimeout(activityTimeout);
    };
  }, [token, user, updateSessionTimestamp]);

  // Check if user is logged in on app load
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedTimestamp = localStorage.getItem('sessionTimestamp');
    
    if (storedToken && storedUser) {
      try {
        // Check if session is still valid
        if (storedTimestamp) {
          const elapsed = Date.now() - parseInt(storedTimestamp, 10);
          if (elapsed > SESSION_TIMEOUT) {
            // Session expired, clear everything
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('sessionTimestamp');
            setLoading(false);
            return;
          }
        }
        
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Update timestamp if it doesn't exist
        if (!storedTimestamp) {
          localStorage.setItem('sessionTimestamp', Date.now().toString());
        }
      } catch (error) {
        console.error('Error parsing stored user:', error);
        logout();
      }
    }
    setLoading(false);
  }, []);

  // NEW: Auto-fetch continue reading and stats when user logs in
  useEffect(() => {
    if (user && token) {
      fetchFavorites();
      fetchContinueReading();
      fetchReadingStats();
    } else {
      setFavorites([]);
      setContinueReading([]);
      setReadingStats(null);
    }
  }, [user, token, fetchFavorites, fetchContinueReading, fetchReadingStats]);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('sessionTimestamp', Date.now().toString());
      
      setToken(token);
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await axios.post('/api/auth/register', {
        username,
        email,
        password
      });
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('sessionTimestamp', Date.now().toString());
      
      setToken(token);
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionTimestamp');
    
    // Clear session timeouts
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    if (sessionWarningRef.current) {
      clearTimeout(sessionWarningRef.current);
    }
    
    setToken(null);
    setUser(null);
    setFavorites([]);
    setContinueReading([]);
    setReadingStats(null);
    setShowSessionWarning(false);
    
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const isAuthenticated = () => {
    return !!token && !!user;
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated,
    favorites,
    fetchFavorites,
    toggleFavorite,
    isFavorite,
    // NEW: Reading progress functions
    continueReading,
    readingStats,
    updateReadingProgress,
    fetchContinueReading,
    fetchReadingHistory,
    fetchReadingStats,
    // Session timeout
    showSessionWarning,
    updateSessionTimestamp
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Export using named exports for Vite compatibility
export { useAuth, AuthProvider };