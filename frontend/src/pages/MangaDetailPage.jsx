// Create a new file: frontend/src/pages/MangaDetailPage.jsx
import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function MangaDetailPage() {
  const { mangaId } = useParams();
  const [manga, setManga] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchManga = async () => {
      try {
        const response = await axios.get(`/api/manga/${mangaId}`);
        setManga(response.data);
      } catch (error) {
        console.error('Error fetching manga:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchManga();
  }, [mangaId]);

  if (loading) return <div>Loading...</div>;
  if (!manga) return <div>Manga not found</div>;

  return (
    <div>
      <h1>{manga.title}</h1>
      <img src={manga.coverImage} alt={manga.title} />
      <p>{manga.description}</p>
      {/* Add more manga details and chapter list */}
    </div>
  );
}