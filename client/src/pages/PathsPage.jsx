import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';
import './PathsPage.css';

const PathsPage = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolveBannerSrc = (p) => {
    if (!p) return null;
    // Prefer external URL if provided; otherwise use DB banner endpoint lazily.
    const bannerUrl = p.bannerUrl;
    if (bannerUrl) {
      const s = String(bannerUrl);
      if (s.startsWith('http://') || s.startsWith('https://')) return s;
      if (s.startsWith('/')) return `${API_URL}${s}`;
      return `${API_URL}/${s}`;
    }
    if (p.hasBanner) return `${API_URL}/api/paths/${p.id}/banner`;
    return null;
  };

  const PathCard = ({ p }) => {
    const [inView, setInView] = useState(false);
    const ref = React.useRef(null);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          const e = entries[0];
          if (e?.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        },
        { rootMargin: '200px' }
      );
      io.observe(el);
      return () => io.disconnect();
    }, []);

    const src = inView ? resolveBannerSrc(p) : null;

    return (
      <div
        ref={ref}
        key={p.id}
        className="path-card"
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
        <div className="path-card-media">{src ? <img src={src} alt="" loading="lazy" /> : null}</div>
        <div className="path-card-body">
          <div className="path-card-kicker">COURSE</div>
          <div className="path-card-title">{p.title}</div>
          <p className="path-card-desc">{p.description || '—'}</p>
        </div>
        <div className="path-card-footer">
          <div className="path-pill">
            <span className="path-pill-dot">
              <i className="fas fa-layer-group" />
            </span>
            {p.roomsCount ?? 0} pokoi
          </div>
          <div className="path-pill-sub">BEGINNER</div>
        </div>
      </div>
    );
  };

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
    <div className="container paths-wrap">
      <header className="paths-header">
        <div>
          <h1 className="paths-title">Ścieżki</h1>
          <p className="paths-count">Dostępne: {paths.length}</p>
        </div>
      </header>

      <div className="paths-grid">
        {paths.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)', backgroundColor: '#1e1e1e', borderRadius: '12px' }}>
            <h3>Brak ścieżek.</h3>
          </div>
        ) : (
          paths.map((p) => (
            <PathCard key={p.id} p={p} />
          ))
        )}
      </div>
    </div>
  );
};

export default PathsPage;

