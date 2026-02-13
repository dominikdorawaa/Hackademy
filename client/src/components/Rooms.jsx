import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API_URL from '../apiConfig';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopRooms = async () => {
      try {
        const response = await fetch(`${API_URL}/api/rooms/top3`);
        if (response.ok) {
          const data = await response.json();
          setRooms(data);
        } else {
          console.error('Failed to fetch top rooms');
        }
      } catch (error) {
        console.error('Error fetching top rooms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopRooms();
  }, []);

  const difficultyClass = (difficulty) => {
    switch (difficulty) {
      case 'EASY': return 'diff-easy';
      case 'MEDIUM': return 'diff-medium';
      case 'HARD': return 'diff-hard';
      case 'INSANE': return 'diff-insane';
      default: return 'diff-easy';
    }
  };

  const difficultyTranslation = (difficulty) => {
    switch (difficulty) {
      case 'EASY': return 'Łatwy';
      case 'MEDIUM': return 'Średni';
      case 'HARD': return 'Trudny';
      case 'INSANE': return 'Niemożliwy';
      default: return 'Łatwy';
    }
  };

  return (
    <section className="rooms-showcase" id="rooms">
      <div className="container">
        <h2 className="section-title">Przegląd Pokoi</h2>
        <p className="section-subtitle">
          Zobacz, nad czym pracują inni. Zarejestruj się, aby uzyskać dostęp.
        </p>

        <div className="rooms-grid">
          {loading ? (
            <p style={{ color: 'var(--text-gray)', textAlign: 'center', width: '100%' }}>Ładowanie pokoi...</p>
          ) : rooms.length > 0 ? (
            rooms.map((room) => (
              <Link key={room.id} to="/register" className="room-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                <div className="room-top-badge"><i className="fas fa-lock"></i></div>
                <div className="room-image-placeholder">
                  <span className={`difficulty-badge ${difficultyClass(room.difficulty)}`}>
                    {difficultyTranslation(room.difficulty)}
                  </span>
                </div>
                <div className="room-body">
                  <h3 className="room-title">{room.title}</h3>
                  <div className="room-tags">{room.category} • Security</div>

                  <div className="room-locked-footer">
                    <span className="lock-info">
                      <i className="fas fa-user-lock"></i> Wymagane konto
                    </span>
                    <span>{room.solutionsCount} rozwiązań</span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            // Fallback if no rooms found (or DB empty)
            <p style={{ color: 'var(--text-gray)', textAlign: 'center', width: '100%' }}>Brak dostępnych pokoi.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default Rooms;
