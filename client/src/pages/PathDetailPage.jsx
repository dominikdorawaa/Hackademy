import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';
import './PathDetailPage.css';

const PathDetailPage = () => {
  const { id } = useParams();
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPath = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/api/paths/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          logout();
          navigate('/login');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch path');
        const data = await res.json();
        setPath(data);
      } catch (e) {
        console.error(e);
        setError('Nie udało się pobrać ścieżki.');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchPath();
  }, [token, id, logout, navigate]);

  if (loading) return <div className="container" style={{ paddingTop: '40px' }}>Ładowanie ścieżki...</div>;
  if (error) return <div className="container" style={{ paddingTop: '40px' }}>Błąd: {error}</div>;
  if (!path) return <div className="container" style={{ paddingTop: '40px' }}>Nie znaleziono ścieżki</div>;

  const rooms = Array.isArray(path.rooms) ? path.rooms : [];
  // Hero section removed intentionally; keep only rooms list.

  return (
    <div className="container path-detail" style={{ paddingTop: '32px', paddingBottom: '40px' }}>
      <button onClick={() => navigate('/learn')} className="back-btn">
        &larr; Wróć do ścieżek
      </button>

      <section id="pd-rooms" className="pd-list">
        <div className="pd-list-header">
          <h2>Pokoje w ścieżce</h2>
          <span className="pd-muted">Ułóż progres i przechodź krok po kroku.</span>
        </div>

        <div className="pd-steps">
          {rooms.map((r, idx) => {
            const status = r.locked ? 'locked' : r.solved ? 'done' : 'todo';
            const statusLabel = r.locked ? 'Zablokowane' : r.solved ? 'Ukończone' : 'Do zrobienia';

            return (
              <div key={r.id} className={`pd-step ${status}`}>
                <div className="pd-step-left">
                  <div className={`pd-step-dot ${status}`}>
                    {status === 'done' ? <i className="fas fa-check" /> : status === 'locked' ? <i className="fas fa-lock" /> : idx + 1}
                  </div>
                  <div className="pd-step-line" />
                </div>

                <div className="pd-step-card">
                  <div className="pd-step-top">
                    <div className="pd-step-title">{r.title}</div>
                    <div className="pd-step-tags">
                      {r.requiresVpn && <span className="pd-tag">VPN</span>}
                    </div>
                  </div>

                  <div className="pd-step-desc">{r.shortDescription || r.description || '—'}</div>

                  <div className="pd-step-bottom">
                    <div className="pd-step-meta">
                      <span className={`pd-status ${status}`}>{statusLabel}</span>
                      <span className="pd-muted">{r.points} XP</span>
                    </div>
                    <button
                      className={`btn ${r.locked ? 'btn-outline' : 'btn-primary'}`}
                      disabled={r.locked}
                      onClick={() => navigate(`/rooms/${r.id}`)}
                      style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                    >
                      {r.solved ? 'Powtórz' : 'Start'} <i className="fas fa-arrow-right" style={{ marginLeft: '8px' }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default PathDetailPage;

