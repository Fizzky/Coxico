import React, { useState, useEffect } from 'react';
import { Clock, Trash2, Book, Calendar, Filter, Search } from 'lucide-react';
import { useAuth } from "../components/AuthContext";
import { useNavigate } from 'react-router-dom'

export default function ReadingHistoryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readingHistory, setReadingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalChaptersRead: 0,
    completedChapters: 0,
    continueReadingCount: 0
  });

  useEffect(() => {
    fetchReadingHistory();
    fetchStats();
  }, [filterType]);

  const fetchReadingHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5000/api/auth/reading-history?filter=${filterType}&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      setReadingHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching reading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/reading-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const clearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all reading history?')) {
      console.log('Clear history - backend route needed');
    }
  };

  const removeItem = async (historyItem) => {
    console.log('Remove item:', historyItem);
  };


  const getChapterLabel = (item) => {
    return item.chapter?.chapterNumberLabel || item.chapterNumberLabel || (item.chapterNumber != null ? item.chapterNumber.toString() : '');
  };

  const continueReading = (item) => {
  console.log('🚀 CONTINUE READING DEBUG:');
  console.log('Full item:', item);
  console.log('item.currentPage:', item.currentPage);
  console.log('item.totalPages:', item.totalPages);
  
  const mangaId = item.manga?._id;
  const chapterLabel = getChapterLabel(item);
  const page = item.currentPage || 1;
  
  console.log('Extracted values:', { mangaId, chapterLabel, page });
  
  if (mangaId && chapterLabel) {
    const url = `/manga/${mangaId}/chapter/${chapterLabel}?page=${page}`;
    console.log('Navigating to URL:', url);
    navigate(url);
  } else {
    console.error('Missing data!', { mangaId, chapterLabel });
    alert('Unable to continue reading. Missing manga ID or chapter number.');
  }
};

  const filteredHistory = readingHistory.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const chapterNum = getChapterLabel(item).toLowerCase();
      return chapterNum.includes(query);
    }
    return true;
  });

  const formatDate = (date) => {
    const now = new Date();
    const readDate = new Date(date);
    const diffTime = Math.abs(now - readDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return readDate.toLocaleDateString();
  };

  const calculateProgress = (item) => {
    if (!item.totalPages) return 0;
    return Math.round((item.currentPage / item.totalPages) * 100);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #0a0a0a, #1a1a1a)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '80px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Clock size={48} style={{ color: '#e50914', marginBottom: '16px' }} />
          <p>Loading your reading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #0a0a0a, #1a1a1a)',
      color: 'white',
      paddingTop: '80px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Clock size={32} style={{ color: '#e50914' }} />
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
              Reading History
            </h1>
          </div>
          <button
            onClick={clearHistory}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'rgba(229, 9, 20, 0.1)',
              border: '1px solid #e50914',
              borderRadius: '6px',
              color: '#e50914',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#e50914';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(229, 9, 20, 0.1)';
              e.target.style.color = '#e50914';
            }}
          >
            <Trash2 size={18} />
            Clear All
          </button>
        </div>

        {/* Search and Filter */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '32px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            flex: '1',
            minWidth: '250px',
            position: 'relative'
          }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#888'
              }}
            />
            <input
              type="text"
              placeholder="Search by chapter number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <Filter size={20} style={{ color: '#888' }} />
            {['all', 'reading', 'completed'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  padding: '10px 20px',
                  background: filterType === type ? '#e50914' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid ' + (filterType === type ? '#e50914' : 'rgba(255, 255, 255, 0.1)'),
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  transition: 'all 0.3s'
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            background: 'rgba(229, 9, 20, 0.1)',
            border: '1px solid rgba(229, 9, 20, 0.3)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              {stats.totalChaptersRead}
            </div>
            <div style={{ color: '#888', fontSize: '14px' }}>Total Chapters Read</div>
          </div>
          <div style={{
            background: 'rgba(229, 9, 20, 0.1)',
            border: '1px solid rgba(229, 9, 20, 0.3)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              {stats.continueReadingCount}
            </div>
            <div style={{ color: '#888', fontSize: '14px' }}>In Progress</div>
          </div>
          <div style={{
            background: 'rgba(229, 9, 20, 0.1)',
            border: '1px solid rgba(229, 9, 20, 0.3)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              {stats.completedChapters}
            </div>
            <div style={{ color: '#888', fontSize: '14px' }}>Completed</div>
          </div>
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: '#888'
          }}>
            <Book size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>No reading history found</h3>
            <p>Start reading manga to build your history!</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginBottom: '40px'
          }}>
            {Object.values(
  filteredHistory.reduce((acc, item) => {
    const mangaId = item.manga?._id || item.manga;
    if (!acc[mangaId] || new Date(item.lastReadAt) > new Date(acc[mangaId].lastReadAt)) {
      acc[mangaId] = item;
    }
    return acc;
  }, {})
).map((item, index) => {
              const progress = calculateProgress(item);

              // ⭐ ADD THIS DEBUG LOG
  console.log('History item structure:', {
    manga: item.manga,
    mangaId: item.manga?._id,
    chapter: item.chapter,
    chapterId: item.chapter?._id,
    chapterNumber: item.chapterNumber
  });
              
              return (
                <div
                  key={index}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    gap: '20px',
                    alignItems: 'center',
                    transition: 'all 0.3s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = '#e50914';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  {/* Manga Cover */}
<div style={{
  width: '80px',
  height: '120px',
  background: item.manga?.coverImage 
    ? `url(${item.manga.coverImage}) center/cover`
    : 'linear-gradient(135deg, #e50914, #b8070f)',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  fontSize: '12px',
  fontWeight: 'bold',
  textAlign: 'center',
  padding: '8px',
  backgroundSize: 'cover',
  backgroundPosition: 'center'
}}>
  {!item.manga?.coverImage && <Book size={32} />}
</div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <h3 style={{
  fontSize: '18px',
  fontWeight: 'bold',
  marginBottom: '8px'
}}>
  {item.manga?.title || 'Unknown Manga'}
</h3>
<p style={{
  color: '#e50914',
  fontSize: '14px',
  marginBottom: '12px'
}}>
  Chapter {getChapterLabel(item)}{item.chapter?.title ? `: ${item.chapter.title}` : ''}
</p>
                    
                    {/* Progress Bar */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        fontSize: '12px',
                        color: '#888'
                      }}>
                        <span>Page {item.currentPage} of {item.totalPages}</span>
                        <span>{progress}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '4px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${progress}%`,
                          height: '100%',
                          background: item.isCompleted ? '#4CAF50' : '#e50914',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '13px',
                      color: '#888'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        {formatDate(item.lastReadAt)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        continueReading(item);
                      }}
                      style={{
                        padding: '10px 24px',
                        background: '#e50914',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#b8070f';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#e50914';
                      }}
                    >
                      {item.isCompleted ? 'Read Again' : 'Continue'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item);
                      }}
                      style={{
                        padding: '8px',
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        color: '#888',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = '#e50914';
                        e.target.style.color = '#e50914';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        e.target.style.color = '#888';
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}