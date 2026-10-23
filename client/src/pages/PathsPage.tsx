import * as pathApi from '../services/pathApi';
import API_URL from '../apiConfig';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Layers, TerminalSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../components/room/room.css';
import '../components/learn/learn.css';
import './PathsPage.css';
import { LoadingSkeleton, Skeleton, SkeletonText } from '../components/common/Skeleton';
import PathArt from '../components/learn/PathArt';
import DyzurZeroBanner from '../components/learn/DyzurZeroBanner';
import { plural, ROOMS } from '../lib/plural';
import type { PathSummaryDto } from '../types/api';

const UkosPathCard = ({ p }: { p: PathSummaryDto }) => (
  <Link to="/learn/ukos" className="path-card path-card--zero px-frame">
    <DyzurZeroBanner className="path-card-media" />
    <div className="path-card-main">
      <div className="path-card-body">
        <p className="path-card-kicker"><TerminalSquare aria-hidden="true" />Prawdziwy terminal w przeglądarce</p>
        <h2 className="path-card-title"><span className="path-card-cursor" aria-hidden="true" />{p.title}</h2>
        <p className="path-card-desc">{p.description}</p>
      </div>
      <div className="path-card-footer">
        <span className="room-chip">Bash, nano i pliki</span>
        <span className="path-card-go">Otwórz ścieżkę<ChevronRight aria-hidden="true" /></span>
      </div>
    </div>
  </Link>
);

const resolveBannerSrc = (p: PathSummaryDto) => {
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

const PathCard = ({ p, onOpen, onEnroll }: { p: PathSummaryDto; onOpen: () => void; onEnroll: (e: React.MouseEvent) => void }) => {
  const [inView, setInView] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="path-card px-frame"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <PathArt seed={p.id} src={inView ? resolveBannerSrc(p) : null} className="path-card-media">
        {p.enrolled && <span className="path-card-flag"><Check aria-hidden="true" />Zapisany</span>}
      </PathArt>
      <div className="path-card-main">
        <div className="path-card-body">
          <h2 className="path-card-title"><span className="path-card-cursor" aria-hidden="true" />{p.title}</h2>
          <p className="path-card-desc">{p.description || 'Opis tej ścieżki pojawi się wkrótce.'}</p>
        </div>
        <div className="path-card-footer">
          <span className="room-chip"><Layers aria-hidden="true" />{plural(p.roomsCount ?? 0, ROOMS)}</span>
          {p.enrolled ? (
            <span className="path-card-go">Otwórz<ChevronRight aria-hidden="true" /></span>
          ) : (
            <button type="button" className="room-btn room-btn--primary room-btn--small" onClick={onEnroll}>Dołącz</button>
          )}
        </div>
      </div>
    </div>
  );
};

const PathsPage = () => {
  const { sessionKey, logout } = useAuth();
  const navigate = useNavigate();

  const [paths, setPaths] = useState<PathSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await pathApi.getPaths({ sessionKey });
        if (res.status === 401) {
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

    if (sessionKey) fetchPaths();
  }, [sessionKey, logout, navigate]);

  const handleEnroll = async (e: React.MouseEvent, pathId: number) => {
    e.stopPropagation();
    try {
      const res = await pathApi.enroll(pathId, { sessionKey });
      if (res.ok) {
        setPaths(current => current.map(p => p.id === pathId ? { ...p, enrolled: true } : p));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const header = (count: React.ReactNode, tour?: string) => (
    <header className="paths-head" data-tour={tour}>
      <div>
        <h1 className="learn-title">Ścieżki</h1>
        <p className="paths-lead">Każda ścieżka to seria pokoi do przejścia po kolei. Wybierz jedną i zacznij od pierwszego.</p>
      </div>
      <p className="paths-count">{count}</p>
    </header>
  );

  if (loading) {
    return (
      <div className="room-tokens learn-page paths-page">
        {header(<Skeleton width={110} />, 'learn')}
        <LoadingSkeleton label="Ładowanie ścieżek" className="paths-grid">
          {[0, 1, 2].map(index => <div key={index} className="path-card px-frame" aria-hidden="true">
            <div className="path-art path-card-media" />
            <div className="path-card-main">
              <div className="path-card-body hk-skeleton-stack">
                <Skeleton width="70%" height={26} />
                <SkeletonText lines={2} />
              </div>
              <div className="path-card-footer"><Skeleton width={90} height={26} radius={4} /><Skeleton width={72} height={34} radius={4} /></div>
            </div>
          </div>)}
        </LoadingSkeleton>
      </div>
    );
  }

  if (error) {
    return (
      <div className="room-tokens learn-page paths-page">
        {header(null)}
        <div className="paths-empty px-frame" role="alert">
          <p>{error}</p>
          <button type="button" className="room-btn room-btn--small" onClick={() => window.location.reload()}>Odśwież stronę</button>
        </div>
      </div>
    );
  }

  const ordered = [...paths].sort((a, b) => Number(b.systemKey === 'ukos') - Number(a.systemKey === 'ukos'));

  return (
    <div className="room-tokens learn-page paths-page">
      {header(`Dostępne: ${paths.length}`)}

      <div className="paths-grid" data-tour="learn-paths">
        {paths.length === 0 ? (
          <div className="paths-empty px-frame">
            <p>Nie ma jeszcze żadnej ścieżki. Zajrzyj tu wkrótce.</p>
          </div>
        ) : (
          ordered.map((p) => (p.systemKey === 'ukos'
            ? <UkosPathCard key={p.id} p={p} />
            : <PathCard key={p.id} p={p} onOpen={() => navigate(`/learn/paths/${p.id}`)} onEnroll={(e) => void handleEnroll(e, p.id)} />))
        )}
      </div>
    </div>
  );
};

export default PathsPage;
