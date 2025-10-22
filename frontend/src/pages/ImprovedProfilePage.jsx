import React, { useState, useEffect } from 'react';
import { Settings, BookOpen, Heart, Clock } from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ImprovedProfilePage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [continueReading, setContinueReading] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        
        // Fetch reading stats
        const statsResponse = await axios.get('/api/auth/reading-stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(statsResponse.data);

        // Fetch continue reading list
        const continueReadingResponse = await axios.get('/api/auth/continue-reading', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setContinueReading(continueReadingResponse.data.continueReading || []);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfileData();
    }
  }, [token]);

  const handleEditProfile = () => {
    navigate('/edit-profile');
  };

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#141414'
      }}>
        <p style={{ color: 'white' }}>Please log in to view your profile</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#141414',
      color: 'white',
      paddingTop: '80px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px'
      }}>
        {/* Header Section with Banner and Profile Photo */}
        <div style={{
          position: 'relative',
          marginBottom: '48px'
        }}>
          {/* Banner */}
          <div style={{
            height: '300px',
            background: user.bannerPhoto 
              ? `url(${user.bannerPhoto}) center/cover`
              : 'linear-gradient(to right, #e50914, #b20710)',
            borderRadius: '16px',
            marginBottom: '-80px',
            position: 'relative'
          }}>
            {/* Edit Profile Button */}
            <button
              onClick={handleEditProfile}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              <Settings style={{ width: '16px', height: '16px' }} />
              Edit Profile
            </button>
          </div>

          {/* Profile Info */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '24px',
            paddingLeft: '32px',
            position: 'relative',
            zIndex: 1
          }}>
            {/* Profile Photo */}
            <div style={{
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              border: '4px solid #141414',
              background: user.profilePhoto 
                ? `url(${user.profilePhoto}) center/cover`
                : 'linear-gradient(135deg, #e50914, #b20710)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '64px',
              fontWeight: 'bold',
              color: 'white'
            }}>
              {!user.profilePhoto && user.username?.charAt(0)?.toUpperCase()}
            </div>

            {/* User Info */}
<div style={{ flex: 1, paddingBottom: '70px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h1 style={{
                fontSize: '36px',
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                {user.username}
              </h1>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        {user.bio && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '48px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#e50914'
            }}>
              About Me
            </h3>
            <p style={{
              fontSize: '16px',
              lineHeight: '1.6',
              color: 'rgba(255, 255, 255, 0.8)',
              margin: 0
            }}>
              {user.bio}
            </p>
          </div>
        )}

        {/* Content Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '48px'
        }}>
          {/* Reading Stats */}
          {stats && (
            <>
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <BookOpen style={{ width: '24px', height: '24px', color: '#e50914' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Chapters Read</h3>
                </div>
                <p style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.totalChaptersRead || 0}</p>
                <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  {stats.completedChapters || 0} completed
                </p>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Heart style={{ width: '24px', height: '24px', color: '#e50914' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Manga Read</h3>
                </div>
                <p style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.uniqueMangaRead || 0}</p>
                <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  unique series
                </p>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Clock style={{ width: '24px', height: '24px', color: '#e50914' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Reading Time</h3>
                </div>
                <p style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.totalReadingTime || 0}</p>
                <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  minutes
                </p>
              </div>
            </>
          )}
        </div>

        {/* Continue Reading Section */}
        {continueReading.length > 0 && (
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '24px'
            }}>
              Continue Reading
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              {continueReading.slice(0, 6).map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (item.manga?._id && item.chapterNumber) {
                      navigate(`/manga/${item.manga._id}/chapter/${item.chapterNumber}`);
                    }
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.3s, border-color 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'rgba(229, 9, 20, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  <div style={{
                    height: '280px',
                    background: item.manga?.coverImage 
                      ? `url(${item.manga.coverImage}) center/cover`
                      : 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '8px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                      fontSize: '12px'
                    }}>
                      Chapter {item.chapterNumber}
                    </div>
                  </div>
                  <div style={{ padding: '12px' }}>
                    <h3 style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.manga?.title}
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                      Page {item.currentPage || 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          marginBottom: '48px'
        }}>
          <button
            onClick={() => navigate('/favorites')}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(229, 9, 20, 0.5)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Heart style={{ width: '24px', height: '24px', color: '#e50914' }} />
            <span style={{ fontSize: '16px', fontWeight: '500' }}>View Favorites</span>
          </button>

          <button
            onClick={() => navigate('/reading-history')}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(229, 9, 20, 0.5)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Clock style={{ width: '24px', height: '24px', color: '#e50914' }} />
            <span style={{ fontSize: '16px', fontWeight: '500' }}>Reading History</span>
          </button>
        </div>
      </div>
    </div>
  );
}