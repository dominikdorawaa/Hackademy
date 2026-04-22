import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';

const PathsPage = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/api/paths`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          logout();
          navigate('/login');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch paths');
        const data = await res.json();
        setPaths(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError('Nie udało się pobrać ścieżek.');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchPaths();
  }, [token, logout, navigate]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1>Ścieżki</h1>
        <p style={{ color: 'var(--text-gray)' }}>Ładowanie...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1>Ścieżki</h1>
        <p style={{ color: 'var(--text-gray)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <header className="rooms-header">
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Ścieżki</h1>
          <p className="results-count">Dostępne: {paths.length}</p>
        </div>
      </header>

      <div className="rooms-grid">
        {paths.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)', backgroundColor: '#1e1e1e', borderRadius: '12px' }}>
            <h3>Brak ścieżek.</h3>
          </div>
        ) : (
          paths.map((p) => (
            <div
              key={p.id}
              className="room-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/learn/paths/${p.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/learn/paths/${p.id}`);
                }
              }}
            >
              <div className="room-image-placeholder">
                <span className="difficulty-badge diff-medium" style={{ background: 'rgba(11, 99, 255, 0.15)', color: 'var(--primary-blue)' }}>
                  {p.roomsCount ?? 0} pokoi
                </span>
              </div>
              <div className="room-body">
                <div className="room-title">{p.title}</div>
                <div className="room-tags">{p.description || '—'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PathsPage;

